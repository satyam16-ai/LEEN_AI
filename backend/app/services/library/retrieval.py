# =============================================================================
# Retrieval — the pages of the student's own books closest to a question
# (cosine similarity on local embeddings in pgvector). Only the asking
# student's ready documents are ever searched.
# =============================================================================

from dataclasses import dataclass

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.config import settings
from app.models.document import Document, DocumentChunk
from app.repositories.syllabus_repository import subject_key
from app.services.library import embeddings

MAX_SOURCE_CHARS = 1500
# Fetch a few extra rows: several chunks of one page count as one source.
OVERFETCH = 4


@dataclass(frozen=True)
class Source:
    n: int
    doc: str
    page: int
    title: str
    text: str


def retrieve(
    db: Session,
    student_id: str,
    query: str,
    *,
    subject: str | None = None,
    k: int | None = None,
    min_score: float | None = None,
) -> list[Source]:
    k = k or settings.rag_top_k
    min_score = settings.rag_min_score if min_score is None else min_score
    filters = [Document.student_id == student_id, Document.status == "ready"]
    if subject:
        filters.append(Document.subject_key == subject_key(subject))
    if db.scalar(select(Document.id).where(*filters).limit(1)) is None:
        return []  # no pages yet: skip embedding the question

    [vector] = embeddings.embed([query])
    distance = DocumentChunk.embedding.cosine_distance(vector)
    # The HNSW index filters after its scan; iterative scans keep looking until enough
    # rows pass this student's filter.
    db.execute(text("SET LOCAL hnsw.iterative_scan = relaxed_order"))
    rows = db.execute(
        select(
            DocumentChunk.document_id,
            DocumentChunk.page,
            DocumentChunk.text,
            Document.title,
            distance,
        )
        .join(Document, DocumentChunk.document_id == Document.id)
        .where(*filters)
        .order_by(distance)
        .limit(k * OVERFETCH)
    ).all()

    found, seen = [], set()
    for document_id, page, passage, title, gap in sorted(rows, key=lambda row: row[4]):
        if 1 - gap < min_score or len(found) == k:
            break
        if (document_id, page) in seen:
            continue
        seen.add((document_id, page))
        found.append((document_id, page, title, passage))

    share = MAX_SOURCE_CHARS // max(len(found), 1)
    return [
        Source(n, document_id, page, title, passage[:share])
        for n, (document_id, page, title, passage) in enumerate(found, start=1)
    ]


def _guard(value: str) -> str:
    return value.replace("</", "< /")


def format_sources(sources: list[Source]) -> str:
    """Numbered lines for the <sources> block, guarded so they can't close the tag."""
    return "\n".join(
        f"[{source.n}] {_guard(source.title)}, page {source.page}: {_guard(source.text)}"
        for source in sources
    )
