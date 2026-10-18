# =============================================================================
# Whiteboard Service — student doubts explained live on a whiteboard by the AI
# =============================================================================

import asyncio
import hashlib
import json
import logging
from collections.abc import AsyncIterator
from typing import NamedTuple

import anyio
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.database import SessionLocal
from app.models.board import BoardSession
from app.models.profile import StudentProfile
from app.models.user import User, utcnow
from app.repositories import board_repository, profile_repository
from app.schemas.whiteboard import DoubtCreate, DoubtOut, DoubtSummary, TurnCreate, TurnOut
from app.services.llm import claude_bridge, gateway
from app.services.whiteboard.parser import ActionStreamParser
from app.services.whiteboard.prompt import build_prompt
from app.services.whiteboard.summary import summarize_board

logger = logging.getLogger("leen_ai")

NOT_FOUND = "Doubt not found"
MAX_TURNS = 6
BUSY = "Wait for the current explanation to finish."
FULL = "This board is full. Start a new doubt to keep going."
INTERRUPTED = "Interrupted before the explanation finished."
STALE_MARGIN_SECONDS = 60
KEEPALIVE_SECONDS = 15
OFFLINE_DEV = (
    "The AI tutor is offline. Start the Claude Code bridge "
    "(python3 infrastructure/claude-bridge/claude_bridge.py) and try again."
)
OFFLINE = "The AI tutor is offline right now. Please try again in a little while."
FAILED = "The AI tutor ran into a problem. Please try again."
EMPTY = "The AI tutor couldn't draw an explanation for that. Try asking in a different way."
STOPPED = "Stopped before the explanation finished."


def _summary(session: BoardSession) -> DoubtSummary:
    return DoubtSummary(
        id=session.id,
        question=session.title,
        subject=session.subject,
        status=session.status,
        created_at=session.created_at,
    )


def _opens_with_scene(actions: list[dict]) -> bool:
    """True when the model started the turn on a new page itself (captions may come first)."""
    first = next((action for action in actions if action.get("type") != "caption"), None)
    return first is not None and first.get("type") == "scene"


def flatten_turns(turns: list[dict]) -> list[dict]:
    """All turns' actions in order; each follow-up turn starts on a new page (scene)."""
    actions: list[dict] = []
    for index, turn in enumerate(turns):
        turn_actions = turn.get("actions") or []
        if index and not _opens_with_scene(turn_actions):
            actions.append({"type": "scene", "title": turn["question"][:60]})
        actions.extend(turn_actions)
    return actions


def _owned(db: Session, student: User, doubt_id: str, lock: bool = False) -> BoardSession:
    session = board_repository.get_owned_session(db, doubt_id, student.id, lock=lock)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    return session


def list_doubts(db: Session, student: User) -> list[DoubtSummary]:
    return [_summary(session) for session in board_repository.list_sessions(db, student.id)]


def get_doubt(db: Session, student: User, doubt_id: str) -> DoubtOut:
    session = _owned(db, student, doubt_id)
    turns = [event.payload for event in board_repository.list_turns(db, session.id)]
    return DoubtOut(
        **_summary(session).model_dump(),
        actions=flatten_turns(turns),
        turns=[
            TurnOut(
                question=turn["question"],
                mode=turn.get("mode", "ask"),
                status=turn.get("status", "complete"),
                count=len(turn.get("actions") or []),
            )
            for turn in turns
        ],
        error=session.error,
        completed_at=session.completed_at,
    )


def delete_doubt(db: Session, student: User, doubt_id: str) -> None:
    board_repository.delete_session(db, _owned(db, student, doubt_id))
    db.commit()


def _new_turn(question: str, mode: str) -> dict:
    return {
        "question": question,
        "mode": mode,
        "actions": [],
        "status": "streaming",
        "error": None,
        "cached": False,
    }


class TurnStart(NamedTuple):
    """What the endpoint needs to stream a turn: from the model, or from the cache."""

    doubt: DoubtSummary
    event_id: str
    system: str | None
    prompt: str | None
    cached_actions: list[dict] | None = None


