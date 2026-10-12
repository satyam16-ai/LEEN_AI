# =============================================================================
# Admin User Management — /api/v1/admin/users
# =============================================================================

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies.auth import require_roles
from app.database import get_db
from app.models.user import UserRole
from app.repositories import user_repository
from app.schemas.response import ok
from app.schemas.user import AdminCreateUserRequest, UserListOut, UserOut
from app.services import auth_service

router = APIRouter(dependencies=[Depends(require_roles(UserRole.ADMIN))])


@router.get("")
def list_users(
    role: UserRole | None = None,
    search: str | None = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    items, total = user_repository.list_users(
        db, role=role, search=search, page=page, page_size=page_size
    )
    result = UserListOut(
        items=[UserOut.model_validate(user) for user in items],
        total=total,
        page=page,
        page_size=page_size,
        counts=user_repository.count_by_role(db),
    )
    return ok(result)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_user(payload: AdminCreateUserRequest, db: Session = Depends(get_db)):
    user = auth_service.create_user(
        db, name=payload.name, email=payload.email, password=payload.password, role=payload.role
    )
    return ok(UserOut.model_validate(user), f"{payload.role.value.capitalize()} account created")
