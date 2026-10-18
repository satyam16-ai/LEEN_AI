# =============================================================================
# Board sessions — one canvas the AI teaches on (a doubt today; classes later),
# with an append-only log of events. A doubt's events are its turns.
# =============================================================================

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, SmallInteger, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.user import utcnow


class BoardSession(Base):
    __tablename__ = "board_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(16), default="doubt", nullable=False)
    # The first question asked on this board.
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(60), nullable=True)
    # streaming -> complete | failed (follows the latest turn)
    status: Mapped[str] = mapped_column(String(16), default="streaming", nullable=False)
    # 1 = boards saved before Protocol v2; 2 = everything since.
    protocol_v: Mapped[int] = mapped_column(SmallInteger, default=2, nullable=False)
    model: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # Identical doubts from students with the same profile share a board (see whiteboard_service).
    cache_key: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    error: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class BoardEvent(Base):
    __tablename__ = "board_events"
    __table_args__ = (UniqueConstraint("session_id", "seq", name="uq_board_event_seq"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("board_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    # "turn": {question, mode, actions, status, error, cached}
    kind: Mapped[str] = mapped_column(String(16), default="turn", nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
