# =============================================================================
# Board session repository — sessions and their append-only events
# =============================================================================

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.board import BoardEvent, BoardSession


def create_session(db: Session, **fields) -> BoardSession:
    session = BoardSession(**fields)
    db.add(session)
    db.flush()
    return session


def get_session(db: Session, session_id: str) -> BoardSession | None:
    return db.get(BoardSession, session_id)


def get_owned_session(
    db: Session, session_id: str, student_id: str, kind: str = "doubt", lock: bool = False
) -> BoardSession | None:
    """The student's session; `lock` holds its row until commit so turns can't race."""
    query = select(BoardSession).where(
        BoardSession.id == session_id,
        BoardSession.student_id == student_id,
        BoardSession.kind == kind,
    )
    return db.scalar(query.with_for_update() if lock else query)


def list_sessions(
    db: Session, student_id: str, kind: str = "doubt", limit: int = 50
) -> list[BoardSession]:
    return list(
        db.scalars(
            select(BoardSession)
            .where(BoardSession.student_id == student_id, BoardSession.kind == kind)
            .order_by(BoardSession.created_at.desc())
            .limit(limit)
        )
    )


def add_turn(db: Session, session: BoardSession, payload: dict) -> BoardEvent:
    last = db.scalar(select(func.max(BoardEvent.seq)).where(BoardEvent.session_id == session.id))
    event = BoardEvent(session_id=session.id, seq=(last or 0) + 1, kind="turn", payload=payload)
    db.add(event)
    db.flush()
    return event


def get_event(db: Session, event_id: str) -> BoardEvent | None:
    return db.get(BoardEvent, event_id)


def list_turns(db: Session, session_id: str) -> list[BoardEvent]:
    return list(
        db.scalars(
            select(BoardEvent)
            .where(BoardEvent.session_id == session_id, BoardEvent.kind == "turn")
            .order_by(BoardEvent.seq)
        )
    )


def delete_session(db: Session, session: BoardSession) -> None:
    db.delete(session)


def find_cached_turn(db: Session, cache_key: str) -> BoardEvent | None:
    """The newest complete first turn of a v2 board made for the same doubt and profile."""
    return db.scalar(
        select(BoardEvent)
        .join(BoardSession, BoardSession.id == BoardEvent.session_id)
        .where(
            BoardSession.cache_key == cache_key,
            BoardSession.protocol_v == 2,
            BoardEvent.seq == 1,
            BoardEvent.payload["status"].astext == "complete",
        )
        .order_by(BoardSession.created_at.desc())
        .limit(1)
    )
