import json

import pytest
from pydantic import ValidationError

from app.schemas.board import board_action, dump_action


def parse(action: dict) -> dict:
    return dump_action(board_action.validate_python(action))


def invalid(action: dict) -> bool:
    try:
        board_action.validate_python(action)
    except ValidationError:
        return True
    return False


def test_v1_actions_still_validate():
    write = parse({"type": "write", "text": "hi", "x": -50, "y": 5000, "color": "pink"})
    assert write == {
        "type": "write",
        "text": "hi",
        "x": 0.0,
        "y": 900.0,
        "size": "md",
        "color": "ink",
    }
    assert parse({"type": "box", "id": "t", "color": "green"})["type"] == "box"
    assert parse({"type": "line", "from": [10, 10], "to": [99999, 20]})["to"] == [1600.0, 20.0]


def test_structure_actions():
    assert parse({"type": "scene", "title": "x" * 99})["title"] == "x" * 60
    assert parse({"type": "column", "side": "right"})["side"] == "right"
    assert parse({"type": "column", "side": "middle"})["side"] == "left"
    assert parse({"type": "focus", "at": [100, 100, 400, 300]})["at"] == [100, 100, 400, 300]
    assert "at" not in parse({"type": "focus"})


def test_plot_drops_unsafe_expressions():
    plot = parse(
        {
            "type": "plot",
            "fns": ["x^2", "__import__('os')", "constructor(1)", "2x+1", "sin(x)", "y+1"],
        }
    )
    assert plot["fns"] == ["x^2", "2x+1", "sin(x)"]


def test_plot_ranges_are_sorted_and_clamped():
    assert parse({"type": "plot", "x": [5, -5]})["x"] == [-5, 5]
    assert parse({"type": "plot", "x": [3, 3]})["x"] == [2, 4]
    assert parse({"type": "plot", "x": [-1e9, 0]})["x"] == [-1e6, 0]
    assert parse({"type": "plot"})["x"] == [-5, 5]
    shade = parse({"type": "plot", "fns": ["x"], "shade": {"from": 2, "to": -1}})["shade"]
    assert shade == {"fn": 0, "from": -1, "to": 2}


def test_placement_needs_all_four():
    plot = parse({"type": "plot", "x": [0, 1], "at": [920, 100, 600]})
    assert "at" not in plot and plot["x"] == [0, 1]
    assert parse({"type": "plot", "at": [920, 100, 600, 5000]})["at"] == [920, 100, 600, 900]


def test_geo_drops_unknown_point_references():
    geo = parse(
        {
            "type": "geo",
            "pts": {"A": [0, 0], "B": [4, 0], "C": [0, 3], "bad name": [1, 1]},
            "shapes": ["ABC", "ABZ", "A"],
            "angles": ["CAB", "QAB", "AB"],
            "right": ["BAC"],
            "sides": {"AB": "4 cm", "AZ": "?"},
            "circles": [{"c": "A", "r": 2}, {"c": "Q", "r": 1}, {"c": "B", "through": "C"}],
        }
    )
    assert set(geo["pts"]) == {"A", "B", "C"}
    assert geo["shapes"] == ["ABC"]
    assert geo["angles"] == ["CAB"]
    assert geo["right"] == ["BAC"]
    assert geo["sides"] == {"AB": "4 cm"}
    assert [c["c"] for c in geo["circles"]] == ["A", "B"]
    assert invalid({"type": "geo", "pts": {"A": [0, 0]}})


def test_flow_edges_out_of_range_are_dropped():
    flow = parse({"type": "flow", "nodes": ["a", "b", "c"], "edges": [[0, 1], [1, 5], [2, 2]]})
    assert flow["edges"] == [[0, 1]]
    assert parse({"type": "flow", "nodes": ["a", "b"], "dir": "XX"})["dir"] == "TB"
    assert invalid({"type": "flow", "nodes": ["only one"]})


