# =============================================================================
# Syllabus Service — one topic tree per profile subject. An upload (photos or a
# PDF of the contents page) is read in the background by the Syllabus Reader
# into a draft; the student edits it and confirms. Saving keeps row ids, so
# topics stay the same rows for mastery and plans later.
# =============================================================================

import asyncio
import logging
from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.syllabus import SyllabusChapter, SyllabusSubject, SyllabusTopic
from app.models.user import User, utcnow
from app.repositories import profile_repository, syllabus_repository
from app.repositories.syllabus_repository import subject_key
from app.schemas.syllabus import (
    ChapterOut,
    SubjectSummary,
    SyllabusOut,
    SyllabusSave,
)
from app.services import files
from app.services.llm import gateway
from app.services.llm.types import ImageInput
from app.services.syllabus import reader

logger = logging.getLogger("leen_ai")

MAX_PHOTOS = 3
MAX_PDF_PAGES_READ = 3
# A PDF with at least this much text is read as text (cheaper than images).
MIN_PDF_TEXT = 200
# A "reading" status older than this is treated as stuck, so the student can upload again.
READING_STALE = timedelta(minutes=10)
READ_FAILED = "Couldn't read that page. Try a clearer photo or type it yourself."
NOT_IN_PROFILE = "That subject isn't in your profile."
WRONG_FILES = "Send up to 3 photos of the contents page, or one PDF."


def _profile_subject(db: Session, student: User, subject: str) -> str:
    """The subject's name as the profile spells it; 404 when it isn't one of them."""
    profile = profile_repository.get(db, student.id)
    key = subject_key(subject)
    for name in profile.subjects if profile else []:
        if subject_key(name) == key:
            return name
    raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_IN_PROFILE)


def _tree(row: SyllabusSubject | None, name: str) -> SyllabusOut:
    if row is None:
        return SyllabusOut(subject=name, status="empty", error=None, confirmed_at=None, chapters=[])
    return SyllabusOut(
        subject=name,
        status=row.status,
        error=row.error,
        confirmed_at=row.confirmed_at,
        chapters=[ChapterOut.model_validate(chapter) for chapter in row.chapters],
    )


def _is_reading(row: SyllabusSubject) -> bool:
    return row.status == "reading" and row.updated_at > utcnow() - READING_STALE


def list_subjects(db: Session, student: User) -> list[SubjectSummary]:
    profile = profile_repository.get(db, student.id)
    rows = {row.subject_key: row for row in syllabus_repository.list_subjects(db, student.id)}
    summaries = []
    for name in profile.subjects if profile else []:
        row = rows.get(subject_key(name))
        topics = [topic for chapter in row.chapters for topic in chapter.topics] if row else []
        summaries.append(
            SubjectSummary(
                subject=name,
                status=row.status if row else "empty",
                chapters=len(row.chapters) if row else 0,
                topics=len(topics),
                done=sum(topic.done for topic in topics),
            )
        )
    return summaries


def get_tree(db: Session, student: User, subject: str) -> SyllabusOut:
    name = _profile_subject(db, student, subject)
    return _tree(syllabus_repository.get_subject(db, student.id, name), name)


def _locked_subject(db: Session, student: User, name: str) -> SyllabusSubject:
    syllabus_repository.get_or_create_subject(db, student.id, name)
    return syllabus_repository.get_subject(db, student.id, name, lock=True)


def start_upload(db: Session, student: User, subject: str, uploads: list[bytes]) -> SyllabusOut:
    """Store the contents-page photos (or PDF) and queue the Syllabus Reader."""
    name = _profile_subject(db, student, subject)
    pdfs = sum(1 for data in uploads if data[:5] == b"%PDF-")
    if not uploads or len(uploads) > MAX_PHOTOS or (pdfs and len(uploads) > 1):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, WRONG_FILES)

    row = _locked_subject(db, student, name)
    if _is_reading(row):
        raise HTTPException(status.HTTP_409_CONFLICT, "Still reading your last upload.")
    stored = [files.save_upload(data, "syllabus") for data in uploads]

    previous = list(row.sources or [])
    row.sources = [item.name for item in stored]
    row.status = "reading"
    row.error = None
    row.updated_at = utcnow()
    db.commit()
    for old in previous:
        files.remove(old)

    from app.core.tasks import read_syllabus_task

    read_syllabus_task.delay(row.id)
    return _tree(row, name)


