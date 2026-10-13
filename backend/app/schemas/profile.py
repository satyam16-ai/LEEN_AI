# =============================================================================
# Profile Schemas
# =============================================================================

from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

from app.schemas.user import Name, UserOut

Board = Literal["cbse", "icse", "state", "ib", "igcse", "other"]
LearningLevel = Literal["beginner", "intermediate", "advanced"]
Language = Literal["en", "hi"]
Grade = Annotated[int, Field(ge=1, le=12)]
Subject = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=50)]
SchoolName = Annotated[str, StringConstraints(strip_whitespace=True, max_length=150)]

STUDENT_FIELDS = {
    "grade",
    "board",
    "school_name",
    "subjects",
    "learning_level",
    "preferred_language",
}


def _dedupe_subjects(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result = []
    for value in values:
        key = value.lower()
        if key not in seen:
            seen.add(key)
            result.append(value)
    return result


class StudentProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    grade: int | None
    board: str | None
    school_name: str | None
    subjects: list[str]
    learning_level: str | None
    preferred_language: str
    is_complete: bool


class ProfileOut(BaseModel):
    user: UserOut
    student_profile: StudentProfileOut | None = None


class ProfileUpdate(BaseModel):
    """Partial update. Student-only fields are rejected for other roles."""

    model_config = ConfigDict(extra="forbid")

    name: Name | None = None
    grade: Grade | None = None
    board: Board | None = None
    school_name: SchoolName | None = None
    subjects: (
        Annotated[list[Subject], Field(max_length=12), AfterValidator(_dedupe_subjects)] | None
    ) = None
    learning_level: LearningLevel | None = None
    preferred_language: Language | None = None