def test_diagram_clamps():
    assert parse({"type": "diagram", "kind": "atom", "z": 99})["z"] == 20
    assert parse({"type": "diagram", "kind": "lens", "f": 0})["f"] == 1
    cell = parse({"type": "diagram", "kind": "cell", "labels": ["nucleus", "wifi"]})
    assert cell["labels"] == ["nucleus"]
    fbd = parse(
        {
            "type": "diagram",
            "kind": "fbd",
            "forces": [{"dir": "up", "label": "N"}, {"dir": 30, "size": 9}, {"dir": "sideways"}],
        }
    )
    assert [force["dir"] for force in fbd["forces"]] == ["up", 30]
    assert fbd["forces"][1]["size"] == 2
    assert invalid({"type": "diagram", "kind": "spaceship"})


def test_table_needs_rows_or_fn():
    assert invalid({"type": "table"})
    table = parse({"type": "table", "fn": "x^2", "xs": [1, 2]})
    assert table["fn"] == "x^2" and table["xs"] == [1, 2]
    rows = parse({"type": "table", "head": ["x", "y"], "rows": [[1, 2.5], ["a", True]]})
    assert rows["rows"] == [["1", "2.5"], ["a", "True"]]


def test_chart_lists_are_trimmed_to_the_same_length():
    chart = parse({"type": "chart", "labels": ["a", "b", "c"], "values": [1, 2]})
    assert (chart["labels"], chart["values"], chart["kind"]) == (["a", "b"], [1, 2], "bar")
    assert invalid({"type": "chart", "labels": [], "values": []})


@pytest.mark.parametrize(
    "line",
    [
        {"type": "plot", "fns": ["x^2-4"], "x": [-4, 4], "points": {"A": [-2, 0], "B": [2, 0]}},
        {"type": "geo", "pts": {"A": [0, 0], "B": [4, 0], "C": [0, 3]}, "shapes": ["ABC"]},
        {"type": "diagram", "kind": "lens", "f": 10, "u": 30},
    ],
)
def test_v2_lines_are_short(line):
    assert len(json.dumps(line, separators=(",", ":"))) < 100
    assert parse(line)["type"] == line["type"]


# -- questions: ask, mark, verdict ------------------------------------------------------


def test_ask_choice_keeps_options_and_answer():
    ask = {"type": "ask", "id": "q1", "kind": "choice", "options": ["4", "8", "16"], "answer": 1}
    assert parse(ask) == ask


def test_ask_unknown_kind_is_text():
    assert parse({"type": "ask", "id": "q1", "kind": "essay"})["kind"] == "text"


def test_ask_caps_options_at_six():
    ask = parse({"type": "ask", "id": "q1", "kind": "choice", "options": list("ABCDEFGH")})
    assert ask["options"] == list("ABCDEF")


def test_ask_choice_needs_two_options():
    assert invalid({"type": "ask", "id": "q1", "kind": "choice", "options": ["4"], "answer": 0})


def test_ask_drops_an_unsafe_calc():
    ask = parse({"type": "ask", "id": "q1", "kind": "number", "answer": 12, "calc": "import os"})
    assert "calc" not in ask
    assert parse({"type": "ask", "id": "q1", "kind": "number", "calc": "3*4"})["calc"] == "3*4"


def test_mark_and_verdict_validate():
    mark = parse({"type": "mark", "id": "s1", "kind": "star", "note": "sign error"})
    assert mark == {"type": "mark", "id": "s1", "kind": "cross", "note": "sign error"}
    verdict = parse({"type": "verdict", "ask": "q1", "correct": False})
    assert verdict == {"type": "verdict", "ask": "q1", "correct": False}


def test_cite_schema_clamps_source():
    assert dump_action(board_action.validate_python({"type": "cite", "source": 42})) == {
        "type": "cite",
        "source": 9,
    }
    assert board_action.validate_python({"type": "cite", "source": 0}).source == 1
    with pytest.raises(ValidationError):
        board_action.validate_python({"type": "cite"})
