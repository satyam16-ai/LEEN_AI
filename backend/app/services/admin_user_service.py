# =============================================================================
# Admin User Service — inspect, edit, (de)activate users
# =============================================================================

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.repositories import (
    classroom_repository,
    family_repository,
    token_repository,
    user_repository,
)
from app.schemas.admin import AdminUserDetail
from app.schemas.user import AdminUserUpdate, UserOut
from app.services import auth_service, classroom_service, family_service, profile_service


def _get_or_404(db: Session, user_id: str) -> User:
    user = user_repository.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


def get_detail(db: Session, user_id: str) -> AdminUserDetail:
    user = _get_or_404(db, user_id)
    detail = AdminUserDetail(user=UserOut.model_validate(user))
    if user.role == UserRole.STUDENT:
        detail.student_profile = profile_service.get_profile(db, user).student_profile
        detail.parents = family_service.list_parents(db, user)
        detail.classes_enrolled = classroom_service.list_for_student(db, user)
    elif user.role == UserRole.PARENT:
        detail.children = family_service.list_children(db, user)
    elif user.role == UserRole.TEACHER:
        detail.classes_taught = classroom_service.list_for_teacher(db, user)
    return detail


def _role_change_blocker(db: Session, user: User) -> str | None:
    """Role-specific data that would be orphaned by a role change."""
    if user.role in (UserRole.STUDENT, UserRole.PARENT) and family_repository.count_links_for_user(
        db, user.id
    ):
        return "parent/child links"
    if user.role == UserRole.STUDENT and classroom_repository.count_enrollments_for_student(
        db, user.id
    ):
        return "class enrollments"
    if user.role == UserRole.TEACHER and classroom_repository.count_for_teacher(db, user.id):
        return "classes"
    return None


def update_user(db: Session, actor: User, user_id: str, payload: AdminUserUpdate) -> UserOut:
    user = _get_or_404(db, user_id)
    fields = payload.model_fields_set
    for field in fields:
        if getattr(payload, field) is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{field.capitalize()} can't be empty")

    role_changing = "role" in fields and payload.role != user.role
    deactivating = "is_active" in fields and payload.is_active is False and user.is_active

    if user.id == actor.id and (role_changing or deactivating):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "You can't change your own role or deactivate your own account",
        )
    if "email" in fields and payload.email != user.email:
        if user_repository.get_by_email(db, payload.email):
            raise HTTPException(status.HTTP_409_CONFLICT, auth_service.DUPLICATE_EMAIL)
        user.email = payload.email
    if (
        (role_changing or deactivating)
        and user.role == UserRole.ADMIN
        and user.is_active
        and user_repository.count_active_admins(db) <= 1
    ):
        raise HTTPException(status.HTTP_409_CONFLICT, "LEEN AI needs at least one active admin")
    if role_changing:
        blocker = _role_change_blocker(db, user)
        if blocker:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Remove this user's {blocker} before changing their role",
            )
        user.role = payload.role

    if "name" in fields:
        user.name = payload.name
    if "is_active" in fields:
        user.is_active = payload.is_active

    if role_changing or deactivating:
        # Force a fresh sign-in so the new role / suspension applies everywhere at once.
        user.token_version += 1
        token_repository.revoke_all_for_user(db, user.id)

    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


def send_password_reset(db: Session, user_id: str) -> None:
    user = _get_or_404(db, user_id)
    if not user.is_active:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Reactivate this account before sending a reset link"
        )
    auth_service.request_password_reset(db, user.email)
