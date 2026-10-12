# =============================================================================
# Auth Schemas
# =============================================================================

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.user import Email, Name, Password


class RegisterRequest(BaseModel):
    name: Name
    email: Email
    password: Password
    role: Literal["student", "parent"]


class LoginRequest(BaseModel):
    email: Email
    password: str = Field(min_length=1, max_length=128)
    remember_me: bool = False


class ForgotPasswordRequest(BaseModel):
    email: Email


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10, max_length=256)
    password: Password


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: Password
