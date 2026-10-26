# =============================================================================
# Document Endpoints — /api/v1/student/documents (the student's book pages)
# =============================================================================

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.v1.dependencies.auth import require_roles
from app.api.v1.endpoints.syllabus import read_upload
from app.core import rate_limit
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.response import ok
from app.services import document_service

router = APIRouter()
current_student = require_roles(UserRole.STUDENT)
UPLOAD_LIMIT = 60


@router.post("", status_code=status.HTTP_201_CREATED)
def upload_document(
    file: UploadFile = File(...),
    subject: str = Form(..., max_length=50),
    topic_id: str | None = Form(None, max_length=36),
    title: str | None = Form(None, max_length=120),
    student: User = Depends(current_student),
    db: Session = Depends(get_db),
):
    """One page photo, or a PDF of up to 20 pages. The Librarian reads it next."""
    rate_limit.enforce(f"upload:{student.id}", UPLOAD_LIMIT, 3600)
    document = document_service.upload(
        db, student, read_upload(file), subject, topic_id=topic_id, title=title
    )
    return ok(document, "Reading your page")


@router.get("")
def list_documents(
    subject: str | None = None,
    topic_id: str | None = None,
    student: User = Depends(current_student),
    db: Session = Depends(get_db),
):
    return ok(document_service.list_documents(db, student, subject, topic_id))


@router.delete("/{document_id}")
def delete_document(
    document_id: str, student: User = Depends(current_student), db: Session = Depends(get_db)
):
    document_service.delete_document(db, student, document_id)
    return ok(message="Page removed")


@router.get("/{document_id}/file")
def document_file(
    document_id: str, student: User = Depends(current_student), db: Session = Depends(get_db)
):
    path, media_type = document_service.file_for(db, student, document_id)
    return FileResponse(
        path, media_type=media_type, headers={"Cache-Control": "private, max-age=3600"}
    )
