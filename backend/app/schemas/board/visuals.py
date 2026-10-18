# =============================================================================
# Board Protocol v2 actions. Each visual is one short command that names WHAT
# to draw; the browser computes how it looks (curves, angles, layout).
# Bad parts are dropped or clamped instead of rejecting the whole visual.
# =============================================================================

import re
from typing import Annotated, Any, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, model_validator

from app.schemas.board.common import (
    Box,
    OptionalExpr,
    Placed,
    Range,
    _Action,
    _cap,
    _choice,
    _clamp,
    _exprs,
    _truncate,
    is_number,
    short,
)

# -- Structure -------------------------------------------------------------------


class SceneAction(_Action):
    """Start a new board page; earlier pages stay in the page strip."""

    type: Literal["scene"]
    title: short(60)


class FocusAction(_Action):
    """Zoom the camera to `at`; without it, zoom back out."""

    type: Literal["focus"]
    at: Box = None


class ColumnAction(_Action):
    """Switch the column that writes without x/y flow into."""

    type: Literal["column"]
    side: Annotated[Literal["left", "right", "full"], _choice(("left", "right", "full"), "left")]


# -- Graphs ----------------------------------------------------------------------


class _Span(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    start: float = Field(alias="from")
    end: float = Field(alias="to")

    @model_validator(mode="after")
    def _ordered(self):
        if self.start > self.end:
            self.start, self.end = self.end, self.start
        return self


class Shade(_Span):
    fn: Annotated[int, _clamp(0, 3)] = 0


class Interval(_Span):
    open: tuple[bool, bool] = (False, False)


PointName = short(8)
Coord = tuple[float, float]


class PlotAction(Placed):
    type: Literal["plot"]
    fns: Annotated[list[str], _exprs(4)] = []
    x: Range = (-5.0, 5.0)
    y: Range | None = None
    points: Annotated[dict[PointName, Coord], _cap(12)] = {}
    labels: Annotated[list[short(30)], _cap(4)] = []
    shade: Shade | None = None
    xlabel: short(20) | None = None
    ylabel: short(20) | None = None


class NumberLineAction(Placed):
    type: Literal["numberline"]
    range: Range = (-5.0, 5.0)
    marks: Annotated[list[float], _cap(12)] = []
    labels: Annotated[dict[PointName, float], _cap(8)] = {}
    interval: Interval | None = None


# -- Geometry --------------------------------------------------------------------

_POINT = re.compile(r"[A-Z][0-9']?")


def _names(text: str) -> list[str] | None:
    """Split "ABC" or "A1B1" into point names, or None if it isn't only point names."""
    names = _POINT.findall(text)
    return names if "".join(names) == text else None


def _valid_points(value: Any) -> Any:
    if not isinstance(value, dict):
        return value
    return {
        name: point
        for name, point in list(value.items())
        if isinstance(name, str) and _POINT.fullmatch(name)
    }


class GeoCircle(BaseModel):
    model_config = ConfigDict(extra="ignore")

    c: str
    r: Annotated[float, _clamp(1e-6, 1e6)] | None = None
    through: str | None = None


class GeoAction(Placed):
    type: Literal["geo"]
    pts: Annotated[dict[str, Coord], BeforeValidator(_valid_points), _cap(12)]
    shapes: Annotated[list[str], _cap(8)] = []
    angles: Annotated[list[str], _cap(6)] = []
    right: Annotated[list[str], _cap(4)] = []
    sides: Annotated[dict[str, short(12)], _cap(8)] = {}
    circles: Annotated[list[GeoCircle], _cap(3)] = []

    @model_validator(mode="after")
    def _known_points_only(self):
        if len(self.pts) < 2:
            raise ValueError("geo needs at least two points")
        known = set(self.pts)

        def uses_known(text: str, count: range) -> bool:
            names = _names(text)
            return names is not None and len(names) in count and set(names) <= known

        self.shapes = [s for s in self.shapes if uses_known(s, range(2, 9))]
        self.angles = [a for a in self.angles if uses_known(a, range(3, 4))]
        self.right = [a for a in self.right if uses_known(a, range(3, 4))]
        self.sides = {s: label for s, label in self.sides.items() if uses_known(s, range(2, 3))}
        self.circles = [
            c for c in self.circles if c.c in known and (c.r is not None or c.through in known)
        ]
        return self


# -- Tables and charts -----------------------------------------------------------


def _cell(value: Any) -> Any:
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return f"{value:g}"
    return value


Cell = Annotated[str, BeforeValidator(_cell), _truncate(24)]


class TableAction(Placed):
    type: Literal["table"]
    head: Annotated[list[Cell], _cap(6)] = []
    rows: Annotated[list[Annotated[list[Cell], _cap(6)]], _cap(10)] = []
    # Or a table of values, computed in the browser: fn evaluated at each of xs.
    fn: OptionalExpr = None
    xs: Annotated[list[float], _cap(10)] = []

    @model_validator(mode="after")
    def _has_content(self):
        if not self.rows and not (self.fn and self.xs):
            raise ValueError("table needs rows, or fn and xs")
        return self


class ChartAction(Placed):
    type: Literal["chart"]
    kind: Annotated[Literal["bar", "pie", "line"], _choice(("bar", "pie", "line"), "bar")] = "bar"
    labels: Annotated[list[short(16)], _cap(10)] = []
    values: Annotated[list[float], _cap(10)] = []
    title: short(40) | None = None
    unit: short(10) | None = None

    @model_validator(mode="after")
    def _paired(self):
        count = min(len(self.labels), len(self.values))
        if count < 1:
            raise ValueError("chart needs labels and values")
        self.labels, self.values = self.labels[:count], self.values[:count]
        return self


# -- Flowcharts and mind maps ----------------------------------------------------


class FlowAction(Placed):
    type: Literal["flow"]
    nodes: Annotated[list[short(28)], _cap(10)]
    # Index pairs; none means a simple chain in node order.
    edges: Annotated[list[tuple[int, int]], _cap(14)] = []
    kind: Annotated[Literal["chart", "mind"], _choice(("chart", "mind"), "chart")] = "chart"
    dir: Annotated[Literal["TB", "LR"], _choice(("TB", "LR"), "TB")] = "TB"

    @model_validator(mode="after")
    def _valid_edges(self):
        count = len(self.nodes)
        if count < 2:
            raise ValueError("flow needs at least two nodes")
        self.edges = [(a, b) for a, b in self.edges if a != b and 0 <= a < count and 0 <= b < count]
        return self


# -- Science diagrams ------------------------------------------------------------

DIAGRAM_KINDS = ("circuit", "lens", "mirror", "fbd", "atom", "cell", "apparatus")
DIRECTIONS = ("up", "down", "left", "right")
ORGANELLES = (
    "nucleus",
    "cell membrane",
    "cell wall",
    "cytoplasm",
    "mitochondria",
    "chloroplast",
    "vacuole",
    "ribosome",
)
APPARATUS = ("beaker", "test_tube", "flask", "burner", "stand")


def _force_direction(value: Any) -> Any:
    if value in DIRECTIONS:
        return value
    if is_number(value):
        return round(min(max(float(value), -360.0), 360.0), 1)
    raise ValueError("direction must be up, down, left, right or an angle")


class Force(BaseModel):
    model_config = ConfigDict(extra="ignore")

    dir: Annotated[str | float, BeforeValidator(_force_direction)]
    label: short(12) | None = None
    size: Annotated[float, _clamp(0.5, 2)] = 1


def _forces(value: Any) -> Any:
    if not isinstance(value, list):
        return value
    return [
        item
        for item in value
        if isinstance(item, dict) and (item.get("dir") in DIRECTIONS or is_number(item.get("dir")))
    ][:6]


def _known(options: tuple[str, ...], limit: int):
    def validate(value: Any) -> Any:
        if not isinstance(value, list):
            return value
        return [item for item in value if item in options][:limit]

    return BeforeValidator(validate)


class DiagramAction(Placed):
    type: Literal["diagram"]
    kind: Literal[DIAGRAM_KINDS]
    title: short(40) | None = None
    # circuit: parts like "battery 6V", "resistor 4Ω", "bulb", "switch", "ammeter", "voltmeter"
    parts: Annotated[list[short(24)], _cap(8)] = []
    layout: Annotated[Literal["series", "parallel"], _choice(("series", "parallel"), "series")] = (
        "series"
    )
    # lens / mirror: focal length f, object distance u, object height h (cm)
    shape: Annotated[Literal["convex", "concave"], _choice(("convex", "concave"), "convex")] = (
        "convex"
    )
    f: Annotated[float, _clamp(1, 100)] = 10
    u: Annotated[float, _clamp(1, 200)] = 30
    h: Annotated[float, _clamp(0.5, 10)] = 2
    # fbd
    body: Annotated[Literal["block", "ball"], _choice(("block", "ball"), "block")] = "block"
    forces: Annotated[list[Force], BeforeValidator(_forces)] = []
    # atom (Bohr model, Z up to 20)
    z: Annotated[int, _clamp(1, 20)] | None = None
    symbol: short(3) | None = None
    # cell
    cell: Annotated[Literal["animal", "plant"], _choice(("animal", "plant"), "animal")] = "animal"
    labels: Annotated[list[str], _known(ORGANELLES, 8)] = []
    # apparatus
    items: Annotated[list[str], _known(APPARATUS, 4)] = []
