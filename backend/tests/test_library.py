import pytest

from app.core import tasks
from app.database import SessionLocal
from app.models.document import Document, DocumentChunk
from app.models.llm_call import LlmCall
from app.models.user import UserRole
from app.services.library import ingest, ocr
from app.services.library.chunker import chunk_pages
from app.services.llm import claude_bridge
from tests.samples import png, text_image, text_pdf

DOCUMENTS = "/api/v1/student/documents"
SYLLABUS = "/api/v1/student/syllabus"
INERTIA = (
    "Inertia is the natural tendency of an object to resist a change in its state of "
    "motion or of rest. The mass of an object is a measure of its inertia."
)


class _Queue(list):
    def delay(self, *args):
        self.append(args)


@pytest.fixture
def queued(monkeypatch):
    queue = _Queue()
    monkeypatch.setattr(tasks, "ingest_document_task", queue)
    return queue


@pytest.fixture
def student(signed_in):
    client = signed_in("pages@example.com", UserRole.STUDENT)
    client.patch("/api/v1/profile", json={"subjects": ["Science", "Maths"]})
    return client


def fake_librarian(reply="Text read by the Librarian."):
    async def stream_text(system, prompt, *, usage=None, images=(), **kwargs):
        fake_librarian.calls.append({"system": system, "images": images})
        yield reply

    fake_librarian.calls = []
    return stream_text


def fake_ocr(results):
    """OCR that returns `results` in turn: (text, confidence) per page."""
    pages = iter(results)

    def read_page(jpeg):
        fake_ocr.calls += 1
        return next(pages)

    fake_ocr.calls = 0
    return read_page


def add_page(client, blob=None, subject="Science", **form):
    return client.post(
        DOCUMENTS,
        files={"file": ("page.jpg", blob or png(), "application/octet-stream")},
        data={"subject": subject, **form},
    )


def only_document():
    with SessionLocal() as db:
        document = db.query(Document).one()
        db.expunge(document)
        return document


# -- the chunker --------------------------------------------------------------------


def test_chunker_keeps_pages_and_overlap():
    long_page = " ".join(f"Sentence {n} about force and motion." for n in range(130))
    assert 4300 < len(long_page) < 4700

    chunks = chunk_pages([(3, long_page), (4, "A short page."), (5, "   ")])

    long_chunks = [chunk for chunk in chunks if chunk.page == 3]
    assert len(long_chunks) == 3
    assert all(len(chunk.text) <= 2000 for chunk in long_chunks)
    for first, second in zip(long_chunks, long_chunks[1:], strict=False):
        assert first.text[-100:] in second.text
    assert [(chunk.page, chunk.text) for chunk in chunks if chunk.page != 3] == [
        (4, "A short page.")
    ]


def test_ocr_reads_printed_text():
    text, confidence = ocr.read_page(text_image("Inertia resists change"))

    assert "Inertia" in text
    assert confidence > 60


# -- uploads --------------------------------------------------------------------------


def test_upload_queues_ingestion(student, queued):
    response = add_page(student, title="Force, page 112")

    assert response.status_code == 201
    document = response.json()["data"]
    assert (document["status"], document["subject"], document["title"]) == (
        "queued",
        "Science",
        "Force, page 112",
    )
    assert document["media_type"] == "image/jpeg"
    assert queued == [(document["id"],)]
    assert student.get(DOCUMENTS).json()["data"][0]["id"] == document["id"]


def test_upload_needs_a_profile_subject_and_own_topic(student, signed_in, queued):
    assert add_page(student, subject="History").status_code == 404

    other = signed_in("other@example.com", UserRole.STUDENT)
    other.patch("/api/v1/profile", json={"subjects": ["Science"]})
    tree = other.put(
        f"{SYLLABUS}/Science",
        json={"chapters": [{"title": "Force", "topics": [{"title": "Inertia"}]}]},
    ).json()["data"]
    foreign_topic = tree["chapters"][0]["topics"][0]["id"]

    assert add_page(student, topic_id=foreign_topic).status_code == 404
    assert queued == []


def test_upload_rejects_non_images(student, queued):
    assert add_page(student, b"plain text").status_code == 422
    assert queued == []


# -- ingestion --------------------------------------------------------------------------


def test_ingest_uses_ocr_when_confident(student, queued, monkeypatch):
    monkeypatch.setattr(ocr, "read_page", fake_ocr([(INERTIA, 85.0)]))
    monkeypatch.setattr(claude_bridge, "stream_text", fake_librarian())
    document_id = add_page(student).json()["data"]["id"]

    ingest.ingest_document(document_id)

    assert fake_librarian.calls == []
    assert only_document().status == "ready"
    with SessionLocal() as db:
        chunk = db.query(DocumentChunk).one()
        assert (chunk.page, chunk.text) == (1, INERTIA)
        assert len(chunk.embedding) == 384
    listed = student.get(DOCUMENTS, params={"subject": "science"}).json()["data"]
    assert listed[0]["status"] == "ready"


