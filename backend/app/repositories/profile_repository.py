# =============================================================================
# Student profile repository
# =============================================================================

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.profile import StudentProfile


def get(db: Session, user_id: str) -> StudentProfile | None:
    return db.get(StudentProfile, user_id)


def get_or_create(db: Session, user_id: str) -> StudentProfile:
    profile = db.get(StudentProfile, user_id)
    if profile is None:
        profile = StudentProfile(user_id=user_id, subjects=[], preferred_language="en")
        db.add(profile)
        db.flush()
    return profile


def get_by_link_code(db: Session, code: str) -> StudentProfile | None:
    return db.scalar(select(StudentProfile).where(StudentProfile.link_code == code))


def link_code_exists(db: Session, code: str) -> bool:
    return get_by_link_code(db, code) is not None
