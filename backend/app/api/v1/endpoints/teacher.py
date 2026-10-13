# =============================================================================
# Teacher Endpoints — /api/v1/teacher/classes
# =============================================================================

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies.auth import require_roles
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.classroom import ClassroomCreate, ClassroomUpdate
from app.schemas.response import ok
from app.services import classroom_service

router = APIRouter()
current_teacher = require_roles(UserRole.TEACHER)


@router.get("/classes")
def list_classes(teacher: User = Depends(current_teacher), db: Session = Depends(get_db)):
    return ok(classroom_service.list_for_teacher(db, teacher))


@router.post("/classes", status_code=status.HTTP_201_CREATED)
def create_class(
    payload: ClassroomCreate,
    teacher: User = Depends(current_teacher),
    db: Session = Depends(get_db),
):
    return ok(classroom_service.create(db, teacher, payload), "Class created")


@router.get("/classes/{classroom_id}")
def get_class(
    classroom_id: str, teacher: User = Depends(current_teacher), db: Session = Depends(get_db)
):
    return ok(classroom_service.detail(db, teacher, classroom_id))


@router.patch("/classes/{classroom_id}")
def update_class(
    classroom_id: str,
    payload: ClassroomUpdate,
    teacher: User = Depends(current_teacher),
    db: Session = Depends(get_db),
):
    return ok(classroom_service.update(db, teacher, classroom_id, payload), "Class updated")


@router.delete("/classes/{classroom_id}")
def delete_class(
    classroom_id: str, teacher: User = Depends(current_teacher), db: Session = Depends(get_db)
):
    classroom_service.delete(db, teacher, classroom_id)
    return ok(message="Class deleted")


@router.post("/classes/{classroom_id}/join-code")
def regenerate_join_code(
    classroom_id: str, teacher: User = Depends(current_teacher), db: Session = Depends(get_db)
):
    return ok(
        classroom_service.regenerate_code(db, teacher, classroom_id),
        "New join code generated. The old code no longer works.",
    )


@router.delete("/classes/{classroom_id}/students/{student_id}")
def remove_student(
    classroom_id: str,
    student_id: str,
    teacher: User = Depends(current_teacher),
    db: Session = Depends(get_db),
):
    classroom_service.remove_student(db, teacher, classroom_id, student_id)
    return ok(message="Student removed from class")
