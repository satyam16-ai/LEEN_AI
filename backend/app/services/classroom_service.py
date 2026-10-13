# =============================================================================
# Classroom Service — teacher classes, join codes, enrollments
# =============================================================================

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.codes import generate_code, normalize_code
from app.models.classroom import Classroom
from app.models.user import User
from app.repositories import classroom_repository
from app.schemas.classroom import (
    ClassroomCreate,
    ClassroomDetailOut,
    ClassroomOut,
    ClassroomUpdate,
    RosterStudentOut,
    StudentClassOut,
)
from app.schemas.user import UserSummary

JOIN_CODE_LENGTH = 6
NOT_FOUND = "Class not found"
INVALID_CODE = "No class found with that code. Check it with your teacher."


def _new_join_code(db: Session) -> str:
    for _ in range(10):
        code = generate_code(JOIN_CODE_LENGTH)
        if not classroom_repository.code_exists(db, code):
            return code
    return generate_code(JOIN_CODE_LENGTH + 2)


def _out(classroom: Classroom, student_count: int) -> ClassroomOut:
    result = ClassroomOut.model_validate(classroom)
    result.student_count = student_count
    return result


def _owned(db: Session, teacher: User, classroom_id: str) -> Classroom:
    classroom = classroom_repository.get(db, classroom_id)
    if classroom is None or classroom.teacher_id != teacher.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    return classroom


def create(db: Session, teacher: User, payload: ClassroomCreate) -> ClassroomOut:
    classroom = classroom_repository.create(
        db,
        teacher_id=teacher.id,
        name=payload.name,
        subject=payload.subject,
        grade=payload.grade,
        description=payload.description or None,
        join_code=_new_join_code(db),
    )
    db.commit()
    return _out(classroom, 0)


def list_for_teacher(db: Session, teacher: User) -> list[ClassroomOut]:
    return [_out(c, count) for c, count in classroom_repository.list_for_teacher(db, teacher.id)]


def detail(db: Session, teacher: User, classroom_id: str) -> ClassroomDetailOut:
    classroom = _owned(db, teacher, classroom_id)
    students = [
        RosterStudentOut(
            id=student.id,
            name=student.name,
            email=student.email,
            avatar_url=student.avatar_url,
            grade=grade,
            joined_at=joined_at,
        )
        for student, grade, joined_at in classroom_repository.roster(db, classroom.id)
    ]
    base = _out(classroom, len(students))
    return ClassroomDetailOut(**base.model_dump(), students=students)


def update(db: Session, teacher: User, classroom_id: str, payload: ClassroomUpdate) -> ClassroomOut:
    classroom = _owned(db, teacher, classroom_id)
    for field in payload.model_fields_set:
        value = getattr(payload, field)
        if field in ("name", "subject") and not value:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{field.capitalize()} is required")
        if field == "description":
            value = value or None
        setattr(classroom, field, value)
    db.commit()
    return _out(classroom, classroom_repository.student_count(db, classroom.id))


def delete(db: Session, teacher: User, classroom_id: str) -> None:
    classroom_repository.delete_classroom(db, _owned(db, teacher, classroom_id))
    db.commit()


def regenerate_code(db: Session, teacher: User, classroom_id: str) -> ClassroomOut:
    classroom = _owned(db, teacher, classroom_id)
    classroom.join_code = _new_join_code(db)
    db.commit()
    return _out(classroom, classroom_repository.student_count(db, classroom.id))


def remove_student(db: Session, teacher: User, classroom_id: str, student_id: str) -> None:
    classroom = _owned(db, teacher, classroom_id)
    if not classroom_repository.unenroll(db, classroom.id, student_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That student isn't in this class")
    db.commit()


def _student_class_out(classroom, teacher, joined_at, student_count) -> StudentClassOut:
    return StudentClassOut(
        id=classroom.id,
        name=classroom.name,
        subject=classroom.subject,
        grade=classroom.grade,
        description=classroom.description,
        teacher=UserSummary.model_validate(teacher),
        student_count=student_count,
        joined_at=joined_at,
    )


def join(db: Session, student: User, raw_code: str) -> StudentClassOut:
    classroom = classroom_repository.get_by_code(db, normalize_code(raw_code))
    if classroom is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, INVALID_CODE)
    if classroom_repository.get_enrollment(db, classroom.id, student.id):
        raise HTTPException(status.HTTP_409_CONFLICT, f"You're already in {classroom.name}")

    enrollment = classroom_repository.enroll(db, classroom.id, student.id)
    db.commit()
    teacher = db.get(User, classroom.teacher_id)
    count = classroom_repository.student_count(db, classroom.id)
    return _student_class_out(classroom, teacher, enrollment.joined_at, count)


def list_for_student(db: Session, student: User) -> list[StudentClassOut]:
    return [
        _student_class_out(classroom, teacher, joined_at, count or 0)
        for classroom, teacher, joined_at, count in classroom_repository.list_for_student(
            db, student.id
        )
    ]


def leave(db: Session, student: User, classroom_id: str) -> None:
    if not classroom_repository.unenroll(db, classroom_id, student.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "You're not in that class")
    db.commit()
