# =============================================================================
# Shared board types: coordinates, colours and the validators that clean up
# model output instead of rejecting it (clamp, truncate, fall back, drop items)
# =============================================================================

import re
from typing import Annotated, Any, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, StringConstraints

BOARD_WIDTH = 1600
BOARD_HEIGHT = 900
MAX_TEXT = 120
MAX_CAPTION = 300

COLORS = ("ink", "blue", "red", "green", "orange", "purple")
SIZES = ("sm", "md", "lg", "xl")


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


def _cap(limit: int):
    """Keep at most `limit` items of a list (or dict) rather than rejecting a long one."""

    def validate(value: Any) -> Any:
        if isinstance(value, list | tuple):
            return list(value)[:limit]
        if isinstance(value, dict):
            return dict(list(value.items())[:limit])
        return value

    return BeforeValidator(validate)


def is_number(value: Any) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool)


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


def short(limit: int):
    """Optional-length text: trimmed and truncated, never empty."""
    return Annotated[str, _truncate(limit), StringConstraints(min_length=1)]


# -- Expressions: evaluated only in the browser (mathjs + AST whitelist) ---------

EXPR_NAMES = frozenset(
    {
        "x",
        "pi",
        "e",
        "sin",
        "cos",
        "tan",
        "asin",
        "acos",
        "atan",
        "sqrt",
        "abs",
        "log",
        "ln",
        "exp",
        "log10",
        "floor",
        "ceil",
    }
)
_EXPR_CHARS = re.compile(r"^[0-9a-zA-Z_+\-*/^().,\s]*$")


def is_safe_expr(value: Any) -> bool:
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= 80:
        return False
    if not _EXPR_CHARS.match(value):
        return False
    return all(name in EXPR_NAMES for name in re.findall(r"[A-Za-z_]+", value))


def _expr(value: Any) -> Any:
    if not is_safe_expr(value):
        raise ValueError("unsupported expression")
    return value.strip()


def _expr_or_none(value: Any) -> Any:
    return value.strip() if is_safe_expr(value) else None


def _exprs(limit: int):
    def validate(value: Any) -> Any:
        if not isinstance(value, list | tuple):
            return value
        return [item.strip() for item in value if is_safe_expr(item)][:limit]

    return BeforeValidator(validate)


Expr = Annotated[str, BeforeValidator(_expr)]
OptionalExpr = Annotated[str | None, BeforeValidator(_expr_or_none)]


def _range(limit: float):
    """A sorted (lo, hi) pair clamped to ±limit; equal ends are widened by 1."""

    def validate(value: Any) -> Any:
        if not isinstance(value, list | tuple) or len(value) != 2 or not all(map(is_number, value)):
            raise ValueError("expected [low, high]")
        low, high = sorted(min(max(float(v), -limit), limit) for v in value)
        return (low - 1, high + 1) if low == high else (low, high)

    return BeforeValidator(validate)


Range = Annotated[tuple[float, float], _range(1e6)]


def _box(value: Any) -> Any:
    """[x, y, w, h] on the board, or None for anything else (the browser places it)."""
    if not isinstance(value, list | tuple) or len(value) != 4 or not all(map(is_number, value)):
        return None
    x, y, w, h = (float(v) for v in value)
    return [
        min(max(x, 0), BOARD_WIDTH),
        min(max(y, 0), BOARD_HEIGHT),
        min(max(w, 0), BOARD_WIDTH),
        min(max(h, 0), BOARD_HEIGHT),
    ]


Box = Annotated[list[float] | None, BeforeValidator(_box)]


class _Action(BaseModel):
    # Models sometimes add commentary fields; ignore them instead of rejecting the action.
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


class Placed(_Action):
    """A visual drawn inside a box: `at` [x, y, w, h], or auto-placed on the stage."""

    at: Box = None
    color: Color | None = None
