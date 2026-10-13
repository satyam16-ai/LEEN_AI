# =============================================================================
# User Schemas
# =============================================================================

from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, StringConstraints

from app.models.user import UserRole


def _validate_password(value: str) -> str:
    if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
        raise ValueError("Password must contain at least one letter and one number")
    return value


Password = Annotated[str, Field(min_length=8, max_length=128), AfterValidator(_validate_password)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]


def _normalize_email(value: str) -> str:
    return value.strip().lower()


Email = Annotated[EmailStr, AfterValidator(_normalize_email)]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    role: UserRole
    is_active: bool
    avatar_url: str | None = None
    last_login_at: datetime | None
    created_at: datetime


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    avatar_url: str | None = None


class AdminCreateUserRequest(BaseModel):
    name: Name
    email: Email
    password: Password
    role: UserRole = UserRole.TEACHER


class AdminUserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name | None = None
    email: Email | None = None
    role: UserRole | None = None
    is_active: bool | None = None


class UserListOut(BaseModel):
    items: list[UserOut]
    total: int
    page: int
    page_size: int
    counts: dict[str, int]
