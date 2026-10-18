# =============================================================================
# Whiteboard Schemas — doubt records (board actions live in app.schemas.board)
# =============================================================================

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints

# -- Doubts -------------------------------------------------------------------

Question = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]
Subject = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
DoubtStatus = Literal["streaming", "complete", "failed"]


class DoubtCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: Question
    subject: Subject | None = None


class DoubtSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    question: str
    subject: str | None
    status: DoubtStatus
    created_at: datetime


class TurnOut(BaseModel):
    question: str
    mode: str
    status: DoubtStatus
    count: int


class DoubtOut(DoubtSummary):
    # Every turn's actions in order, with a scene (new page) before each follow-up turn.
    actions: list[dict]
    turns: list[TurnOut]
    error: str | None
    completed_at: datetime | None
