# =============================================================================
# LLM gateway — the single way the app calls a model. Picks the provider and
# the per-agent model settings, and logs every call's token use in llm_calls.
# =============================================================================

import asyncio
import logging
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass

from app.config import settings
from app.database import SessionLocal
from app.repositories import llm_call_repository
from app.services.llm import claude_bridge

logger = logging.getLogger("leen_ai")

PROVIDERS = ("claude_bridge",)
TOKEN_FIELDS = ("input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens")


class LlmConfigError(Exception):
    """The configured provider or agent is not usable."""


@dataclass(frozen=True)
class AgentConfig:
    model: str | None
    effort: str | None


def agent_config(agent: str) -> AgentConfig:
    configs = {
        "board_teacher": AgentConfig(settings.whiteboard_model, settings.whiteboard_effort),
    }
    return configs[agent]


def _record(agent: str, config: AgentConfig, status: str, usage: dict, elapsed_ms: int, **ids):
    try:
        with SessionLocal() as db:
            llm_call_repository.create(
                db,
                agent=agent,
                provider=settings.llm_provider,
                model=config.model,
                status=status,
                duration_ms=usage.get("duration_ms") or elapsed_ms,
                cost_usd=usage.get("cost_usd"),
                **{field: usage.get(field) or 0 for field in TOKEN_FIELDS},
                **ids,
            )
            db.commit()
    except Exception:  # noqa: BLE001 - logging usage must never break a lesson
        logger.exception("Could not record the %s LLM call", agent)


async def stream_text(
    agent: str,
    system: str,
    prompt: str,
    *,
    user_id: str | None = None,
    session_id: str | None = None,
    usage: dict | None = None,
) -> AsyncIterator[str]:
    """Yield text deltas for `agent`, then log the call with its token use.

    Pass `usage` to also receive the token counts, cost and duration when the call ends.
    """
    if settings.llm_provider not in PROVIDERS:
        raise LlmConfigError(f"Unknown LLM provider: {settings.llm_provider}")
    config = agent_config(agent)
    usage = {} if usage is None else usage
    status = "error"
    started = time.monotonic()
    try:
        async for chunk in claude_bridge.stream_text(
            system, prompt, model=config.model, effort=config.effort, usage=usage
        ):
            yield chunk
        status = "ok"
    except (GeneratorExit, asyncio.CancelledError):
        status = "cancelled"
        raise
    finally:
        elapsed_ms = int((time.monotonic() - started) * 1000)
        _record(agent, config, status, usage, elapsed_ms, user_id=user_id, session_id=session_id)
