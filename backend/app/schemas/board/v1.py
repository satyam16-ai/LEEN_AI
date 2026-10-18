# =============================================================================
# Board Protocol v1 actions: handwriting, shapes, erasing and 2D animation
# =============================================================================

from typing import Annotated, Literal

from pydantic import Field, model_validator

from app.schemas.board.common import (
    BoardText,
    CaptionText,
    Color,
    Height,
    ItemId,
    Offset,
    Point,
    Radius,
    Seconds,
    Size,
    Width,
    X,
    Y,
    _Action,
    _choice,
    _clamp,
    _truncate,
)

SHAPES = ("sprite", "emoji", "circle", "rect", "arrow")
MOTIONS = ("move", "path", "fall", "projectile", "orbit", "swing", "oscillate", "spin", "pulse")
MAX_PATH_POINTS = 24


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


class HighlightAction(_Action):
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
