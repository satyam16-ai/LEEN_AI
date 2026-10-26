# =============================================================================
# Document repository — a student's book pages and their searchable chunks
# =============================================================================

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentChunk


def create(db: Session, **fields) -> Document:
    document = Document(**fields)
    db.add(document)
    db.flush()
    return document


def get(db: Session, document_id: str) -> Document | None:
    return db.get(Document, document_id)


def get_owned(db: Session, document_id: str, student_id: str) -> Document | None:
    return db.scalar(
        select(Document).where(Document.id == document_id, Document.student_id == student_id)
    )


def list_for(
    db: Session, student_id: str, subject_key: str | None = None, topic_id: str | None = None
) -> list[Document]:
    query = select(Document).where(Document.student_id == student_id)
    if subject_key is not None:
        query = query.where(Document.subject_key == subject_key)
    if topic_id is not None:
        query = query.where(Document.topic_id == topic_id)
    return list(db.scalars(query.order_by(Document.created_at.desc())))


def replace_chunks(
    db: Session, document: Document, chunks: list[tuple[int, str, list[float]]]
) -> None:
    """Swap the document's chunks for `chunks`: (page, text, embedding) each."""
    db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
    db.add_all(
        DocumentChunk(document_id=document.id, page=page, text=text, embedding=embedding)
        for page, text, embedding in chunks
    )
    db.flush()
