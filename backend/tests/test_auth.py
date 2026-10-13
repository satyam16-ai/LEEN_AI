from datetime import UTC, datetime, timedelta

import jwt
import pytest
from sqlalchemy import text

from app.config import settings
from app.core import security
from app.database import SessionLocal
from app.models.user import User, UserRole
from tests.conftest import PASSWORD

AUTH = "/api/v1/auth"


def register(client, email="student@example.com", role="student", password=PASSWORD):
    return client.post(
        f"{AUTH}/register",
        json={"name": "Asha Verma", "email": email, "password": password, "role": role},
    )


def refresh_with(make_client, token):
    other = make_client()
    other.cookies.set("refresh_token", token, domain="testserver.local", path="/api/v1/auth")
    return other.post(f"{AUTH}/refresh")


@pytest.mark.parametrize("role", ["student", "parent"])
def test_register_self_service_roles_start_a_session(client, role):
    response = register(client, email=f"{role}@example.com", role=role)

    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    assert body["data"]["role"] == role
    assert "password_hash" not in body["data"]
    assert {"access_token", "refresh_token"} <= set(response.cookies.keys())

    me = client.get(f"{AUTH}/me")
    assert me.status_code == 200
    assert me.json()["data"]["email"] == f"{role}@example.com"


@pytest.mark.parametrize("role", ["teacher", "admin"])
def test_register_rejects_privileged_roles(client, role):
    response = register(client, role=role)

    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["data"]["errors"][0]["field"] == "role"


def test_register_rejects_duplicate_email_case_insensitively(client):
    assert register(client, email="dup@example.com").status_code == 201
    response = register(client, email="DUP@Example.com")

    assert response.status_code == 409
    assert response.json()["message"] == "An account with this email already exists"


def test_register_rejects_weak_password(client):
    response = register(client, password="onlyletters")

    assert response.status_code == 422
    errors = response.json()["data"]["errors"]
    assert errors[0]["field"] == "password"
    assert "letter and one number" in errors[0]["message"]


def test_role_is_stored_as_lowercase_value(client):
    register(client, email="enum@example.com", role="parent")
    with SessionLocal() as db:
        raw = db.execute(
            text("SELECT role::text FROM users WHERE email = :email"), {"email": "enum@example.com"}
        ).scalar_one()
    assert raw == "parent"


def test_login_returns_user_and_sets_cookies(client, create_user):
    create_user("teacher@example.com", UserRole.TEACHER)

    response = client.post(
        f"{AUTH}/login", json={"email": "Teacher@Example.com", "password": PASSWORD}
    )

    assert response.status_code == 200
    assert response.json()["data"]["role"] == "teacher"
    assert client.get(f"{AUTH}/me").status_code == 200


@pytest.mark.parametrize(
    ("email", "password"),
    [("known@example.com", "WrongPass1"), ("unknown@example.com", PASSWORD)],
)
def test_login_failures_share_one_message(client, create_user, email, password):
    create_user("known@example.com", UserRole.STUDENT)

    response = client.post(f"{AUTH}/login", json={"email": email, "password": password})

    assert response.status_code == 401
    assert response.json() == {
        "success": False,
        "message": "Invalid email or password",
        "data": None,
    }


def test_login_rejects_deactivated_user(client, create_user):
    user = create_user("inactive@example.com", UserRole.STUDENT)
    with SessionLocal() as db:
        db.get(User, user.id).is_active = False
        db.commit()

    response = client.post(
        f"{AUTH}/login", json={"email": "inactive@example.com", "password": PASSWORD}
    )

    assert response.status_code == 403


def test_me_requires_authentication(client):
    response = client.get(f"{AUTH}/me")

    assert response.status_code == 401
    assert response.json()["success"] is False


def test_access_token_tolerates_small_clock_skew():
    # A VM clock that steps back after issuing makes `iat` look slightly in the future.
    now = datetime.now(UTC)
    claims = {"sub": "user-1", "role": "student", "tv": 0, "type": "access"}
    token = jwt.encode(
        {**claims, "iat": now + timedelta(seconds=3), "exp": now + timedelta(minutes=15)},
        settings.secret_key,
        algorithm=settings.jwt_algorithm,
    )

    assert security.decode_access_token(token)["sub"] == "user-1"


def test_state_changing_requests_require_csrf_header(make_client, create_user):
    create_user("csrf@example.com", UserRole.STUDENT)
    bare = make_client(headers={})

    response = bare.post(f"{AUTH}/login", json={"email": "csrf@example.com", "password": PASSWORD})

    assert response.status_code == 403
    assert response.json()["message"] == "Missing CSRF header"


def test_same_origin_fetch_metadata_satisfies_csrf_check(make_client, create_user):
    create_user("fetchmeta@example.com", UserRole.STUDENT)
    browser = make_client(headers={"Sec-Fetch-Site": "same-origin"})

    response = browser.post(
        f"{AUTH}/login", json={"email": "fetchmeta@example.com", "password": PASSWORD}
    )

    assert response.status_code == 200


