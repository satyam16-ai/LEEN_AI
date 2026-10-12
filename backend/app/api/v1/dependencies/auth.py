# =============================================================================
# Auth dependencies — current user, role checks, CSRF header check
# =============================================================================

from fastapi import Cookie, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import ACCESS_COOKIE, decode_access_token
from app.database import get_db
from app.models.user import User, UserRole
from app.repositories import user_repository

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def require_csrf_header(request: Request) -> None:
    """Cross-site forms can't set custom headers, and cross-origin fetches with one
    need a CORS preflight we don't allow — so this header proves a same-origin caller.
    Sec-Fetch-Site is browser-controlled, which keeps Swagger /docs usable."""
    if request.method not in UNSAFE_METHODS:
        return
    if request.headers.get("x-requested-with", "").lower() == "xmlhttprequest":
        return
    if request.headers.get("sec-fetch-site") == "same-origin":
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Missing CSRF header")


def get_current_user(
    access_token: str | None = Cookie(default=None, alias=ACCESS_COOKIE),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    if not access_token:
        raise unauthorized
    payload = decode_access_token(access_token)
    if payload is None:
        raise unauthorized
    user = user_repository.get_by_id(db, payload["sub"])
    if user is None or not user.is_active or payload.get("tv") != user.token_version:
        raise unauthorized
    return user


def require_roles(*roles: UserRole):
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "You don't have permission to access this resource"
            )
        return user

    return dependency
