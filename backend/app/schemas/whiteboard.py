# =============================================================================
# Whiteboard Schemas — doubt records (board actions live in app.schemas.board)
# =============================================================================

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

# -- Doubts -------------------------------------------------------------------

Question = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]
Subject = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
AskId = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=24)]
DoubtStatus = Literal["streaming", "complete", "failed"]


class DoubtCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: Question
    subject: Subject | None = None


class TurnCreate(BaseModel):
    """More on the same board.

    follow_up: a question; with `keep`, it was sent mid-explanation and the board keeps only the
    first `keep` actions of its latest turn before the reply. another_way: the same doubt again.
    check: explain the student's answer to question `ask`. practice: "Now you try".
    """

    model_config = ConfigDict(extra="forbid")

    question: Question | None = None
    mode: Literal["follow_up", "another_way", "check", "practice"] = "follow_up"
    keep: Annotated[int, Field(ge=0)] | None = None
    ask: AskId | None = None

    @model_validator(mode="after")
    def _what_each_mode_needs(self):
        if self.mode == "follow_up" and not self.question:
            raise ValueError("Ask a follow-up question")
        if self.mode == "check" and not self.ask:
            raise ValueError("Say which question to check")
        return self


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