def cache_key(question: str, subject: str | None, profile: StudentProfile | None) -> str:
    normal = " ".join(question.casefold().split()).rstrip("?.! ")
    parts = [
        normal,
        (subject or "").casefold().strip(),
        str(profile.grade or "") if profile else "",
        (profile.board or "") if profile else "",
        (profile.learning_level or "") if profile else "",
        (profile.preferred_language or "") if profile else "",
    ]
    return hashlib.sha256("|".join(parts).encode()).hexdigest()


def start_doubt(db: Session, student: User, payload: DoubtCreate) -> TurnStart:
    """Record the doubt and its first turn, and build the prompts.

    An identical doubt from a student with the same profile is copied from the
    earlier board instead (no model call). The board itself is streamed separately.
    """
    profile = profile_repository.get(db, student.id)
    key = cache_key(payload.question, payload.subject, profile)
    cached = board_repository.find_cached_turn(db, key) if settings.board_cache_enabled else None

    session = board_repository.create_session(
        db,
        student_id=student.id,
        title=payload.question,
        subject=payload.subject,
        model=gateway.agent_config("board_teacher").model,
        cache_key=key,
    )
    turn = _new_turn(payload.question, "ask")
    if cached is not None:
        actions = list(cached.payload["actions"])
        turn.update(actions=actions, status="complete", cached=True)
        session.status = "complete"
        session.completed_at = utcnow()
    event = board_repository.add_turn(db, session, turn)
    db.commit()

    if cached is not None:
        return TurnStart(_summary(session), event.id, None, None, actions)
    system, prompt = build_prompt(payload.question, payload.subject, profile)
    return TurnStart(_summary(session), event.id, system, prompt)


def _is_stale(turn) -> bool:
    age = (utcnow() - turn.created_at).total_seconds()
    return age > settings.whiteboard_timeout_seconds + STALE_MARGIN_SECONDS


def start_turn(db: Session, student: User, doubt_id: str, payload: TurnCreate) -> TurnStart:
    """Add a follow-up (or "explain another way") turn to a doubt's board."""
    session = _owned(db, student, doubt_id, lock=True)
    turns = board_repository.list_turns(db, session.id)
    if turns and turns[-1].payload.get("status") == "streaming":
        if not _is_stale(turns[-1]):
            raise HTTPException(status.HTTP_409_CONFLICT, BUSY)
        # Its stream died without saving (a restart or crash): close it so the board isn't stuck.
        turns[-1].payload = {**turns[-1].payload, "status": "failed", "error": INTERRUPTED}
    if len(turns) >= MAX_TURNS:
        raise HTTPException(status.HTTP_409_CONFLICT, FULL)

    question = payload.question if payload.mode == "follow_up" else session.title
    context = summarize_board(flatten_turns([turn.payload for turn in turns]))
    profile = profile_repository.get(db, student.id)
    event = board_repository.add_turn(db, session, _new_turn(question, payload.mode))
    session.status = "streaming"
    session.error = None
    db.commit()

    system, prompt = build_prompt(
        question, session.subject, profile, context=context, mode=payload.mode
    )
    return TurnStart(_summary(session), event.id, system, prompt)


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _save_result(event_id: str, actions: list[dict], error: str | None) -> None:
    with SessionLocal() as db:
        turn = board_repository.get_event(db, event_id)
        if turn is None:  # deleted while streaming
            return
        status_ = "failed" if error else "complete"
        turn.payload = {**turn.payload, "actions": actions, "status": status_, "error": error}
        session = board_repository.get_session(db, turn.session_id)
        session.status = status_
        session.error = error[:300] if error else None
        session.completed_at = utcnow()
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
    doubt: DoubtSummary, event_id: str, system: str, prompt: str, student_id: str
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
            await run_in_threadpool(_save_result, event_id, actions, error)

    if error:
        yield _sse("error", {"message": error})
    else:
        yield _sse("done", {"id": doubt.id, "count": len(actions)})


async def stream_cached(doubt: DoubtSummary, actions: list[dict]) -> AsyncIterator[str]:
    """The same events as stream_solution, for a board copied from the cache."""
    yield _sse("doubt", doubt.model_dump(mode="json"))
    for action in actions:
        yield _sse("action", action)
    yield _sse("done", {"id": doubt.id, "count": len(actions)})
