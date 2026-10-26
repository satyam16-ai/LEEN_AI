# =============================================================================
# Whiteboard Service — student doubts explained live on a whiteboard by the AI
# =============================================================================

import asyncio
import hashlib
import json
import logging
from collections.abc import AsyncIterator, Sequence
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
from app.schemas.whiteboard import (
    AnswerCreate,
    AnswerOut,
    DoubtCreate,
    DoubtOut,
    DoubtSummary,
    TurnCreate,
    TurnOut,
)
from app.services import files
from app.services.library.retrieval import Source, format_sources, retrieve
from app.services.llm import claude_bridge, gateway
from app.services.llm.types import ImageInput
from app.services.whiteboard.grading import check_answer, display_key, prepare_ask, public_action
from app.services.whiteboard.parser import ActionStreamParser
from app.services.whiteboard.prompt import build_prompt
from app.services.whiteboard.summary import question_context, summarize_board, summarize_plan

logger = logging.getLogger("leen_ai")

NOT_FOUND = "Doubt not found"
MAX_TURNS = 12
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
QUESTION_NOT_FOUND = "Question not found"
UNREADABLE = "Check your answer and try again."
ANSWERED = "You've already answered this question."
MAX_TRIES = 2
PHOTO_QUESTION = "Explain and solve the question in this photo."
PHOTO_TITLE = "Question from a photo"


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


# Turns that carry on the page the student was looking at, instead of starting a new one.
CONTINUING_MODES = ("reply", "check")
# Turns run by the Examiner agent; everything else on a doubt board is the Doubt Solver's.
EXAMINER_MODES = ("check", "practice")

Answers = dict[tuple[int, str], list[dict]]


def _shown(turn: dict) -> list[dict]:
    """A turn's actions up to where a reply cut it off."""
    actions = turn.get("actions") or []
    cut = turn.get("cut_at")
    return actions[:cut] if cut is not None else actions


def flatten_turns(turns: list[dict], answers: Answers | None = None) -> list[dict]:
    """The board as the student saw it, in order.

    Cut-off parts of a turn are left out, each answer follows its question, and a new turn
    starts a new page (scene) unless it is a reply or check that carries on the same page.
    """
    actions: list[dict] = []
    for index, turn in enumerate(turns):
        turn_actions = _shown(turn)
        new_page = index and turn.get("mode") not in CONTINUING_MODES
        if new_page and not _opens_with_scene(turn_actions):
            actions.append({"type": "scene", "title": turn["question"][:60]})
        for action in turn_actions:
            actions.append(action)
            if action.get("type") == "ask" and answers:
                actions += [
                    {
                        "type": "answer",
                        "ask": action["id"],
                        "text": answer["answer"],
                        "correct": answer.get("correct"),
                    }
                    for answer in answers.get((index, action["id"]), [])
                    if answer.get("answer") is not None  # a question closed without an answer
                ]
    return actions


def _find_ask(turns: list, ask_id: str) -> tuple[int, int, dict] | None:
    """(turn index, position, ask) of the newest question `ask_id` the student has seen."""
    for index in range(len(turns) - 1, -1, -1):
        shown = _shown(turns[index].payload)
        for position, action in enumerate(shown):
            if action.get("type") == "ask" and action.get("id") == ask_id:
                return index, position, action
    return None


def _answers(events) -> Answers:
    grouped: Answers = {}
    for event in events:
        if event.kind == "answer":
            key = (event.payload["turn"], event.payload["ask"])
            grouped.setdefault(key, []).append(event.payload)
    return grouped


def _owned(db: Session, student: User, doubt_id: str, lock: bool = False) -> BoardSession:
    session = board_repository.get_owned_session(db, doubt_id, student.id, lock=lock)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    return session


def list_doubts(db: Session, student: User) -> list[DoubtSummary]:
    return [_summary(session) for session in board_repository.list_sessions(db, student.id)]


