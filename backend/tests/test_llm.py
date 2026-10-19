import asyncio
import json

import httpx
import pytest

from app.config import settings
from app.database import SessionLocal
from app.models.llm_call import LlmCall
from app.models.user import User, UserRole
from app.services.llm import claude_bridge, gateway

# -- bridge client --------------------------------------------------------------


def _bridge_transport(lines: list[dict], status: int = 200):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer dev-bridge-token"
        body = "".join(json.dumps(line) + "\n" for line in lines)
        return httpx.Response(status, text=body)

    return httpx.MockTransport(handler)


async def _collect(transport, usage=None):
    return [
        chunk
        async for chunk in claude_bridge.stream_text("s", "p", usage=usage, transport=transport)
    ]


def test_bridge_client_yields_text_until_done():
    transport = _bridge_transport(
        [
            {"type": "start"},
            {"type": "text", "text": "ab"},
            {"type": "text", "text": "c"},
            {"type": "done"},
        ]
    )
    assert asyncio.run(_collect(transport)) == ["ab", "c"]


def test_bridge_client_errors():
    with pytest.raises(claude_bridge.BridgeError, match="Not logged in"):
        asyncio.run(_collect(_bridge_transport([{"type": "error", "message": "Not logged in"}])))
    with pytest.raises(claude_bridge.BridgeError, match="busy"):
        asyncio.run(_collect(_bridge_transport([], status=503)))
    with pytest.raises(claude_bridge.BridgeError, match="early"):
        asyncio.run(_collect(_bridge_transport([{"type": "text", "text": "a"}])))

    def refuse(request):
        raise httpx.ConnectError("refused")

    with pytest.raises(claude_bridge.BridgeOfflineError):
        asyncio.run(_collect(httpx.MockTransport(refuse)))


def test_bridge_client_fills_usage():
    usage = {}
    transport = _bridge_transport(
        [
            {"type": "text", "text": "a"},
            {
                "type": "done",
                "duration_ms": 5,
                "cost_usd": 0.01,
                "usage": {
                    "input_tokens": 1,
                    "output_tokens": 2,
                    "cache_read_tokens": 3,
                    "cache_write_tokens": 4,
                },
            },
        ]
    )
    chunks = asyncio.run(_collect(transport, usage=usage))
    assert chunks == ["a"]
    assert usage == {
        "input_tokens": 1,
        "output_tokens": 2,
        "cache_read_tokens": 3,
        "cache_write_tokens": 4,
        "cost_usd": 0.01,
        "duration_ms": 5,
    }


# -- gateway --------------------------------------------------------------------


def fake_with_usage(chunks, usage_values, error=None):
    async def stream_text(system, prompt, *, usage=None, **kwargs):
        for chunk in chunks:
            yield chunk
        if error:
            raise error
        if usage is not None:
            usage.update(usage_values)

    return stream_text


USAGE = {
    "input_tokens": 120,
    "output_tokens": 40,
    "cache_read_tokens": 100,
    "cache_write_tokens": 0,
    "cost_usd": 0.002,
    "duration_ms": 50,
}


async def _drain(stream):
    return [chunk async for chunk in stream]


def test_gateway_streams_and_logs_usage(monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", fake_with_usage(["ab", "c"], USAGE))

    chunks = asyncio.run(
        _drain(gateway.stream_text("board_teacher", "s", "p", session_id="sess-1"))
    )

    assert chunks == ["ab", "c"]
    with SessionLocal() as db:
        call = db.query(LlmCall).one()
    assert (
        call.agent,
        call.status,
        call.provider,
        call.model,
        call.input_tokens,
        call.output_tokens,
        call.cache_read_tokens,
        call.session_id,
        call.user_id,
    ) == ("board_teacher", "ok", "claude_bridge", "sonnet", 120, 40, 100, "sess-1", None)
    assert float(call.cost_usd) == pytest.approx(0.002)
    assert call.duration_ms == 50


def test_gateway_logs_failed_calls(monkeypatch):
    error = claude_bridge.BridgeError("exit 1")
    monkeypatch.setattr(claude_bridge, "stream_text", fake_with_usage(["a"], USAGE, error=error))

    with pytest.raises(claude_bridge.BridgeError):
        asyncio.run(_drain(gateway.stream_text("board_teacher", "s", "p")))

    with SessionLocal() as db:
        call = db.query(LlmCall).one()
    assert call.status == "error" and call.output_tokens == 0


def test_gateway_rejects_unknown_provider(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "nope")

    with pytest.raises(gateway.LlmConfigError, match="nope"):
        asyncio.run(_drain(gateway.stream_text("board_teacher", "s", "p")))

    with SessionLocal() as db:
        assert db.query(LlmCall).count() == 0


def test_agent_config_for_the_board_teacher():
    assert gateway.agent_config("board_teacher") == gateway.AgentConfig(
        model=settings.whiteboard_model, effort=settings.whiteboard_effort
    )
    with pytest.raises(gateway.LlmConfigError):
        gateway.agent_config("nobody")


def test_doubt_stream_logs_one_llm_call(signed_in, monkeypatch):
    script = '{"type":"caption","text":"Hi"}\n'
    monkeypatch.setattr(claude_bridge, "stream_text", fake_with_usage([script], USAGE))
    student = signed_in("s@example.com", UserRole.STUDENT)

    response = student.post("/api/v1/student/doubts", json={"question": "What is a prime?"})
    doubt_id = response.text.split('"id": "')[1].split('"')[0]

    with SessionLocal() as db:
        call = db.query(LlmCall).one()
        user = db.query(User).filter_by(email="s@example.com").one()
    assert call.user_id == user.id and call.session_id == doubt_id
    assert call.status == "ok" and call.output_tokens == 40


def test_every_doubt_agent_has_a_config():
    for agent in ("doubt_solver", "examiner", "board_teacher"):
        assert isinstance(gateway.agent_config(agent), gateway.AgentConfig)
    with pytest.raises(gateway.LlmConfigError):
        gateway.agent_config("nobody")