def save_tree(db: Session, student: User, subject: str, payload: SyllabusSave) -> SyllabusOut:
    """Replace the tree with the student's edit. Ids are kept only for this subject's rows,
    and a topic keeps its id only inside its own chapter."""
    name = _profile_subject(db, student, subject)
    row = _locked_subject(db, student, name)
    if _is_reading(row):
        raise HTTPException(status.HTTP_409_CONFLICT, "Still reading your contents page.")

    old_chapters = {chapter.id: chapter for chapter in row.chapters}
    chapters = []
    for position, chapter_in in enumerate(payload.chapters):
        chapter = old_chapters.pop(chapter_in.id, None) if chapter_in.id else None
        old_topics = {topic.id: topic for topic in chapter.topics} if chapter else {}
        chapter = chapter or SyllabusChapter()
        chapter.position = position
        chapter.title = chapter_in.title
        topics = []
        for topic_position, topic_in in enumerate(chapter_in.topics):
            topic = old_topics.pop(topic_in.id, None) if topic_in.id else None
            topic = topic or SyllabusTopic()
            topic.position = topic_position
            topic.title = topic_in.title
            topic.done = topic_in.done
            topics.append(topic)
        chapter.topics = topics
        chapters.append(chapter)
    row.chapters = chapters

    if payload.confirm:
        row.status = "confirmed"
        row.confirmed_at = utcnow()
    elif row.status in ("empty", "failed", "reading"):
        row.status = "draft"
    row.error = None
    db.commit()
    db.refresh(row)
    return _tree(row, name)


# -- the background job ------------------------------------------------------------


def _reader_request(subject: str, sources: list[str]) -> tuple[str, tuple[ImageInput, ...]]:
    """The prompt and images for the Syllabus Reader. A text PDF goes in as text."""
    if len(sources) == 1 and sources[0].endswith(".pdf"):
        texts = files.pdf_texts(sources[0])
        contents = "\n".join(text.strip() for text in texts if text.strip())
        if len(contents) >= MIN_PDF_TEXT:
            return reader.build_prompt(subject, contents), ()
        count = min(len(texts), MAX_PDF_PAGES_READ)
        images = tuple(
            ImageInput("image/jpeg", files.pdf_page_jpeg(sources[0], index))
            for index in range(count)
        )
        return reader.build_prompt(subject), images
    images = tuple(ImageInput("image/jpeg", files.read_bytes(name)) for name in sources)
    return reader.build_prompt(subject), images


def _finish(subject_id: str, sources: list[str], chapters=None, error=None) -> None:
    with SessionLocal() as db:
        row = db.get(SyllabusSubject, subject_id, with_for_update=True)
        # A newer upload replaced this one while it was being read: leave that one alone.
        if row is None or row.status != "reading" or list(row.sources) != sources:
            return
        if error:
            row.status = "failed"
            row.error = error
        else:
            row.chapters = [
                SyllabusChapter(
                    position=position,
                    title=chapter["title"],
                    topics=[
                        SyllabusTopic(position=index, title=title)
                        for index, title in enumerate(chapter["topics"])
                    ],
                )
                for position, chapter in enumerate(chapters)
            ]
            row.status = "draft"
            row.error = None
        db.commit()


def read_syllabus(subject_id: str) -> None:
    """The Celery job: read the stored upload into a draft tree, or mark it failed."""
    with SessionLocal() as db:
        row = db.get(SyllabusSubject, subject_id)
        if row is None or row.status != "reading":
            return
        subject, sources, student_id = row.subject, list(row.sources), row.student_id

    try:
        prompt, images = _reader_request(subject, sources)
        reply = asyncio.run(
            gateway.complete(
                "syllabus_reader", reader.SYSTEM, prompt, images=images, user_id=student_id
            )
        )
        chapters = reader.parse_draft(reply)
    except Exception:  # noqa: BLE001 - any failure must end as "failed", never stuck
        logger.exception("The Syllabus Reader could not read subject %s", subject_id)
        _finish(subject_id, sources, error=READ_FAILED)
        return
    _finish(subject_id, sources, chapters=chapters)
