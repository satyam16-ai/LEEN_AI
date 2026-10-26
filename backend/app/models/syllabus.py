# =============================================================================
# Syllabus — one topic tree per student and subject (Subject → Chapters →
# Topics), read from a contents-page photo by the Syllabus Reader and edited
# by the student. Topic ids stay stable across edits: later phases (mastery,
# plans) point at them.
# =============================================================================

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.user import utcnow


def _uuid() -> str:
    return str(uuid.uuid4())


class SyllabusSubject(Base):
    __tablename__ = "syllabus_subjects"
    __table_args__ = (
        UniqueConstraint("student_id", "subject_key", name="uq_syllabus_subject_student_key"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    student_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject: Mapped[str] = mapped_column(String(50), nullable=False)
    # Casefolded, single-spaced subject name: how profile subjects are matched.
    subject_key: Mapped[str] = mapped_column(String(50), nullable=False)
    # empty -> reading -> draft -> confirmed; failed when the Syllabus Reader could not read it
    status: Mapped[str] = mapped_column(String(12), default="empty", nullable=False)
    error: Mapped[str | None] = mapped_column(String(300), nullable=True)
    # Stored file names (files.StoredFile.name) of the last upload.
    sources: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    chapters: Mapped[list["SyllabusChapter"]] = relationship(
        order_by="SyllabusChapter.position", cascade="all, delete-orphan", passive_deletes=True
    )


class SyllabusChapter(Base):
    __tablename__ = "syllabus_chapters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    subject_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("syllabus_subjects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)

    topics: Mapped[list["SyllabusTopic"]] = relationship(
        order_by="SyllabusTopic.position", cascade="all, delete-orphan", passive_deletes=True
    )


class SyllabusTopic(Base):
    __tablename__ = "syllabus_topics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    chapter_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("syllabus_chapters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
