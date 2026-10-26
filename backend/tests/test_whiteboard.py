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
        for n in range(11):
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


# -- questions: answer keys stay on the server ------------------------------------------

QUESTION_SCRIPT = (
    '{"type":"caption","text":"What is the area of a 3 cm by 4 cm rectangle?"}\n'
    '{"type":"write","text":"Area = ?","id":"a"}\n'
    '{"type":"ask","id":"q1","kind":"number","answer":13,"calc":"3*4","unit":"cm"}\n'
)


def _has_key(action: dict) -> bool:
    return "answer" in action or "calc" in action


def test_answer_keys_never_reach_the_browser(signed_in, monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", counting_stream(QUESTION_SCRIPT))
    student = signed_in("s@example.com", UserRole.STUDENT)

    events = read_events(student.post(DOUBTS, json={"question": "Area of a 3 by 4 rectangle?"}))
    streamed = [data for name, data in events if name == "action"]
    doubt_id = events[0][1]["id"]

    asks = [action for action in streamed if action["type"] == "ask"]
    assert asks == [{"type": "ask", "id": "q1", "kind": "number", "unit": "cm"}]
    saved = student.get(f"{DOUBTS}/{doubt_id}").json()["data"]
    assert not any(_has_key(action) for action in saved["actions"])
    with SessionLocal() as db:
        [turn] = board_repository.list_turns(db, doubt_id)
        [stored] = [a for a in turn.payload["actions"] if a["type"] == "ask"]
        assert stored["answer"] == 12.0

    cached = read_events(student.post(DOUBTS, json={"question": "Area of a 3 by 4 rectangle?"}))
    cached_asks = [data for name, data in cached if name == "action" and data["type"] == "ask"]
    assert cached_asks == asks


def test_doubts_are_logged_as_the_doubt_solver(signed_in, monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", counting_stream(BOARD_SCRIPT))
    student = signed_in("s@example.com", UserRole.STUDENT)

    ask(student)

    with SessionLocal() as db:
        assert [call.agent for call in db.query(LlmCall).all()] == ["doubt_solver"]


# -- replies mid-explanation and practice ------------------------------------------------

STEPS_SCRIPT = (
    '{"type":"caption","text":"First, the rule."}\n'
    '{"type":"write","text":"1/v - 1/u = 1/f"}\n'
    '{"type":"caption","text":"Now put in the numbers."}\n'
    '{"type":"write","text":"v = 15 cm"}\n'
)
REPLY_SCRIPT = '{"type":"caption","text":"Good question!"}\n{"type":"write","text":"inverted"}\n'


def test_reply_cuts_the_board_and_carries_on(signed_in, monkeypatch):
    fake = counting_stream(STEPS_SCRIPT)
    monkeypatch.setattr(claude_bridge, "stream_text", fake)
    student = signed_in("s@example.com", UserRole.STUDENT)
    doubt_id = ask(student, "Where is the image of a convex lens?")
    fake_reply = counting_stream(REPLY_SCRIPT)
    monkeypatch.setattr(claude_bridge, "stream_text", fake_reply)

    response = student.post(f"{DOUBTS}/{doubt_id}/turns", json={"question": "Why?", "keep": 2})

    assert read_events(response)[-1][0] == "done"
    assert "<left>\nNow put in the numbers.\nv = 15 cm\n</left>" in fake_reply.prompt
    assert "<message>\nWhy?\n</message>" in fake_reply.prompt
    assert "<doubt>\nWhere is the image of a convex lens?\n</doubt>" in fake_reply.prompt
    saved = student.get(f"{DOUBTS}/{doubt_id}").json()["data"]
    assert [a["text"] for a in saved["actions"]] == [
        "First, the rule.",
        "1/v - 1/u = 1/f",
        "Good question!",
        "inverted",
    ]
    assert [(t["mode"], t["question"]) for t in saved["turns"]] == [
        ("ask", "Where is the image of a convex lens?"),
        ("reply", "Why?"),
    ]
    with SessionLocal() as db:
        first = board_repository.list_turns(db, doubt_id)[0]
        assert first.payload["cut_at"] == 2 and len(first.payload["actions"]) == 4


def test_reply_without_left_wraps_up(signed_in, monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", counting_stream(STEPS_SCRIPT))
    student = signed_in("s@example.com", UserRole.STUDENT)
    doubt_id = ask(student)
    fake_reply = counting_stream(REPLY_SCRIPT)
    monkeypatch.setattr(claude_bridge, "stream_text", fake_reply)

    student.post(f"{DOUBTS}/{doubt_id}/turns", json={"question": "And then?", "keep": 99})

    assert "<left>" not in fake_reply.prompt and "wrap up" in fake_reply.prompt
    saved = student.get(f"{DOUBTS}/{doubt_id}").json()["data"]
    assert len(saved["actions"]) == 6 and saved["turns"][1]["mode"] == "reply"


def test_now_you_try_sets_a_practice_question(signed_in, monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", counting_stream(BOARD_SCRIPT))
    student = signed_in("s@example.com", UserRole.STUDENT)
    doubt_id = ask(student, "What is a prime number?")
    fake = counting_stream(QUESTION_SCRIPT)
    monkeypatch.setattr(claude_bridge, "stream_text", fake)

    response = student.post(f"{DOUBTS}/{doubt_id}/turns", json={"mode": "practice"})

    assert read_events(response)[-1][0] == "done"
    assert "Now you try" in fake.prompt
    saved = student.get(f"{DOUBTS}/{doubt_id}").json()["data"]
    assert saved["turns"][1] | {"count": 0} == {
        "question": "What is a prime number?",
        "mode": "practice",
        "status": "complete",
        "count": 0,
    }
    with SessionLocal() as db:
        agents = [call.agent for call in db.query(LlmCall).order_by(LlmCall.created_at)]
        assert agents == ["doubt_solver", "examiner"]


def test_flatten_applies_cuts_and_answers():
    ask_q1 = {"type": "ask", "id": "q1", "kind": "number"}
    turns = [
        {
            "question": "Area?",
            "mode": "ask",
            "actions": [
                {"type": "caption", "text": "c"},
                {"type": "write", "text": "w"},
                ask_q1,
                {"type": "caption", "text": "cut"},
            ],
            "cut_at": 3,
        },
        {"question": "Why?", "mode": "check", "actions": [{"type": "caption", "text": "see"}]},
    ]
    answers = {
        (0, "q1"): [
            {"turn": 0, "ask": "q1", "answer": "14", "correct": False, "attempt": 1},
            {"turn": 0, "ask": "q1", "answer": "12", "correct": True, "attempt": 2},
        ]
    }

    actions = whiteboard_service.flatten_turns(turns, answers)

    assert actions == [
        {"type": "caption", "text": "c"},
        {"type": "write", "text": "w"},
        ask_q1,
        {"type": "answer", "ask": "q1", "text": "14", "correct": False},
        {"type": "answer", "ask": "q1", "text": "12", "correct": True},
        {"type": "caption", "text": "see"},
    ]


def test_turns_have_their_own_rate_limit(signed_in, monkeypatch):
    from app.api.v1.endpoints import student as student_endpoints

    monkeypatch.setattr(claude_bridge, "stream_text", counting_stream(BOARD_SCRIPT))
    student = signed_in("s@example.com", UserRole.STUDENT)
    limits = []
    monkeypatch.setattr(
        student_endpoints.rate_limit,
        "enforce",
        lambda key, limit, window: limits.append((key.split(":")[0], limit, window)),
    )
    doubt_id = ask(student)

    student.post(f"{DOUBTS}/{doubt_id}/turns", json={"question": "Why so?"})

    assert limits == [("doubt", 15, 3600), ("doubt-turn", 40, 3600)]


# -- answers and check turns -------------------------------------------------------------

TEXT_SCRIPT = (
    '{"type":"caption","text":"Why does a lens bend light?"}\n'
    '{"type":"ask","id":"q2","kind":"text","answer":"Light changes speed in glass"}\n'
)
CHECK_SCRIPT = (
    '{"type":"caption","text":"Let us check."}\n'
    '{"type":"write","text":"15 cm","color":"orange","id":"s1"}\n'
    '{"type":"mark","id":"s1","kind":"cross"}\n'
)


def _question_board(student, monkeypatch, script=QUESTION_SCRIPT) -> str:
    monkeypatch.setattr(claude_bridge, "stream_text", counting_stream(script))
    return ask(student, "Area of a 3 by 4 rectangle?")


def _answer(student, doubt_id, answer, ask_id="q1"):
    return student.post(f"{DOUBTS}/{doubt_id}/answers", json={"ask": ask_id, "answer": answer})


def test_number_answer_is_checked_in_code(signed_in, monkeypatch):
    student = signed_in("s@example.com", UserRole.STUDENT)
    doubt_id = _question_board(student, monkeypatch)

    wrong = _answer(student, doubt_id, "14")
    right = _answer(student, doubt_id, "12 cm")

    assert wrong.status_code == 200
    assert wrong.json()["data"] == {
        "correct": False,
        "attempt": 1,
        "final": False,
        "expected": None,
    }
    assert right.json()["data"] == {"correct": True, "attempt": 2, "final": True, "expected": None}
    with SessionLocal() as db:
        assert db.query(LlmCall).count() == 1  # only the doubt itself


def test_two_wrong_answers_are_final(signed_in, monkeypatch):
    student = signed_in("s@example.com", UserRole.STUDENT)
    doubt_id = _question_board(student, monkeypatch)

    _answer(student, doubt_id, "14")
    second = _answer(student, doubt_id, "15")
    third = _answer(student, doubt_id, "12")

    assert second.json()["data"] == {
        "correct": False,
        "attempt": 2,
        "final": True,
        "expected": "12 cm",
    }
    assert third.status_code == 409 and "already answered" in third.json()["message"]


def test_unreadable_answer_does_not_use_a_try(signed_in, monkeypatch):
    student = signed_in("s@example.com", UserRole.STUDENT)
    doubt_id = _question_board(student, monkeypatch)

    unreadable = _answer(student, doubt_id, "abc")
    readable = _answer(student, doubt_id, "12")

    assert unreadable.status_code == 422
    assert readable.json()["data"]["attempt"] == 1


def test_text_answer_waits_for_the_teacher(signed_in, monkeypatch):
    student = signed_in("s@example.com", UserRole.STUDENT)
    doubt_id = _question_board(student, monkeypatch, TEXT_SCRIPT)

    response = _answer(student, doubt_id, "light slows down in glass", "q2")

    assert response.json()["data"] == {
        "correct": None,
        "attempt": 1,
        "final": True,
        "expected": None,
    }


def test_answer_needs_a_known_question(signed_in, monkeypatch):
    student = signed_in("s@example.com", UserRole.STUDENT)
    doubt_id = _question_board(student, monkeypatch)
    other = signed_in("o@example.com", UserRole.STUDENT)

    assert _answer(student, doubt_id, "12", "zz").status_code == 404
    assert _answer(other, doubt_id, "12").status_code == 404
    assert student.post(f"{DOUBTS}/{doubt_id}/answers", json={"ask": "q1"}).status_code == 422


def test_check_turn_explains_a_wrong_answer(signed_in, monkeypatch):
    student = signed_in("s@example.com", UserRole.STUDENT)
    doubt_id = _question_board(student, monkeypatch)
    _answer(student, doubt_id, "14")
    _answer(student, doubt_id, "15")
    fake = counting_stream(CHECK_SCRIPT)
    monkeypatch.setattr(claude_bridge, "stream_text", fake)

    response = student.post(
        f"{DOUBTS}/{doubt_id}/turns", json={"mode": "check", "ask": "q1", "keep": 3}
    )

    assert read_events(response)[-1][0] == "done"
    assert "<answer>\n14\n</answer>" in fake.prompt and "<answer>\n15\n</answer>" in fake.prompt
    assert "12 cm" in fake.prompt and "What is the area of a 3 cm by 4 cm rectangle?" in fake.prompt
    saved = student.get(f"{DOUBTS}/{doubt_id}").json()["data"]
    assert [a["type"] for a in saved["actions"]] == [
        "caption",
        "write",
        "ask",
        "answer",
        "answer",
        "caption",
        "write",
        "mark",
    ]
    assert [a["text"] for a in saved["actions"] if a["type"] == "answer"] == ["14", "15"]
    assert saved["turns"][1]["mode"] == "check"
    with SessionLocal() as db:
        agents = [call.agent for call in db.query(LlmCall).order_by(LlmCall.created_at)]
        assert agents == ["doubt_solver", "examiner"]


def test_verdict_marks_a_text_answer(signed_in, monkeypatch):
    student = signed_in("s@example.com", UserRole.STUDENT)
    doubt_id = _question_board(student, monkeypatch, TEXT_SCRIPT)
    _answer(student, doubt_id, "light slows down in glass", "q2")
    verdict = '{"type":"verdict","ask":"q2","correct":true}\n'
    monkeypatch.setattr(claude_bridge, "stream_text", counting_stream(CHECK_SCRIPT + verdict))

    student.post(f"{DOUBTS}/{doubt_id}/turns", json={"mode": "check", "ask": "q2"})

    with SessionLocal() as db:
        events = board_repository.list_events(db, doubt_id)
        [answer] = [event.payload for event in events if event.kind == "answer"]
        assert answer["correct"] is True


# -- small fixes after the review ---------------------------------------------------------


def test_parser_drops_non_finite_numbers():
    parser = ActionStreamParser(max_actions=10)
    actions = parser.feed('{"type":"ask","id":"q1","kind":"number","answer":Infinity}\n')
    actions += parser.feed('{"type":"pause","ms":NaN}\n') + parser.flush()
    assert actions == [] and parser.dropped == 2


def test_verdict_only_marks_the_question_checked(signed_in, monkeypatch):
    student = signed_in("s@example.com", UserRole.STUDENT)
    doubt_id = _question_board(student, monkeypatch, TEXT_SCRIPT)
    _answer(student, doubt_id, "an early answer", "q2")
    monkeypatch.setattr(claude_bridge, "stream_text", counting_stream(TEXT_SCRIPT))
    student.post(f"{DOUBTS}/{doubt_id}/turns", json={"mode": "practice"})
    _answer(student, doubt_id, "light slows down in glass", "q2")
    verdict = '{"type":"verdict","ask":"q2","correct":true}\n'
    monkeypatch.setattr(claude_bridge, "stream_text", counting_stream(CHECK_SCRIPT + verdict))

    student.post(f"{DOUBTS}/{doubt_id}/turns", json={"mode": "check", "ask": "q2"})

    with SessionLocal() as db:
        answers = [
            e.payload for e in board_repository.list_events(db, doubt_id) if e.kind == "answer"
        ]
        assert [(a["turn"], a["correct"]) for a in answers] == [(0, None), (1, True)]


def test_a_question_whose_solution_was_shown_cannot_be_answered(signed_in, monkeypatch):
    student = signed_in("s@example.com", UserRole.STUDENT)
    doubt_id = _question_board(student, monkeypatch)
    monkeypatch.setattr(claude_bridge, "stream_text", counting_stream(CHECK_SCRIPT))

    student.post(f"{DOUBTS}/{doubt_id}/turns", json={"mode": "check", "ask": "q1"})
    late = _answer(student, doubt_id, "12")

    assert late.status_code == 409
    saved = student.get(f"{DOUBTS}/{doubt_id}").json()["data"]
    assert not any(action["type"] == "answer" for action in saved["actions"])


# -- citing the student's own pages (Phase 6) --------------------------------------------

CITE_SCRIPT = (
    '{"type":"caption","text":"Inertia means resisting change."}\n'
    '{"type":"write","text":"Inertia","x":80,"y":110}\n'
    '{"type":"cite","source":1}\n'
    '{"type":"cite","source":7}\n'
)
INERTIA_PAGE = "Inertia: inertia resists changes in motion. Mass measures inertia."


def science_student(signed_in, email="cite@example.com"):
    client = signed_in(email, UserRole.STUDENT)
    client.patch("/api/v1/profile", json={"grade": 9, "board": "cbse", "subjects": ["Science"]})
    with SessionLocal() as db:
        student = db.query(User).filter_by(email=email).one()
    return client, student.id


def test_doubt_cites_retrieved_page(signed_in, monkeypatch):
    from tests.pages import add_ready_page

    fake = counting_stream(CITE_SCRIPT)
    monkeypatch.setattr(claude_bridge, "stream_text", fake)
    client, student_id = science_student(signed_in)
    document = add_ready_page(student_id, INERTIA_PAGE, title="Force", page=112)

    events = read_events(
        client.post(DOUBTS, json={"question": "What is inertia?", "subject": "Science"})
    )

    assert "<sources>\n[1] Force, page 112: Inertia" in fake.prompt
    cites = [data for name, data in events if name == "action" and data["type"] == "cite"]
    assert cites == [{"type": "cite", "source": 1, "doc": document, "page": 112, "title": "Force"}]
    saved = client.get(f"{DOUBTS}/{events[0][1]['id']}").json()["data"]
    assert [a for a in saved["actions"] if a["type"] == "cite"] == cites
    with SessionLocal() as db:
        turn = db.query(BoardEvent).filter_by(session_id=events[0][1]["id"]).one()
        assert turn.payload["sources"] == [{"n": 1, "doc": document, "page": 112, "title": "Force"}]


def test_cite_without_sources_is_dropped(signed_in, monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", counting_stream(CITE_SCRIPT))
    client, _ = science_student(signed_in)

    events = read_events(
        client.post(DOUBTS, json={"question": "What is inertia?", "subject": "Science"})
    )

    assert [d["type"] for n, d in events if n == "action"] == ["caption", "write"]


def test_unrelated_pages_are_not_cited(signed_in, monkeypatch):
    from tests.pages import add_ready_page

    fake = counting_stream(BOARD_SCRIPT)
    monkeypatch.setattr(claude_bridge, "stream_text", fake)
    client, student_id = science_student(signed_in)
    add_ready_page(student_id, "Photosynthesis converts sunlight into chemical energy.")

    ask(client, "What is inertia?", "Science")

    assert "<sources>" not in fake.prompt
    ask(client, "What is inertia?", "Science")
    assert fake.calls == 1  # no sources, so the board is cached as before


def test_doubt_with_sources_skips_cache(signed_in, monkeypatch):
    from tests.pages import add_ready_page

    fake = counting_stream(CITE_SCRIPT)
    monkeypatch.setattr(claude_bridge, "stream_text", fake)
    first, first_id = science_student(signed_in, "first@example.com")
    second, _ = science_student(signed_in, "second@example.com")
    add_ready_page(first_id, INERTIA_PAGE, title="Force", page=112)

    ask(first, "What is inertia?", "Science")
    events = read_events(
        second.post(DOUBTS, json={"question": "What is inertia?", "subject": "Science"})
    )

    assert fake.calls == 2
    assert "<sources>" not in fake.prompt
    assert not [d for n, d in events if n == "action" and d["type"] == "cite"]
    with SessionLocal() as db:
        first_session = db.query(BoardSession).order_by(BoardSession.created_at).first()
        assert first_session.cache_key is None


def test_follow_up_retrieves_sources(signed_in, monkeypatch):
    from tests.pages import add_ready_page

    fake = counting_stream(BOARD_SCRIPT)
    monkeypatch.setattr(claude_bridge, "stream_text", fake)
    client, student_id = science_student(signed_in)
    doubt_id = ask(client, "What is a prime?", "Science")
    add_ready_page(student_id, INERTIA_PAGE, title="Force", page=112)
    monkeypatch.setattr(claude_bridge, "stream_text", counting_stream(CITE_SCRIPT))

    events = read_events(
        client.post(
            f"{DOUBTS}/{doubt_id}/turns", json={"question": "What is inertia?", "mode": "follow_up"}
        )
    )

    cites = [d for n, d in events if n == "action" and d["type"] == "cite"]
    assert [(c["source"], c["page"]) for c in cites] == [(1, 112)]


# -- photo doubts (Phase 6) --------------------------------------------------------------


def image_stream(text: str):
    async def stream_text(system, prompt, *, images=(), **kwargs):
        stream_text.calls.append({"prompt": prompt, "images": images})
        yield text

    stream_text.calls = []
    return stream_text


def ask_photo(client, photo=None, **form):
    from tests.samples import png

    return client.post(
        f"{DOUBTS}/photo",
        files={"photo": ("question.jpg", photo or png(), "application/octet-stream")},
        data=form,
    )


def test_photo_doubt_streams_image_first(signed_in, monkeypatch):
    fake = image_stream(BOARD_SCRIPT)
    monkeypatch.setattr(claude_bridge, "stream_text", fake)
    client = signed_in("photo@example.com", UserRole.STUDENT)

    response = ask_photo(client, question="Solve question 3", subject="Maths")

    assert response.status_code == 200
    events = read_events(response)
    doubt_id = events[0][1]["id"]
    names = [name for name, _ in events]
    assert names[:3] == ["doubt", "status", "action"]
    assert events[2][1] == {
        "type": "image",
        "src": "photo",
        "url": f"/api/v1/student/doubts/{doubt_id}/photo",
    }
    assert names[-1] == "done"
    [call] = fake.calls
    assert [image.media_type for image in call["images"]] == ["image/jpeg"]
    assert "attached photo" in call["prompt"] and "Solve question 3" in call["prompt"]
    saved = client.get(f"{DOUBTS}/{doubt_id}").json()["data"]
    assert saved["actions"][0]["type"] == "image"
    assert saved["question"] == "Solve question 3"


def test_photo_doubt_default_question_and_title(signed_in, monkeypatch):
    fake = image_stream(BOARD_SCRIPT)
    monkeypatch.setattr(claude_bridge, "stream_text", fake)
    client = signed_in("photo@example.com", UserRole.STUDENT)

    doubt_id = read_events(ask_photo(client))[0][1]["id"]

    assert whiteboard_service.PHOTO_QUESTION in fake.calls[0]["prompt"]
    assert client.get(f"{DOUBTS}/{doubt_id}").json()["data"]["question"] == "Question from a photo"


def test_photo_doubt_rejects_non_image(signed_in, monkeypatch):
    fake = image_stream(BOARD_SCRIPT)
    monkeypatch.setattr(claude_bridge, "stream_text", fake)
    client = signed_in("photo@example.com", UserRole.STUDENT)

    assert ask_photo(client, b"definitely not a photo").status_code == 422
    assert fake.calls == []


def test_photo_is_owner_only(signed_in, monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", image_stream(BOARD_SCRIPT))
    owner = signed_in("photo@example.com", UserRole.STUDENT)
    other = signed_in("nosy@example.com", UserRole.STUDENT)
    doubt_id = read_events(ask_photo(owner))[0][1]["id"]
    plain_id = ask(owner, "What is a prime?")

    photo = owner.get(f"{DOUBTS}/{doubt_id}/photo")
    assert photo.status_code == 200
    assert photo.headers["content-type"] == "image/jpeg"
    assert other.get(f"{DOUBTS}/{doubt_id}/photo").status_code == 404
    assert owner.get(f"{DOUBTS}/{plain_id}/photo").status_code == 404


def test_photo_doubt_is_not_cached(signed_in, monkeypatch):
    fake = image_stream(BOARD_SCRIPT)
    monkeypatch.setattr(claude_bridge, "stream_text", fake)
    client = signed_in("photo@example.com", UserRole.STUDENT)

    ask_photo(client)
    ask_photo(client)

    assert len(fake.calls) == 2
    with SessionLocal() as db:
        assert [s.cache_key for s in db.query(BoardSession)] == [None, None]


def test_model_image_actions_are_dropped(signed_in, monkeypatch):
    script = BOARD_SCRIPT + '{"type":"image","src":"photo","url":"https://evil.example/x.png"}\n'
    monkeypatch.setattr(claude_bridge, "stream_text", image_stream(script))
    client = signed_in("photo@example.com", UserRole.STUDENT)

    plain = read_events(client.post(DOUBTS, json={"question": "What is a prime?"}))
    photo = read_events(ask_photo(client))

    assert not [d for n, d in plain if n == "action" and d["type"] == "image"]
    images = [d for n, d in photo if n == "action" and d["type"] == "image"]
    assert len(images) == 1 and images[0]["url"].startswith("/api/v1/student/doubts/")


def test_follow_up_on_photo_doubt_sends_no_image(signed_in, monkeypatch):
    fake = image_stream(BOARD_SCRIPT)
    monkeypatch.setattr(claude_bridge, "stream_text", fake)
    client = signed_in("photo@example.com", UserRole.STUDENT)
    doubt_id = read_events(ask_photo(client))[0][1]["id"]

    response = client.post(
        f"{DOUBTS}/{doubt_id}/turns", json={"question": "Why that step?", "mode": "follow_up"}
    )

    assert read_events(response)[-1][0] == "done"
    assert fake.calls[-1]["images"] == ()


def test_library_error_never_blocks_a_doubt(signed_in, monkeypatch):
    from app.services.library import embeddings
    from tests.pages import add_ready_page

    fake = counting_stream(BOARD_SCRIPT)
    monkeypatch.setattr(claude_bridge, "stream_text", fake)
    client, student_id = science_student(signed_in)
    add_ready_page(student_id, INERTIA_PAGE)
    # A model of the wrong size: pgvector rejects the query inside the request's transaction.
    embeddings.override(lambda texts: [[0.5, 0.5, 0.5] for _ in texts])

    events = read_events(
        client.post(DOUBTS, json={"question": "What is inertia?", "subject": "Science"})
    )
    doubt_id = events[0][1]["id"]
    turn = client.post(
        f"{DOUBTS}/{doubt_id}/turns", json={"question": "And mass?", "mode": "follow_up"}
    )

    assert events[-1][0] == "done"
    assert "<sources>" not in fake.prompt
    assert read_events(turn)[-1][0] == "done"
