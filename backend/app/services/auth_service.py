# =============================================================================
# Auth Service — registration, sessions, refresh rotation, password flows
# =============================================================================

import html
import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.core import security
from app.core.tasks import send_email_task
from app.models.auth_token import RefreshToken
from app.models.user import User, UserRole, utcnow
from app.repositories import token_repository, user_repository

logger = logging.getLogger("leen_ai")

INVALID_CREDENTIALS = "Invalid email or password"
INVALID_SESSION = "Your session has expired. Please sign in again."
INVALID_RESET_TOKEN = "This reset link is invalid or has expired. Please request a new one."
DUPLICATE_EMAIL = "An account with this email already exists"


@dataclass
class AuthSession:
    user: User
    access_token: str
    # None means "keep the refresh cookie the browser already has" (multi-tab grace path).
    refresh_token: str | None
    persistent: bool


def _as_aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _access_token(user: User) -> str:
    return security.create_access_token(user.id, user.role.value, user.token_version)


def create_user(db: Session, *, name: str, email: str, password: str, role: UserRole) -> User:
    if user_repository.get_by_email(db, email):
        raise HTTPException(status.HTTP_409_CONFLICT, DUPLICATE_EMAIL)
    try:
        user = user_repository.create(
            db, name=name, email=email, password_hash=security.hash_password(password), role=role
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, DUPLICATE_EMAIL) from exc
    db.refresh(user)
    return user


def _issue_session(
    db: Session,
    user: User,
    *,
    persistent: bool,
    user_agent: str | None,
    family_id: str | None = None,
) -> tuple[AuthSession, RefreshToken]:
    raw_refresh, refresh_hash = security.generate_token()
    ttl = (
        timedelta(days=settings.refresh_token_ttl_days)
        if persistent
        else timedelta(hours=settings.refresh_token_session_ttl_hours)
    )
    record = token_repository.create_refresh_token(
        db,
        user_id=user.id,
        token_hash=refresh_hash,
        family_id=family_id or str(uuid.uuid4()),
        persistent=persistent,
        expires_at=utcnow() + ttl,
        user_agent=user_agent,
    )
    session = AuthSession(
        user=user,
        access_token=_access_token(user),
        refresh_token=raw_refresh,
        persistent=persistent,
    )
    return session, record


def start_session(
    db: Session, user: User, *, persistent: bool, user_agent: str | None
) -> AuthSession:
    session, _ = _issue_session(db, user, persistent=persistent, user_agent=user_agent)
    user.last_login_at = utcnow()
    db.commit()
    return session


def authenticate(db: Session, email: str, password: str) -> User:
    user = user_repository.get_by_email(db, email)
    if user is None:
        security.verify_password(password, security.DUMMY_PASSWORD_HASH)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_CREDENTIALS)
    if not security.verify_password(password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_CREDENTIALS)
    if not user.is_active:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "This account has been deactivated. Contact support."
        )
    return user


def _within_grace(stored: RefreshToken, db: Session) -> bool:
    """Two tabs can send the same refresh token before either sees the rotated cookie.
    Allow a rotated-out token for a few seconds as long as its successor is still live."""
    if stored.replaced_by_id is None or stored.revoked_at is None:
        return False
    age = (utcnow() - _as_aware(stored.revoked_at)).total_seconds()
    if age > settings.refresh_reuse_grace_seconds:
        return False
    successor = db.get(RefreshToken, stored.replaced_by_id)
    return successor is not None and successor.revoked_at is None


