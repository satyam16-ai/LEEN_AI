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


def user_id(session) -> str:
    return session.get("/api/v1/auth/me").json()["data"]["id"]


def test_admin_views_student_detail_with_relationships(signed_in):
    admin = signed_in("admin@example.com", UserRole.ADMIN)
    student = signed_in("s@example.com", UserRole.STUDENT)
    parent = signed_in("p@example.com", UserRole.PARENT, name="Meera Verma")
    teacher = signed_in("t@example.com", UserRole.TEACHER)
    student.patch("/api/v1/profile", json={"grade": 8})
    code = student.get("/api/v1/student/link-code").json()["data"]["code"]
    parent.post("/api/v1/parent/children", json={"code": code})
    join_code = teacher.post(
        "/api/v1/teacher/classes", json={"name": "Maths A", "subject": "Maths"}
    ).json()["data"]["join_code"]
    student.post("/api/v1/student/classes/join", json={"code": join_code})

    detail = admin.get(f"{USERS}/{user_id(student)}").json()["data"]

    assert detail["student_profile"]["grade"] == 8
    assert [p["name"] for p in detail["parents"]] == ["Meera Verma"]
    assert [c["name"] for c in detail["classes_enrolled"]] == ["Maths A"]
    assert admin.get(f"{USERS}/missing-id").status_code == 404


def test_admin_edits_name_and_email(signed_in, create_user):
    admin = signed_in("admin@example.com", UserRole.ADMIN)
    target = create_user("old@example.com", UserRole.TEACHER)
    create_user("taken@example.com", UserRole.STUDENT)

    updated = admin.patch(
        f"{USERS}/{target.id}", json={"name": "Ravi K", "email": "New@Example.com"}
    )
    assert updated.status_code == 200
    assert updated.json()["data"]["email"] == "new@example.com"

    taken = admin.patch(f"{USERS}/{target.id}", json={"email": "taken@example.com"})
    assert taken.status_code == 409


def test_deactivation_signs_user_out_and_blocks_login(signed_in, make_client):
    admin = signed_in("admin@example.com", UserRole.ADMIN)
    teacher = signed_in("t@example.com", UserRole.TEACHER)

    response = admin.patch(f"{USERS}/{user_id(teacher)}", json={"is_active": False})

    assert response.status_code == 200
    assert teacher.get("/api/v1/auth/me").status_code == 401
    retry = make_client().post(
        "/api/v1/auth/login", json={"email": "t@example.com", "password": PASSWORD}
    )
    assert retry.status_code == 403
    deactivated = admin.get(USERS, params={"status": "deactivated"}).json()["data"]["items"]
    assert [u["email"] for u in deactivated] == ["t@example.com"]

    admin.patch(f"{USERS}/{user_id_by_email(admin, 't@example.com')}", json={"is_active": True})
    reactivated = make_client().post(
        "/api/v1/auth/login", json={"email": "t@example.com", "password": PASSWORD}
    )
    assert reactivated.status_code == 200


def user_id_by_email(admin, email: str) -> str:
    items = admin.get(USERS, params={"search": email}).json()["data"]["items"]
    return items[0]["id"]


def test_admin_cannot_demote_or_deactivate_self(signed_in):
    admin = signed_in("admin@example.com", UserRole.ADMIN)
    me = user_id(admin)

    assert admin.patch(f"{USERS}/{me}", json={"role": "teacher"}).status_code == 400
    assert admin.patch(f"{USERS}/{me}", json={"is_active": False}).status_code == 400
    assert admin.patch(f"{USERS}/{me}", json={"name": "Chief Admin"}).status_code == 200


def test_role_change_requires_no_role_specific_data(signed_in):
    admin = signed_in("admin@example.com", UserRole.ADMIN)
    student = signed_in("s@example.com", UserRole.STUDENT)
    parent = signed_in("p@example.com", UserRole.PARENT)
    loner = signed_in("solo@example.com", UserRole.STUDENT)
    code = student.get("/api/v1/student/link-code").json()["data"]["code"]
    parent.post("/api/v1/parent/children", json={"code": code})

    blocked = admin.patch(f"{USERS}/{user_id(student)}", json={"role": "teacher"})
    assert blocked.status_code == 409
    assert "parent/child links" in blocked.json()["message"]

    loner_id = user_id(loner)
    changed = admin.patch(f"{USERS}/{loner_id}", json={"role": "teacher"})
    assert changed.status_code == 200
    assert changed.json()["data"]["role"] == "teacher"
    # Role changes force a fresh sign-in.
    assert loner.get("/api/v1/auth/me").status_code == 401


def test_admin_sends_password_reset(signed_in, create_user, outbox):
    admin = signed_in("admin@example.com", UserRole.ADMIN)
    target = create_user("t@example.com", UserRole.TEACHER)

    assert admin.post(f"{USERS}/{target.id}/password-reset").status_code == 200
    assert outbox[-1]["to"] == "t@example.com"

    admin.patch(f"{USERS}/{target.id}", json={"is_active": False})
    assert admin.post(f"{USERS}/{target.id}/password-reset").status_code == 409


def test_non_admins_cannot_edit_users(signed_in, create_user):
    teacher = signed_in("t@example.com", UserRole.TEACHER)
    target = create_user("s@example.com", UserRole.STUDENT)

    assert teacher.patch(f"{USERS}/{target.id}", json={"name": "X"}).status_code == 403
    assert teacher.get(f"{USERS}/{target.id}").status_code == 403
