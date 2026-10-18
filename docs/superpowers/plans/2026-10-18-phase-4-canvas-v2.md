# Phase 4: Canvas Engine v2 (Richer Visuals) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The AI can draw graphs, geometry, tables, charts, flowcharts and science diagrams on the whiteboard by sending one short command each. A doubt becomes a multi-turn board session with follow-ups and "Explain another way". Every model call logs its token use, and tokens per doubt stay at or below the v1 baseline.

**Architecture:**
- **Backend.** An LLM gateway wraps the Claude Code bridge and logs usage in `llm_calls`. Doubts become `board_sessions` with one `board_events` row per turn. Protocol v2 actions are pydantic models with compact field names. The system prompt is assembled per subject from small modules.
- **Frontend.** The engine moves to `features/canvas/`. Each v2 visual is *compiled* in the browser (mathjs, d3-scale/d3-shape, dagre, in-house geometry) into internal primitives (`path`, `label`, `dot` plus v1 shapes), which the existing pencil player already knows how to animate.

**Tech Stack:** FastAPI, SQLAlchemy 2, Alembic, pydantic v2, pytest; React 19 (plain JS), Vite, vitest; mathjs, d3-scale, d3-shape, @dagrejs/dagre.

**Spec:**
- `docs/architecture/CANVAS_ENGINE.md`: Layer 1, Layer 6, Token efficiency, Frontend.
- `docs/LEEN_AI_Master_Plan.pdf`: chapter 8, Phase 4.

## Global Constraints

- **Frontend:** plain JavaScript, no TypeScript. Feature folders `features/<name>/`.
- **Backend:**
  - layering: endpoints → services → repositories (repositories only `flush()`, services `commit()`);
  - every JSON response goes through `ok()`, `{success, message, data}`;
  - roles via `require_roles`.
- **Migrations** are reversible.
- **Commits:**
  - Conventional Commits, e.g. `feat(backend): …` or `feat(frontend): …`;
  - every message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
  - never push.
- **Token rule:** the AI never sends computed values (curve points, table values, angles, layout coordinates of parts). It names the visual, and the browser computes it.
- **Board geometry:**
  - The board is 1600×900 units.
  - The writing column is x 60–880.
  - The **stage** for visuals is x 920–1540, y 100–860. Visuals without a box stack down the stage.
- **Expressions:**
  - at most 80 characters;
  - characters `[0-9a-zA-Z_+\-*/^().,\s]`;
  - identifiers only from `x, pi, e, sin, cos, tan, asin, acos, atan, sqrt, abs, log, ln, exp, log10, floor, ceil`;
  - evaluated only in the browser by mathjs after an AST whitelist check, never `eval`.
- **Limits:**
  - 150 actions per turn (`whiteboard_max_actions`);
  - 6 turns per doubt;
  - board summary for follow-ups at most 800 characters;
  - follow-up turns share the existing doubt rate limit (`doubt:{student_id}`, 15 per hour).
- **Prompt budget:**
  - Each per-subject system prompt (maths, physics, chemistry, biology) is **shorter than the v1 prompt (8,914 characters)**.
  - The all-subjects prompt is at most 13,000 characters.
- **Dependencies:** install the current stable versions, at least two weeks old (`pnpm add mathjs d3-scale d3-shape @dagrejs/dagre`). mathjs is loaded with a dynamic `import()` so it stays out of the main chunk.
- **Commands:**
  - Backend tests: `docker compose exec api pytest -q`
  - Backend lint: `docker compose exec api ruff check app tests`
  - Frontend: `cd frontend && pnpm test && pnpm lint`
  - Bridge tests: `python3 -m pytest infrastructure/claude-bridge -q`
- **Live token evals** (Tasks 3 and 19) need the Claude Code bridge running on the host (`python3 infrastructure/claude-bridge/claude_bridge.py`). If it is offline, stop and ask Satyam to start it. Don't skip silently.

## Review Focus

1. **Degenerate visuals from the model.** Examples: plot fns that all fail to compile, geo with one point, flow with one node, a chart with no values. The board skips the visual and continues; the render loop never throws. Covered by the `every compiler returns an array for empty input` test (Task 10) and each compiler's degenerate case.
2. **Asymptotes and huge values** (`tan(x)`, `1/x`, `exp(x)` over a wide range): the curve breaks at the jump and every point stays inside the box. Covered by the asymptote tests in Task 11.
3. **Long labels and many items** (long node text, 10-row tables, long tick labels): text shrinks to fit and nothing leaves the visual's box. Every compiler test asserts the in-box bounds through `assertInBox`.
4. **Double-submitting a follow-up** while the previous turn is streaming returns 409 and never corrupts turn order. Covered by the `busy board` test in Task 7.
5. **Doubts saved before this phase** replay exactly as before after migration, with no inserted `scene` actions and the same action list. Covered by the `migrated v1 session replays unchanged` test in Task 4.

---

### Task 1: Bridge reports token usage

**Files:**
- Modify: `infrastructure/claude-bridge/claude_bridge.py` (`extract_event`)
- Modify: `infrastructure/claude-bridge/test_claude_bridge.py`
- Modify: `backend/app/services/llm/claude_bridge.py` (`stream_text`)
- Create: `backend/tests/test_llm.py` (move the two bridge-client tests here from `tests/test_whiteboard.py`, together with `_bridge_transport` and `_collect`)

**Interfaces:**
- Produces:
  - The bridge `done` event becomes `{"type":"done","duration_ms":int|None,"cost_usd":float|None,"usage":{"input_tokens":int,"output_tokens":int,"cache_read_tokens":int,"cache_write_tokens":int}}`. These map from the CLI result's `usage.input_tokens`, `usage.output_tokens`, `usage.cache_read_input_tokens` and `usage.cache_creation_input_tokens`; a missing value is 0.
  - `claude_bridge.stream_text(system, prompt, *, model=None, effort=None, usage: dict | None = None, transport=None)`. On `done`, if `usage` is not None it is updated with the four token keys plus `cost_usd` and `duration_ms`.

- [ ] **Step 1: Write the failing tests**

```python
# test_claude_bridge.py
def test_extract_event_forwards_usage():
    line = json.dumps({"type": "result", "subtype": "success", "duration_ms": 900,
        "total_cost_usd": 0.004, "usage": {"input_tokens": 12, "output_tokens": 340,
        "cache_read_input_tokens": 2100, "cache_creation_input_tokens": 0}})
    assert extract_event(line)["usage"] == {"input_tokens": 12, "output_tokens": 340,
        "cache_read_tokens": 2100, "cache_write_tokens": 0}

# backend/tests/test_llm.py
def test_bridge_client_fills_usage():
    usage = {}
    transport = _bridge_transport([{"type": "text", "text": "a"},
        {"type": "done", "duration_ms": 5, "cost_usd": 0.01,
         "usage": {"input_tokens": 1, "output_tokens": 2, "cache_read_tokens": 3, "cache_write_tokens": 4}}])
    chunks = asyncio.run(_collect(transport, usage=usage))
    assert chunks == ["a"]
    assert usage == {"input_tokens": 1, "output_tokens": 2, "cache_read_tokens": 3,
        "cache_write_tokens": 4, "cost_usd": 0.01, "duration_ms": 5}
```

- [ ] **Step 2: Run the tests to verify they fail.**
  - Run: `python3 -m pytest infrastructure/claude-bridge -q` and `docker compose exec api pytest tests/test_llm.py -q`
  - Expected: FAIL (no `usage` key; `_collect` has no `usage` argument).
