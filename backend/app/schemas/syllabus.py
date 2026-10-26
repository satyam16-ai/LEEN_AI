# =============================================================================
# Syllabus schemas — a subject's chapter → topic tree
# =============================================================================

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
RowId = Annotated[str, StringConstraints(max_length=36)]

MAX_CHAPTERS = 40
MAX_TOPICS = 40


class TopicIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: RowId | None = None
    title: Title
    done: bool = False


class ChapterIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: RowId | None = None
    title: Title
    topics: list[TopicIn] = Field(default_factory=list, max_length=MAX_TOPICS)


class SyllabusSave(BaseModel):
    """The whole tree as the student edited it. Rows keep their id; new rows have none."""

    model_config = ConfigDict(extra="forbid")

    chapters: list[ChapterIn] = Field(max_length=MAX_CHAPTERS)
    confirm: bool = False


class TopicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    done: bool


class ChapterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    topics: list[TopicOut]


class SyllabusOut(BaseModel):
    subject: str
    # empty | reading | draft | confirmed | failed
    status: str
    error: str | None
    confirmed_at: datetime | None
    chapters: list[ChapterOut]


class SubjectSummary(BaseModel):
    subject: str
    status: str
    chapters: int
    topics: int
    done: int
