# =============================================================================
# Document Service — a student's own book pages (a photo, or a short PDF) filed
# under a subject and optionally a syllabus topic. Uploads are stored privately
# and read by the Librarian in the background (services/library/ingest.py).
# =============================================================================

from datetime import timedelta
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User, utcnow
from app.repositories import document_repository, syllabus_repository
from app.repositories.syllabus_repository import subject_key
from app.schemas.document import DocumentOut
from app.services import files, syllabus_service

NOT_FOUND = "That page isn't in your library."
# A page still waiting after this long was lost by the worker: show it as failed.
READING_STALE = timedelta(minutes=30)
STALE_ERROR = "Reading this page took too long. Delete it and try again."


def upload(
    db: Session,
    student: User,
    data: bytes,
    subject: str,
    topic_id: str | None = None,
    title: str | None = None,
) -> DocumentOut:
    name = syllabus_service.profile_subject(db, student, subject)
    topic = None
    if topic_id:
        topic = syllabus_repository.get_topic(db, student.id, topic_id, subject=name)
        if topic is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "That topic isn't in your syllabus.")
    stored = files.save_upload(data, "pages")
    label = (title or "").strip() or (topic.title if topic else "Page")
    document = document_repository.create(
        db,
        student_id=student.id,
        subject=name,
        subject_key=subject_key(name),
        topic_id=topic.id if topic else None,
        title=label[:120],
        file_name=stored.name,
        media_type=stored.media_type,
        pages=stored.pages,
    )
    db.commit()

    from app.core.tasks import ingest_document_task

    ingest_document_task.delay(document.id)
    return DocumentOut.model_validate(document)


def list_documents(
    db: Session, student: User, subject: str | None = None, topic_id: str | None = None
) -> list[DocumentOut]:
    documents = document_repository.list_for(
        db, student.id, subject_key(subject) if subject else None, topic_id
    )
    stale = [
        document
        for document in documents
        if document.status in ("queued", "reading")
        and document.created_at < utcnow() - READING_STALE
    ]
    for document in stale:
        document.status = "failed"
        document.error = STALE_ERROR
    if stale:
        db.commit()
    return [DocumentOut.model_validate(document) for document in documents]


def _owned(db: Session, student: User, document_id: str):
    document = document_repository.get_owned(db, document_id, student.id)
    if document is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    return document


def delete_document(db: Session, student: User, document_id: str) -> None:
    document = _owned(db, student, document_id)
    name = document.file_name
    db.delete(document)
    db.commit()
    files.remove(name)


def file_for(db: Session, student: User, document_id: str) -> tuple[Path, str]:
    document = _owned(db, student, document_id)
    path = files.path_of(document.file_name)
    if not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    return path, document.media_type
