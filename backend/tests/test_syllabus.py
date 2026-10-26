import json
from datetime import timedelta

import pytest

from app.core import tasks
from app.database import SessionLocal
from app.models.llm_call import LlmCall
from app.models.syllabus import SyllabusSubject
from app.models.user import UserRole, utcnow
from app.services import syllabus_service
from app.services.llm import claude_bridge
from app.services.llm.claude_bridge import BridgeOfflineError
from app.services.syllabus.reader import parse_draft
from tests.samples import png, text_pdf

SYLLABUS = "/api/v1/student/syllabus"
DRAFT = {
    "chapters": [
        {"title": "Matter in Our Surroundings", "topics": ["States of matter", "Evaporation"]},
        {"title": "Force and Laws of Motion", "topics": ["Inertia", "Newton's second law"]},
    ]
}


class _Queue(list):
    def delay(self, *args):
        self.append(args)


@pytest.fixture
def queued(monkeypatch):
    queue = _Queue()
    monkeypatch.setattr(tasks, "read_syllabus_task", queue)
    return queue


def fake_reader(reply, error=None):
    async def stream_text(system, prompt, *, usage=None, images=(), **kwargs):
        fake_reader.calls.append({"system": system, "prompt": prompt, "images": images})
        if error:
            raise error
        yield reply

    fake_reader.calls = []
    return stream_text


@pytest.fixture
def student(signed_in):
    client = signed_in("reader@example.com", UserRole.STUDENT)
    client.patch("/api/v1/profile", json={"subjects": ["Science", "Maths"]})
    return client


def upload(client, subject, *blobs):
    files = [
        ("files", (f"page{i}.bin", blob, "application/octet-stream"))
        for i, blob in enumerate(blobs)
    ]
    return client.post(f"{SYLLABUS}/{subject}/upload", files=files)


def subject_row(name="science"):
    with SessionLocal() as db:
        row = db.query(SyllabusSubject).filter_by(subject_key=name).one()
        db.expunge(row)
        return row


# -- the Syllabus Reader's reply ------------------------------------------------


def test_parse_draft_cleans_and_caps():
    reply = (
        "Here it is:\n"
        + json.dumps(
            {
                "chapters": [
                    {
                        "title": "  1. Matter   in our surroundings ",
                        "topics": ["States", " ", "States", "x" * 200],
                    },
                    {"title": "", "topics": ["dropped with its chapter"]},
                    {"title": "Atoms ........ 32", "topics": [{"title": "Dalton"}]},
                ]
                + [{"title": f"Chapter {n}", "topics": []} for n in range(45)]
            }
        )
        + "\nHope that helps!"
    )

    chapters = parse_draft(reply)

    assert chapters[0] == {"title": "Matter in our surroundings", "topics": ["States", "x" * 120]}
    assert chapters[1] == {"title": "Atoms", "topics": ["Dalton"]}
    assert len(chapters) == 40


@pytest.mark.parametrize(
    "reply", ["no json here", "{not json}", '{"chapters": []}', '{"chapters": 3}']
)
def test_parse_draft_rejects_garbage(reply):
    with pytest.raises(ValueError):
        parse_draft(reply)


# -- endpoints --------------------------------------------------------------------


def test_list_subjects_follows_profile(student):
    response = student.get(SYLLABUS)

    assert response.status_code == 200
    assert response.json()["data"] == [
        {"subject": "Science", "status": "empty", "chapters": 0, "topics": 0, "done": 0},
        {"subject": "Maths", "status": "empty", "chapters": 0, "topics": 0, "done": 0},
    ]


def test_upload_queues_reading(student, queued):
    response = upload(student, "science", png())

    assert response.status_code == 202
    assert response.json()["data"]["status"] == "reading"
    assert response.json()["data"]["subject"] == "Science"
    row = subject_row()
    assert queued == [(row.id,)]
    assert len(row.sources) == 1 and row.sources[0].startswith("syllabus/")


def test_upload_rejects_mixed_or_too_many_files(student, queued):
    assert upload(student, "Science", png(), png(), png(), png()).status_code == 422
    assert upload(student, "Science", png(), text_pdf(["Contents"])).status_code == 422
    assert upload(student, "Science", b"not an image").status_code == 422
    assert queued == []


def test_unknown_subject_is_404(student, queued):
    assert student.get(f"{SYLLABUS}/History").status_code == 404
    assert upload(student, "History", png()).status_code == 404
    assert student.put(f"{SYLLABUS}/History", json={"chapters": []}).status_code == 404


def test_stale_reading_allows_new_upload(student, queued):
    upload(student, "Science", png())
    assert upload(student, "Science", png()).status_code == 409

    with SessionLocal() as db:
        row = db.query(SyllabusSubject).one()
        row.updated_at = utcnow() - timedelta(minutes=11)
        db.commit()

    assert upload(student, "Science", png()).status_code == 202
    assert len(queued) == 2


# -- the reading job ----------------------------------------------------------------


