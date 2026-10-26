# =============================================================================
# Claude Code bridge client — streams text from `claude -p` on the host machine
# (see infrastructure/claude-bridge). To move to the Anthropic API, replace
# stream_text() with an SDK call that yields text deltas.
# =============================================================================

import base64
import json
from collections.abc import AsyncIterator, Sequence

import httpx

from app.config import settings
from app.services.llm.types import ImageInput


class BridgeOfflineError(Exception):
    """The bridge is not running or not reachable."""


class BridgeError(Exception):
    """The bridge answered but the Claude Code run failed."""


def _client(transport: httpx.AsyncBaseTransport | None = None) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=settings.claude_bridge_url,
        headers={"Authorization": f"Bearer {settings.claude_bridge_token}"},
        timeout=httpx.Timeout(settings.whiteboard_timeout_seconds, connect=5),
        transport=transport,
    )


async def stream_text(
    system: str,
    prompt: str,
    *,
    model: str | None = None,
    effort: str | None = None,
    usage: dict | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
    images: Sequence[ImageInput] = (),
) -> AsyncIterator[str]:
    """Yield text deltas as Claude writes them. `images` are sent for Claude to look at.

    When the run ends, `usage` (if given) is filled with its token counts, cost and duration.
    """
    body = {"system": system, "prompt": prompt, "model": model, "effort": effort}
    if images:
        body["images"] = [
            {"media_type": image.media_type, "data": base64.b64encode(image.data).decode()}
            for image in images
        ]
    try:
        async with (
            _client(transport) as client,
            client.stream("POST", "/v1/stream", json=body) as response,
        ):
            if response.status_code == 503:
                raise BridgeError("The AI tutor is busy with other questions. Try again shortly.")
            if response.status_code != 200:
                raise BridgeError(f"Claude Code bridge returned HTTP {response.status_code}")

            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                event = json.loads(line)
                kind = event.get("type")
                if kind == "text":
                    yield event["text"]
                elif kind == "done":
                    if usage is not None:
                        usage.update(event.get("usage") or {})
                        usage["cost_usd"] = event.get("cost_usd")
                        usage["duration_ms"] = event.get("duration_ms")
                    return
                elif kind == "error":
                    raise BridgeError(event.get("message") or "Claude Code run failed")
            raise BridgeError("The Claude Code bridge closed the stream early")
    except (httpx.ConnectError, httpx.ConnectTimeout) as error:
        raise BridgeOfflineError(str(error)) from error
    except httpx.HTTPError as error:
        raise BridgeError(f"Claude Code bridge error: {error}") from error
