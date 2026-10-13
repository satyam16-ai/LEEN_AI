# =============================================================================
# Whiteboard doubts — a student's question and the board script the AI drew
# =============================================================================

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.user import utcnow


class WhiteboardDoubt(Base):
    __tablename__ = "whiteboard_doubts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question: Mapped[str] = mapped_column(String(500), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(60), nullable=True)
    # streaming -> complete | failed
    status: Mapped[str] = mapped_column(String(16), default="streaming", nullable=False)
    # Validated board actions, replayed as-is by the frontend.
    actions: Mapped[list[dict]] = mapped_column(JSONB, default=list, nullable=False)
    error: Mapped[str | None] = mapped_column(String(300), nullable=True)
    model: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