def get_doubt(db: Session, student: User, doubt_id: str) -> DoubtOut:
    session = _owned(db, student, doubt_id)
    events = board_repository.list_events(db, session.id)
    turns = [event.payload for event in events if event.kind == "turn"]
    return DoubtOut(
        **_summary(session).model_dump(),
        actions=[public_action(action) for action in flatten_turns(turns, _answers(events))],
        turns=[
            TurnOut(
                question=turn["question"],
                mode=turn.get("mode", "ask"),
                status=turn.get("status", "complete"),
                count=len(_shown(turn)),
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
    agent: str = "doubt_solver"
    # The student's pages offered to the model as numbered <sources>: {n, doc, page, title}.
    sources: tuple[dict, ...] = ()
    # A photo doubt: the photo for the model, and the image action sent before its board.
    images: tuple[ImageInput, ...] = ()
    prelude: tuple[dict, ...] = ()


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


def _retrieve(db: Session, student_id: str, query: str, subject: str | None) -> list[Source]:
    """The student's own pages for this question; a search failure never blocks a doubt."""
    try:
        return retrieve(db, student_id, query, subject=subject)
    except Exception:  # noqa: BLE001 - e.g. the embedding model failed to load
        logger.exception("Could not search the student's pages")
        return []


def _refs(sources: list[Source]) -> tuple[dict, ...]:
    return tuple(
        {"n": source.n, "doc": source.doc, "page": source.page, "title": source.title}
        for source in sources
    )


def prepare_cite(action: dict, sources: Sequence[dict]) -> dict | None:
    """Fill a cite from the turn's sources by number; None (dropped) for any other number."""
    source = next((item for item in sources if item["n"] == action.get("source")), None)
    if source is None:
        return None
    return {
        "type": "cite",
        "source": source["n"],
        "doc": source["doc"],
        "page": source["page"],
        "title": source["title"],
    }


def start_doubt(db: Session, student: User, payload: DoubtCreate) -> TurnStart:
    """Record the doubt and its first turn, and build the prompts.

    An identical doubt from a student with the same profile is copied from the
    earlier board instead (no model call). A doubt that uses the student's own pages
    is never cached, nor served from the cache. The board is streamed separately.
    """
    profile = profile_repository.get(db, student.id)
    sources = _retrieve(db, student.id, payload.question, payload.subject)
    key = None if sources else cache_key(payload.question, payload.subject, profile)
    cached = (
        board_repository.find_cached_turn(db, key) if key and settings.board_cache_enabled else None
    )

    session = board_repository.create_session(
        db,
        student_id=student.id,
        title=payload.question,
        subject=payload.subject,
        model=gateway.agent_config("doubt_solver").model,
        cache_key=key,
    )
    turn = _new_turn(payload.question, "ask")
    refs = _refs(sources)
    if refs:
        turn["sources"] = list(refs)
    if cached is not None:
        actions = list(cached.payload["actions"])
        turn.update(actions=actions, status="complete", cached=True)
        session.status = "complete"
        session.completed_at = utcnow()
    event = board_repository.add_turn(db, session, turn)
    db.commit()

    if cached is not None:
        return TurnStart(_summary(session), event.id, None, None, actions)
    system, prompt = build_prompt(
        payload.question, payload.subject, profile, sources=format_sources(sources) or None
    )
    return TurnStart(_summary(session), event.id, system, prompt, sources=refs)


def start_photo_doubt(
    db: Session, student: User, *, photo: bytes, question: str | None, subject: str | None
) -> TurnStart:
    """A doubt asked with a photo of the question. Never cached: the photo is the question."""
    stored = files.save_image(photo, "doubts")
    typed = " ".join((question or "").split())
    asked = typed or PHOTO_QUESTION
    profile = profile_repository.get(db, student.id)
    sources = _retrieve(db, student.id, typed, subject) if typed else []

    session = board_repository.create_session(
        db,
        student_id=student.id,
        title=typed or PHOTO_TITLE,
        subject=subject,
        model=gateway.agent_config("doubt_solver").model,
        cache_key=None,
    )
    turn = _new_turn(asked, "ask") | {"image": stored.name}
    refs = _refs(sources)
    if refs:
        turn["sources"] = list(refs)
    event = board_repository.add_turn(db, session, turn)
    db.commit()

    system, prompt = build_prompt(
        asked, subject, profile, sources=format_sources(sources) or None, photo=True
    )
    image = {"type": "image", "src": "photo", "url": f"/api/v1/student/doubts/{session.id}/photo"}
    return TurnStart(
        _summary(session),
        event.id,
        system,
        prompt,
        sources=refs,
        images=(ImageInput(stored.media_type, files.read_bytes(stored.name)),),
        prelude=(image,),
    )


def photo_path(db: Session, student: User, doubt_id: str):
    """The stored photo of the student's photo doubt; 404 for any other doubt."""
    session = _owned(db, student, doubt_id)
    turns = board_repository.list_turns(db, session.id)
    name = turns[0].payload.get("image") if turns else None
    if not name:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    path = files.path_of(name)
    if not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    return path


def _is_stale(turn) -> bool:
    age = (utcnow() - turn.created_at).total_seconds()
    return age > settings.whiteboard_timeout_seconds + STALE_MARGIN_SECONDS


def start_turn(db: Session, student: User, doubt_id: str, payload: TurnCreate) -> TurnStart:
    """Add a turn to a doubt's board: a follow-up or reply, another way, a check or practice."""
    session = _owned(db, student, doubt_id, lock=True)
    turns = board_repository.list_turns(db, session.id)
    if turns and turns[-1].payload.get("status") == "streaming":
        if not _is_stale(turns[-1]):
            raise HTTPException(status.HTTP_409_CONFLICT, BUSY)
        # Its stream died without saving (a restart or crash): close it so the board isn't stuck.
        turns[-1].payload = {**turns[-1].payload, "status": "failed", "error": INTERRUPTED}
    if len(turns) >= MAX_TURNS:
        raise HTTPException(status.HTTP_409_CONFLICT, FULL)

    mode, left, message, check = payload.mode, None, None, None
    asked = payload.question if payload.mode == "follow_up" else session.title
    turn_extra: dict = {}
    if payload.mode == "check":
        found = _find_ask(turns, payload.ask)
        if found is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, QUESTION_NOT_FOUND)
        index, position, question = found
        answers = _answers(board_repository.list_events(db, session.id)).get((index, payload.ask))
        given = [a["answer"] for a in answers or [] if a.get("answer") is not None]
        context_text = question_context(_shown(turns[index].payload), position)
        check = {
            "ask": payload.ask,
            "question": context_text,
            "kind": question.get("kind"),
            "options": question.get("options"),
            "answers": given,
            "expected": display_key(question),
        }
        asked = (context_text.split("\n")[0] or session.title)[:500]
        turn_extra = {"ask": payload.ask, "ask_turn": index}
        if not any(answer.get("final") for answer in answers or []):
            # The check shows the solution, so the question is closed to later answers.
            board_repository.add_event(
                db,
                session,
                "answer",
                {
                    "turn": index,
                    "ask": payload.ask,
                    "answer": None,
                    "correct": None,
                    "attempt": len(given),
                    "final": True,
                },
            )
    if payload.keep is not None and turns and payload.mode in ("follow_up", "check"):
        # Sent mid-explanation: keep what the student has seen, answer, then teach the rest.
        latest = turns[-1]
        actions = _shown(latest.payload)
        keep = min(payload.keep, len(actions))
        latest.payload = {**latest.payload, "cut_at": keep}
        left = summarize_plan(actions[keep:]) or None
        if payload.mode == "follow_up":
            mode, message = "reply", payload.question

    context = summarize_board(flatten_turns([turn.payload for turn in turns]))
    profile = profile_repository.get(db, student.id)
    sources = []
    if payload.mode in ("follow_up", "another_way"):
        query = payload.question if payload.mode == "follow_up" else session.title
        sources = _retrieve(db, student.id, query, session.subject)
    refs = _refs(sources)
    if refs:
        turn_extra["sources"] = list(refs)
    event = board_repository.add_turn(db, session, _new_turn(asked, mode) | turn_extra)
    session.status = "streaming"
    session.error = None
    db.commit()

    question = session.title if mode in ("reply", "check") else asked
    system, prompt = build_prompt(
        question,
        session.subject,
        profile,
        context=context,
        mode=mode,
        left=left,
        message=message,
        check=check,
        sources=format_sources(sources) or None,
    )
    agent = "examiner" if mode in EXAMINER_MODES else "doubt_solver"
    return TurnStart(_summary(session), event.id, system, prompt, agent=agent, sources=refs)


def submit_answer(db: Session, student: User, doubt_id: str, payload: AnswerCreate) -> AnswerOut:
    """Check an answer in code (choice, number, expression) and record it; no model call.

    Written answers are recorded as final with `correct` unknown: a check turn by the
    Examiner judges them. An answer that can't be read doesn't cost a try.
    """
    session = _owned(db, student, doubt_id, lock=True)
    events = board_repository.list_events(db, session.id)
    turns = [event for event in events if event.kind == "turn"]
    found = _find_ask(turns, payload.ask)
    if found is None:
        if turns and turns[-1].payload.get("status") == "streaming":
            raise HTTPException(status.HTTP_409_CONFLICT, BUSY)
        raise HTTPException(status.HTTP_404_NOT_FOUND, QUESTION_NOT_FOUND)
    index, _, question = found
    earlier = _answers(events).get((index, payload.ask), [])
    if any(answer.get("final") for answer in earlier):
        raise HTTPException(status.HTTP_409_CONFLICT, ANSWERED)
    try:
        correct = check_answer(question, payload.answer)
    except ValueError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, UNREADABLE) from error

    attempt = len(earlier) + 1
    final = correct is not False or attempt >= MAX_TRIES
    board_repository.add_event(
        db,
        session,
        "answer",
        {
            "turn": index,
            "ask": payload.ask,
            "answer": payload.answer,
            "correct": correct,
            "attempt": attempt,
            "final": final,
        },
    )
    db.commit()
    expected = display_key(question) if final and correct is False else None
    return AnswerOut(correct=correct, attempt=attempt, final=final, expected=expected)


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
        _record_verdicts(db, session.id, actions, turn.payload.get("ask_turn"))
        db.commit()


def _record_verdicts(
    db: Session, session_id: str, actions: list[dict], ask_turn: int | None
) -> None:
    """The Examiner's verdicts on written answers, stored on the answers they judge.

    Question ids repeat across turns, so only the checked question's turn is touched.
    """
    verdicts = {a["ask"]: a["correct"] for a in actions if a.get("type") == "verdict"}
    if not verdicts or ask_turn is None:
        return
    for event in board_repository.list_events(db, session_id):
        payload = event.payload
        if (
            event.kind == "answer"
            and payload["turn"] == ask_turn
            and payload["ask"] in verdicts
            and payload.get("answer") is not None
            and payload["correct"] is None
        ):
            event.payload = {**payload, "correct": verdicts[payload["ask"]]}


async def _produce(
    agent: str,
    system: str,
    prompt: str,
    queue: asyncio.Queue,
    student_id: str,
    doubt_id: str,
    images: Sequence[ImageInput] = (),
) -> None:
    """Pump text from the model into the queue so the consumer can send keepalives."""
    try:
        async for chunk in gateway.stream_text(
            agent, system, prompt, user_id=student_id, session_id=doubt_id, images=images
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
    doubt: DoubtSummary,
    event_id: str,
    system: str,
    prompt: str,
    student_id: str,
    agent: str = "doubt_solver",
    sources: Sequence[dict] = (),
    images: Sequence[ImageInput] = (),
    prelude: Sequence[dict] = (),
) -> AsyncIterator[str]:
    """Server-sent events: doubt, status, action*, then done or error.

    Actions are validated one by one as Claude writes them, so the board starts
    drawing long before the explanation is finished. `prelude` actions (the student's
    photo) come first and are saved with the board.
    """
    yield _sse("doubt", doubt.model_dump(mode="json"))
    yield _sse("status", {"state": "thinking"})

    parser = ActionStreamParser(settings.whiteboard_max_actions)
    actions: list[dict] = list(prelude)
    for action in prelude:
        yield _sse("action", action)
    error: str | None = STOPPED  # until the stream ends normally
    queue: asyncio.Queue = asyncio.Queue()
    producer = asyncio.create_task(
        _produce(agent, system, prompt, queue, student_id, doubt.id, images)
    )

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
                if action["type"] == "ask":
                    action = prepare_ask(action)  # the key is saved, never sent
                elif action["type"] == "cite":
                    action = prepare_cite(action, sources)  # only pages we offered
                    if action is None:
                        continue
                elif action["type"] == "image":
                    continue  # only the server places the student's photo
                actions.append(action)
                yield _sse("action", public_action(action))
            if kind == "end" or parser.full:
                error = None if len(actions) > len(prelude) else EMPTY
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
        yield _sse("action", public_action(action))
    yield _sse("done", {"id": doubt.id, "count": len(actions)})
