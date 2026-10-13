# =============================================================================
# Classroom Schemas
# =============================================================================

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.schemas.user import UserSummary

ClassName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
SubjectName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
Grade = Annotated[int, Field(ge=1, le=12)]


class ClassroomCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ClassName
    subject: SubjectName
    grade: Grade | None = None
    description: Description | None = None


class ClassroomUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ClassName | None = None
    subject: SubjectName | None = None
    grade: Grade | None = None
    description: Description | None = None


class ClassroomOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    subject: str
    grade: int | None
    description: str | None
    join_code: str
    student_count: int = 0
    created_at: datetime


class RosterStudentOut(UserSummary):
    grade: int | None = None
    joined_at: datetime


class ClassroomDetailOut(ClassroomOut):
    students: list[RosterStudentOut]


class StudentClassOut(BaseModel):
    id: str
    name: str
    subject: str
    grade: int | None
    description: str | None
    teacher: UserSummary
    student_count: int
    joined_at: datetime
