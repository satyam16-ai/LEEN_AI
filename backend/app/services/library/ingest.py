# =============================================================================
# The Librarian's reading job — a stored page (photo or short PDF) → text →
# chunks → local embeddings → pgvector. Printed text is read by local OCR at
# zero tokens; the Librarian agent reads a page by vision only when OCR can't.
# =============================================================================

import asyncio
import logging

from app.config import settings
from app.database import SessionLocal
from app.repositories import document_repository
from app.services import files
from app.services.library import embeddings, ocr
from app.services.library.chunker import chunk_pages
from app.services.llm import gateway
from app.services.llm.types import ImageInput

logger = logging.getLogger("leen_ai")

READ_FAILED = "Couldn't read this page. Try a clearer photo."
# A PDF page with less text than this is a scan: OCR it.
MIN_PDF_PAGE_TEXT = 20

LIBRARIAN_SYSTEM = (
    "You are the Librarian for LEEN AI, an AI tuition teacher. Copy all the text on this "
    "book page exactly, in reading order. Write formulas in plain text (F = ma, v^2 = u^2 + "
    "2as). Describe a diagram in one short line in square brackets. Output only the text."
)


def _read_image(jpeg: bytes, student_id: str) -> str:
    text, confidence = ocr.read_page(jpeg)
    if text.strip() and confidence >= settings.ocr_min_confidence:
        return text
    try:
        return asyncio.run(
            gateway.complete(
                "librarian",
                LIBRARIAN_SYSTEM,
                "Copy the text of this page.",
                images=(ImageInput("image/jpeg", jpeg),),
                user_id=student_id,
            )
        )
    except Exception:
        # The bridge is down or busy: rough OCR text still beats nothing.
        if text.strip():
            logger.warning("The Librarian could not read a page; keeping the OCR text")
            return text
        raise


def _read_pages(name: str, media_type: str, student_id: str) -> list[tuple[int, str]]:
    if media_type != "application/pdf":
        return [(1, _read_image(files.read_bytes(name), student_id))]
    pages = []
    for index, text in enumerate(files.pdf_texts(name)):
        if len(text.strip()) < MIN_PDF_PAGE_TEXT:
            text = _read_image(files.pdf_page_jpeg(name, index), student_id)
        pages.append((index + 1, text))
    return pages


def _finish(document_id: str, chunks=None, error: str | None = None) -> None:
    with SessionLocal() as db:
        document = document_repository.get(db, document_id)
        if document is None:  # deleted while it was being read
            return
        if error:
            document.status = "failed"
            document.error = error
        else:
            document_repository.replace_chunks(db, document, chunks)
            document.status = "ready"
            document.error = None
        db.commit()


def ingest_document(document_id: str) -> None:
    """The Celery job for one uploaded page or PDF."""
    with SessionLocal() as db:
        document = document_repository.get(db, document_id)
        if document is None or document.status not in ("queued", "reading"):
            return
        document.status = "reading"
        db.commit()
        name, media_type, student_id = document.file_name, document.media_type, document.student_id

    try:
        chunks = chunk_pages(_read_pages(name, media_type, student_id))
        if not chunks:
            raise ValueError("No text on the page")
        vectors = embeddings.embed([chunk.text for chunk in chunks])
    except Exception:  # noqa: BLE001 - any failure must end as "failed", never stuck
        logger.exception("The Librarian could not read document %s", document_id)
        _finish(document_id, error=READ_FAILED)
        return
    rows = [(chunk.page, chunk.text, vector) for chunk, vector in zip(chunks, vectors, strict=True)]
    _finish(document_id, chunks=rows)
