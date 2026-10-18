import json
import threading
import time
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException

from app.database import SessionLocal
from app.models.board import BoardEvent, BoardSession
from app.models.llm_call import LlmCall
from app.models.user import User, UserRole
from app.repositories import board_repository
from app.schemas.whiteboard import TurnCreate
from app.services import whiteboard_service
from app.services.llm import claude_bridge
from app.services.whiteboard.parser import ActionStreamParser
from app.services.whiteboard.summary import summarize_board

DOUBTS = "/api/v1/student/doubts"

BOARD_SCRIPT = (
    '{"type":"caption","text":"Let\'s expand (x+y)^2."}\n'
    '{"type":"write","text":"(x+y)^2","x":80,"y":110,"size":"lg","id":"t"}\n'
    "not json at all\n"
    '{"type":"erase","id":"t"}\n'
    '{"type":"box","id":"t","color":"green"}\n'
)


def fake_stream(text: str, chunk: int = 7, error: Exception | None = None):
    async def stream_text(system, prompt, **kwargs):
        fake_stream.prompt = prompt
        for start in range(0, len(text), chunk):
            yield text[start : start + chunk]
        if error:
            raise error

    return stream_text


def read_events(response) -> list[tuple[str, dict]]:
    events = []
    for block in response.text.split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines() if not line.startswith(":"))
        if "event" in lines:
            events.append((lines["event"], json.loads(lines["data"])))
    return events


# -- parser -------------------------------------------------------------------


@pytest.mark.parametrize("chunk", [1, 3, 50, 10_000])
def test_parser_handles_any_chunking(chunk):
    parser = ActionStreamParser(max_actions=100)
    actions = []
    for start in range(0, len(BOARD_SCRIPT), chunk):
        actions += parser.feed(BOARD_SCRIPT[start : start + chunk])
    actions += parser.flush()

    assert [a["type"] for a in actions] == ["caption", "write", "erase", "box"]
    assert parser.dropped == 1


def test_parser_cleans_up_model_output():
    parser = ActionStreamParser(max_actions=100)
    text = "\n".join(
        [
            "```json",
            '[{"type":"write","text":"hi","x":-50,"y":5000,"color":"pink","size":"huge","why":"x"},',
            '{"type":"line","from":[10,10],"to":[99999,20]}',
            '{"type":"rect","x":10,"y":10}',  # missing w/h
            '{"type":"erase"}',  # no target
            '{"type":"teleport","x":1}',
            '{"type":"caption","text":"' + "a" * 500 + '"}]',
            "```",
        ]
    )
    actions = parser.feed(text) + parser.flush()

    write, line, caption = actions
    assert write == {
        "type": "write",
        "text": "hi",
        "x": 0.0,
        "y": 900.0,
        "size": "md",
        "color": "ink",
    }
    assert line["from"] == [10.0, 10.0] and line["to"] == [1600.0, 20.0]
    assert len(caption["text"]) == 300
    assert parser.dropped == 3


def test_parser_accepts_animation_actions():
    parser = ActionStreamParser(max_actions=100)
    script = "\n".join(
        [
            '{"type":"object","id":"apple","sprite":"apple","x":1120,"y":220,"size":999}',
            '{"type":"object","id":"g","shape":"arrow","follow":"apple","dx":0,"dy":90,"label":"gravity"}',
            '{"type":"object","id":"lost","shape":"sprite"}',  # no position and nothing to follow
            '{"type":"animate","id":"apple","motion":"fall","to_y":800,"bounce":3,"trail":true}',
            '{"type":"animate","id":"moon","motion":"orbit","around":"earth","period":0,"loop":true}',
            '{"type":"animate","id":"x","motion":"warp"}',
            '{"type":"stop","id":"moon"}',
            '{"type":"remove","id":"apple"}',
        ]
    )
    actions = parser.feed(script) + parser.flush()

    apple, arrow, fall, orbit, stop, remove = actions
    assert apple["shape"] == "sprite" and apple["size"] == 320
    assert arrow["follow"] == "apple" and arrow["dy"] == 90
    assert fall["bounce"] == 0.8 and fall["trail"] is True
    assert orbit["period"] == 0.2 and orbit["loop"] is True
    assert (stop["type"], remove["type"]) == ("stop", "remove")
    assert parser.dropped == 2


