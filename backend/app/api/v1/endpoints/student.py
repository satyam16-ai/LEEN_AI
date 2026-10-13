# =============================================================================
# Student Endpoints — /api/v1/student (parent link code, classes)
# =============================================================================

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies.auth import require_roles
from app.core import rate_limit
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.family import CodeRequest
from app.schemas.response import ok
from app.services import classroom_service, family_service

router = APIRouter()
current_student = require_roles(UserRole.STUDENT)


@router.get("/link-code")
def get_link_code(student: User = Depends(current_student), db: Session = Depends(get_db)):
    return ok(family_service.get_link_code(db, student))


@router.post("/link-code")
def regenerate_link_code(student: User = Depends(current_student), db: Session = Depends(get_db)):
    return ok(family_service.regenerate_link_code(db, student), "New code generated")


@router.get("/parents")
def list_parents(student: User = Depends(current_student), db: Session = Depends(get_db)):
    return ok(family_service.list_parents(db, student))


@router.delete("/parents/{parent_id}")
def remove_parent(
    parent_id: str, student: User = Depends(current_student), db: Session = Depends(get_db)
):
    family_service.unlink(db, parent_id, student.id)
    return ok(message="Parent access removed")


@router.get("/classes")
def list_classes(student: User = Depends(current_student), db: Session = Depends(get_db)):
    return ok(classroom_service.list_for_student(db, student))


@router.post("/classes/join", status_code=status.HTTP_201_CREATED)
def join_class(
    payload: CodeRequest, student: User = Depends(current_student), db: Session = Depends(get_db)
):
    rate_limit.enforce(f"class-join:{student.id}", 10, 900)
    joined = classroom_service.join(db, student, payload.code)
    return ok(joined, f"You joined {joined.name}")


@router.delete("/classes/{classroom_id}")
def leave_class(
    classroom_id: str, student: User = Depends(current_student), db: Session = Depends(get_db)
):
    classroom_service.leave(db, student, classroom_id)
    return ok(message="You left the class")
