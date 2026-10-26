# =============================================================================
# Board actions for the student's own material: `cite` points at a page of
# their book. The model only gives the source number from <sources>; the
# server fills in which document, page and title (whiteboard_service).
# =============================================================================

from typing import Annotated, Any, Literal

from pydantic import BeforeValidator

from app.schemas.board.common import _Action, short

MAX_SOURCES = 9


def _source_number(value: Any) -> Any:
    if isinstance(value, int | float) and not isinstance(value, bool):
        return min(max(int(value), 1), MAX_SOURCES)
    return value


class CiteAction(_Action):
    """A chip under the last line naming the book page it came from."""

    type: Literal["cite"]
    source: Annotated[int, BeforeValidator(_source_number)]
    # Set by the server from the turn's sources, never taken from the model.
    doc: str | None = None
    page: int | None = None
    title: short(120) | None = None
