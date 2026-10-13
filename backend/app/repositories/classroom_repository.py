# =============================================================================
# Classroom repository
# =============================================================================

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, aliased

from app.models.classroom import ClassEnrollment, Classroom
from app.models.profile import StudentProfile
from app.models.user import User


def _student_count():
    return (
        select(func.count(ClassEnrollment.id))
        .where(ClassEnrollment.classroom_id == Classroom.id)
        .correlate(Classroom)
        .scalar_subquery()
    )


def create(db: Session, **fields) -> Classroom:
    classroom = Classroom(**fields)
    db.add(classroom)
    db.flush()
    return classroom


def get(db: Session, classroom_id: str) -> Classroom | None:
    return db.get(Classroom, classroom_id)


def get_by_code(db: Session, code: str) -> Classroom | None:
    return db.scalar(select(Classroom).where(Classroom.join_code == code))


def code_exists(db: Session, code: str) -> bool:
    return get_by_code(db, code) is not None


def delete_classroom(db: Session, classroom: Classroom) -> None:
    db.delete(classroom)


def list_for_teacher(db: Session, teacher_id: str) -> list[tuple[Classroom, int]]:
    query = (
        select(Classroom, _student_count())
        .where(Classroom.teacher_id == teacher_id)
        .order_by(Classroom.created_at.desc())
    )
    return [(row[0], row[1]) for row in db.execute(query).all()]


def student_count(db: Session, classroom_id: str) -> int:
    return (
        db.scalar(
            select(func.count(ClassEnrollment.id)).where(
                ClassEnrollment.classroom_id == classroom_id
            )
        )
        or 0
    )


def roster(db: Session, classroom_id: str):
    """Rows of (student User, grade, joined_at)."""
    query = (
        select(User, StudentProfile.grade, ClassEnrollment.joined_at)
        .join(ClassEnrollment, ClassEnrollment.student_id == User.id)
        .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
        .where(ClassEnrollment.classroom_id == classroom_id)
        .order_by(User.name)
    )
    return db.execute(query).all()


def get_enrollment(db: Session, classroom_id: str, student_id: str) -> ClassEnrollment | None:
    return db.scalar(
        select(ClassEnrollment).where(
            ClassEnrollment.classroom_id == classroom_id,
            ClassEnrollment.student_id == student_id,
        )
    )


def enroll(db: Session, classroom_id: str, student_id: str) -> ClassEnrollment:
    enrollment = ClassEnrollment(classroom_id=classroom_id, student_id=student_id)
    db.add(enrollment)
    db.flush()
    return enrollment


def unenroll(db: Session, classroom_id: str, student_id: str) -> bool:
    result = db.execute(
        delete(ClassEnrollment).where(
            ClassEnrollment.classroom_id == classroom_id,
            ClassEnrollment.student_id == student_id,
        )
    )
    return result.rowcount > 0


def list_for_student(db: Session, student_id: str):
    """Rows of (Classroom, teacher User, joined_at, student_count)."""
    teacher = aliased(User)
    query = (
        select(Classroom, teacher, ClassEnrollment.joined_at, _student_count())
        .join(ClassEnrollment, ClassEnrollment.classroom_id == Classroom.id)
        .join(teacher, teacher.id == Classroom.teacher_id)
        .where(ClassEnrollment.student_id == student_id)
        .order_by(ClassEnrollment.joined_at.desc())
    )
    return db.execute(query).all()


def count_for_teacher(db: Session, teacher_id: str) -> int:
    query = select(func.count(Classroom.id)).where(Classroom.teacher_id == teacher_id)
    return db.scalar(query) or 0


def count_enrollments_for_student(db: Session, student_id: str) -> int:
    return (
        db.scalar(
            select(func.count(ClassEnrollment.id)).where(ClassEnrollment.student_id == student_id)
        )
        or 0
    )
