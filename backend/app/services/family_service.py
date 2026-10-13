# =============================================================================
# Family Service — parent ↔ student linking via short-lived codes
# =============================================================================

from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.core.codes import generate_code, normalize_code
from app.models.profile import StudentProfile
from app.models.user import User, UserRole, utcnow
from app.repositories import family_repository, profile_repository, user_repository
from app.schemas.family import LinkCodeOut, LinkedChildOut, LinkedParentOut
from app.utils.dates import ensure_aware

LINK_CODE_LENGTH = 8
INVALID_CODE = "That code is invalid or has expired. Ask your child for a new one."


def format_link_code(code: str) -> str:
    return f"{code[:4]}-{code[4:]}"


def _assign_new_code(db: Session, profile: StudentProfile) -> None:
    for _ in range(10):
        code = generate_code(LINK_CODE_LENGTH)
        if not profile_repository.link_code_exists(db, code):
            break
    profile.link_code = code
    profile.link_code_expires_at = utcnow() + timedelta(hours=settings.link_code_ttl_hours)


def _code_out(profile: StudentProfile) -> LinkCodeOut:
    return LinkCodeOut(
        code=format_link_code(profile.link_code), expires_at=profile.link_code_expires_at
    )


def _is_live(profile: StudentProfile) -> bool:
    return bool(
        profile.link_code
        and profile.link_code_expires_at
        and ensure_aware(profile.link_code_expires_at) > utcnow()
    )


def get_link_code(db: Session, student: User) -> LinkCodeOut:
    profile = profile_repository.get_or_create(db, student.id)
    if not _is_live(profile):
        _assign_new_code(db, profile)
    db.commit()
    return _code_out(profile)


def regenerate_link_code(db: Session, student: User) -> LinkCodeOut:
    profile = profile_repository.get_or_create(db, student.id)
    _assign_new_code(db, profile)
    db.commit()
    return _code_out(profile)


def _child_out(student: User, profile: StudentProfile | None, linked_at, class_count: int):
    return LinkedChildOut(
        id=student.id,
        name=student.name,
        email=student.email,
        avatar_url=student.avatar_url,
        linked_at=linked_at,
        grade=profile.grade if profile else None,
        board=profile.board if profile else None,
        school_name=profile.school_name if profile else None,
        profile_complete=profile.is_complete if profile else False,
        class_count=class_count,
    )


def redeem_link_code(db: Session, parent: User, raw_code: str) -> LinkedChildOut:
    profile = profile_repository.get_by_link_code(db, normalize_code(raw_code))
    if profile is None or not _is_live(profile):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, INVALID_CODE)

    student = user_repository.get_by_id(db, profile.user_id)
    if student is None or not student.is_active or student.role != UserRole.STUDENT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, INVALID_CODE)
    if family_repository.get_link(db, parent.id, student.id):
        raise HTTPException(status.HTTP_409_CONFLICT, f"You're already linked to {student.name}")

    link = family_repository.create_link(db, parent.id, student.id)
    # One code, one parent: rotate so a shared code can't be reused by someone else.
    _assign_new_code(db, profile)
    db.commit()
    return _child_out(student, profile, link.created_at, 0)


def list_children(db: Session, parent: User) -> list[LinkedChildOut]:
    return [
        _child_out(student, profile, linked_at, class_count or 0)
        for student, profile, linked_at, class_count in family_repository.list_children(
            db, parent.id
        )
    ]


def list_parents(db: Session, student: User) -> list[LinkedParentOut]:
    return [
        LinkedParentOut(
            id=parent.id,
            name=parent.name,
            email=parent.email,
            avatar_url=parent.avatar_url,
            linked_at=linked_at,
        )
        for parent, linked_at in family_repository.list_parents(db, student.id)
    ]


def unlink(db: Session, parent_id: str, student_id: str) -> None:
    if not family_repository.delete_link(db, parent_id, student_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Link not found")
    db.commit()
