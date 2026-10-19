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


def test_prepare_choice_key_out_of_range_becomes_text():
    assert prepare_ask(choice(5))["kind"] == "text"


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
    assert check_answer(ask, "12.1") is True
    assert check_answer(ask, "12.5") is False
    assert check_answer(ask, "12 cm") is True
    with pytest.raises(ValueError):
        check_answer(ask, "abc")


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
    assert display_key(prepare_ask(third)) == "0.3333"
    expr = {"type": "ask", "id": "q1", "kind": "expr", "answer": "x^2+2x+1"}
    assert display_key(prepare_ask(expr)) == "x^2+2x+1"


def test_public_action_hides_the_key():
    ask = {"type": "ask", "id": "q1", "kind": "number", "answer": 12.0, "calc": "3*4", "unit": "cm"}
    assert public_action(ask) == {"type": "ask", "id": "q1", "kind": "number", "unit": "cm"}
    write = {"type": "write", "text": "x"}
    assert public_action(write) is write
