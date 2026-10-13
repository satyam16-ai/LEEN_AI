# =============================================================================
# Admin User Management — /api/v1/admin/users
# =============================================================================

from typing import Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies.auth import require_roles
from app.database import get_db
from app.models.user import User, UserRole
from app.repositories import user_repository
from app.schemas.response import ok
from app.schemas.user import AdminCreateUserRequest, AdminUserUpdate, UserListOut, UserOut
from app.services import admin_user_service, auth_service

router = APIRouter()
current_admin = require_roles(UserRole.ADMIN)


@router.get("", dependencies=[Depends(current_admin)])
def list_users(
    role: UserRole | None = None,
    status_filter: Literal["active", "deactivated"] | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    is_active = None if status_filter is None else status_filter == "active"
    items, total = user_repository.list_users(
        db, role=role, search=search, page=page, page_size=page_size, is_active=is_active
    )
    result = UserListOut(
        items=[UserOut.model_validate(user) for user in items],
        total=total,
        page=page,
        page_size=page_size,
        counts=user_repository.count_by_role(db),
    )
    return ok(result)


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(current_admin)])
def create_user(payload: AdminCreateUserRequest, db: Session = Depends(get_db)):
    user = auth_service.create_user(
        db, name=payload.name, email=payload.email, password=payload.password, role=payload.role
    )
    return ok(UserOut.model_validate(user), f"{payload.role.value.capitalize()} account created")


@router.get("/{user_id}", dependencies=[Depends(current_admin)])
def get_user(user_id: str, db: Session = Depends(get_db)):
    return ok(admin_user_service.get_detail(db, user_id))


@router.patch("/{user_id}")
def update_user(
    user_id: str,
    payload: AdminUserUpdate,
    admin: User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    return ok(admin_user_service.update_user(db, admin, user_id, payload), "User updated")


@router.post("/{user_id}/password-reset", dependencies=[Depends(current_admin)])
def send_password_reset(user_id: str, db: Session = Depends(get_db)):
    admin_user_service.send_password_reset(db, user_id)
    return ok(message="Password reset link sent")
