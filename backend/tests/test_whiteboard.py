import json

import pytest

from app.database import SessionLocal
from app.models.board import BoardEvent, BoardSession
from app.models.user import User, UserRole
from app.repositories import board_repository
from app.services import whiteboard_service
from app.services.llm import claude_bridge
from app.services.whiteboard.parser import ActionStreamParser

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