- [ ] **Step 3: Implement** the `usage` mapping in `extract_event`, and the `usage` parameter in `stream_text` and `_collect`.
- [ ] **Step 4: Run** both suites, plus `docker compose exec api pytest tests/test_whiteboard.py -q`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(infra): report token usage from the Claude Code bridge`

---

### Task 2: LLM gateway and `llm_calls`

**Files:**
- Create: `backend/app/models/llm_call.py` (`LlmCall`), registered in `app/models/__init__.py`
- Create: `backend/alembic/versions/0004_llm_calls.py`
- Create: `backend/app/repositories/llm_call_repository.py`
- Create: `backend/app/services/llm/gateway.py`
- Modify: `backend/app/config/settings.py` (add `llm_provider: str = "claude_bridge"`)
- Modify: `backend/app/services/whiteboard_service.py` (`_produce` calls the gateway); `backend/app/api/v1/endpoints/student.py` (passes the student id)
- Test: `backend/tests/test_llm.py`

**Interfaces:**
- Consumes: `claude_bridge.stream_text(..., usage=dict)` from Task 1.
- Produces:
  - **`LlmCall` columns:**
    - `id` String(36)
    - `user_id` String(36), FK users SET NULL, nullable, indexed
    - `session_id` String(36), nullable, indexed
    - `agent` String(40)
    - `provider` String(20)
    - `model` String(40), nullable
    - `status` String(16): `ok`, `error` or `cancelled`
    - `duration_ms` Integer, nullable
    - `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`: Integer, default 0
    - `cost_usd` Numeric(10,6), nullable
    - `created_at`
  - **`llm_call_repository.create(db, **fields) -> LlmCall`**
  - **`gateway.LlmConfigError(Exception)`**
  - **`gateway.AgentConfig(model: str | None, effort: str | None)`**: a frozen dataclass.
  - **`gateway.agent_config(agent: str) -> AgentConfig`**
    - `"board_teacher"` → `(settings.whiteboard_model, settings.whiteboard_effort)`;
    - an unknown agent raises `KeyError`.
  - **`async gateway.stream_text(agent, system, prompt, *, user_id=None, session_id=None) -> AsyncIterator[str]`**
    - Calls `claude_bridge.stream_text` through the module attribute, so existing monkeypatches keep working.
    - Its `finally` writes one `llm_calls` row with a short synchronous `SessionLocal()` insert.
    - Status: `ok` on normal end, `error` on exception, `cancelled` on `GeneratorExit` or `CancelledError`.
    - If `settings.llm_provider != "claude_bridge"` it raises `LlmConfigError(f"Unknown LLM provider: {name}")` before any call, and no row is written.
  - **`whiteboard_service.stream_solution(doubt, prompt, student_id: str)`**: the endpoint passes `student.id`.

- [ ] **Step 1: Write the failing tests** in `tests/test_llm.py`, using a fake `stream_text(system, prompt, *, usage=None, **kw)` that fills `usage`:

```python
def test_gateway_streams_and_logs_usage(monkeypatch):
    monkeypatch.setattr(claude_bridge, "stream_text", fake_with_usage(["ab", "c"],
        {"input_tokens": 120, "output_tokens": 40, "cache_read_tokens": 100, "cache_write_tokens": 0, "cost_usd": 0.002, "duration_ms": 50}))
    chunks = asyncio.run(collect(gateway.stream_text("board_teacher", "s", "p", user_id=None, session_id="sess-1")))
    assert chunks == ["ab", "c"]
    with SessionLocal() as db:
        call = db.query(LlmCall).one()
    assert (call.agent, call.status, call.model, call.output_tokens, call.cache_read_tokens, call.session_id) == \
        ("board_teacher", "ok", "sonnet", 40, 100, "sess-1")

def test_gateway_logs_failed_calls(monkeypatch):  # fake yields "a" then raises BridgeError
    ...; with pytest.raises(claude_bridge.BridgeError): ...
    assert db.query(LlmCall).one().status == "error"

def test_gateway_rejects_unknown_provider(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "nope")
    with pytest.raises(gateway.LlmConfigError): asyncio.run(collect(gateway.stream_text("board_teacher", "s", "p")))
    assert db.query(LlmCall).count() == 0

def test_doubt_stream_logs_one_llm_call(signed_in, monkeypatch):  # through POST /student/doubts
    assert call.user_id == student_id and call.session_id == doubt_id
