import re
from datetime import UTC, datetime, timedelta

from app.database import SessionLocal
from app.models.profile import StudentProfile
from app.models.user import UserRole

STUDENT = "/api/v1/student"
PARENT = "/api/v1/parent"


def link_code(student_client) -> str:
    return student_client.get(f"{STUDENT}/link-code").json()["data"]["code"]


def test_student_gets_a_stable_formatted_code(signed_in):
    student = signed_in("s@example.com", UserRole.STUDENT)

    first = link_code(student)

    assert re.fullmatch(r"[A-Z2-9]{4}-[A-Z2-9]{4}", first)
    assert link_code(student) == first
    regenerated = student.post(f"{STUDENT}/link-code").json()["data"]["code"]
    assert regenerated != first


def test_parent_links_with_code_and_code_rotates(signed_in):
    student = signed_in("s@example.com", UserRole.STUDENT, name="Asha Verma")
    parent = signed_in("p@example.com", UserRole.PARENT)
    other_parent = signed_in("p2@example.com", UserRole.PARENT)
    code = link_code(student)

    # Codes are accepted without the dash and in lowercase.
    response = parent.post(f"{PARENT}/children", json={"code": code.replace("-", "").lower()})

    assert response.status_code == 201
    assert response.json()["data"]["name"] == "Asha Verma"
    children = parent.get(f"{PARENT}/children").json()["data"]
    assert [child["email"] for child in children] == ["s@example.com"]
    assert link_code(student) != code
    assert other_parent.post(f"{PARENT}/children", json={"code": code}).status_code == 400


def test_linking_twice_is_a_conflict(signed_in):
    student = signed_in("s@example.com", UserRole.STUDENT)
    parent = signed_in("p@example.com", UserRole.PARENT)
    parent.post(f"{PARENT}/children", json={"code": link_code(student)})

    response = parent.post(f"{PARENT}/children", json={"code": link_code(student)})

    assert response.status_code == 409


def test_invalid_and_expired_codes_are_rejected(signed_in):
    student = signed_in("s@example.com", UserRole.STUDENT)
    parent = signed_in("p@example.com", UserRole.PARENT)
    code = link_code(student)
    with SessionLocal() as db:
        profile = db.query(StudentProfile).one()
        profile.link_code_expires_at = datetime.now(UTC) - timedelta(minutes=1)
        db.commit()

    assert parent.post(f"{PARENT}/children", json={"code": "ZZZZ-ZZZZ"}).status_code == 400
    assert parent.post(f"{PARENT}/children", json={"code": code}).status_code == 400
    assert link_code(student) != code  # expired code is replaced on next view


def test_roles_are_enforced(signed_in):
    student = signed_in("s@example.com", UserRole.STUDENT)
    parent = signed_in("p@example.com", UserRole.PARENT)

    assert parent.get(f"{STUDENT}/link-code").status_code == 403
    assert student.post(f"{PARENT}/children", json={"code": "ABCD-EFGH"}).status_code == 403


def test_student_sees_and_removes_parents(signed_in):
    student = signed_in("s@example.com", UserRole.STUDENT)
    parent = signed_in("p@example.com", UserRole.PARENT, name="Meera Verma")
    parent.post(f"{PARENT}/children", json={"code": link_code(student)})

    parents = student.get(f"{STUDENT}/parents").json()["data"]
    assert [p["name"] for p in parents] == ["Meera Verma"]

    assert student.delete(f"{STUDENT}/parents/{parents[0]['id']}").status_code == 200
    assert parent.get(f"{PARENT}/children").json()["data"] == []


def test_parent_unlinks_child(signed_in):
    student = signed_in("s@example.com", UserRole.STUDENT)
    parent = signed_in("p@example.com", UserRole.PARENT)
    child = parent.post(f"{PARENT}/children", json={"code": link_code(student)}).json()["data"]

    assert parent.delete(f"{PARENT}/children/{child['id']}").status_code == 200
    assert parent.delete(f"{PARENT}/children/{child['id']}").status_code == 404
    assert student.get(f"{STUDENT}/parents").json()["data"] == []
