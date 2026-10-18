import asyncio
import json

import httpx
import pytest

from app.services.llm import claude_bridge

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