def test_ingest_asks_librarian_when_ocr_is_poor(student, queued, monkeypatch):
    monkeypatch.setattr(ocr, "read_page", fake_ocr([("lnert1a is th", 30.0)]))
    monkeypatch.setattr(claude_bridge, "stream_text", fake_librarian(INERTIA))
    document_id = add_page(student).json()["data"]["id"]

    ingest.ingest_document(document_id)

    assert len(fake_librarian.calls) == 1
    assert len(fake_librarian.calls[0]["images"]) == 1
    assert fake_librarian.calls[0]["system"] == ingest.LIBRARIAN_SYSTEM
    with SessionLocal() as db:
        assert db.query(DocumentChunk).one().text == INERTIA
        assert db.query(LlmCall).one().agent == "librarian"
    assert only_document().status == "ready"


def test_ingest_pdf_ocrs_only_empty_pages(student, queued, monkeypatch):
    monkeypatch.setattr(ocr, "read_page", fake_ocr([("Second law: F = ma for a body.", 90.0)]))
    pdf = text_pdf(["Newton first law of motion and inertia.", ""])
    document_id = add_page(student, pdf).json()["data"]["id"]

    ingest.ingest_document(document_id)

    assert fake_ocr.calls == 1
    with SessionLocal() as db:
        chunks = sorted((c.page, c.text) for c in db.query(DocumentChunk))
    assert chunks == [
        (1, "Newton first law of motion and inertia."),
        (2, "Second law: F = ma for a body."),
    ]
    assert only_document().pages == 2


@pytest.mark.parametrize("result", [("", 0.0), RuntimeError("tesseract crashed")])
def test_ingest_failure_marks_failed(student, queued, monkeypatch, result):
    def read_page(jpeg):
        if isinstance(result, Exception):
            raise result
        return result

    monkeypatch.setattr(ocr, "read_page", read_page)
    monkeypatch.setattr(claude_bridge, "stream_text", fake_librarian(""))
    document_id = add_page(student).json()["data"]["id"]

    ingest.ingest_document(document_id)

    document = only_document()
    assert document.status == "failed"
    assert document.error == "Couldn't read this page. Try a clearer photo."


# -- ownership and the syllabus ------------------------------------------------------------


def test_other_student_cannot_see_document(student, signed_in, queued):
    document_id = add_page(student).json()["data"]["id"]
    other = signed_in("nosy@example.com", UserRole.STUDENT)

    assert other.get(f"{DOCUMENTS}/{document_id}/file").status_code == 404
    assert other.delete(f"{DOCUMENTS}/{document_id}").status_code == 404
    assert other.get(DOCUMENTS).json()["data"] == []

    owner_file = student.get(f"{DOCUMENTS}/{document_id}/file")
    assert owner_file.status_code == 200
    assert owner_file.headers["content-type"] == "image/jpeg"
    assert owner_file.headers["cache-control"].startswith("private")


def test_delete_removes_file_and_chunks(student, queued, monkeypatch):
    monkeypatch.setattr(ocr, "read_page", fake_ocr([(INERTIA, 85.0)]))
    document_id = add_page(student).json()["data"]["id"]
    ingest.ingest_document(document_id)
    file_url = f"{DOCUMENTS}/{document_id}/file"

    assert student.delete(f"{DOCUMENTS}/{document_id}").status_code == 200

    assert student.get(file_url).status_code == 404
    with SessionLocal() as db:
        assert db.query(DocumentChunk).count() == 0


def test_deleting_topic_keeps_pages(student, queued):
    tree = student.put(
        f"{SYLLABUS}/Science",
        json={
            "chapters": [{"title": "Force", "topics": [{"title": "Inertia"}, {"title": "Mass"}]}]
        },
    ).json()["data"]
    chapter = tree["chapters"][0]
    inertia = chapter["topics"][0]
    document = add_page(student, topic_id=inertia["id"]).json()["data"]
    assert (document["topic_id"], document["title"]) == (inertia["id"], "Inertia")
    by_topic = student.get(DOCUMENTS, params={"topic_id": inertia["id"]}).json()["data"]
    assert [d["id"] for d in by_topic] == [document["id"]]

    student.put(
        f"{SYLLABUS}/Science",
        json={
            "chapters": [{"id": chapter["id"], "title": "Force", "topics": chapter["topics"][1:]}]
        },
    )

    kept = student.get(DOCUMENTS).json()["data"]
    assert [(d["id"], d["topic_id"]) for d in kept] == [(document["id"], None)]
