# =============================================================================
# Auth Endpoints — /api/v1/auth
# =============================================================================

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.v1.dependencies.auth import get_current_user
from app.core import rate_limit
from app.core.security import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
)
from app.schemas.response import ok
from app.schemas.user import UserOut
from app.services import auth_service

router = APIRouter()


def _user_agent(request: Request) -> str | None:
    return request.headers.get("user-agent")


def _session_response(response: Response, session: auth_service.AuthSession) -> None:
    set_auth_cookies(response, session.access_token, session.refresh_token, session.persistent)


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(rate_limit.rate_limit("register", 10, 3600, rate_limit.client_ip)),
    ],
)
def register(
    payload: RegisterRequest, request: Request, response: Response, db: Session = Depends(get_db)
):
    user = auth_service.create_user(
        db,
        name=payload.name,
        email=payload.email,
        password=payload.password,
        role=UserRole(payload.role),
    )
    session = auth_service.start_session(
        db, user, persistent=False, user_agent=_user_agent(request)
    )
    _session_response(response, session)
    return ok(UserOut.model_validate(user), "Account created")


@router.post("/login")
def login(
    payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)
):
    rate_limit.enforce(f"login:{rate_limit.client_ip(request)}:{payload.email}", 5, 60)
    user = auth_service.authenticate(db, payload.email, payload.password)
    session = auth_service.start_session(
        db, user, persistent=payload.remember_me, user_agent=_user_agent(request)
    )
    _session_response(response, session)
    return ok(UserOut.model_validate(user), "Signed in")


@router.post("/refresh")
def refresh(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
    db: Session = Depends(get_db),
):
    try:
        session = auth_service.rotate_refresh_token(db, refresh_token, _user_agent(request))
    except HTTPException as exc:
        failed = JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "message": exc.detail, "data": None},
        )
        clear_auth_cookies(failed)
        return failed
    _session_response(response, session)
    return ok(UserOut.model_validate(session.user), "Session refreshed")


@router.post("/logout")
def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
    db: Session = Depends(get_db),
):
    auth_service.logout(db, refresh_token)
    clear_auth_cookies(response)
    return ok(message="Signed out")


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return ok(UserOut.model_validate(user))


@router.post("/forgot-password")
def forgot_password(
    payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)
):
    rate_limit.enforce(f"forgot:{rate_limit.client_ip(request)}", 10, 900)
    rate_limit.enforce(f"forgot:{payload.email}", 3, 900)
    auth_service.request_password_reset(db, payload.email)
    return ok(message="If an account exists for that email, we've sent a reset link.")


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    auth_service.reset_password(db, payload.token, payload.password)
    return ok(message="Password updated. You can now sign in.")


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = auth_service.change_password(
        db,
        user,
        payload.current_password,
        payload.new_password,
        raw_refresh=refresh_token,
        user_agent=_user_agent(request),
    )
    _session_response(response, session)
    return ok(message="Password changed. Other devices have been signed out.")
