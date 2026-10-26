import base64
import json

import pytest
from claude_bridge import build_command, extract_event, parse_images, user_message


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
    assert event == {
        "type": "done",
        "duration_ms": 2257,
        "cost_usd": 0.0014,
        "usage": {
            "input_tokens": 0,
            "output_tokens": 0,
            "cache_read_tokens": 0,
            "cache_write_tokens": 0,
        },
    }


def test_extract_event_forwards_usage():
    event = extract_event(
        line(
            {
                "type": "result",
                "subtype": "success",
                "duration_ms": 900,
                "total_cost_usd": 0.004,
                "usage": {
                    "input_tokens": 12,
                    "output_tokens": 340,
                    "cache_read_input_tokens": 2100,
                    "cache_creation_input_tokens": 0,
                },
            }
        )
    )
    assert event["usage"] == {
        "input_tokens": 12,
        "output_tokens": 340,
        "cache_read_tokens": 2100,
        "cache_write_tokens": 0,
    }


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


def image(media_type="image/png", data=b"png-bytes"):
    return {"media_type": media_type, "data": base64.b64encode(data).decode()}


def test_parse_images_accepts_jpeg_png_webp():
    images = [image("image/jpeg"), image("image/png"), image("image/webp")]
    assert parse_images(images) == images
    assert parse_images(None) == []


@pytest.mark.parametrize(
    "value",
    [
        "not a list",
        [image()] * 4,
        [image("image/gif")],
        [{"media_type": "image/png", "data": "not base64!!"}],
        [image(data=b"x" * (5 * 1024 * 1024 + 1))],
        [{"media_type": "image/png"}],
    ],
)
def test_parse_images_rejects_bad_input(value):
    with pytest.raises(ValueError):
        parse_images(value)


def test_user_message_puts_images_before_text():
    message = json.loads(user_message("Read this", [image(), image("image/jpeg")]))
    assert message["type"] == "user"
    content = message["message"]["content"]
    assert [block["type"] for block in content] == ["image", "image", "text"]
    assert content[0]["source"] == {
        "type": "base64",
        "media_type": "image/png",
        "data": image()["data"],
    }
    assert content[-1]["text"] == "Read this"


def test_build_command_stream_input_flag():
    plain = build_command("claude", "sys", None, None)
    streamed = build_command("claude", "sys", None, None, stream_input=True)
    assert "--input-format" not in plain
    assert streamed[streamed.index("--input-format") + 1] == "stream-json"
