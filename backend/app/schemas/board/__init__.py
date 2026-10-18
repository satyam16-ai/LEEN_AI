# =============================================================================
# Board Protocol — every action the AI can send to the canvas, validated here
# before it reaches the browser or the database.
# =============================================================================

from typing import Annotated

from pydantic import BaseModel, Field, TypeAdapter

from app.schemas.board.common import BOARD_HEIGHT, BOARD_WIDTH, MAX_CAPTION, MAX_TEXT
from app.schemas.board.v1 import (
    AnimateAction,
    CaptionAction,
    CircleAction,
    ClearAction,
    EraseAction,
    HighlightAction,
    LineAction,
    ObjectAction,
    ObjectControlAction,
    PauseAction,
    RectAction,
    WriteAction,
)
from app.schemas.board.visuals import (
    ChartAction,
    ColumnAction,
    DiagramAction,
    FlowAction,
    FocusAction,
    GeoAction,
    NumberLineAction,
    PlotAction,
    SceneAction,
    TableAction,
)

BoardAction = Annotated[
    CaptionAction
    | WriteAction
    | HighlightAction
    | LineAction
    | RectAction
    | CircleAction
    | EraseAction
    | ClearAction
    | PauseAction
    | ObjectAction
    | AnimateAction
    | ObjectControlAction
    | SceneAction
    | FocusAction
    | ColumnAction
    | PlotAction
    | NumberLineAction
    | GeoAction
    | TableAction
    | ChartAction
    | FlowAction
    | DiagramAction,
    Field(discriminator="type"),
]
board_action = TypeAdapter(BoardAction)


def dump_action(action: BaseModel) -> dict:
    return action.model_dump(mode="json", by_alias=True, exclude_none=True)


__all__ = [
    "BOARD_HEIGHT",
    "BOARD_WIDTH",
    "MAX_CAPTION",
    "MAX_TEXT",
    "BoardAction",
    "board_action",
    "dump_action",
]
