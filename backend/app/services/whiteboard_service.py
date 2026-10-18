# =============================================================================
# Whiteboard Service — student doubts explained live on a whiteboard by the AI
# =============================================================================

import asyncio
import json
import logging
from collections.abc import AsyncIterator

import anyio
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.database import SessionLocal
from app.models.user import User, utcnow
from app.repositories import profile_repository, whiteboard_repository
from app.schemas.whiteboard import DoubtCreate, DoubtOut, DoubtSummary
from app.services.llm import claude_bridge, gateway
from app.services.whiteboard.parser import ActionStreamParser
from app.services.whiteboard.prompt import build_prompt

logger = logging.getLogger("leen_ai")

NOT_FOUND = "Doubt not found"
KEEPALIVE_SECONDS = 15
OFFLINE_DEV = (
    "The AI tutor is offline. Start the Claude Code bridge "
    "(python3 infrastructure/claude-bridge/claude_bridge.py) and try again."
)
OFFLINE = "The AI tutor is offline right now. Please try again in a little while."
FAILED = "The AI tutor ran into a problem. Please try again."
EMPTY = "The AI tutor couldn't draw an explanation for that. Try asking in a different way."
STOPPED = "Stopped before the explanation finished."


def list_doubts(db: Session, student: User) -> list[DoubtSummary]:
    doubts = whiteboard_repository.list_for_student(db, student.id)
    return [DoubtSummary.model_validate(doubt) for doubt in doubts]


def get_doubt(db: Session, student: User, doubt_id: str) -> DoubtOut:
    doubt = whiteboard_repository.get_owned(db, doubt_id, student.id)
    if doubt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    return DoubtOut.model_validate(doubt)


def delete_doubt(db: Session, student: User, doubt_id: str) -> None:
    doubt = whiteboard_repository.get_owned(db, doubt_id, student.id)
    if doubt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    whiteboard_repository.delete(db, doubt)
    db.commit()


def start_doubt(
    db: Session, student: User, payload: DoubtCreate
) -> tuple[DoubtSummary, str, str]:
    """Record the doubt and build its (system, user) prompts; the board is streamed separately."""
    profile = profile_repository.get(db, student.id)
    doubt = whiteboard_repository.create(
        db,
        student_id=student.id,
        question=payload.question,
        subject=payload.subject,
        model=settings.whiteboard_model,
    )
    db.commit()
    system, prompt = build_prompt(payload.question, payload.subject, profile)
    return DoubtSummary.model_validate(doubt), system, prompt


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _save_result(doubt_id: str, actions: list[dict], error: str | None) -> None:
    with SessionLocal() as db:
        doubt = whiteboard_repository.get(db, doubt_id)
        if doubt is None:  # deleted while streaming
            return
        doubt.actions = actions
        doubt.status = "failed" if error else "complete"
        doubt.error = error[:300] if error else None
        doubt.completed_at = utcnow()
        db.commit()


async def _produce(
    system: str, prompt: str, queue: asyncio.Queue, student_id: str, doubt_id: str
) -> None:
    """Pump text from the model into the queue so the consumer can send keepalives."""
    try:
        async for chunk in gateway.stream_text(
            "board_teacher", system, prompt, user_id=student_id, session_id=doubt_id
        ):
            await queue.put(("text", chunk))
        await queue.put(("end", None))
    except Exception as error:  # noqa: BLE001 - handed to the consumer to report
        await queue.put(("error", error))


def _friendly(error: Exception) -> str:
    if isinstance(error, claude_bridge.BridgeOfflineError):
        logger.warning("Claude Code bridge unreachable at %s", settings.claude_bridge_url)
        return OFFLINE_DEV if settings.is_development else OFFLINE
    logger.error("Whiteboard generation failed: %s", error)
    if isinstance(error, claude_bridge.BridgeError) and "busy" in str(error):
        return str(error)
    return FAILED


async def stream_solution(
    doubt: DoubtSummary, system: str, prompt: str, student_id: str
) -> AsyncIterator[str]:
    """Server-sent events: doubt, status, action*, then done or error.

    Actions are validated one by one as Claude writes them, so the board starts
    drawing long before the explanation is finished.
    """
    yield _sse("doubt", doubt.model_dump(mode="json"))
    yield _sse("status", {"state": "thinking"})

    parser = ActionStreamParser(settings.whiteboard_max_actions)
    actions: list[dict] = []
    error: str | None = STOPPED  # until the stream ends normally
    queue: asyncio.Queue = asyncio.Queue()
    producer = asyncio.create_task(_produce(system, prompt, queue, student_id, doubt.id))

    try:
        while True:
            try:
                kind, value = await asyncio.wait_for(queue.get(), KEEPALIVE_SECONDS)
            except TimeoutError:
                yield ": ping\n\n"
                continue

            if kind == "error":
                error = _friendly(value)
                break
            new = parser.flush() if kind == "end" else parser.feed(value)
            for action in new:
                actions.append(action)
                yield _sse("action", action)
            if kind == "end" or parser.full:
                error = None if actions else EMPTY
                break
    finally:
        producer.cancel()
        if parser.dropped:
            logger.info("Whiteboard %s: dropped %d invalid lines", doubt.id, parser.dropped)
        # Save even if the client went away mid-stream (the request scope is cancelled).
        with anyio.CancelScope(shield=True):
            await run_in_threadpool(_save_result, doubt.id, actions, error)

    if error:
        yield _sse("error", {"message": error})
    else:
        yield _sse("done", {"id": doubt.id, "count": len(actions)})
