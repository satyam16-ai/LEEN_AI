import pytest
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models.document import Document, DocumentChunk
from app.models.syllabus import SyllabusChapter, SyllabusSubject, SyllabusTopic
from app.models.user import UserRole
from app.repositories import document_repository, syllabus_repository


def test_subject_tree_round_trip(create_user):
    student = create_user("tree@example.com", UserRole.STUDENT)
    with SessionLocal() as db:
        subject = syllabus_repository.get_or_create_subject(db, student.id, "Science")
        subject.chapters = [
            SyllabusChapter(
                position=1,
                title="Gravitation",
                topics=[
                    SyllabusTopic(position=1, title="Free fall"),
                    SyllabusTopic(position=0, title="Kepler's laws"),
                ],
            ),
            SyllabusChapter(
                position=0,
                title="Force and laws of motion",
                topics=[SyllabusTopic(position=0, title="Inertia", done=True)],
            ),
        ]
        db.commit()

    with SessionLocal() as db:
        subject = syllabus_repository.get_subject(db, student.id, "science")
        assert subject.subject == "Science"
        assert subject.status == "empty"
        assert [c.title for c in subject.chapters] == ["Force and laws of motion", "Gravitation"]
        assert [t.title for t in subject.chapters[1].topics] == ["Kepler's laws", "Free fall"]
        assert subject.chapters[0].topics[0].done is True
        assert (
            syllabus_repository.get_or_create_subject(db, student.id, " SCIENCE ").id == subject.id
        )
        assert len(syllabus_repository.topic_ids_for(db, student.id)) == 3
        assert [s.subject for s in syllabus_repository.list_subjects(db, student.id)] == ["Science"]


def test_subject_key_is_unique_per_student(create_user):
    student = create_user("unique@example.com", UserRole.STUDENT)
    with SessionLocal() as db:
        db.add(SyllabusSubject(student_id=student.id, subject="Maths", subject_key="maths"))
        db.commit()
        db.add(SyllabusSubject(student_id=student.id, subject="maths", subject_key="maths"))
        with pytest.raises(IntegrityError):
            db.commit()


def test_chunks_store_vectors(create_user):
    student = create_user("chunks@example.com", UserRole.STUDENT)
    vector = [0.0] * 384
    vector[7] = 1.0
    with SessionLocal() as db:
        document = document_repository.create(
            db,
            student_id=student.id,
            subject="Science",
            subject_key="science",
            title="Force",
            file_name="pages/x.jpg",
            media_type="image/jpeg",
            pages=1,
        )
        document_repository.replace_chunks(db, document, [(1, "Inertia is...", vector)])
        db.commit()
        document_id = document.id

    with SessionLocal() as db:
        chunk = db.query(DocumentChunk).one()
        assert (chunk.page, chunk.text) == (1, "Inertia is...")
        assert list(chunk.embedding)[7] == pytest.approx(1.0)
        document = document_repository.get_owned(db, document_id, student.id)
        assert document.status == "queued"
        assert document_repository.get_owned(db, document_id, "someone-else") is None
        assert [d.id for d in document_repository.list_for(db, student.id, "science")] == [
            document_id
        ]
        db.delete(document)
        db.commit()
        assert db.query(DocumentChunk).count() == 0
        assert db.query(Document).count() == 0
