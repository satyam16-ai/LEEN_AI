# =============================================================================
# Board eval — runs sample doubts through the board teacher and reports tokens,
# action counts and dropped lines, so prompt changes can be compared.
#   python -m app.cli board-eval --label v2 --out evals/board-v2.json \
#       --compare evals/board-v1.json
# =============================================================================

import statistics
import time
from collections import Counter

from app.config import settings
from app.services.llm import gateway
from app.services.whiteboard.parser import ActionStreamParser
from app.services.whiteboard.prompt import build_prompt

SAMPLE_DOUBTS: list[tuple[str, str]] = [
    ("Mathematics", "Plot y = x^2 - 4 and find where it cuts the x-axis"),
    ("Mathematics", "Prove the angle sum of a triangle is 180°"),
    ("Physics", "Explain a velocity–time graph for a car that speeds up and then stops"),
    ("Physics", "How does a convex lens form an image when the object is beyond 2F?"),
    ("Chemistry", "Draw the Bohr model of sodium and explain its valency"),
    ("Chemistry", "Balance H2 + O2 → H2O and explain each step"),
    ("Biology", "Label the parts of a plant cell"),
    ("Biology", "Explain the steps of photosynthesis as a flowchart"),
]


async def _run_one(subject: str, question: str) -> dict:
    system, prompt = build_prompt(question, subject, None)
    parser = ActionStreamParser(settings.whiteboard_max_actions)
    usage: dict = {}
    actions: list[dict] = []
    error = None
    started = time.monotonic()
    try:
        async for chunk in gateway.stream_text("board_teacher", system, prompt, usage=usage):
            actions += parser.feed(chunk)
        actions += parser.flush()
    except Exception as exc:  # noqa: BLE001 - reported in the run instead
        error = str(exc) or type(exc).__name__
    return {
        "subject": subject,
        "question": question,
        "actions": len(actions),
        "dropped": parser.dropped,
        "types": dict(Counter(action["type"] for action in actions)),
        "input_tokens": usage.get("input_tokens", 0),
        "output_tokens": usage.get("output_tokens", 0),
        "cache_read_tokens": usage.get("cache_read_tokens", 0),
        "duration_ms": usage.get("duration_ms") or int((time.monotonic() - started) * 1000),
        "error": error,
    }


def _median(runs: list[dict], key: str) -> float:
    values = [run[key] for run in runs if run["error"] is None]
    return statistics.median(values) if values else 0


async def run_board_eval(label: str) -> dict:
    runs = [await _run_one(subject, question) for subject, question in SAMPLE_DOUBTS]
    return {
        "label": label,
        "model": gateway.agent_config("board_teacher").model,
        "runs": runs,
        "median_output_tokens": _median(runs, "output_tokens"),
        "median_input_tokens": _median(runs, "input_tokens"),
        "median_actions": _median(runs, "actions"),
    }


def compare(report: dict, baseline: dict) -> list[str]:
    """Problems that make `report` worse than `baseline` (empty when it holds up)."""
    current, before = report["median_output_tokens"], baseline["median_output_tokens"]
    if current > before:
        return [f"median output tokens {current:g} > baseline {before:g}"]
    return []