```

- [ ] **Step 2: Run** `docker compose exec api pytest tests/test_llm.py -q`. Expected: FAIL (import errors).
- [ ] **Step 3: Implement** the model, migration 0004 (with `downgrade` dropping the table and its indexes), repository, gateway and settings field. Switch `_produce` to `gateway.stream_text("board_teacher", SYSTEM_PROMPT, prompt, user_id=student_id, session_id=doubt.id)`.
- [ ] **Step 4: Run** the full backend suite and `ruff check app tests`. Expected: all PASS, including the unchanged `test_whiteboard.py` endpoint tests.
- [ ] **Step 5: Migrate the dev database:** `docker compose exec api alembic upgrade head`, then `alembic downgrade -1`, then `alembic upgrade head`. Expected: no errors.
- [ ] **Step 6: Commit:** `feat(backend): add LLM gateway with per-call token logging`

---

### Task 3: Board eval harness and the v1 token baseline

**Files:**
- Create: `backend/app/services/whiteboard/board_eval.py`
- Modify: `backend/app/services/whiteboard/prompt.py`: add `build_prompt(question, subject, profile, *, context=None, mode="ask") -> tuple[str, str]`, which for now returns `(SYSTEM_PROMPT, build_user_prompt(...))`
- Modify: `backend/app/services/whiteboard_service.py`: use `build_prompt`
- Modify: `backend/app/cli.py`: add the `board-eval` command
- Create: `backend/evals/board-v1.json` (output of the live run)
- Test: `backend/tests/test_board_eval.py`

**Interfaces:**
- Consumes: `gateway.stream_text` (Task 2) and `ActionStreamParser`.
- Produces:
  - **`board_eval.SAMPLE_DOUBTS: list[tuple[str, str]]`**: 8 `(subject, question)` pairs, 2 each for Mathematics, Physics, Chemistry and Biology. They must invite visuals:
    - "Plot y = x^2 - 4 and find where it cuts the x-axis"
    - "Prove the angle sum of a triangle is 180°"
    - "Explain a velocity–time graph for a car that speeds up and then stops"
    - "How does a convex lens form an image when the object is beyond 2F?"
    - "Draw the Bohr model of sodium and explain its valency"
    - "Balance H2 + O2 → H2O and explain each step"
    - "Label the parts of a plant cell"
    - "Explain the steps of photosynthesis as a flowchart"
  - **`async board_eval.run_board_eval(label: str) -> dict`**. The report:
    - `{label, model, runs:[{subject, question, actions, dropped, types:{type:count}, input_tokens, output_tokens, cache_read_tokens, duration_ms, error}], median_output_tokens, median_input_tokens, median_actions}`
    - Each run is one `gateway.stream_text("board_teacher", system, user)` call, with the prompt from `build_prompt(question, subject, None)`.
  - **`board_eval.compare(report: dict, baseline: dict) -> list[str]`**: problems found. It holds `"median output tokens N > baseline M"` when the median is higher, and is empty otherwise.
  - **CLI:** `python -m app.cli board-eval --label LABEL --out PATH [--compare PATH]`
    - writes the JSON report;
    - prints one table row per run plus the medians;
    - with `--compare`, exits 1 when `compare()` returns problems.

- [ ] **Step 1: Write the failing tests:**
  - `test_board_eval_summarises_runs`: monkeypatch `SAMPLE_DOUBTS` to 2 items and the bridge with a usage fake (output 100 and 300 tokens). Assert `report["median_output_tokens"] == 200`, `report["runs"][0]["types"] == {"caption": 1, "write": 1}`, and `report["runs"][0]["error"] is None`.
  - `test_compare_flags_regressions`: `compare({"median_output_tokens": 900}, {"median_output_tokens": 800}) == ["median output tokens 900 > baseline 800"]`, and `compare` of an equal median is `[]`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** `build_prompt`, `board_eval` and the CLI command, and switch the service to `build_prompt`.
- [ ] **Step 4: Run** the full backend suite. Expected: PASS.
- [ ] **Step 5: Record the live baseline.** Check `curl -s 127.0.0.1:8765/health`. If it doesn't return `{"ok": true…}`, ask Satyam to start the bridge, then run `docker compose exec api python -m app.cli board-eval --label v1 --out evals/board-v1.json`. Expected: 8 runs, each with `actions > 0`, and non-zero `median_output_tokens`.
- [ ] **Step 6: Commit:** `feat(backend): add board eval harness and record the v1 token baseline` (include `evals/board-v1.json`)

---

### Task 4: Board sessions and events (doubts migrated)

**Files:**
- Create: `backend/app/models/board.py` (`BoardSession`, `BoardEvent`)
- Delete: `backend/app/models/whiteboard.py`; update `app/models/__init__.py`
- Create: `backend/alembic/versions/0005_board_sessions.py`
- Create: `backend/app/repositories/board_repository.py`
- Delete: `backend/app/repositories/whiteboard_repository.py`
- Modify: `backend/app/services/whiteboard_service.py`, `backend/app/schemas/whiteboard.py`
- Test: `backend/tests/test_whiteboard.py` (switch `WhiteboardDoubt` to `BoardSession`)

**Interfaces:**
- Produces:
  - **`BoardSession` columns:**
    - `id` String(36)
    - `student_id`: FK users CASCADE, indexed
    - `kind` String(16), default `"doubt"`
    - `title` String(500): the first question
    - `subject` String(60), nullable
    - `status` String(16): `streaming`, `complete` or `failed`
    - `protocol_v` SmallInteger, default 2
    - `model` String(40), nullable
    - `cache_key` String(64), nullable, indexed
    - `error` String(300), nullable
    - `created_at`, `updated_at`, `completed_at` (nullable)
  - **`BoardEvent` columns:**
    - `id` String(36)
    - `session_id`: FK board_sessions CASCADE, indexed
    - `seq` Integer
    - `kind` String(16), default `"turn"`
    - `payload` JSONB
    - `created_at`
    - `UniqueConstraint(session_id, seq)`
  - **Turn payload:** `{"question": str, "mode": "ask"|"follow_up"|"another_way", "actions": list[dict], "status": "streaming"|"complete"|"failed", "error": str|None, "cached": bool}`.
  - **`board_repository`** functions:
    - `create_session(db, **f) -> BoardSession`
    - `get_session(db, session_id) -> BoardSession | None`
    - `get_owned_session(db, session_id, student_id, kind="doubt") -> BoardSession | None`
    - `list_sessions(db, student_id, kind="doubt", limit=50) -> list[BoardSession]`
    - `add_turn(db, session, payload: dict) -> BoardEvent`: `seq` is the max plus 1.
    - `get_event(db, event_id) -> BoardEvent | None`
    - `list_turns(db, session_id) -> list[BoardEvent]`: ordered by `seq`.
    - `delete_session(db, session)`
  - **`whiteboard_service.flatten_turns(turns: list[dict]) -> list[dict]`**: concatenates each turn's actions. Before every turn after the first it inserts `{"type": "scene", "title": turn["question"][:60]}`.
  - **`DoubtOut`** gains `turns: list[TurnOut]`, where `TurnOut = {question, mode, status, count}`. `actions` is the flattened list. The `DoubtSummary` fields are unchanged; `question` comes from `title`.
  - **`whiteboard_service._save_result(event_id, actions, error)`** updates the turn payload and the session's `status`, `error`, `completed_at` and `updated_at`.
- **Migration 0005:**
  - `upgrade` creates both tables, then copies every `whiteboard_doubts` row:
    - into `board_sessions` with the same id, `kind='doubt'`, `title=question`, `protocol_v=1`, `updated_at=COALESCE(completed_at, created_at)`;
    - into one `board_events` row: `id=gen_random_uuid()::text`, `seq=1`, `kind='turn'`, `payload=jsonb_build_object('question',question,'mode','ask','actions',actions,'status',status,'error',error,'cached',false)`.
    - Then it drops `whiteboard_doubts`.
  - `downgrade` recreates `whiteboard_doubts` from each session's `seq=1` turn, then drops the new tables. Later turns are lost on downgrade; say so in the docstring.

- [ ] **Step 1: Write the failing tests:**
  - **`test_migrated_v1_session_replays_unchanged`**: create a session through `board_repository` with `protocol_v=1` and one turn holding `BOARD_SCRIPT`'s 4 actions. `GET /student/doubts/{id}` returns exactly those 4 actions (no `scene`), `turns == [{"question": …, "mode": "ask", "status": "complete", "count": 4}]`.
  - **`test_flatten_turns_inserts_scenes_between_turns`**: two turns of 2 and 1 actions give 4 actions, where `actions[2] == {"type": "scene", "title": "<second question>"}`.
  - **Existing endpoint tests**, updated to read `BoardSession` and `BoardEvent`:
    - the failed run still saves the partial board, with `status "failed"` and 4 actions;
    - delete cascades the events.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** the models, migration, repository and service changes.
- [ ] **Step 4: Run** the full suite. Then run `alembic upgrade head`, `alembic downgrade -1`, `alembic upgrade head` on the dev database. If doubts existed before, check one in the UI: it still replays. Expected: PASS and no migration errors.
- [ ] **Step 5: Commit:** `feat(backend): store doubts as board sessions with one event per turn`

---

### Task 5: Board Protocol v2 schemas

**Files:**
- Create the package `backend/app/schemas/board/`:
  - `common.py`: clamp, truncate and choice helpers; `X`, `Y`, `Color`, `Size`, `Placement` mixin and `Expr`, moved and added.
  - `v1.py`: the existing actions, moved. Rename the class `MarkAction` to `HighlightAction`; its types `box` and `underline` are unchanged.
  - `visuals.py`: the new actions.
  - `__init__.py`: exports `BoardAction`, `board_action`, `dump_action` and the constants.
- Modify: `backend/app/schemas/whiteboard.py` keeps only the doubt schemas. `backend/app/services/whiteboard/parser.py` imports from `app.schemas.board`.
- Test: `backend/tests/test_board_schema.py`

**Interfaces** (field names are short on purpose, to save tokens):
- **`Placement` mixin:** `at: [x, y, w, h] | None`. Exactly 4 numbers, clamped to the board (x and w to 0–1600, y and h to 0–900); anything else becomes None and the browser auto-places the visual. It is a single field so it never clashes with plot's `x`/`y` domains, and it costs fewer tokens.
- **`Expr`:** a string that obeys the expression rule in Global Constraints. `fns` lists drop invalid items instead of rejecting the action.
- **Structure actions:**
  - `scene{title≤60}`
  - `focus{x,y,w,h}`: all four, or none to reset.
  - `column{side: left|right|full}`
- **`plot`:**
  - `fns: list[Expr] ≤4 = []`
  - `x: (lo, hi) = (-5, 5)`: clamped to ±1e6, sorted; if lo == hi it becomes (lo−1, hi+1).
  - `y: (lo, hi) | None`
  - `points: dict[name≤8 → (x, y)] ≤12`
  - `labels: list[str≤30] ≤4`
  - `shade: {fn: 0..3 = 0, from, to} | None`
  - `xlabel`, `ylabel`: str≤20, optional
  - `color`, plus `Placement`
- **`numberline`:**
  - `range = (-5, 5)`
  - `marks: list[float] ≤12`
  - `labels: dict[str≤8 → float] ≤8`
  - `interval: {from, to, open: (bool, bool) = (false, false)} | None`
- **`geo`:**
  - `pts: dict[name matching ^[A-Z][0-9']?$ → (x, y)]`, 2–12 points
  - `shapes: list[str 2–8 point names] ≤8`
  - `angles: list[3 names] ≤6`
  - `right: list[3 names] ≤4`
  - `sides: dict[2 names → label≤12] ≤8`
  - `circles: list[{c: name, r: float > 0 | None, through: name | None}] ≤3`
  - References to unknown points are filtered out after validation.
- **`table`:**
  - `head: list[str≤24] ≤6`
  - `rows: list[list[str≤24] ≤6] ≤10`: numbers are converted to strings.
  - or `fn: Expr` with `xs: list[float] ≤10`
  - Either `rows`, or `fn` with `xs`, is required.
- **`chart`:**
  - `kind: bar|pie|line = bar`
  - `labels: list[str≤16] ≤10`
  - `values: list[float]`: both lists are truncated to the shorter length, which must be at least 1.
  - `title≤40`, `unit≤10`
- **`flow`:**
  - `nodes: list[str≤28]`, 2–10
  - `edges: list[(int, int)] ≤14`: out-of-range pairs are dropped; empty means a chain.
  - `kind: chart|mind = chart`
  - `dir: TB|LR = TB`
- **`diagram`:** `kind: circuit|lens|mirror|fbd|atom|cell|apparatus` and `title≤40`, plus these per-kind optional fields:

  | Kind | Fields |
  | --- | --- |
  | circuit | `parts: list[str≤24] ≤8`; `layout: series\|parallel = series` |
  | lens / mirror | `shape: convex\|concave = convex`; `f` clamped 1..100, default 10; `u` clamped 1..200, default 30; `h` clamped 0.5..10, default 2 |
  | fbd | `body: block\|ball = block`; `forces: list[{dir: up\|down\|left\|right or an angle in degrees, label≤12, size 0.5..2 = 1}] ≤6` |
  | atom | `z` clamped 1..20; `symbol≤3` |
  | cell | `cell: animal\|plant = animal`; `labels`: kept only if in nucleus, cell membrane, cell wall, cytoplasm, mitochondria, chloroplast, vacuole, ribosome |
  | apparatus | `items: list[beaker\|test_tube\|flask\|burner\|stand] ≤4` |

  All kinds also take `color` and `Placement`.

- [ ] **Step 1: Write the failing tests:**
  - `test_v1_actions_still_validate`: the existing `test_parser_cleans_up_model_output` expectations hold when imported from `app.schemas.board`.
  - `test_plot_drops_unsafe_expressions`: `fns ["x^2", "__import__('os')", "constructor(1)", "2x+1"]` becomes `["x^2", "2x+1"]`.
  - `test_plot_ranges_are_sorted_and_clamped`: `x [5, -5]` becomes `[-5, 5]`; `[3, 3]` becomes `[2, 4]`; `[-1e9, 0]` becomes `[-1e6, 0]`.
  - `test_placement_needs_all_four`:
    - `{"type":"plot","x":[0,1],"at":[920,100,600]}` dumps with no `at`, and keeps `x == [0, 1]` as the domain;
    - `"at":[920,100,600,5000]` becomes `[920, 100, 600, 900]`.
  - `test_geo_drops_unknown_point_references`: `shapes ["ABC", "ABZ"]` with points A, B, C becomes `["ABC"]`; `angles ["CAB", "QAB"]` becomes `["CAB"]`.
  - `test_flow_edges_out_of_range_are_dropped`: 3 nodes with `edges [[0,1],[1,5]]` become `[[0,1]]`.
  - `test_diagram_clamps`: atom `z 99` becomes 20; lens `f 0` becomes 1; cell `labels ["nucleus", "wifi"]` becomes `["nucleus"]`.
  - `test_table_needs_rows_or_fn`: `{"type":"table"}` is invalid; `{"type":"table","fn":"x^2","xs":[1,2]}` is valid.
  - `test_v2_lines_are_short`: the JSON of a typical plot (`{"type":"plot","fns":["x^2-4"],"x":[-4,4],"points":{"A":[-2,0],"B":[2,0]}}`) is under 100 characters, so it costs about 25 tokens.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** the package and update the imports in `parser.py`, `whiteboard_service.py` and the tests.
- [ ] **Step 4: Run** the full suite and ruff. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(backend): add board protocol v2 visual actions with compact fields`

---

### Task 6: Prompt v2, modular and split by subject

**Files:**
- Modify: `backend/app/services/whiteboard/prompt.py`
- Test: `backend/tests/test_board_prompt.py` (move `test_prompt_includes_student_context` here)

**Interfaces:**
- **`CORE: str`** contains:
  - persona, output format, board size, columns and the stage;
  - the v1 writing commands (caption, write, underline, box, erase, line, arrow, rect, circle, clear, pause);
  - `scene`, `column`, `focus`;
  - maths text, and chemical equations (`2H_2 + O_2 → 2H_2O`);
  - teaching style: about 20–60 commands, finish with a boxed answer;
  - a visual-format chooser (graph vs geometry vs table vs chart vs flow vs diagram);
  - **token rules:**
    - "Never compute curve points, table values, angles, or positions of parts: name the visual and the board computes it."
    - "Omit x/y on writes; they flow down the column."
    - "Omit any field that has its default."
  - one short example using `plot`.
- **`MODULES: dict[str, str]`** with keys `graphs` (plot, numberline, table-with-fn), `geometry` (geo), `data` (table rows, chart), `flow`, `physics_diagrams` (circuit, lens, mirror, fbd), `chemistry` (atom, apparatus) and `biology` (cell). Also `animation`: the current animation section, trimmed, keeping the apple/moon example.
- **`SUBJECT_MODULES`:**

  | Subject | Modules |
  | --- | --- |
  | maths | graphs, geometry, data |
  | physics | graphs, physics_diagrams, animation, data |
  | chemistry | chemistry, data, graphs |
  | biology | biology, flow, data |
  | science | the union of physics, chemistry and biology |
  | all | every module |

- **`subject_key(subject: str | None) -> str`** matches case-insensitive keywords:
  - `math` → maths
  - `phys` → physics
  - `chem` → chemistry
  - `bio`, `life` → biology
  - `science` → science
  - anything else → all
- **`build_system_prompt(subject: str | None) -> str`**: `CORE` plus the subject's modules, in a fixed order.
- **`build_prompt(question, subject, profile, *, context=None, mode="ask") -> tuple[str, str]`**: returns `(build_system_prompt(subject), user)`.
  - For `mode="follow_up"`, the user prompt adds `<board>\n{context}\n</board>` and "This is a follow-up on the board above. Start with a scene and answer only the new question."
  - For `mode="another_way"`, it adds the board and "Explain the same doubt again in a completely different way: a different visual or analogy from the board above."
  - The question always stays inside `<doubt>` tags.

- [ ] **Step 1: Write the failing tests:**
  - `test_system_prompt_only_includes_subject_modules`:
    - The maths prompt contains `"type":"plot"` and `"type":"geo"`, and not `"kind":"cell"` or `"motion"`.
    - The biology prompt contains `"kind":"cell"` and `"type":"flow"`, and not `"type":"geo"`.
  - `test_unknown_subject_gets_every_module`: `build_system_prompt(None)` contains all the module markers.
  - `test_prompts_stay_within_budget`:
    - for s in Mathematics, Physics, Chemistry, Biology: `len(build_system_prompt(s)) < 8914`;
    - `len(build_system_prompt(None)) <= 13000`.
  - `test_follow_up_prompt_carries_board_summary`: the user prompt contains `<board>\nplot: x^2\n</board>`, "follow-up", and the doubt in tags.
  - `test_another_way_prompt_asks_for_a_different_visual`.
  - `test_prompt_includes_student_context`: the existing assertions, now through `build_prompt`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Delete `SYSTEM_PROMPT`; the service and `board_eval` use `build_prompt`.
- [ ] **Step 4: Run** the full suite. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(backend): split the whiteboard prompt into per-subject modules`

---

### Task 7: Follow-ups, "Explain another way" and the board cache

**Files:**
- Create: `backend/app/services/whiteboard/summary.py`
- Modify: `backend/app/services/whiteboard_service.py`, `backend/app/schemas/whiteboard.py`, `backend/app/api/v1/endpoints/student.py`, `backend/app/config/settings.py` (`board_cache_enabled: bool = True`)
- Test: `backend/tests/test_whiteboard.py`

**Interfaces:**
- **`summary.summarize_board(actions: list[dict], limit: int = 800) -> str`** builds one line per caption, write text, or visual descriptor, and stops before `limit`. Visual descriptors:
  - `plot: <fns joined by ", ">`
  - `geo: <shapes joined>`
  - `table`
  - `chart: <kind>`
  - `flow: <first 3 nodes>`
  - `diagram: <kind>`
- **`TurnCreate`:** `{question: Question | None = None, mode: Literal["follow_up", "another_way"] = "follow_up"}`. `follow_up` requires `question` (422 otherwise). `another_way` uses the session title.
- **Endpoint:** `POST /student/doubts/{doubt_id}/turns` returns an SSE stream with the same events as asking a doubt (`doubt`, `status`, `action*`, `done`/`error`). It applies the same rate limit as asking.
- **`whiteboard_service.start_turn(db, student, doubt_id, payload) -> tuple[DoubtSummary, str, str, str]`**: returns `(doubt, event_id, system, user)`. Errors:
  - 404 when the student doesn't own the session;
  - 409 "Wait for the current explanation to finish." while the last turn is streaming;
  - 409 "This board is full. Start a new doubt to keep going." at 6 turns.
- **`whiteboard_service.cache_key(question, subject, profile) -> str`**: the sha256 hex of `question.casefold()` with whitespace collapsed and trailing `?.!` stripped, plus `subject.casefold()`, grade, board, learning_level and preferred_language, joined with `|`.
- **`start_doubt`**: when `settings.board_cache_enabled` is on and a `complete` session with `protocol_v == 2` and the same `cache_key` exists, it copies that session's first-turn actions into the new session (turn `cached: true`, status `complete`). The stream then sends the actions with no gateway call (`stream_cached`).

- [ ] **Step 1: Write the failing tests:**
  - `test_summarize_board_is_short_and_descriptive`: 300 writes and a plot of `x^2` give a summary that contains `plot: x^2` and is at most 800 characters long.
  - `test_follow_up_streams_onto_the_same_board`:
    - Ask, then POST turns `{"question": "Why is it 2xy?"}`.
    - The event names end in `done`.
    - `fake_stream.prompt` contains `<board>` and `follow-up`.
    - GET returns 2 turns, and the actions include `{"type": "scene", "title": "Why is it 2xy?"}`.
    - Exactly 2 `llm_calls` rows exist.
  - `test_explain_another_way_reuses_the_question`: the prompt contains "different way" and the original question.
  - `test_busy_board_and_turn_limit`: a session whose last turn has status `streaming` returns 409. After 6 turns (added through the repository), the next one returns 409.
  - `test_identical_doubt_is_served_from_cache`:
    - Two students with the same profile ask the same question, the second with different spacing and case.
    - The second ask makes no gateway call (fake counter is 1) and streams the same actions.
    - Its turn has `cached: true`.
    - A student with a different grade gets a fresh call.
  - `test_failed_board_is_never_cached`: the first ask fails partway, and the second ask calls the gateway.
  - `test_turns_are_owner_only`: another student gets 404; a teacher gets 403.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** the summary, schema, service functions and endpoint (`StreamingResponse` with the same headers as `ask_doubt`).
- [ ] **Step 4: Run** the full suite and ruff. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(backend): add follow-up turns, explain another way and a board cache`

---

### Task 8: Move the engine to `features/canvas`

**Files:**
- Move with `git mv` into `frontend/src/features/canvas/`:
  - `features/whiteboard/engine/` → `engine/`
  - `components/Whiteboard.jsx` → `components/Canvas.jsx` (component renamed `Canvas`)
  - `components/NarrationMenu.jsx`, `components/MathText.jsx`
  - `hooks/useBoardPlayer.js`
  - `SPEEDS` → `canvas/constants.js`
- Create: `features/canvas/index.js`, exporting `Canvas`, `MathText`, `useBoardPlayer`, `BOARD_WIDTH`, `BOARD_HEIGHT`.
- Modify: `features/whiteboard/index.js` (drop the moved exports), imports inside `features/whiteboard/*`, and `pages/student/StudentDoubtsPage.jsx`.

**Interfaces:** `import { Canvas, MathText, useBoardPlayer } from '@/features/canvas'`. Behaviour is unchanged.

- [ ] **Step 1:** `git mv` the files and fix every import (`grep -rn "whiteboard/engine\|components/Whiteboard\|useBoardPlayer" src` finds none of the old paths).
- [ ] **Step 2: Run** `pnpm test && pnpm lint && pnpm build`. Expected: all 69 tests pass and the build succeeds.
- [ ] **Step 3: Commit:** `refactor(frontend): move the board engine into features/canvas`

---

### Task 9: Math engine (mathjs with a whitelist)

**Files:**
- Modify: `frontend/package.json` (`pnpm add mathjs d3-scale d3-shape @dagrejs/dagre`)
- Create: `frontend/src/features/canvas/engine/math/expr.js`, `expr.test.js`

**Interfaces:**
- `export const ALLOWED_FUNCTIONS`: the function names from Global Constraints.
- `export async function loadMath(): Promise<void>`: an idempotent dynamic `import('mathjs')`; creates the instance and adds `ln` as an alias of `log`.
- `export function isMathReady(): boolean`
- `export function compileExpr(source: string): ((x: number) => number) | null`
  - Returns null if mathjs isn't loaded, the source fails to parse, or the AST contains anything other than:
    - `ConstantNode`;
    - `SymbolNode` named `x`, `pi` or `e`;
    - `OperatorNode`;
    - `ParenthesisNode`;
    - `FunctionNode` whose name is in `ALLOWED_FUNCTIONS`.
  - The returned function gives `NaN` for non-number or non-finite results.
- `export function sampleFunction(fn, [x0, x1], n = 240): Array<Array<[number, number]>>`
  - Samples `n + 1` points.
  - Splits into segments at NaN, and where `|Δy|` between neighbours is more than 50% of the sampled y-range (the asymptote rule).

- [ ] **Step 1: Write the failing tests** (`beforeAll(loadMath)`):
  - `x^2` at 3 gives 9.
  - `2x+1` at 2 gives 5.
  - `sin(pi/2)` gives 1; `ln(e)` gives 1.
  - `sqrt(x)` at −1 gives NaN.
  - These all give `null`: `import("fs")`, `x.constructor`, `f(x)=x`, `[1,2]`, `a=1`, `evaluate("1")`, `x ? 1 : 2`, `1:3`.
  - `sampleFunction(compileExpr('1/x'), [-2, 2])` returns at least 2 segments.
  - `sampleFunction(compileExpr('x'), [0, 1])` returns 1 segment of 241 points.
- [ ] **Step 2: Run** `pnpm vitest run src/features/canvas/engine/math`. Expected: FAIL.
- [ ] **Step 3: Implement** `expr.js`.
- [ ] **Step 4: Run** the tests and `pnpm build`; confirm mathjs lands in a separate chunk in the build output. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(frontend): add a whitelisted mathjs expression engine for the board`

---

### Task 10: Compile pipeline, primitives and stage layout in the player

**Files:**
- Create in `frontend/src/features/canvas/engine/compile/`:
  - `index.js` (registry)
  - `layout.js`, `layout.test.js`
  - `testUtils.js` (`assertInBox`)
  - `registry.test.js`
- Modify: `engine/BoardPlayer.js`, `engine/board.js`

**Interfaces:**
- **Internal primitives.** The browser makes these; they are never accepted from the AI, because the backend schema has no such types.
  - `{type: 'path', points: [[x, y], …], color, closed?: bool, dash?: bool, fill?: bool}`: a smooth stroke with no wobble. `fill` draws a translucent polygon first.
  - `{type: 'label', text, x, y, px, color, align: 'left'|'center'|'right'}`: handwriting at a fixed position. It never moves the write cursor or registers an `id`.
  - `{type: 'dot', x, y, r, color, hollow?: bool}`
  - The v1 shapes `line`, `arrow`, `rect` and `circle` are also allowed.
- **`board.js`:**
  - `STAGE = {x: 920, y: 100, w: 620, h: 760}`
  - `COLUMNS = {left: 80, right: 940, full: 80}`
  - `PALETTE = ['blue', 'red', 'green', 'purple']`
  - `LABEL_PX = 24`
- **`layout.js`:**
  - `DEFAULT_HEIGHT = {plot: 400, numberline: 140, geo: 380, table: 360, chart: 380, flow: 420, diagram: 400}`
  - `placeVisual(action, state) -> {x, y, w, h}`, where `state = {stageY}` is mutated:
    - with `action.at`, it returns that box;
    - otherwise it returns `{x: STAGE.x, y: state.stageY, w: STAGE.w, h}` and advances `stageY` by `h + 30`;
    - if `stageY + h > STAGE.y + STAGE.h`, it restarts at `STAGE.y`.
- **`compile/index.js`:**
  - `COMPILERS = {plot, numberline, geo, table, chart, flow, diagram}`, filled in by Tasks 11–15. Each compiler is `(action, ctx) => primitive[]`, with `ctx = {box, measure(text, px) => width}`.
  - `isCompiled(type) -> bool`
  - `expandAction(action, ctx) -> primitive[]` returns `[]` and never throws: errors are caught and logged with `console.warn` in dev only.
- **`BoardPlayer`:**
  - On a compiled type, it calls `placeVisual`, then `expandAction`, and queues the primitives in `this.expanded`. `_advance` drains `this.expanded` before the next action.
  - The RNG seed is `(index + 1) * 1000 + partIndex`.
  - It handles `column` (per-column y memory, in `this.columnY`) and the primitives `path`, `label` and `dot`.
  - `_drawFill` supports `{points}` polygons and `{cx, cy, r}` discs.
  - `clear` and `scene` reset `stageY` to `STAGE.y`.
  - If an action needs mathjs (`plot`, `numberline`, or `table` with `fn`) and `!isMathReady()`, `_advance` waits: `loadMath().then(() => this._wake())`.

- [ ] **Step 1: Write the failing tests:**
  - `layout.test.js`:
    - explicit `at` is used as-is;
    - two plots stack at y 100 and y 530;
    - a third wraps to y 100.
  - `registry.test.js`: `every compiler returns an array for empty input`. For each key in `COMPILERS`, `expandAction({type: key}, ctx)` is an array and doesn't throw.
  - `testUtils.js`: `assertInBox(primitives, box, slack = 2)` checks every path point, label anchor, dot, line or arrow endpoint, rect and circle bound.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** `board.js`, `layout.js` and `compile/index.js`, with the compilers as stubs returning `[]`, plus the `BoardPlayer` changes.
- [ ] **Step 4: Run** `pnpm test && pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(frontend): compile board visuals into pencil primitives`

---

### Task 11: `plot` and `numberline` compilers

**Files:**
- Create: `frontend/src/features/canvas/engine/compile/plot.js`, `plot.test.js`, `numberline.js`, `numberline.test.js`
- Modify: `compile/index.js` (register both)

**Interfaces:**
- **`compilePlot(action, ctx) -> primitive[]`**
  - The inner frame is padded 48 left and bottom, and 16 top and right.
  - x scale: `scaleLinear(action.x)`. y scale: `action.y`, or the extent of finite samples clipped to ±1000 and padded 10%, or `[-5, 5]` when there are none. Then `.nice()`.
  - The axis sits at 0 when 0 is in the domain, otherwise at the frame edge, with an arrowhead at the positive end.
  - Ticks come from `scale.ticks(6)`. Each tick is a 10-unit mark plus a label at `LABEL_PX` showing `formatNumber(v)`.
  - Each fn draws one `path` per segment from `sampleFunction`, coloured `PALETTE[i]` (or `action.color` when there is one fn). Points are clipped to the frame.
  - Labels go near each curve's last visible point.
  - Each point is a `dot` with a name label.
  - `shade` is a closed, filled `path` between the curve and y=0 over `[from, to]`.
  - `xlabel` and `ylabel` sit at the axis ends.
  - Order: axes, ticks, curves, shade, points, labels.
- **`formatNumber(v) -> string`** (exported from `plot.js`): at most 4 significant digits, trailing zeros stripped, `−` for negatives.
- **`compileNumberLine(action, ctx)`:**
  - a horizontal arrow line at mid-height of the box;
  - ticks from `scaleLinear(range).ticks(12)`, with labels;
  - `marks` as dots;
  - `labels` as named dots;
  - `interval` as a thick coloured `path` with a `dot` at each end (`hollow` when `open`).

- [ ] **Step 1: Write the failing tests** (`beforeAll(loadMath)`):
  - `draws axes, one curve and tick labels for y=x^2`: at least one `path` with ≥100 points; labels include `"2"`; `assertInBox`.
  - `splits curves at asymptotes for 1/x and tan(x)`: at least 2 curve segments; `assertInBox`.
  - `auto-scales y when omitted and respects explicit y`.
  - `skips invalid expressions but still draws axes`: `fns: ["x^^2"]` draws the axes and no curve path.
  - `shades the area between from and to`: exactly one `path` with `fill: true`.
  - `formatNumber`: 1/3 gives `"0.3333"`, 2.50 gives `"2.5"`, −4 gives `"−4"`.
  - `numberline marks an interval with open and closed ends`: one hollow dot and one filled dot; `assertInBox`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** both compilers and register them.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(frontend): draw function plots and number lines from one command`

---

### Task 12: `geo` compiler

**Files:**
- Create: `frontend/src/features/canvas/engine/compile/geo.js`, `geo.test.js`
- Modify: `compile/index.js`

**Interfaces:**
- **`angleDegrees(a, vertex, b) -> number`**: rounded to 1 decimal place.
- **`compileGeo(action, ctx)`** fits the points into the box with uniform scale, centred, with 50 units of padding and y flipped (math y up). Then it draws:
  - `shapes`: 2 names → segment; 3 or more → closed path;
  - `circles`;
  - `angles`: a 34-unit arc at the vertex between the rays, labelled with the engine-computed degrees (`"36.9°"`, with `.0` dropped) on the bisector at 60 units;
  - `right`: a 22-unit square instead of an arc;
  - `sides`: a label at the midpoint, offset 26 units away from the centroid of all points;
  - point names: offset 22 units away from the centroid.

- [ ] **Step 1: Write the failing tests:**
  - `angleDegrees` on the 3-4-5 triangle `A(0,0) B(4,0) C(0,3)`: CAB 90, ABC 36.9, BCA 53.1.
  - `draws a closed triangle with point labels outside it`: one closed path of 3 or 4 points; each label lies farther from the centroid than its point; `assertInBox`.
  - `uses a right-angle square instead of an arc`.
  - `angle label shows the computed value`: a label text `"36.9°"` appears.
  - `a single point draws nothing and does not throw`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** and register.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(frontend): draw geometry constructions with computed angles`

---

### Task 13: `table` and `chart` compilers

**Files:**
- Create: `frontend/src/features/canvas/engine/compile/table.js`, `table.test.js`, `chart.js`, `chart.test.js`
- Modify: `compile/index.js`

**Interfaces:**
- **`compileTable(action, ctx)`:**
  - Rows come from `action.rows`, or are computed from `fn` over `xs` with `formatNumber`. The default head for `fn` is `['x', fn]`.
  - Column widths come from the measured text plus 24 of padding. The font starts at `LABEL_PX + 2` and shrinks, down to 14 at the smallest, until the table fits the box.
  - Primitives are ordered row by row (the row's lines, then its cells), so rows reveal in order.
- **`compileChart(action, ctx)`:**

  | Kind | Drawing |
  | --- | --- |
  | bar | `scaleBand` + `scaleLinear` from 0; a bar `rect` with a value label on top; category labels below |
  | pie | `pie()` from d3-shape gives the angles; each slice is a closed `path` sampled every 4°, filled `PALETTE[i % 4]`; labels at the slice mid-angle |
  | line | one `path` through the points, plus a `dot` at each |

  A `title` sits at the top.

- [ ] **Step 1: Write the failing tests:**
  - `fills a table of values from fn`: `x^2` over `[-2, 0, 2]` gives cell labels `"4"`, `"0"`, `"4"`, with head `["x", "x^2"]`.
  - `shrinks text to fit a narrow box`: a 10×6 table of long text in a 300×200 box passes `assertInBox`.
  - `bar heights are proportional`: values `[2, 4]` give the second rect twice the height of the first, within 1 unit.
  - `pie slices cover the full circle`: the sum of slice angle spans is 2π, within 1e-6.
  - `line chart draws one path through every point`.
  - `charts with no values draw nothing`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** and register.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(frontend): draw tables of values and bar, pie and line charts`

---

### Task 14: `flow` compiler

**Files:**
- Create: `frontend/src/features/canvas/engine/compile/flow.js`, `flow.test.js`
- Modify: `compile/index.js`

**Interfaces:**
- **`compileFlow(action, ctx)`:**
  - **`kind: 'chart'`:**
    - dagre graph with `rankdir = dir`, `nodesep 30`, `ranksep 40`;
    - node size is measured label width + 28 by `px + 22`, with `px` starting at `LABEL_PX + 2`;
    - the layout is scaled down uniformly to fit the box and centred;
    - each node is a `rect` plus a centred `label`;
    - each edge is a `path` through dagre's points, ending in an `arrow` on its last segment;
    - no edges means a chain `i → i+1`.
  - **`kind: 'mind'`:** node 0 is a `rect` at the box centre; the other nodes are spaced evenly on an ellipse (radii 40% of w, 38% of h), each with a `line` from the centre.

- [ ] **Step 1: Write the failing tests:**
  - `chains nodes when edges are omitted`: 4 nodes give 3 arrows.
  - `LR layout places nodes left to right`: node label x positions strictly increase.
  - `mind map puts the first node in the centre`.
  - `long node text still fits the box`: `assertInBox`.
  - `one node draws nothing`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** and register.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(frontend): lay out flowcharts and mind maps with dagre`

---

### Task 15: Diagram templates

**Files:**
- Create in `frontend/src/features/canvas/engine/compile/diagram/`:
  - `index.js` (`compileDiagram` dispatches on `kind`)
  - `labels.js` (`leaderLabels`)
  - `circuit.js`, `optics.js`, `fbd.js`, `atom.js`, `cell.js`, `apparatus.js`
  - `diagram.test.js`
- Modify: `compile/index.js`

**Interfaces:**
- **`leaderLabels(items: [{text, anchor: [x, y]}], box) -> primitive[]`**: each label goes to whichever box side (left or right) is nearer its anchor, spaced at least `LABEL_PX * 1.4` apart vertically, with a `line` from the label to the anchor.
- **`lensImage(f, u) -> {v, m, real}`**:
  - inputs are a signed focal length (positive convex, negative concave) and a positive object distance `u`;
  - `v = 1 / (1/f − 1/u)`, `m = v / −u`, `real = v > 0`.
- **`mirrorImage(f, u, shape) -> {v, m, real}`**:
  - `f_s = shape === 'concave' ? −f : f` and `u_s = −u`;
  - `1/v = 1/f_s − 1/u_s`, `m = −v / u_s`, `real = v < 0`.
- **`shellConfig(z) -> number[]`**: fills shells with capacities `[2, 8, 8, 2]` for z ≤ 20.
- **Templates:**

  | Kind | Drawing |
  | --- | --- |
  | circuit | **series**: rectangular loop, parts spread evenly along top, right and bottom. **parallel**: battery on the left edge, the other parts as parallel branches. Symbols: battery (long and short plates), resistor (zigzag), bulb (circle with ×), switch (open lever), ammeter (circle with "A"), voltmeter (circle with "V"). The part's text after its first word is its label. |
  | lens / mirror | Principal axis, the lens or mirror shape, F and 2F (C for mirrors) marks, the object arrow at `u`, the image arrow from `lensImage`/`mirrorImage` (dashed when virtual), and two principal rays: parallel then through F, and through the optical centre or the pole. Everything is scaled so object and image both fit the box. |
  | fbd | A block `rect` or ball `circle` at the centre. One `arrow` per force from the body edge: direction from `dir`, length 70 × `size`, label at the tip. |
  | atom | A nucleus circle with the symbol, concentric shells with electron dots spread evenly, and the configuration text (`"2, 8, 1"`) below. |
  | cell | Animal: wobbly ellipse membrane. Plant: rect wall with an inner membrane. Organelles at fixed relative positions. Labels via `leaderLabels` for the requested labels, or all drawn organelles when `labels` is empty. |
  | apparatus | Outline per item, side by side. |

- [ ] **Step 1: Write the failing tests:**
  - **Optics maths:**
    - `lensImage(10, 30)` gives `{v: 15, m: −0.5, real: true}`;
    - `lensImage(10, 5)` gives `{v: −10, m: 2, real: false}`;
    - `lensImage(−10, 30)` gives v −7.5 and m 0.25;
    - `mirrorImage(10, 30, 'concave')` gives v −15, m −0.5, real true.
  - **Atom shells:** `shellConfig(11)` is `[2, 8, 1]`; `shellConfig(20)` is `[2, 8, 8, 2]`; `shellConfig(1)` is `[1]`.
  - **Circuits:** `series circuit labels every part`: parts `["battery 6V", "resistor 4Ω", "bulb"]` give labels including "6V" and "4Ω".
  - **Free-body:** `fbd draws one arrow per force`.
  - **Cell:** `cell labels only the requested organelles`.
  - **All diagrams fit their box:** every kind passes `assertInBox` at 400×300.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** and register.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(frontend): add circuit, optics, free-body, atom, cell and apparatus diagrams`

---

### Task 16: Scenes, camera focus and the page strip

**Files:**
- Modify: `frontend/src/features/canvas/engine/BoardPlayer.js`, `components/Canvas.jsx`
- Create: `frontend/src/features/canvas/engine/camera.js`, `camera.test.js`, `components/PageStrip.jsx`, `PageStrip.test.jsx`

**Interfaces:**
- **`cameraTransform(focus) -> {scale, tx, ty}`** (`camera.js`):
  - `scale = min(1600 / w, 900 / h, 2.5)`;
  - the translation centres the box, in percent of the board;
  - `null` gives `{scale: 1, tx: 0, ty: 0}`.
- **`BoardPlayer` snapshot** gains:
  - `pages: [{title, thumb}]`, the finished pages, where `thumb` is a 320 px-wide PNG data URL from the ink canvas, or null in jsdom;
  - `pageTitle`, the current page's title;
  - `camera`, the focus box or null.
- **`scene`**: pushes the current page, does a whole-board erase, resets items, flow, columns and the stage, then writes the title (lg, at the top left). `clear` and `replay` reset `camera`.
- **`Canvas`** applies `cameraTransform` as a CSS transform on the canvas stack, with `transition: transform 600ms`, and renders `<PageStrip pages={board.pages} current={board.pageTitle} />` under the board.
- **`PageStrip`** shows a button per page (thumbnail image, or title text when `thumb` is null). Clicking one opens the existing `Dialog` showing the larger image and its title. With no pages, it renders nothing.

- [ ] **Step 1: Write the failing tests:**
  - `cameraTransform` on `{x: 400, y: 225, w: 800, h: 450}` gives scale 2.
  - `cameraTransform(null)` is the identity.
  - The scale is capped at 2.5.
  - `PageStrip`: 2 pages render 2 buttons; clicking the first opens a dialog with its title; 0 pages render nothing.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test && pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(frontend): add board pages, a page strip and camera focus`

---

### Task 17: Follow-ups and "Explain another way" on the doubts page

**Files:**
- Modify: `frontend/src/services/doubtService.js`
- Modify: `frontend/src/features/whiteboard/hooks/useDoubtSession.js`, `frontend/src/features/canvas/engine/BoardPlayer.js`
- Modify: `frontend/src/pages/student/StudentDoubtsPage.jsx`
- Create: `frontend/src/features/whiteboard/components/FollowUpBar.jsx`, `FollowUpBar.test.jsx`

**Interfaces:**
- **`doubtService`:**
  - `stream` and the new `streamTurn` share a private `streamSSE(path, body, {signal, onEvent})`, which keeps the 401 → refresh → retry behaviour;
  - `streamTurn(doubtId, {question, mode}, {signal, onEvent})` POSTs `/student/doubts/{id}/turns`.
- **`BoardPlayer.extend()`** continues streaming onto the current board, setting `streaming` and `started` true without a restart.
- **`useDoubtSession`** returns `{session, ask, followUp, stop, reset}`:
  - `followUp(doubtId, {question, mode})` calls `player.extend()` and handles events exactly like `ask`;
  - `session.turns` counts the turns in this visit.
- **`FollowUpBar({ onFollowUp(question), onAnotherWay(), busy, full })`:**
  - an input with placeholder "Ask a follow-up about this board", and a Send button;
  - an "Explain another way" button;
  - everything is disabled while `busy`;
  - when `full`, it shows "This board is full — start a new doubt to keep going." in place of the controls.
- **The page** shows `FollowUpBar` under the board when there is a live doubt with an id, or a saved doubt.
  - A follow-up on a saved doubt first `load`s it, so the board shows the saved actions, then extends.
  - `full` is `turns >= 6`, using `saved.data.turns.length` plus the live turns.

- [ ] **Step 1: Write the failing tests** (`FollowUpBar.test.jsx`):
  - Typing a question and pressing Send calls `onFollowUp` with the trimmed text and clears the input.
  - An empty question can't be sent.
  - "Explain another way" calls `onAnotherWay`.
  - Everything is disabled while `busy`.
  - The full message shows when `full`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** the service, player, hook, component and page wiring.
- [ ] **Step 4: Run** `pnpm test && pnpm lint && pnpm build`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(frontend): ask follow-ups and see another explanation on the same board`

---

### Task 18: Dev-only canvas gallery

**Files:**
- Create: `frontend/src/features/canvas/samples.js`, `samples.test.js`
- Create: `frontend/src/pages/dev/CanvasGalleryPage.jsx`
- Modify: `frontend/src/routes/index.jsx`

**Interfaces:**
- **`SAMPLES: Array<{id, title, actions}>`** has one entry each for:

  | Id | What it draws |
  | --- | --- |
  | `plot` | y = x² − 4 with roots marked and shaded |
  | `asymptote` | 1/x |
  | `numberline` | an interval |
  | `geo` | a 3-4-5 triangle with the right angle |
  | `table` | values of 2x+1 |
  | `bar`, `pie` | charts |
  | `flow` | photosynthesis |
  | `mind` | a mind map |
  | `circuit` | a series circuit |
  | `lens` | an object beyond 2F |
  | `fbd` | a free-body diagram |
  | `atom` | sodium |
  | `cell` | a plant cell |
  | `lesson` | a mixed physics lesson using `scene`, `column`, `focus`, a plot and an fbd |

  Every sample uses the compact Task 5 field names exactly as the AI would send them.
- **The route** `/dev/canvas` is added only when `import.meta.env.DEV` is true, outside the auth guards. It takes `?sample=<id>&instant=1`; `instant` calls `player.setInstant(true)`.
- **The page** has a sample picker, `Canvas` and a Replay button.

- [ ] **Step 1: Write the failing test** `every sample uses only known action types`: each type is either a v1 type or in `COMPILERS`, plus `scene`, `column` and `focus`. Every sample compiles without throwing (`expandAction` on each compiled action with a stage box, after `loadMath`).
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement** the samples, page and dev route.
- [ ] **Step 4: Visual check.** Run `pnpm dev`, then for each sample run
  `google-chrome --headless=new --no-sandbox --window-size=1400,1000 --virtual-time-budget=4000 --screenshot=/tmp/…/<id>.png "http://localhost:3000/dev/canvas?sample=<id>&instant=1"`
  and read each PNG. Check the visual is legible, sits inside the stage and overlaps nothing. Fix and repeat until clean.
- [ ] **Step 5: Run** `pnpm test && pnpm lint && pnpm build`. Expected: PASS.
- [ ] **Step 6: Commit:** `feat(frontend): add a dev gallery of every board visual`

---

### Task 19: Token check against the baseline, docs and roadmap

**Files:**
- Create: `backend/evals/board-v2.json`
- Modify:
  - `docs/architecture/ARCHITECTURE.md`, AI Whiteboard Tutor section: the protocol v2 table with the as-built field names (`at`, `fns`, `pts`…), board sessions and turns, follow-ups, the cache, and the gateway and `llm_calls`.
  - `docs/architecture/CANVAS_ENGINE.md`: Layer 1 field names as built; mark Phase 4 as implemented.
  - `docs/ROADMAP.md`: Phase 4 ✅ Done, Phase 5 Next.
  - `docs/master-plan/LEEN_AI_Master_Plan.html`:
    - roadmap pills;
    - chapter 9 API outline: rename the planned tuition-class endpoints from `/student/classes…` to `/student/lessons…`, because `/student/classes` is already the classroom API;
    - re-render `docs/LEEN_AI_Master_Plan.pdf`.
  - Memory file `project_frontend_rebuild.md`: Phase 4 done, Phase 5 next.

- [ ] **Step 1: Run the v2 eval.** With the bridge running, run `docker compose exec api python -m app.cli board-eval --label v2 --out evals/board-v2.json --compare evals/board-v1.json`.
  - Expected: exit code 0 (median output tokens ≤ v1), and the visual types (`plot`, `geo`, `diagram`, `flow`, `table`) appear in the run type counts.
  - If the run exits 1, trim the prompt or examples and re-run. Don't relax the check.
- [ ] **Step 2: Live check in the app.** At http://localhost:8081, ask one doubt each in Mathematics, Physics, Chemistry and Biology, and one follow-up. Confirm visuals draw, pages appear in the strip, and a repeated doubt returns instantly from the cache.
- [ ] **Step 3: Update the docs and re-render the PDF** (command in the HTML header). Check the changed PDF pages visually.
- [ ] **Step 4: Run every suite:** backend pytest and ruff, frontend test, lint and build, and the bridge tests. Expected: all PASS.
- [ ] **Step 5: Commit:** `docs: document canvas engine v2 and record the v2 token report`
