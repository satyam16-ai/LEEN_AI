# =============================================================================
# Board actions for questions: the AI asks (ask), marks the student's answer
# written on the board (mark), and records its judgment of a written answer
# (verdict). Answer keys stay on the server; see services/whiteboard/grading.py.
# =============================================================================

from typing import Annotated, Literal

from pydantic import model_validator

from app.schemas.board.common import (
    BoardText,
    ItemId,
    OptionalExpr,
    _Action,
    _cap,
    _choice,
    short,
)

ASK_KINDS = ("choice", "number", "expr", "text")
MARK_KINDS = ("tick", "cross")
MAX_OPTIONS = 6


class AskAction(_Action):
    """Pause the board for the student's answer. `answer` is the key; never sent to the browser."""

    type: Literal["ask"]
    id: ItemId
    kind: Annotated[Literal[ASK_KINDS], _choice(ASK_KINDS, "text")] = "text"
    options: Annotated[list[BoardText], _cap(MAX_OPTIONS)] | None = None
    answer: int | float | str | None = None
    calc: OptionalExpr = None
    unit: short(12) | None = None
    hint: short(160) | None = None

    @model_validator(mode="after")
    def _choices_need_options(self):
        if self.kind == "choice" and len(self.options or []) < 2:
            raise ValueError("a choice question needs at least two options")
        return self


class MarkAction(_Action):
    """A tick or cross beside an earlier write, with an optional short note."""

    type: Literal["mark"]
    id: ItemId
    kind: Annotated[Literal[MARK_KINDS], _choice(MARK_KINDS, "cross")] = "cross"
    note: short(40) | None = None


class VerdictAction(_Action):
    """The AI's judgment of a written answer to question `ask` (not drawn)."""

    type: Literal["verdict"]
    ask: ItemId
    correct: bool
