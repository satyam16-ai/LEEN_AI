import json

from claude_bridge import build_command, extract_event


def line(payload):
    return json.dumps(payload) + "\n"


def delta(kind, **fields):
    return line(
        {
            "type": "stream_event",
            "event": {"type": "content_block_delta", "delta": {"type": kind, **fields}},
        }
    )


def test_text_delta_is_forwarded():
    assert extract_event(delta("text_delta", text='{"type":')) == {
        "type": "text",
        "text": '{"type":',
    }


def test_thinking_and_bookkeeping_are_ignored():
    assert extract_event(delta("thinking_delta", thinking="hmm")) is None
    assert extract_event(delta("text_delta", text="")) is None
    assert extract_event(line({"type": "system", "subtype": "init", "tools": []})) is None
    assert extract_event(line({"type": "stream_event", "event": {"type": "message_stop"}})) is None
    assert extract_event(line({"type": "assistant", "message": {}})) is None


def test_success_result_becomes_done():
    event = extract_event(
        line(
            {
                "type": "result",
                "subtype": "success",
                "is_error": False,
                "duration_ms": 2257,
                "total_cost_usd": 0.0014,
            }
        )
    )
    assert event == {"type": "done", "duration_ms": 2257, "cost_usd": 0.0014}


def test_error_result_becomes_error():
    event = extract_event(
        line({"type": "result", "subtype": "error_max_turns", "is_error": True, "result": None})
    )
    assert event == {"type": "error", "message": "error_max_turns"}
    event = extract_event(
        line({"type": "result", "subtype": "success", "is_error": True, "result": "Not logged in"})
    )
    assert event == {"type": "error", "message": "Not logged in"}


def test_garbage_lines_are_ignored():
    assert extract_event("") is None
    assert extract_event("not json\n") is None


def test_command_disables_tools_and_settings():
    command = build_command("claude", "SYS", "sonnet", "low")
    assert command[:2] == ["claude", "-p"]
    assert command[command.index("--tools") + 1] == ""
    assert command[command.index("--setting-sources") + 1] == ""
    assert command[command.index("--system-prompt") + 1] == "SYS"
    assert "--model" in command and "--effort" in command
    assert "--model" not in build_command("claude", "SYS", None, None)
