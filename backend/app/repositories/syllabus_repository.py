# =============================================================================
# Syllabus repository — a student's subject trees
# =============================================================================

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.syllabus import SyllabusChapter, SyllabusSubject, SyllabusTopic


def subject_key(subject: str) -> str:
    """How subject names are matched: casefolded, single-spaced."""
    return " ".join(subject.split()).casefold()


def get_subject(
    db: Session, student_id: str, subject: str, lock: bool = False
) -> SyllabusSubject | None:
    query = select(SyllabusSubject).where(
        SyllabusSubject.student_id == student_id,
        SyllabusSubject.subject_key == subject_key(subject),
    )
    return db.scalar(query.with_for_update() if lock else query)


def get_subject_by_id(db: Session, subject_id: str) -> SyllabusSubject | None:
    return db.get(SyllabusSubject, subject_id)


def get_or_create_subject(db: Session, student_id: str, subject: str) -> SyllabusSubject:
    existing = get_subject(db, student_id, subject)
    if existing is not None:
        return existing
    created = SyllabusSubject(
        student_id=student_id,
        subject=" ".join(subject.split()),
        subject_key=subject_key(subject),
        sources=[],
    )
    db.add(created)
    db.flush()
    return created


def list_subjects(db: Session, student_id: str) -> list[SyllabusSubject]:
    return list(db.scalars(select(SyllabusSubject).where(SyllabusSubject.student_id == student_id)))


def topic_ids_for(db: Session, student_id: str) -> set[str]:
    """Every topic id in the student's trees, to check ids the browser sends back."""
    query = (
        select(SyllabusTopic.id)
        .join(SyllabusChapter, SyllabusTopic.chapter_id == SyllabusChapter.id)
        .join(SyllabusSubject, SyllabusChapter.subject_id == SyllabusSubject.id)
        .where(SyllabusSubject.student_id == student_id)
    )
    return set(db.scalars(query))


def get_topic(
    db: Session, student_id: str, topic_id: str, subject: str | None = None
) -> SyllabusTopic | None:
    """The student's topic (in `subject`'s tree, when given)."""
    query = (
        select(SyllabusTopic)
        .join(SyllabusChapter, SyllabusTopic.chapter_id == SyllabusChapter.id)
        .join(SyllabusSubject, SyllabusChapter.subject_id == SyllabusSubject.id)
        .where(SyllabusSubject.student_id == student_id, SyllabusTopic.id == topic_id)
    )
    if subject is not None:
        query = query.where(SyllabusSubject.subject_key == subject_key(subject))
    return db.scalar(query)
