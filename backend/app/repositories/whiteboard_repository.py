# =============================================================================
# Whiteboard doubt repository
# =============================================================================

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.whiteboard import WhiteboardDoubt


def create(db: Session, **fields) -> WhiteboardDoubt:
    doubt = WhiteboardDoubt(**fields)
    db.add(doubt)
    db.flush()
    return doubt


def get(db: Session, doubt_id: str) -> WhiteboardDoubt | None:
    return db.get(WhiteboardDoubt, doubt_id)


def get_owned(db: Session, doubt_id: str, student_id: str) -> WhiteboardDoubt | None:
    return db.scalar(
        select(WhiteboardDoubt).where(
            WhiteboardDoubt.id == doubt_id, WhiteboardDoubt.student_id == student_id
        )
    )


def list_for_student(db: Session, student_id: str, limit: int = 50) -> list[WhiteboardDoubt]:
    return list(
        db.scalars(
            select(WhiteboardDoubt)
            .where(WhiteboardDoubt.student_id == student_id)
            .order_by(WhiteboardDoubt.created_at.desc())
            .limit(limit)
        )
    )


def delete(db: Session, doubt: WhiteboardDoubt) -> None:
    db.delete(doubt)
