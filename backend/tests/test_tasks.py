import uuid
from datetime import UTC, datetime, timedelta

from app.core.tasks import cleanup_expired_tokens
from app.database import SessionLocal
from app.models.auth_token import PasswordResetToken, RefreshToken
from app.models.user import UserRole


def test_cleanup_removes_only_long_expired_tokens(create_user):
    user = create_user("s@example.com", UserRole.STUDENT)
    now = datetime.now(UTC)
    with SessionLocal() as db:
        for expires_at in (now - timedelta(days=3), now + timedelta(days=3)):
            db.add(
                RefreshToken(
                    user_id=user.id,
                    token_hash=uuid.uuid4().hex,
                    family_id=str(uuid.uuid4()),
                    expires_at=expires_at,
                )
            )
        db.add(
            PasswordResetToken(
                user_id=user.id, token_hash=uuid.uuid4().hex, expires_at=now - timedelta(days=2)
            )
        )
        db.commit()

    result = cleanup_expired_tokens()

    assert result == {"refresh_tokens": 1, "reset_tokens": 1}
    with SessionLocal() as db:
        assert db.query(RefreshToken).count() == 1
