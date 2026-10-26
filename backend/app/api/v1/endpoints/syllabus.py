# =============================================================================
# Syllabus Endpoints — /api/v1/student/syllabus (one topic tree per subject)
# =============================================================================

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies.auth import require_roles
from app.config import settings
from app.core import rate_limit
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.response import ok
from app.schemas.syllabus import SyllabusSave
from app.services import syllabus_service

router = APIRouter()
current_student = require_roles(UserRole.STUDENT)
UPLOAD_LIMIT = 10


def read_upload(file: UploadFile) -> bytes:
    """The upload's bytes, reading one past the limit so oversized files are caught."""
    return file.file.read(settings.max_upload_bytes + 1)


@router.get("")
def list_subjects(student: User = Depends(current_student), db: Session = Depends(get_db)):
    return ok(syllabus_service.list_subjects(db, student))


@router.get("/{subject}")
def get_syllabus(
    subject: str, student: User = Depends(current_student), db: Session = Depends(get_db)
):
    return ok(syllabus_service.get_tree(db, student, subject))


@router.post("/{subject}/upload", status_code=status.HTTP_202_ACCEPTED)
def upload_contents(
    subject: str,
    files: list[UploadFile] = File(...),
    student: User = Depends(current_student),
    db: Session = Depends(get_db),
):
    """Up to 3 photos of the contents page, or one PDF. The Syllabus Reader reads them next."""
    rate_limit.enforce(f"syllabus:{student.id}", UPLOAD_LIMIT, 3600)
    uploads = [read_upload(file) for file in files]
    tree = syllabus_service.start_upload(db, student, subject, uploads)
    return ok(tree, "Reading your contents page")


@router.put("/{subject}")
def save_syllabus(
    subject: str,
    payload: SyllabusSave,
    student: User = Depends(current_student),
    db: Session = Depends(get_db),
):
    tree = syllabus_service.save_tree(db, student, subject, payload)
    return ok(tree, "Syllabus confirmed" if payload.confirm else "Syllabus saved")
