# =============================================================================
# Parent ↔ Student link repository
# =============================================================================

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.models.classroom import ClassEnrollment
from app.models.profile import ParentStudentLink, StudentProfile
from app.models.user import User


def get_link(db: Session, parent_id: str, student_id: str) -> ParentStudentLink | None:
    return db.scalar(
        select(ParentStudentLink).where(
            ParentStudentLink.parent_id == parent_id,
            ParentStudentLink.student_id == student_id,
        )
    )


def create_link(db: Session, parent_id: str, student_id: str) -> ParentStudentLink:
    link = ParentStudentLink(parent_id=parent_id, student_id=student_id)
    db.add(link)
    db.flush()
    return link


def delete_link(db: Session, parent_id: str, student_id: str) -> bool:
    result = db.execute(
        delete(ParentStudentLink).where(
            ParentStudentLink.parent_id == parent_id,
            ParentStudentLink.student_id == student_id,
        )
    )
    return result.rowcount > 0


def list_children(db: Session, parent_id: str):
    """Rows of (student User, StudentProfile | None, linked_at, class_count)."""
    class_count = (
        select(func.count(ClassEnrollment.id))
        .where(ClassEnrollment.student_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    query = (
        select(User, StudentProfile, ParentStudentLink.created_at, class_count)
        .join(ParentStudentLink, ParentStudentLink.student_id == User.id)
        .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
        .where(ParentStudentLink.parent_id == parent_id)
        .order_by(ParentStudentLink.created_at)
    )
    return db.execute(query).all()


def list_parents(db: Session, student_id: str):
    """Rows of (parent User, linked_at)."""
    query = (
        select(User, ParentStudentLink.created_at)
        .join(ParentStudentLink, ParentStudentLink.parent_id == User.id)
        .where(ParentStudentLink.student_id == student_id)
        .order_by(ParentStudentLink.created_at)
    )
    return db.execute(query).all()


def count_links_for_user(db: Session, user_id: str) -> int:
    return (
        db.scalar(
            select(func.count(ParentStudentLink.id)).where(
                or_(
                    ParentStudentLink.parent_id == user_id,
                    ParentStudentLink.student_id == user_id,
                )
            )
        )
        or 0
    )