def test_parser_stops_at_the_action_cap():
    parser = ActionStreamParser(max_actions=2)
    actions = parser.feed('{"type":"clear"}\n' * 5)
    assert len(actions) == 2 and parser.full


# -- endpoints ------------------------------------------------------------------


def test_student_asks_a_doubt_and_the_board_streams(signed_in, monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", fake_stream(BOARD_SCRIPT))
    student = signed_in("s@example.com", UserRole.STUDENT)
    student.patch("/api/v1/profile", json={"grade": 9, "board": "cbse"})

    response = student.post(DOUBTS, json={"question": "  Why is (x+y)^2 so?  ", "subject": "Maths"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["x-accel-buffering"] == "no"
    events = read_events(response)
    assert [name for name, _ in events] == [
        "doubt",
        "status",
        "action",
        "action",
        "action",
        "action",
        "done",
    ]
    doubt = events[0][1]
    assert doubt["question"] == "Why is (x+y)^2 so?" and doubt["status"] == "streaming"
    assert "Class 9" in fake_stream.prompt
    assert events[-1][1] == {"id": doubt["id"], "count": 4}

    saved = student.get(f"{DOUBTS}/{doubt['id']}").json()["data"]
    assert saved["status"] == "complete" and saved["completed_at"]
    assert [a["type"] for a in saved["actions"]] == ["caption", "write", "erase", "box"]
    listed = student.get(DOUBTS).json()["data"]
    assert [(d["id"], d["subject"]) for d in listed] == [(doubt["id"], "Maths")]
    assert "actions" not in listed[0]


def test_bridge_offline_is_reported_and_saved_as_failed(signed_in, monkeypatch):
    error = claude_bridge.BridgeOfflineError("refused")
    monkeypatch.setattr(claude_bridge, "stream_text", fake_stream("", error=error))
    student = signed_in("s@example.com", UserRole.STUDENT)

    events = read_events(student.post(DOUBTS, json={"question": "What is a prime?"}))

    name, data = events[-1]
    assert name == "error" and "offline" in data["message"]
    with SessionLocal() as db:
        doubt = db.query(BoardSession).one()
        turn = db.query(BoardEvent).one()
        assert doubt.status == "failed" and "offline" in doubt.error
        assert turn.payload["status"] == "failed" and turn.payload["actions"] == []


def test_partial_board_is_kept_when_the_run_fails(signed_in, monkeypatch):
    error = claude_bridge.BridgeError("exit 1")
    monkeypatch.setattr(claude_bridge, "stream_text", fake_stream(BOARD_SCRIPT, error=error))
    student = signed_in("s@example.com", UserRole.STUDENT)

    events = read_events(student.post(DOUBTS, json={"question": "What is a prime?"}))

    assert events[-1] == (
        "error",
        {"message": "The AI tutor ran into a problem. Please try again."},
    )
    doubt_id = events[0][1]["id"]
    saved = student.get(f"{DOUBTS}/{doubt_id}").json()["data"]
    assert saved["status"] == "failed" and len(saved["actions"]) == 4


def test_no_valid_actions_is_an_error(signed_in, monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", fake_stream("Sorry, I can't draw.\n"))
    student = signed_in("s@example.com", UserRole.STUDENT)

    events = read_events(student.post(DOUBTS, json={"question": "What is a prime?"}))

    assert events[-1][0] == "error" and "different way" in events[-1][1]["message"]


def test_doubt_validation_and_access(signed_in, monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", fake_stream(BOARD_SCRIPT))
    owner = signed_in("s@example.com", UserRole.STUDENT)
    other = signed_in("s2@example.com", UserRole.STUDENT)
    teacher = signed_in("t@example.com", UserRole.TEACHER)

    assert owner.post(DOUBTS, json={"question": "  "}).status_code == 422
    assert owner.post(DOUBTS, json={"question": "x" * 501}).status_code == 422
    assert teacher.post(DOUBTS, json={"question": "What is a prime?"}).status_code == 403
    assert teacher.get(DOUBTS).status_code == 403

    doubt_id = read_events(owner.post(DOUBTS, json={"question": "What is a prime?"}))[0][1]["id"]
    assert other.get(f"{DOUBTS}/{doubt_id}").status_code == 404
    assert other.delete(f"{DOUBTS}/{doubt_id}").status_code == 404

    assert owner.delete(f"{DOUBTS}/{doubt_id}").status_code == 200
    assert owner.get(f"{DOUBTS}/{doubt_id}").status_code == 404
    with SessionLocal() as db:
        assert db.query(BoardEvent).count() == 0
    assert owner.get(DOUBTS).json()["data"] == []


def test_csrf_header_is_required_to_ask(make_client, create_user, monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", fake_stream(BOARD_SCRIPT))
    create_user("s@example.com", UserRole.STUDENT)
    client = make_client(headers={})
    client.post(
        "/api/v1/auth/login",
        json={"email": "s@example.com", "password": "Str0ngPass!"},
        headers={"X-Requested-With": "XMLHttpRequest"},
    )
    assert client.post(DOUBTS, json={"question": "What is a prime?"}).status_code == 403


# -- board sessions -------------------------------------------------------------


def test_saved_doubt_has_one_turn(signed_in, monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", fake_stream(BOARD_SCRIPT))
    student = signed_in("s@example.com", UserRole.STUDENT)

    doubt_id = read_events(student.post(DOUBTS, json={"question": "What is a prime?"}))[0][1]["id"]

    saved = student.get(f"{DOUBTS}/{doubt_id}").json()["data"]
    assert saved["turns"] == [
        {"question": "What is a prime?", "mode": "ask", "status": "complete", "count": 4}
    ]
    with SessionLocal() as db:
        session = db.get(BoardSession, doubt_id)
        assert (session.kind, session.protocol_v, session.title) == ("doubt", 2, "What is a prime?")


def test_migrated_v1_session_replays_unchanged(signed_in):
    student = signed_in("s@example.com", UserRole.STUDENT)
    parser = ActionStreamParser(max_actions=100)
    actions = parser.feed(BOARD_SCRIPT) + parser.flush()
    with SessionLocal() as db:
        owner = db.query(User).filter_by(email="s@example.com").one()
        session = board_repository.create_session(
            db,
            student_id=owner.id,
            title="Why is (x+y)^2 so?",
            subject="Maths",
            status="complete",
            protocol_v=1,
        )
        board_repository.add_turn(
            db,
            session,
            {
                "question": "Why is (x+y)^2 so?",
                "mode": "ask",
                "actions": actions,
                "status": "complete",
                "error": None,
                "cached": False,
            },
        )
        db.commit()
        doubt_id = session.id

    saved = student.get(f"{DOUBTS}/{doubt_id}").json()["data"]

    assert saved["actions"] == actions
    assert saved["question"] == "Why is (x+y)^2 so?" and saved["status"] == "complete"
    assert saved["turns"] == [
        {"question": "Why is (x+y)^2 so?", "mode": "ask", "status": "complete", "count": 4}
    ]


def test_flatten_turns_inserts_scenes_between_turns():
    turns = [
        {"question": "First?", "actions": [{"type": "clear"}, {"type": "pause"}]},
        {"question": "Second question?", "actions": [{"type": "clear"}]},
    ]

    actions = whiteboard_service.flatten_turns(turns)

    assert len(actions) == 4
    assert actions[2] == {"type": "scene", "title": "Second question?"}
    assert actions[:2] == turns[0]["actions"] and actions[3] == {"type": "clear"}


# -- follow-ups, another way, cache -------------------------------------------------


def counting_stream(text: str):
    async def stream_text(system, prompt, **kwargs):
        stream_text.calls += 1
        stream_text.prompt = prompt
        yield text

    stream_text.calls = 0
    return stream_text


def ask(client, question="What is a prime?", subject=None) -> str:
    body = {"question": question} | ({"subject": subject} if subject else {})
    return read_events(client.post(DOUBTS, json=body))[0][1]["id"]


def test_summarize_board_is_short_and_descriptive():
    actions = [{"type": "write", "text": f"line {n}"} for n in range(300)]
    actions.append({"type": "plot", "fns": ["x^2"], "x": [-3, 3]})
    actions.append({"type": "diagram", "kind": "circuit"})

    summary = summarize_board(actions)

    assert "plot: x^2" in summary and "diagram: circuit" in summary
    assert "line 0" in summary
    assert len(summary) <= 800


def test_follow_up_streams_onto_the_same_board(signed_in, monkeypatch):
    fake = counting_stream(BOARD_SCRIPT)
    monkeypatch.setattr(claude_bridge, "stream_text", fake)
    student = signed_in("s@example.com", UserRole.STUDENT)
    doubt_id = ask(student)

    response = student.post(f"{DOUBTS}/{doubt_id}/turns", json={"question": "Why is it 2xy?"})

    assert response.status_code == 200
    events = read_events(response)
    assert events[0][1]["id"] == doubt_id and events[-1][0] == "done"
    assert "<board>" in fake.prompt and "follow-up" in fake.prompt
    assert "<doubt>\nWhy is it 2xy?\n</doubt>" in fake.prompt
    saved = student.get(f"{DOUBTS}/{doubt_id}").json()["data"]
    assert [turn["mode"] for turn in saved["turns"]] == ["ask", "follow_up"]
    assert {"type": "scene", "title": "Why is it 2xy?"} in saved["actions"]
    assert saved["status"] == "complete"
    with SessionLocal() as db:
        assert db.query(LlmCall).count() == 2


def test_explain_another_way_reuses_the_question(signed_in, monkeypatch):
    fake = counting_stream(BOARD_SCRIPT)
    monkeypatch.setattr(claude_bridge, "stream_text", fake)
    student = signed_in("s@example.com", UserRole.STUDENT)
    doubt_id = ask(student, "What is a prime number?")

    response = student.post(f"{DOUBTS}/{doubt_id}/turns", json={"mode": "another_way"})

    assert read_events(response)[-1][0] == "done"
    assert "different way" in fake.prompt
    assert "<doubt>\nWhat is a prime number?\n</doubt>" in fake.prompt
    saved = student.get(f"{DOUBTS}/{doubt_id}").json()["data"]
    assert saved["turns"][1]["question"] == "What is a prime number?"


def test_follow_up_needs_a_question(signed_in, monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", counting_stream(BOARD_SCRIPT))
    student = signed_in("s@example.com", UserRole.STUDENT)
    doubt_id = ask(student)

    assert student.post(f"{DOUBTS}/{doubt_id}/turns", json={}).status_code == 422


def _turn(question: str, status: str = "complete") -> dict:
    return {
        "question": question,
        "mode": "follow_up",
        "actions": [],
        "status": status,
        "error": None,
        "cached": False,
    }


def test_busy_board_and_turn_limit(signed_in, monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", counting_stream(BOARD_SCRIPT))
    student = signed_in("s@example.com", UserRole.STUDENT)
    busy_id, full_id = ask(student), ask(student, "What is a factor?")
    with SessionLocal() as db:
        board_repository.add_turn(db, db.get(BoardSession, busy_id), _turn("q", "streaming"))
        full = db.get(BoardSession, full_id)
        for n in range(5):
            board_repository.add_turn(db, full, _turn(f"q{n}"))
        db.commit()

    busy = student.post(f"{DOUBTS}/{busy_id}/turns", json={"question": "Again?"})
    assert busy.status_code == 409 and "Wait" in busy.json()["message"]
    full = student.post(f"{DOUBTS}/{full_id}/turns", json={"question": "Again?"})
    assert full.status_code == 409 and "full" in full.json()["message"]


def test_turns_are_owner_only(signed_in, monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", counting_stream(BOARD_SCRIPT))
    owner = signed_in("s@example.com", UserRole.STUDENT)
    other = signed_in("s2@example.com", UserRole.STUDENT)
    teacher = signed_in("t@example.com", UserRole.TEACHER)
    doubt_id = ask(owner)

    body = {"question": "Why?"}
    assert other.post(f"{DOUBTS}/{doubt_id}/turns", json=body).status_code == 404
    assert teacher.post(f"{DOUBTS}/{doubt_id}/turns", json=body).status_code == 403


def test_identical_doubt_is_served_from_cache(signed_in, monkeypatch):
    fake = counting_stream(BOARD_SCRIPT)
    monkeypatch.setattr(claude_bridge, "stream_text", fake)
    first = signed_in("s1@example.com", UserRole.STUDENT)
    second = signed_in("s2@example.com", UserRole.STUDENT)
    third = signed_in("s3@example.com", UserRole.STUDENT)
    for client, grade in ((first, 9), (second, 9), (third, 10)):
        client.patch("/api/v1/profile", json={"grade": grade, "board": "cbse"})

    ask(first, "What is a prime number?", "Maths")
    events = read_events(
        second.post(DOUBTS, json={"question": "  what is a PRIME   number ", "subject": "maths"})
    )

    assert fake.calls == 1
    assert [name for name, _ in events].count("action") == 4 and events[-1][0] == "done"
    with SessionLocal() as db:
        turn = db.query(BoardEvent).filter_by(session_id=events[0][1]["id"]).one()
        assert turn.payload["cached"] is True and turn.payload["status"] == "complete"
        assert db.query(LlmCall).count() == 1

    ask(third, "What is a prime number?", "Maths")
    assert fake.calls == 2


def test_failed_board_is_never_cached(signed_in, monkeypatch):
    error = claude_bridge.BridgeError("exit 1")
    monkeypatch.setattr(claude_bridge, "stream_text", fake_stream(BOARD_SCRIPT, error=error))
    student = signed_in("s@example.com", UserRole.STUDENT)
    ask(student)

    fake = counting_stream(BOARD_SCRIPT)
    monkeypatch.setattr(claude_bridge, "stream_text", fake)
    ask(student)

    assert fake.calls == 1


def test_flatten_turns_keeps_the_models_own_scene():
    turns = [
        {"question": "First?", "actions": [{"type": "clear"}]},
        {
            "question": "Second?",
            "actions": [
                {"type": "caption", "text": "New page."},
                {"type": "scene", "title": "Part 2"},
                {"type": "write", "text": "x"},
            ],
        },
    ]

    actions = whiteboard_service.flatten_turns(turns)

    assert [a for a in actions if a["type"] == "scene"] == [{"type": "scene", "title": "Part 2"}]


def test_stale_streaming_turn_does_not_block_follow_ups(signed_in, monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", counting_stream(BOARD_SCRIPT))
    student = signed_in("s@example.com", UserRole.STUDENT)
    doubt_id = ask(student)
    with SessionLocal() as db:
        stuck = board_repository.add_turn(
            db, db.get(BoardSession, doubt_id), _turn("lost in a restart", "streaming")
        )
        stuck.created_at = datetime.now(UTC) - timedelta(hours=1)
        db.commit()
        stuck_id = stuck.id

    response = student.post(f"{DOUBTS}/{doubt_id}/turns", json={"question": "Again?"})

    assert response.status_code == 200 and read_events(response)[-1][0] == "done"
    with SessionLocal() as db:
        assert db.get(BoardEvent, stuck_id).payload["status"] == "failed"


def test_concurrent_follow_ups_get_one_conflict(signed_in, monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", counting_stream(BOARD_SCRIPT))
    student = signed_in("s@example.com", UserRole.STUDENT)
    doubt_id = ask(student)
    real_get = whiteboard_service.profile_repository.get

    def slow_get(db, user_id):  # widen the gap between the busy check and the insert
        time.sleep(0.4)
        return real_get(db, user_id)

    monkeypatch.setattr(whiteboard_service.profile_repository, "get", slow_get)
    outcomes = []

    def follow_up():
        with SessionLocal() as db:
            owner = db.query(User).filter_by(email="s@example.com").one()
            try:
                whiteboard_service.start_turn(
                    db, owner, doubt_id, TurnCreate(question="Why is that?")
                )
                outcomes.append("ok")
            except HTTPException as error:
                outcomes.append(error.status_code)
            except Exception as error:  # noqa: BLE001 - the race shows up as any other error
                outcomes.append(type(error).__name__)

    threads = [threading.Thread(target=follow_up) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sorted(outcomes, key=str) == [409, "ok"]
    with SessionLocal() as db:
        assert len(board_repository.list_turns(db, doubt_id)) == 2
