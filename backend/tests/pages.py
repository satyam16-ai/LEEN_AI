"""Book pages that are already read and embedded, put straight into the database."""

from app.database import SessionLocal
from app.repositories import document_repository
from tests.samples import fake_embed


def add_ready_page(
    student_id: str,
    text: str,
    *,
    subject: str = "Science",
    title: str = "Force and Laws of Motion",
    page: int = 1,
    status: str = "ready",
) -> str:
    with SessionLocal() as db:
        document = document_repository.create(
            db,
            student_id=student_id,
            subject=subject,
            subject_key=subject.casefold(),
            title=title,
            file_name="pages/test.jpg",
            media_type="image/jpeg",
            pages=1,
            status=status,
        )
        document_repository.replace_chunks(db, document, [(page, text, fake_embed([text])[0])])
        db.commit()
        return document.id
