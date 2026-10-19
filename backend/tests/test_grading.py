import pytest

from app.services.whiteboard.grading import (
    check_answer,
    display_key,
    prepare_ask,
    public_action,
)

OPTIONS = ["4", "8", "16"]


def choice(answer) -> dict:
    return {"type": "ask", "id": "q1", "kind": "choice", "options": OPTIONS, "answer": answer}


@pytest.mark.parametrize(("answer", "key"), [("B", 1), ("16", 2), (1, 1), (16, 2)])
def test_prepare_choice_key(answer, key):
    prepared = prepare_ask(choice(answer))
    assert (prepared["kind"], prepared["answer"]) == ("choice", key)


def test_a_choice_question_with_a_broken_key_keeps_its_options():
    # The teacher judges the pick instead; the options stay on the board and in the talk bar.
    ask = prepare_ask(choice(5))
    assert (ask["kind"], ask["answer"], ask["options"]) == ("choice", None, OPTIONS)
    assert check_answer(ask, "b") is None
    assert display_key(ask) is None
    with pytest.raises(ValueError):
        check_answer(ask, "z")


def test_non_finite_keys_are_not_used():
    ask = prepare_ask({"type": "ask", "id": "q1", "kind": "number", "answer": float("inf")})
    assert ask["kind"] == "text"


def test_prepare_does_not_change_its_input():
    ask = choice("B")
    prepare_ask(ask)
    assert ask["answer"] == "B"


def test_prepare_number_key_prefers_calc():
    ask = {"type": "ask", "id": "q1", "kind": "number", "answer": 13, "calc": "3*4"}
    assert prepare_ask(ask)["answer"] == 12.0


def test_prepare_number_key_from_text():
    ask = {"type": "ask", "id": "q1", "kind": "number", "answer": "12 cm", "unit": "cm"}
    assert prepare_ask(ask)["answer"] == 12.0


@pytest.mark.parametrize(
    "ask",
    [
        {"type": "ask", "id": "q1", "kind": "number", "answer": "abc"},
        {"type": "ask", "id": "q1", "kind": "expr", "answer": "y+1"},
    ],
)
def test_unusable_keys_become_text_questions(ask):
    prepared = prepare_ask(ask)
    assert prepared["kind"] == "text"
    assert prepared["answer"] == ask["answer"]


def test_check_choice():
    ask = prepare_ask(choice("B"))
    assert check_answer(ask, "b") is True
    assert check_answer(ask, " 8 ") is True
    assert check_answer(ask, "c") is False
    with pytest.raises(ValueError):
        check_answer(ask, "zebra")
    with pytest.raises(ValueError):
        check_answer(ask, "F")  # only A-C exist


def test_check_number():
    ask = prepare_ask({"type": "ask", "id": "q1", "kind": "number", "answer": 12, "unit": "cm"})
    assert check_answer(ask, "12") is True
    assert check_answer(ask, "12 cm") is True
    assert check_answer(ask, "12.5") is False
    with pytest.raises(ValueError):
        check_answer(ask, "abc")


def test_whole_number_keys_need_the_exact_number():
    # Review: with a 1% tolerance, 99 and 101 were marked right for 100.
    ask = prepare_ask({"type": "ask", "id": "q1", "kind": "number", "answer": 100})
    assert check_answer(ask, "100") is True
    assert check_answer(ask, "99") is False
    assert check_answer(ask, "101") is False
    assert check_answer(ask, "12.1") is False


def test_decimal_keys_accept_the_places_the_student_gives():
    third = prepare_ask({"type": "ask", "id": "q1", "kind": "number", "calc": "1/3"})
    assert check_answer(third, "0.33") is True
    assert check_answer(third, "1/3") is True
    assert check_answer(third, "0.4") is False
    circle = prepare_ask({"type": "ask", "id": "q2", "kind": "number", "calc": "2*pi*7"})
    assert check_answer(circle, "43.98") is True
    assert check_answer(circle, "43.9") is False


def test_check_expression():
    ask = prepare_ask({"type": "ask", "id": "q1", "kind": "expr", "answer": "x^2+2x+1"})
    assert check_answer(ask, "(x+1)^2") is True
    assert check_answer(ask, "(x+1)(x+1)") is True
    assert check_answer(ask, "y = (x+1)^2") is True
    assert check_answer(ask, "x^2+1") is False
    with pytest.raises(ValueError):
        check_answer(ask, "banana")


def test_text_answers_are_not_checked_in_code():
    ask = prepare_ask({"type": "ask", "id": "q1", "kind": "text", "answer": "Because light bends"})
    assert check_answer(ask, "it refracts") is None


def test_display_key():
    assert display_key(prepare_ask(choice("B"))) == "B. 8"
    number = {"type": "ask", "id": "q1", "kind": "number", "answer": 12, "unit": "cm"}
    assert display_key(prepare_ask(number)) == "12 cm"
    third = {"type": "ask", "id": "q1", "kind": "number", "answer": 0.3333333}
    assert display_key(prepare_ask(third)) == "0.333333"
    for value, shown in ((12345, "12345"), (100000, "100000"), (1.5e-7, "0.00000015")):
        ask = {"type": "ask", "id": "q1", "kind": "number", "answer": value}
        assert display_key(prepare_ask(ask)) == shown
    expr = {"type": "ask", "id": "q1", "kind": "expr", "answer": "x^2+2x+1"}
    assert display_key(prepare_ask(expr)) == "x^2+2x+1"


def test_public_action_hides_the_key():
    ask = {"type": "ask", "id": "q1", "kind": "number", "answer": 12.0, "calc": "3*4", "unit": "cm"}
    assert public_action(ask) == {"type": "ask", "id": "q1", "kind": "number", "unit": "cm"}
    write = {"type": "write", "text": "x"}
    assert public_action(write) is write
