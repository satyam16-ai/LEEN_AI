import asyncio

from app.services.llm import claude_bridge
from app.services.whiteboard import board_eval

SCRIPT = '{"type":"caption","text":"Hi"}\n{"type":"write","text":"x^2"}\nnot json\n'


def fake_eval_stream(output_tokens: list[int]):
    calls = iter(output_tokens)

    async def stream_text(system, prompt, *, usage=None, **kwargs):
        yield SCRIPT
        if usage is not None:
            usage.update(
                {
                    "input_tokens": 50,
                    "output_tokens": next(calls),
                    "cache_read_tokens": 2000,
                    "cache_write_tokens": 0,
                    "cost_usd": 0.001,
                    "duration_ms": 1200,
                }
            )

    return stream_text


def test_board_eval_summarises_runs(monkeypatch):
    monkeypatch.setattr(
        board_eval,
        "SAMPLE_DOUBTS",
        [("Mathematics", "What is x^2?"), ("Physics", "Why do apples fall?")],
    )
    monkeypatch.setattr(claude_bridge, "stream_text", fake_eval_stream([100, 300]))

    report = asyncio.run(board_eval.run_board_eval("v1"))

    assert report["label"] == "v1" and report["model"] == "sonnet"
    assert len(report["runs"]) == 2
    first = report["runs"][0]
    assert first["subject"] == "Mathematics" and first["error"] is None
    assert first["types"] == {"caption": 1, "write": 1}
    assert (first["actions"], first["dropped"]) == (2, 1)
    assert (first["output_tokens"], first["cache_read_tokens"]) == (100, 2000)
    assert report["median_output_tokens"] == 200
    assert report["median_input_tokens"] == 50
    assert report["median_actions"] == 2


def test_board_eval_records_failed_runs(monkeypatch):
    monkeypatch.setattr(board_eval, "SAMPLE_DOUBTS", [("Mathematics", "What is x^2?")])

    async def offline(system, prompt, **kwargs):
        raise claude_bridge.BridgeOfflineError("refused")
        yield  # pragma: no cover

    monkeypatch.setattr(claude_bridge, "stream_text", offline)

    report = asyncio.run(board_eval.run_board_eval("v1"))

    assert report["runs"][0]["error"] and report["median_output_tokens"] == 0


def test_compare_flags_regressions():
    assert board_eval.compare(
        {"median_output_tokens": 900}, {"median_output_tokens": 800}
    ) == ["median output tokens 900 > baseline 800"]
    assert board_eval.compare({"median_output_tokens": 800}, {"median_output_tokens": 800}) == []


def test_sample_doubts_cover_four_subjects():
    subjects = [subject for subject, _ in board_eval.SAMPLE_DOUBTS]
    assert len(subjects) == 8
    assert {s: subjects.count(s) for s in set(subjects)} == {
        "Mathematics": 2,
        "Physics": 2,
        "Chemistry": 2,
        "Biology": 2,
    }
