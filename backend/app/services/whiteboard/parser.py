# =============================================================================
# Incremental parser: streamed NDJSON text from the model -> validated actions
# =============================================================================

import json
import logging

from pydantic import ValidationError

from app.schemas.board import board_action, dump_action

logger = logging.getLogger("leen_ai")


def _no_infinity(name: str):
    """JSON allows Infinity and NaN; a board (or Postgres jsonb) can't use them."""
    raise ValueError(f"not a finite number: {name}")


class ActionStreamParser:
    """Feed raw text chunks as they stream in; get back validated board actions.

    Lines can be split across chunks, so the trailing partial line is buffered.
    Anything that is not a valid action (code fences, prose, broken JSON,
    unknown types) is dropped rather than failing the whole explanation.
    """

    def __init__(self, max_actions: int):
        self.max_actions = max_actions
        self.count = 0
        self.dropped = 0
        self._buffer = ""

    @property
    def full(self) -> bool:
        return self.count >= self.max_actions

    def feed(self, chunk: str) -> list[dict]:
        self._buffer += chunk
        *lines, self._buffer = self._buffer.split("\n")
        return self._parse(lines)

    def flush(self) -> list[dict]:
        lines, self._buffer = [self._buffer], ""
        return self._parse(lines)

    def _parse(self, lines: list[str]) -> list[dict]:
        actions = []
        for line in lines:
            if self.full:
                break
            action = self._parse_line(line)
            if action is not None:
                actions.append(action)
                self.count += 1
        return actions

    def _parse_line(self, line: str) -> dict | None:
        # Tolerate a model that wraps the lines in a JSON array or a code fence.
        line = line.strip().removeprefix("[").removesuffix(",").removesuffix("]").strip()
        if not line or line.startswith("```"):
            return None
        try:
            data = json.loads(line, parse_constant=_no_infinity)
            return dump_action(board_action.validate_python(data))
        except (ValueError, ValidationError):
            self.dropped += 1
            logger.debug("Dropped whiteboard line: %.200s", line)
            return None
