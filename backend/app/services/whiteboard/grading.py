# =============================================================================
# Answer keys and checking for board questions (`ask`). Choice, number and
# expression answers are checked here in code, at zero tokens; written (text)
# answers are left to the Examiner agent. Keys never leave the server:
# public_action() strips them from everything sent to the browser.
# =============================================================================

import math
import re
import string

from app.utils.safe_math import evaluate, parse_answer_number

SAMPLE_XS = (-2.7, -1.3, 0.6, 1.9, 3.1)
MIN_SAMPLES = 3
NUMBER_TOLERANCE = 0.01
MAX_MODEL_ANSWER = 200
HIDDEN = ("answer", "calc")
LETTERS = string.ascii_uppercase[:6]
_Y_EQUALS = re.compile(r"^\s*y\s*=\s*", re.IGNORECASE)


def _option_index(options: list[str], value) -> int | None:
    """The 0-based option for an index, a letter A-F or the option's own text."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and 0 <= value < len(options):
        return value
    text = str(value).strip()
    for index, option in enumerate(options):
        if text.casefold() == option.strip().casefold():
            return index
    if len(text) == 1 and text.upper() in LETTERS:
        index = LETTERS.index(text.upper())
        return index if index < len(options) else None
    return None


def _number_key(ask: dict) -> float | None:
    for source in (ask.get("calc"), ask.get("answer")):
        if source is None:
            continue
        try:
            if isinstance(source, int | float) and not isinstance(source, bool):
                return float(source)
            return parse_answer_number(str(source), ask.get("unit"))
        except ValueError:
            continue
    return None


def _values(expression: str) -> list[float | None]:
    expression = _Y_EQUALS.sub("", expression)
    values: list[float | None] = []
    for x in SAMPLE_XS:
        try:
            values.append(evaluate(expression, x))
        except ValueError:
            values.append(None)
    return values


def _as_text(ask: dict) -> dict:
    answer = ask.get("answer")
    ask["kind"] = "text"
    ask["answer"] = str(answer)[:MAX_MODEL_ANSWER] if answer is not None else None
    return ask


def prepare_ask(action: dict) -> dict:
    """A copy of a validated ask with its key normalised, or downgraded to a text question."""
    ask = dict(action)
    kind = ask.get("kind")
    if kind == "choice":
        index = _option_index(ask.get("options") or [], ask.get("answer"))
        if index is None:
            return _as_text(ask)
        ask["answer"] = index
    elif kind == "number":
        key = _number_key(ask)
        if key is None:
            return _as_text(ask)
        ask["answer"] = key
    elif kind == "expr":
        answer = ask.get("answer")
        values = _values(answer) if isinstance(answer, str) else []
        if sum(value is not None for value in values) < MIN_SAMPLES:
            return _as_text(ask)
    else:
        return _as_text(ask)
    return ask


def check_answer(ask: dict, answer: str) -> bool | None:
    """Whether `answer` is right; None for text questions (the Examiner judges those).

    Raises ValueError when the answer can't be read, so it doesn't cost the student a try.
    """
    kind = ask.get("kind")
    if kind == "choice":
        index = _option_index(ask.get("options") or [], answer)
        if index is None:
            raise ValueError("pick one of the options")
        return index == ask["answer"]
    if kind == "number":
        value = parse_answer_number(answer, ask.get("unit"))
        key = float(ask["answer"])
        return abs(value - key) <= max(1e-9, NUMBER_TOLERANCE * abs(key))
    if kind == "expr":
        student = _values(answer)
        if all(value is None for value in student):
            raise ValueError("not an expression in x")
        pairs = [
            (mine, theirs)
            for mine, theirs in zip(student, _values(str(ask["answer"])), strict=True)
            if mine is not None and theirs is not None
        ]
        return len(pairs) >= MIN_SAMPLES and all(
            math.isclose(mine, theirs, rel_tol=1e-6, abs_tol=1e-9) for mine, theirs in pairs
        )
    return None


def display_key(ask: dict) -> str | None:
    """The right answer as the student should see it, e.g. "B. 8" or "12 cm"."""
    answer = ask.get("answer")
    if answer is None:
        return None
    if ask.get("kind") == "choice":
        return f"{LETTERS[answer]}. {ask['options'][answer]}"
    if ask.get("kind") == "number":
        unit = ask.get("unit")
        return f"{float(answer):.4g}" + (f" {unit}" if unit else "")
    return str(answer)


def public_action(action: dict) -> dict:
    """What the browser may see: an ask without its key; anything else unchanged."""
    if action.get("type") != "ask":
        return action
    return {key: value for key, value in action.items() if key not in HIDDEN}
