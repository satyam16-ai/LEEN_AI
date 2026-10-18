import pytest

from app.models.profile import StudentProfile
from app.services.whiteboard.prompt import (
    build_prompt,
    build_system_prompt,
    build_user_prompt,
    subject_key,
)

V1_PROMPT_LENGTH = 8914
MARKERS = {
    "plot": '"type":"plot"',
    "geo": '"type":"geo"',
    "chart": '"type":"chart"',
    "flow": '"type":"flow"',
    "circuit": '"kind":"circuit"',
    "atom": '"kind":"atom"',
    "cell": '"kind":"cell"',
    "animation": '"motion"',
}


@pytest.mark.parametrize(
    ("subject", "key"),
    [
        ("Mathematics", "maths"),
        ("maths", "maths"),
        ("Physics", "physics"),
        ("Chemistry", "chemistry"),
        ("Biology", "biology"),
        ("Life Science", "biology"),
        ("Science", "science"),
        ("History", "all"),
        (None, "all"),
    ],
)
def test_subject_key(subject, key):
    assert subject_key(subject) == key


def test_system_prompt_only_includes_subject_modules():
    maths = build_system_prompt("Mathematics")
    assert MARKERS["plot"] in maths and MARKERS["geo"] in maths
    assert MARKERS["cell"] not in maths and MARKERS["animation"] not in maths

    biology = build_system_prompt("Biology")
    assert MARKERS["cell"] in biology and MARKERS["flow"] in biology
    assert MARKERS["geo"] not in biology and MARKERS["circuit"] not in biology

    physics = build_system_prompt("Physics")
    assert MARKERS["circuit"] in physics and MARKERS["animation"] in physics
    assert MARKERS["cell"] not in physics


def test_unknown_subject_gets_every_module():
    everything = build_system_prompt(None)
    assert all(marker in everything for marker in MARKERS.values())


def test_prompts_stay_within_budget():
    for subject in ("Mathematics", "Physics", "Chemistry", "Biology"):
        assert len(build_system_prompt(subject)) < V1_PROMPT_LENGTH, subject
    assert len(build_system_prompt(None)) <= 13_000


def test_system_prompt_states_the_token_rules():
    prompt = build_system_prompt("Mathematics")
    assert "never compute" in prompt.lower()
    assert "omit" in prompt.lower()


def test_follow_up_prompt_carries_board_summary():
    system, user = build_prompt(
        "Why is it 2xy?", "Mathematics", None, context="plot: x^2", mode="follow_up"
    )
    assert system == build_system_prompt("Mathematics")
    assert "<board>\nplot: x^2\n</board>" in user
    assert "follow-up" in user
    assert "<doubt>\nWhy is it 2xy?\n</doubt>" in user


def test_another_way_prompt_asks_for_a_different_visual():
    _, user = build_prompt(
        "What is a prime?", None, None, context="write: 2, 3, 5", mode="another_way"
    )
    assert "different way" in user and "<board>\nwrite: 2, 3, 5\n</board>" in user
    assert "<doubt>\nWhat is a prime?\n</doubt>" in user


def test_first_turn_prompt_has_no_board():
    _, user = build_prompt("What is a prime?", None, None)
    assert "<board>" not in user


def test_prompt_includes_student_context():
    profile = StudentProfile(
        grade=9, board="cbse", learning_level="beginner", preferred_language="hi", subjects=[]
    )
    _, prompt = build_prompt("Why is (x+y)^2 ...?", "Mathematics", profile)
    assert "Class 9" in prompt and "CBSE" in prompt and "Hinglish" in prompt
    assert "<doubt>\nWhy is (x+y)^2 ...?\n</doubt>" in prompt
    assert "Class" not in build_user_prompt("q?", None, None).split("\n")[0].split(":")[1]


def test_system_prompt_explains_braced_subscripts():
    assert "F_{net}" in build_system_prompt("Physics")


def test_system_prompt_says_the_stage_holds_two_visuals():
    prompt = build_system_prompt("Mathematics")
    assert "two visuals" in prompt and "scene" in prompt