def rotate_refresh_token(db: Session, raw_token: str | None, user_agent: str | None) -> AuthSession:
    if not raw_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION)
    stored = token_repository.get_refresh_token(db, security.hash_token(raw_token))
    if stored is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION)

    user = user_repository.get_by_id(db, stored.user_id)
    if user is None or not user.is_active:
        token_repository.revoke_family(db, stored.family_id)
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION)

    if stored.revoked_at is not None:
        if _within_grace(stored, db):
            return AuthSession(
                user=user,
                access_token=_access_token(user),
                refresh_token=None,
                persistent=stored.persistent,
            )
        # A rotated-out token was replayed: treat the whole family as compromised.
        logger.warning("Refresh token reuse detected; revoking family %s", stored.family_id)
        token_repository.revoke_family(db, stored.family_id)
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION)

    if _as_aware(stored.expires_at) <= utcnow():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_SESSION)

    session, successor = _issue_session(
        db,
        user,
        persistent=stored.persistent,
        user_agent=user_agent,
        family_id=stored.family_id,
    )
    stored.revoked_at = utcnow()
    stored.replaced_by_id = successor.id
    db.commit()
    return session


def logout(db: Session, raw_token: str | None) -> None:
    if not raw_token:
        return
    stored = token_repository.get_refresh_token(db, security.hash_token(raw_token))
    if stored is not None:
        token_repository.revoke_family(db, stored.family_id)
        db.commit()


def _invalidate_all_sessions(db: Session, user: User) -> None:
    user.token_version += 1
    token_repository.revoke_all_for_user(db, user.id)


def request_password_reset(db: Session, email: str) -> None:
    """Silently does nothing for unknown/inactive accounts to avoid user enumeration."""
    user = user_repository.get_by_email(db, email)
    if user is None or not user.is_active:
        return

    token_repository.invalidate_reset_tokens(db, user.id)
    raw, token_hash = security.generate_token()
    token_repository.create_reset_token(
        db,
        user_id=user.id,
        token_hash=token_hash,
        expires_at=utcnow() + timedelta(minutes=settings.password_reset_ttl_minutes),
    )
    db.commit()

    link = f"{settings.frontend_url.rstrip('/')}/reset-password?token={raw}"
    minutes = settings.password_reset_ttl_minutes
    text = (
        f"Hi {user.name},\n\n"
        f"We received a request to reset your LEEN AI password.\n"
        f"Reset it here (valid for {minutes} minutes):\n{link}\n\n"
        f"If you didn't request this, you can ignore this email."
    )
    body_html = (
        f"<p>Hi {html.escape(user.name)},</p>"
        f"<p>We received a request to reset your LEEN AI password.</p>"
        f'<p><a href="{link}" style="display:inline-block;padding:10px 18px;'
        f'background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none">'
        f"Reset password</a></p>"
        f"<p>This link is valid for {minutes} minutes. If you didn't request this, "
        f"you can ignore this email.</p>"
    )
    try:
        send_email_task.delay(user.email, "Reset your LEEN AI password", text, body_html)
    except Exception:
        # Broker outage must not leak whether the account exists via a 500.
        logger.exception("Could not enqueue password reset email")


def reset_password(db: Session, raw_token: str, new_password: str) -> None:
    stored = token_repository.get_reset_token(db, security.hash_token(raw_token))
    if stored is None or stored.used_at is not None or _as_aware(stored.expires_at) <= utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, INVALID_RESET_TOKEN)
    user = user_repository.get_by_id(db, stored.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, INVALID_RESET_TOKEN)

    user.password_hash = security.hash_password(new_password)
    stored.used_at = utcnow()
    token_repository.invalidate_reset_tokens(db, user.id)
    _invalidate_all_sessions(db, user)
    db.commit()


def change_password(
    db: Session,
    user: User,
    current_password: str,
    new_password: str,
    *,
    raw_refresh: str | None,
    user_agent: str | None,
) -> AuthSession:
    """Change password, sign out every other session, and keep this one alive."""
    # 400 rather than 401: a 401 would make the client try to refresh the session.
    if not security.verify_password(current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    current = (
        token_repository.get_refresh_token(db, security.hash_token(raw_refresh))
        if raw_refresh
        else None
    )
    user.password_hash = security.hash_password(new_password)
    _invalidate_all_sessions(db, user)
    session, _ = _issue_session(
        db, user, persistent=current.persistent if current else False, user_agent=user_agent
    )
    db.commit()
    return session
