# =============================================================================
# Whiteboard Schemas — board actions streamed by the AI tutor, doubt records
# =============================================================================

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
    TypeAdapter,
    model_validator,
)

BOARD_WIDTH = 1600
BOARD_HEIGHT = 900
MAX_TEXT = 120
MAX_CAPTION = 300

COLORS = ("ink", "blue", "red", "green", "orange", "purple")
SIZES = ("sm", "md", "lg", "xl")
SHAPES = ("sprite", "emoji", "circle", "rect", "arrow")
MOTIONS = ("move", "path", "fall", "projectile", "orbit", "swing", "oscillate", "spin", "pulse")
MAX_PATH_POINTS = 24


def _clamp(low: float, high: float):
    def validate(value: Any) -> Any:
        if isinstance(value, int | float) and not isinstance(value, bool):
            return round(min(max(float(value), low), high), 1)
        return value

    return BeforeValidator(validate)


def _truncate(limit: int):
    def validate(value: Any) -> Any:
        return value.strip()[:limit] if isinstance(value, str) else value

    return BeforeValidator(validate)


def _choice(options: tuple[str, ...], default: str):
    def validate(value: Any) -> Any:
        return value if value in options else default

    return BeforeValidator(validate)


X = Annotated[float, _clamp(0, BOARD_WIDTH)]
Y = Annotated[float, _clamp(0, BOARD_HEIGHT)]
Width = Annotated[float, _clamp(4, BOARD_WIDTH)]
Height = Annotated[float, _clamp(4, BOARD_HEIGHT)]
Radius = Annotated[float, _clamp(4, BOARD_HEIGHT / 2)]
Point = tuple[X, Y]
Color = Annotated[Literal[COLORS], _choice(COLORS, "ink")]
Size = Annotated[Literal[SIZES], _choice(SIZES, "md")]
BoardText = Annotated[str, _truncate(MAX_TEXT), StringConstraints(min_length=1)]
CaptionText = Annotated[str, _truncate(MAX_CAPTION), StringConstraints(min_length=1)]
# Lets later actions (box, underline, erase) target a write by its measured bounds.
ItemId = Annotated[str, _truncate(24), StringConstraints(min_length=1)]
Offset = Annotated[float, _clamp(-BOARD_WIDTH, BOARD_WIDTH)]
Seconds = Annotated[float, _clamp(0.2, 30)]


class _Action(BaseModel):
    # Models sometimes add commentary fields; ignore them instead of rejecting the action.
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


class CaptionAction(_Action):
    type: Literal["caption"]
    text: CaptionText


class WriteAction(_Action):
    type: Literal["write"]
    text: BoardText
    # Both omitted: continue on the next line under the previous write.
    x: X | None = None
    y: Y | None = None
    size: Size = "md"
    color: Color = "ink"
    id: ItemId | None = None


class MarkAction(_Action):
    """Box or underline a previous write, sized by the frontend from the real text."""

    type: Literal["box", "underline"]
    id: ItemId
    color: Color = "ink"


class LineAction(_Action):
    type: Literal["line", "arrow"]
    start: Point = Field(alias="from")
    end: Point = Field(alias="to")
    color: Color = "ink"


class RectAction(_Action):
    type: Literal["rect"]
    x: X
    y: Y
    w: Width
    h: Height
    color: Color = "ink"
    fill: bool = False


class CircleAction(_Action):
    type: Literal["circle"]
    x: X
    y: Y
    r: Radius
    color: Color = "ink"


class EraseAction(_Action):
    """Erase a previous write by `id`, or any region given by x, y, w, h."""

    type: Literal["erase"]
    id: ItemId | None = None
    x: X | None = None
    y: Y | None = None
    w: Width | None = None
    h: Height | None = None

    @model_validator(mode="after")
    def _needs_target(self):
        if self.id is None and None in (self.x, self.y, self.w, self.h):
            raise ValueError("erase needs an id or a full x, y, w, h region")
        return self


class ClearAction(_Action):
    type: Literal["clear"]


class PauseAction(_Action):
    type: Literal["pause"]
    ms: Annotated[int, _clamp(100, 4000)] = 800


# -- Animation: objects live on their own layer and can move ------------------


class ObjectAction(_Action):
    """A picture on the animation layer: a built-in sprite, emoji, shape or force arrow."""

    type: Literal["object"]
    id: ItemId
    shape: Annotated[Literal[SHAPES], _choice(SHAPES, "sprite")] = "sprite"
    # Unknown sprite names are kept; the frontend draws a labelled circle for them.
    sprite: Annotated[str, _truncate(20)] | None = None
    emoji: Annotated[str, _truncate(8)] | None = None
    x: X | None = None
    y: Y | None = None
    size: Annotated[float, _clamp(16, 320)] = 70
    r: Radius | None = None
    w: Width | None = None
    h: Height | None = None
    color: Color = "ink"
    fill: bool = False
    label: Annotated[str, _truncate(40)] | None = None
    # Hangs on a string from this point (a pendulum bob); "swing" then reuses it.
    pivot: Point | None = None
    # Stay attached to another object (offset by dx, dy), e.g. a force arrow on a falling apple.
    follow: ItemId | None = None
    # Arrows: point at another object, `length` long; otherwise along dx, dy.
    toward: ItemId | None = None
    length: Annotated[float, _clamp(10, 600)] | None = None
    dx: Offset | None = None
    dy: Offset | None = None

    @model_validator(mode="after")
    def _needs_position(self):
        if self.follow is None and None in (self.x, self.y):
            raise ValueError("object needs x and y, or an object to follow")
        return self


class AnimateAction(_Action):
    """Set an object moving. Times are in seconds; speeds in board units per second."""

    type: Literal["animate"]
    id: ItemId
    motion: Literal[MOTIONS]
    to: Point | None = None
    points: Annotated[list[Point], Field(max_length=MAX_PATH_POINTS)] | None = None
    to_y: Y | None = None
    ground_y: Y | None = None
    bounce: Annotated[float, _clamp(0, 0.85)] | None = None
    vx: Annotated[float, _clamp(-3000, 3000)] | None = None
    vy: Annotated[float, _clamp(-3000, 3000)] | None = None
    cx: X | None = None
    cy: Y | None = None
    around: ItemId | None = None
    r: Radius | None = None
    pivot: Point | None = None
    length: Annotated[float, _clamp(20, 800)] | None = None
    angle: Annotated[float, _clamp(3, 80)] | None = None
    dx: Offset | None = None
    dy: Offset | None = None
    period: Seconds | None = None
    duration: Seconds | None = None
    cycles: Annotated[float, _clamp(0.25, 20)] | None = None
    clockwise: bool = False
    loop: bool = False
    wait: bool | None = None
    trail: bool = False


class ObjectControlAction(_Action):
    """stop: freeze a moving object where it is. remove: take it off the board."""

    type: Literal["stop", "remove"]
    id: ItemId


BoardAction = Annotated[
    CaptionAction
    | WriteAction
    | MarkAction
    | LineAction
    | RectAction
    | CircleAction
    | EraseAction
    | ClearAction
    | PauseAction
    | ObjectAction
    | AnimateAction
    | ObjectControlAction,
    Field(discriminator="type"),
]
board_action = TypeAdapter(BoardAction)


def dump_action(action: BaseModel) -> dict:
    return action.model_dump(mode="json", by_alias=True, exclude_none=True)


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


class DoubtOut(DoubtSummary):
    actions: list[dict]
    error: str | None
    completed_at: datetime | None
