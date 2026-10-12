from app.models.user import UserRole
from tests.conftest import PASSWORD

USERS = "/api/v1/admin/users"


def test_admin_routes_require_authentication(client):
    assert client.get(USERS).status_code == 401


def test_admin_routes_reject_non_admins(create_user, login):
    create_user("student@example.com", UserRole.STUDENT)
    session = login("student@example.com")

    response = session.get(USERS)

    assert response.status_code == 403
    assert response.json()["success"] is False


def test_admin_creates_teacher_who_can_sign_in(create_user, login):
    create_user("admin@example.com", UserRole.ADMIN)
    admin = login("admin@example.com")

    created = admin.post(
        USERS,
        json={
            "name": "Ravi Kumar",
            "email": "ravi@example.com",
            "password": PASSWORD,
            "role": "teacher",
        },
    )
    assert created.status_code == 201
    assert created.json()["data"]["role"] == "teacher"

    teacher = login("ravi@example.com")
    assert teacher.get("/api/v1/auth/me").json()["data"]["role"] == "teacher"


def test_admin_lists_users_with_filter_and_counts(create_user, login):
    create_user("admin@example.com", UserRole.ADMIN)
    create_user("s1@example.com", UserRole.STUDENT)
    create_user("s2@example.com", UserRole.STUDENT)
    create_user("p1@example.com", UserRole.PARENT)
    admin = login("admin@example.com")

    response = admin.get(USERS, params={"role": "student", "page_size": 1})

    data = response.json()["data"]
    assert response.status_code == 200
    assert data["total"] == 2
    assert len(data["items"]) == 1
    assert data["items"][0]["role"] == "student"
    assert data["counts"] == {"student": 2, "parent": 1, "teacher": 0, "admin": 1}
