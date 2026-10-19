# =============================================================================
# Board summary — a short plain-text description of what is already on the
# board, sent with follow-up turns instead of the full action list (no AI call).
# =============================================================================


def _describe(action: dict) -> str | None:
    kind = action.get("type")
    if kind == "plot":
        return "plot: " + ", ".join(action.get("fns") or []) if action.get("fns") else "plot"
    if kind == "geo":
        return "geo: " + ", ".join(action.get("shapes") or action.get("pts") or [])
    if kind == "chart":
        return f"chart: {action.get('kind', 'bar')}"
    if kind == "flow":
        return "flow: " + " > ".join((action.get("nodes") or [])[:3])
    if kind == "diagram":
        return f"diagram: {action.get('kind')}"
    if kind in ("table", "numberline"):
        return kind
    return None


def summarize_board(actions: list[dict], limit: int = 800) -> str:
    """Visuals first (they matter most for "explain another way"), then captions and writing."""
    visuals = [line for line in map(_describe, actions) if line]
    texts = [
        action["text"]
        for action in actions
        if action.get("type") in ("caption", "write") and action.get("text")
    ]
    lines: list[str] = []
    size = 0
    for line in dict.fromkeys(visuals + texts):  # dedupe, keep order
        if size + len(line) + 1 > limit:
            break
        lines.append(line)
        size += len(line) + 1
    return "\n".join(lines)


def summarize_plan(actions: list[dict], limit: int = 600) -> str:
    """What a stretch of board teaches, in teaching order: the part a reply still has to cover."""
    lines: list[str] = []
    size = 0
    for action in actions:
        line = _describe(action)
        if line is None and action.get("type") in ("caption", "write"):
            line = action.get("text")
        if not line or line in lines:
            continue
        if size + len(line) + 1 > limit:
            break
        lines.append(line)
        size += len(line) + 1
    return "\n".join(lines)


def question_context(actions: list[dict], index: int, limit: int = 200) -> str:
    """The question asked at `index`: the last caption before it and the writes after that."""
    start = next((i for i in range(index - 1, -1, -1) if actions[i].get("type") == "caption"), None)
    if start is None:
        return ""
    parts = [actions[start]["text"]]
    parts += [
        action["text"]
        for action in actions[start + 1 : index]
        if action.get("type") == "write" and action.get("text")
    ]
    return "\n".join(parts)[:limit]
