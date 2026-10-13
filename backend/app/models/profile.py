# =============================================================================
# Student Profile & Parent↔Student links
# =============================================================================

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.user import utcnow


class StudentProfile(Base):
    """Learning profile for a student (one-to-one with users)."""

    __tablename__ = "student_profiles"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    grade: Mapped[int | None] = mapped_column(Integer, nullable=True)
    board: Mapped[str | None] = mapped_column(String(20), nullable=True)
    school_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    subjects: Mapped[list[str]] = mapped_column(ARRAY(String(50)), default=list, nullable=False)
    learning_level: Mapped[str | None] = mapped_column(String(20), nullable=True)
    preferred_language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    # Short-lived code a student shares so a parent can link to their account.
    link_code: Mapped[str | None] = mapped_column(String(12), unique=True, nullable=True)
    link_code_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    @property
    def is_complete(self) -> bool:
        return bool(self.grade and self.board and self.learning_level and self.subjects)


class ParentStudentLink(Base):
    __tablename__ = "parent_student_links"
    __table_args__ = (UniqueConstraint("parent_id", "student_id", name="uq_parent_student"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    parent_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