def test_read_syllabus_builds_draft(student, queued, monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", fake_reader(json.dumps(DRAFT)))
    upload(student, "Science", png())

    syllabus_service.read_syllabus(subject_row().id)

    tree = student.get(f"{SYLLABUS}/Science").json()["data"]
    assert tree["status"] == "draft"
    assert [c["title"] for c in tree["chapters"]] == [
        "Matter in Our Surroundings",
        "Force and Laws of Motion",
    ]
    assert [t["title"] for t in tree["chapters"][1]["topics"]] == ["Inertia", "Newton's second law"]
    call = fake_reader.calls[0]
    assert len(call["images"]) == 1 and call["images"][0].media_type == "image/jpeg"
    assert "Science" in call["prompt"]
    with SessionLocal() as db:
        assert db.query(LlmCall).one().agent == "syllabus_reader"


def test_text_pdf_is_sent_as_text(student, queued, monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", fake_reader(json.dumps(DRAFT)))
    contents = "Contents. 1 Matter in our surroundings 2 Is matter around us pure " * 4
    upload(student, "Science", text_pdf([contents]))

    syllabus_service.read_syllabus(subject_row().id)

    call = fake_reader.calls[0]
    assert call["images"] == ()
    assert "Is matter around us pure" in call["prompt"]
    assert "<contents>" in call["prompt"]
    assert subject_row().status == "draft"


@pytest.mark.parametrize(
    "stream",
    [fake_reader("I can't see a contents page."), fake_reader("", BridgeOfflineError("down"))],
)
def test_reader_failure_marks_failed(student, queued, monkeypatch, stream):
    monkeypatch.setattr(claude_bridge, "stream_text", stream)
    upload(student, "Science", png())

    syllabus_service.read_syllabus(subject_row().id)

    tree = student.get(f"{SYLLABUS}/Science").json()["data"]
    assert tree["status"] == "failed"
    assert tree["error"] == "Couldn't read that page. Try a clearer photo or type it yourself."
    assert upload(student, "Science", png()).status_code == 202


# -- editing the tree -------------------------------------------------------------------


def saved_tree(student, monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", fake_reader(json.dumps(DRAFT)))
    upload(student, "Science", png())
    syllabus_service.read_syllabus(subject_row().id)
    return student.get(f"{SYLLABUS}/Science").json()["data"]


def test_save_tree_keeps_ids_and_order(student, queued, monkeypatch):
    tree = saved_tree(student, monkeypatch)
    matter, force = tree["chapters"]
    inertia, second_law = force["topics"]

    payload = {
        "chapters": [
            {
                "id": force["id"],
                "title": "Force & laws of motion",
                "topics": [
                    {"id": second_law["id"], "title": second_law["title"], "done": True},
                    {"id": inertia["id"], "title": "Inertia and mass"},
                    {"title": "Third law"},
                ],
            },
            {"id": matter["id"], "title": matter["title"], "topics": matter["topics"][:1]},
        ]
    }
    response = student.put(f"{SYLLABUS}/Science", json=payload)

    assert response.status_code == 200
    saved = response.json()["data"]
    assert saved["status"] == "draft"
    first, second = saved["chapters"]
    assert (first["id"], first["title"]) == (force["id"], "Force & laws of motion")
    assert [t["id"] for t in first["topics"][:2]] == [second_law["id"], inertia["id"]]
    assert first["topics"][0]["done"] is True
    assert first["topics"][1]["title"] == "Inertia and mass"
    assert first["topics"][2]["id"] not in {inertia["id"], second_law["id"]}
    assert second["id"] == matter["id"]
    assert [t["title"] for t in second["topics"]] == ["States of matter"]
    assert student.get(f"{SYLLABUS}/Science").json()["data"] == saved


def test_save_tree_ignores_foreign_ids(student, signed_in, queued, monkeypatch):
    tree = saved_tree(student, monkeypatch)
    foreign_topic = tree["chapters"][0]["topics"][0]["id"]
    foreign_chapter = tree["chapters"][0]["id"]

    other = signed_in("other@example.com", UserRole.STUDENT)
    other.patch("/api/v1/profile", json={"subjects": ["Science"]})
    payload = {
        "chapters": [
            {
                "id": foreign_chapter,
                "title": "Mine",
                "topics": [{"id": foreign_topic, "title": "Mine too"}],
            }
        ]
    }
    saved = other.put(f"{SYLLABUS}/Science", json=payload).json()["data"]

    assert saved["chapters"][0]["id"] != foreign_chapter
    assert saved["chapters"][0]["topics"][0]["id"] != foreign_topic
    assert student.get(f"{SYLLABUS}/Science").json()["data"] == tree


def test_confirm_sets_status(student, queued):
    payload = {
        "chapters": [{"title": "Polynomials", "topics": [{"title": "Zeroes"}]}],
        "confirm": True,
    }

    saved = student.put(f"{SYLLABUS}/Maths", json=payload).json()["data"]

    assert saved["status"] == "confirmed"
    assert saved["confirmed_at"] is not None
    summary = {s["subject"]: s for s in student.get(SYLLABUS).json()["data"]}
    assert summary["Maths"] == {
        "subject": "Maths",
        "status": "confirmed",
        "chapters": 1,
        "topics": 1,
        "done": 0,
    }


def test_save_tree_validates_input(student):
    too_long = {"chapters": [{"title": "x" * 121, "topics": []}]}
    assert student.put(f"{SYLLABUS}/Maths", json=too_long).status_code == 422
    blank = {"chapters": [{"title": "   ", "topics": []}]}
    assert student.put(f"{SYLLABUS}/Maths", json=blank).status_code == 422
