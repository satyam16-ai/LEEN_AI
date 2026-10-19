import pytest
from pytest import approx

from app.utils.safe_math import evaluate, parse_answer_number


@pytest.mark.parametrize(
    ("text", "value"),
    [
        ("3/4", 0.75),
        ("2^3", 8),
        ("2**3", 8),
        ("1.5e3", 1500),
        ("−4 + 10", 6),
        ("3 × 4 ÷ 2", 6),
        ("√16", 4),
        ("3√2", 4.242640687),
        ("2π", 6.283185307),
        ("pi/2", 1.570796327),
        ("2(3+1)", 8),
        ("(1+2)(3+4)", 21),
        ("sqrt(2)^2", 2),
        ("log(100)", 2),
        ("ln(e)", 1),
        ("abs(-3)", 3),
    ],
)
def test_evaluates_school_arithmetic(text, value):
    assert evaluate(text) == approx(value)


def test_evaluates_expressions_in_x():
    assert evaluate("2x+1", 3) == 7
    assert evaluate("x^2 - 4", -2) == 0
    assert evaluate("3x(x-1)", 2) == 6
    assert evaluate("sin(pi/2)") == approx(1)


@pytest.mark.parametrize(
    "text",
    [
        "__import__('os')",
        "x.real",
        "[1, 2]",
        "lambda: 1",
        "a+b",
        "1 if 1 else 2",
        "1;2",
        "'abc'",
        "9^9^9",
        "10^400",
        "",
        "1" * 81,
        "2x",
        "1/0",
        "sqrt(-1)",
    ],
)
def test_rejects_anything_but_arithmetic(text):
    with pytest.raises(ValueError):
        evaluate(text)


@pytest.mark.parametrize(
    ("text", "unit", "value"),
    [
        ("12 cm", "cm", 12),
        ("12cm", "cm", 12),
        ("12 m/s", "m/s", 12),
        ("1,000", None, 1000),
        ("  -3.5 ", None, -3.5),
        ("3/4", None, 0.75),
    ],
)
def test_parse_answer_number(text, unit, value):
    assert parse_answer_number(text, unit) == approx(value)


def test_parse_answer_number_rejects_words():
    with pytest.raises(ValueError):
        parse_answer_number("twelve")
