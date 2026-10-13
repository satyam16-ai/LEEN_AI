import re

from app.models.user import UserRole

TEACHER = "/api/v1/teacher/classes"
STUDENT = "/api/v1/student/classes"


def create_class(teacher, **overrides):
    payload = {"name": "Class 9 — Science", "subject": "Science", "grade": 9, **overrides}
    response = teacher.post(TEACHER, json=payload)
    assert response.status_code == 201, response.text
    return response.json()["data"]


def test_teacher_creates_and_lists_classes(signed_in):
    teacher = signed_in("t@example.com", UserRole.TEACHER)

    created = create_class(teacher, description="  Weekly lab sessions  ")

    assert re.fullmatch(r"[A-Z2-9]{6}", created["join_code"])
    assert created["description"] == "Weekly lab sessions"
    listed = teacher.get(TEACHER).json()["data"]
    assert [(c["id"], c["student_count"]) for c in listed] == [(created["id"], 0)]


def test_student_joins_with_code_and_appears_on_roster(signed_in):
    teacher = signed_in("t@example.com", UserRole.TEACHER, name="Ravi Kumar")
    student = signed_in("s@example.com", UserRole.STUDENT, name="Asha Verma")
    created = create_class(teacher)

    joined = student.post(f"{STUDENT}/join", json={"code": created["join_code"].lower()})

    assert joined.status_code == 201
    assert joined.json()["data"]["teacher"]["name"] == "Ravi Kumar"
    detail = teacher.get(f"{TEACHER}/{created['id']}").json()["data"]
    assert [s["name"] for s in detail["students"]] == ["Asha Verma"]
    assert detail["student_count"] == 1
    mine = student.get(STUDENT).json()["data"]
    assert [(c["name"], c["student_count"]) for c in mine] == [("Class 9 — Science", 1)]


def test_join_errors(signed_in):
    teacher = signed_in("t@example.com", UserRole.TEACHER)
    student = signed_in("s@example.com", UserRole.STUDENT)
    code = create_class(teacher)["join_code"]
    student.post(f"{STUDENT}/join", json={"code": code})

    assert student.post(f"{STUDENT}/join", json={"code": code}).status_code == 409
    assert student.post(f"{STUDENT}/join", json={"code": "ZZZZZZ"}).status_code == 400


def test_teachers_only_see_their_own_classes(signed_in):
    owner = signed_in("t@example.com", UserRole.TEACHER)
    other = signed_in("t2@example.com", UserRole.TEACHER)
    class_id = create_class(owner)["id"]

    assert other.get(f"{TEACHER}/{class_id}").status_code == 404
    assert other.patch(f"{TEACHER}/{class_id}", json={"name": "Mine now"}).status_code == 404
    assert other.delete(f"{TEACHER}/{class_id}").status_code == 404
    assert other.get(TEACHER).json()["data"] == []


def test_regenerating_code_invalidates_old_one(signed_in):
    teacher = signed_in("t@example.com", UserRole.TEACHER)
    student = signed_in("s@example.com", UserRole.STUDENT)
    created = create_class(teacher)

    fresh = teacher.post(f"{TEACHER}/{created['id']}/join-code").json()["data"]["join_code"]

    assert fresh != created["join_code"]
    assert student.post(f"{STUDENT}/join", json={"code": created["join_code"]}).status_code == 400
    assert student.post(f"{STUDENT}/join", json={"code": fresh}).status_code == 201


def test_remove_student_leave_update_and_delete(signed_in):
    teacher = signed_in("t@example.com", UserRole.TEACHER)
    student = signed_in("s@example.com", UserRole.STUDENT)
    created = create_class(teacher)
    student.post(f"{STUDENT}/join", json={"code": created["join_code"]})
    student_id = student.get("/api/v1/auth/me").json()["data"]["id"]

    removed = teacher.delete(f"{TEACHER}/{created['id']}/students/{student_id}")
    assert removed.status_code == 200
    assert student.delete(f"{STUDENT}/{created['id']}").status_code == 404

    renamed = teacher.patch(f"{TEACHER}/{created['id']}", json={"name": "Physics Lab"})
    assert renamed.json()["data"]["name"] == "Physics Lab"
    assert teacher.patch(f"{TEACHER}/{created['id']}", json={"name": None}).status_code == 400

    student.post(f"{STUDENT}/join", json={"code": created["join_code"]})
    assert teacher.delete(f"{TEACHER}/{created['id']}").status_code == 200
    assert student.get(STUDENT).json()["data"] == []


def test_students_cannot_manage_classes(signed_in):
    student = signed_in("s@example.com", UserRole.STUDENT)

    assert student.post(TEACHER, json={"name": "Hack", "subject": "Maths"}).status_code == 403