def test_refresh_rotates_token_and_detects_reuse(make_client, create_user, login, monkeypatch):
    monkeypatch.setattr(settings, "refresh_reuse_grace_seconds", 0)
    create_user("rotate@example.com", UserRole.STUDENT)
    session = login("rotate@example.com")
    original = session.cookies.get("refresh_token")

    rotated = session.post(f"{AUTH}/refresh")
    assert rotated.status_code == 200
    new_token = rotated.cookies.get("refresh_token")
    assert new_token and new_token != original

    # Replaying the rotated-out token revokes the whole family, including the new token.
    assert refresh_with(make_client, original).status_code == 401
    assert refresh_with(make_client, new_token).status_code == 401


def test_concurrent_refresh_from_another_tab_is_tolerated(make_client, create_user, login):
    create_user("tabs@example.com", UserRole.STUDENT)
    session = login("tabs@example.com")
    original = session.cookies.get("refresh_token")
    rotated = session.post(f"{AUTH}/refresh")
    new_token = rotated.cookies.get("refresh_token")

    # Second tab raced with the old token inside the grace window: gets an access
    # cookie only, and the family stays valid.
    late_tab = refresh_with(make_client, original)
    assert late_tab.status_code == 200
    assert "access_token" in late_tab.cookies
    assert "refresh_token" not in late_tab.cookies
    assert refresh_with(make_client, new_token).status_code == 200


def test_refresh_without_cookie_is_unauthorized(client):
    response = client.post(f"{AUTH}/refresh")

    assert response.status_code == 401


def test_remember_me_sets_persistent_refresh_cookie(client, create_user):
    create_user("remember@example.com", UserRole.STUDENT)

    persistent = client.post(
        f"{AUTH}/login",
        json={"email": "remember@example.com", "password": PASSWORD, "remember_me": True},
    )
    session_only = client.post(
        f"{AUTH}/login", json={"email": "remember@example.com", "password": PASSWORD}
    )

    def refresh_header(response):
        return next(
            h for h in response.headers.get_list("set-cookie") if h.startswith("refresh_token=")
        )

    assert "Max-Age" in refresh_header(persistent)
    assert "Max-Age" not in refresh_header(session_only)


def test_logout_revokes_refresh_token_and_clears_cookies(make_client, create_user, login):
    create_user("logout@example.com", UserRole.PARENT)
    session = login("logout@example.com")
    token = session.cookies.get("refresh_token")

    response = session.post(f"{AUTH}/logout")

    assert response.status_code == 200
    assert session.get(f"{AUTH}/me").status_code == 401
    assert refresh_with(make_client, token).status_code == 401


def test_forgot_password_is_silent_for_unknown_email(client, outbox):
    response = client.post(f"{AUTH}/forgot-password", json={"email": "ghost@example.com"})

    assert response.status_code == 200
    assert outbox == []


def test_password_reset_flow_revokes_sessions(make_client, create_user, login, outbox, client):
    create_user("reset@example.com", UserRole.STUDENT)
    session = login("reset@example.com")
    old_refresh = session.cookies.get("refresh_token")

    assert client.post(
        f"{AUTH}/forgot-password", json={"email": "reset@example.com"}
    ).status_code == 200
    token = outbox.reset_token_for("reset@example.com")

    response = client.post(
        f"{AUTH}/reset-password", json={"token": token, "password": "N3wPassword"}
    )
    assert response.status_code == 200

    # Both the still-unexpired access token and the refresh token stop working immediately.
    assert session.get(f"{AUTH}/me").status_code == 401
    assert refresh_with(make_client, old_refresh).status_code == 401
    login("reset@example.com", password="N3wPassword")

    reused = client.post(f"{AUTH}/reset-password", json={"token": token, "password": "An0therPass"})
    assert reused.status_code == 400


def test_new_reset_request_invalidates_previous_link(client, create_user, outbox):
    create_user("twice@example.com", UserRole.STUDENT)
    client.post(f"{AUTH}/forgot-password", json={"email": "twice@example.com"})
    first = outbox.reset_token_for("twice@example.com")
    client.post(f"{AUTH}/forgot-password", json={"email": "twice@example.com"})

    response = client.post(
        f"{AUTH}/reset-password", json={"token": first, "password": "N3wPassword"}
    )

    assert response.status_code == 400


def test_change_password(create_user, login, make_client):
    create_user("change@example.com", UserRole.STUDENT)
    other_device = login("change@example.com")
    other_refresh = other_device.cookies.get("refresh_token")
    assert other_device.get(f"{AUTH}/me").status_code == 200
    session = login("change@example.com")

    wrong = session.post(
        f"{AUTH}/change-password",
        json={"current_password": "nope", "new_password": "N3wPassword"},
    )
    assert wrong.status_code == 400

    changed = session.post(
        f"{AUTH}/change-password",
        json={"current_password": PASSWORD, "new_password": "N3wPassword"},
    )
    assert changed.status_code == 200
    assert session.get(f"{AUTH}/me").status_code == 200
    assert session.post(f"{AUTH}/refresh").status_code == 200
    assert other_device.get(f"{AUTH}/me").status_code == 401
    assert refresh_with(make_client, other_refresh).status_code == 401
    login("change@example.com", password="N3wPassword")
