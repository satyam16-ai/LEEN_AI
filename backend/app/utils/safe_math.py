# =============================================================================
# Safe maths — evaluates the short answers students type ("3/4", "2π", "3√2",
# "x^2 + 2x + 1") without eval: the text is tokenised, implicit multiplication
# is made explicit, and the resulting expression tree is walked node by node
# against a whitelist. Anything else is a ValueError.
# =============================================================================

import ast
import math
import operator
import re

MAX_LENGTH = 80
MAX_EXPONENT = 100
MAX_POWER_BASE = 1e6

FUNCTIONS = {
    "sqrt": math.sqrt,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "asin": math.asin,
    "acos": math.acos,
    "atan": math.atan,
    "abs": abs,
    "log": math.log10,  # school maths: log means base 10
    "ln": math.log,
    "log10": math.log10,
    "exp": math.exp,
}
CONSTANTS = {"pi": math.pi, "e": math.e}

_UNICODE = str.maketrans(
    {"−": "-", "×": "*", "÷": "/", "·": "*", "π": " pi ", "²": "^2", "³": "^3"}
)
_ROOT_OF_NUMBER = re.compile(r"√\s*(\d+(?:\.\d+)?|[A-Za-z]+)")
_MIXED_NUMBER = re.compile(r"^(-?)\s*(\d+)\s+(\d+)\s*/\s*(\d+)$")
_CURRENCY = re.compile(r"^(?:₹|rs\.?|inr)\s*|\s*/-$", re.IGNORECASE)
# 1,00,000 (Indian) or 100,000 (international): the commas only group digits.
_GROUPED = re.compile(r"-?\d{1,3}(?:(?:,\d{2})*,\d{3}|(?:,\d{3})+)(?:\.\d+)?")
_TOKEN = re.compile(
    r"\s*(?:(?P<number>\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+)"
    r"|(?P<name>[A-Za-z_][A-Za-z_0-9]*)"
    r"|(?P<op>\*\*|[-+*/(),]))"
)
_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
}


def _tokens(text: str) -> list[tuple[str, str]]:
    tokens, position = [], 0
    text = text.rstrip()
    while position < len(text):
        match = _TOKEN.match(text, position)
        if not match or match.end() == position:
            raise ValueError(f"unexpected character at {position}")
        kind = match.lastgroup
        tokens.append((kind, match.group(kind)))
        position = match.end()
    return tokens


def _ends_value(kind: str, value: str) -> bool:
    return kind == "number" or value == ")" or (kind == "name" and value not in FUNCTIONS)


def _starts_value(kind: str, value: str) -> bool:
    return kind in ("number", "name") or value == "("


def _python(text: str) -> str:
    """The text as a Python expression, with `*` written out where a student leaves it."""
    text = _ROOT_OF_NUMBER.sub(r"sqrt(\1)", text.translate(_UNICODE)).replace("√", "sqrt")
    parts: list[str] = []
    previous = None
    for kind, value in _tokens(text.replace("^", "**")):
        if kind == "number" and re.fullmatch(r"0\d+", value):
            value = value.lstrip("0") or "0"  # "05": Python rejects leading zeros
        # Two numbers in a row ("2 3", "1.5.2") are a typo, not a product: leave them to fail.
        both_numbers = previous is not None and previous[0] == "number" and kind == "number"
        if previous and _ends_value(*previous) and _starts_value(kind, value) and not both_numbers:
            parts.append("*")
        parts.append(value)
        previous = (kind, value)
    return " ".join(parts)


def _eval(node: ast.AST, x: float | None) -> float:
    if isinstance(node, ast.Expression):
        return _eval(node.body, x)
    if isinstance(node, ast.Constant) and type(node.value) in (int, float):
        return float(node.value)
    if isinstance(node, ast.Name):
        if node.id == "x" and x is not None:
            return float(x)
        if node.id in CONSTANTS:
            return CONSTANTS[node.id]
        raise ValueError(f"unknown name {node.id!r}")
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub | ast.UAdd):
        value = _eval(node.operand, x)
        return -value if isinstance(node.op, ast.USub) else value
    if isinstance(node, ast.BinOp) and type(node.op) in _OPERATORS:
        left, right = _eval(node.left, x), _eval(node.right, x)
        if isinstance(node.op, ast.Pow) and (
            abs(right) > MAX_EXPONENT or abs(left) > MAX_POWER_BASE
        ):
            raise ValueError("power too large")
        return _OPERATORS[type(node.op)](left, right)
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id in FUNCTIONS
        and len(node.args) == 1
        and not node.keywords
    ):
        return FUNCTIONS[node.func.id](_eval(node.args[0], x))
    raise ValueError(f"not allowed: {type(node).__name__}")


def evaluate(text: str, x: float | None = None) -> float:
    """The value of a short maths expression, optionally in x."""
    if not isinstance(text, str) or not 1 <= len(text.strip()) <= MAX_LENGTH:
        raise ValueError("expression is empty or too long")
    try:
        tree = ast.parse(_python(text.strip()), mode="eval")
        value = _eval(tree, x)
    except (SyntaxError, ZeroDivisionError, OverflowError, TypeError, RecursionError) as error:
        raise ValueError(str(error)) from error
    if isinstance(value, complex) or not math.isfinite(value):
        raise ValueError("not a real, finite number")
    return float(value)


def parse_answer_number(text: str, unit: str | None = None) -> float:
    """A student's number answer: "12 cm", "1,000", "3/4", "−3.5", "1 1/2"."""
    value = text.strip().translate(_UNICODE)
    if unit and value.casefold().endswith(unit.strip().casefold()):
        value = value[: -len(unit.strip())]
    value = _CURRENCY.sub("", value).strip()
    if _GROUPED.fullmatch(value):
        value = value.replace(",", "")
    value = re.sub(r"(?<=\d),(?=\d{3}(?!\d))", "", value).strip()
    mixed = _MIXED_NUMBER.match(value)
    if mixed:
        sign, whole, numerator, denominator = mixed.groups()
        if int(denominator) == 0:
            raise ValueError("division by zero")
        size = int(whole) + int(numerator) / int(denominator)
        return -size if sign else size
    return evaluate(value)
