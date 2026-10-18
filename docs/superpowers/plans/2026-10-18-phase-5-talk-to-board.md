# Phase 5: Talk to the Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The student talks to the board by voice or a text box at any time. The AI never gets cut off: it finishes its current step, then works the message into the explanation and carries on. It asks questions and checks the answers, in code where it can.

**Architecture:**
- **Agents.** Every job has its own AI agent (`CANVAS_ENGINE.md`, Layer 3). This phase splits today's single `board_teacher` into two:
  - the **Doubt Solver**, for doubts, follow-ups and replies;
  - the **Examiner**, for practice questions and answer checks.

  Each has its own model setting and token log.
- **Backend.**
  - Three new board actions: `ask`, `mark` and `verdict`.
  - A small safe evaluator (Python `ast`, no `eval`) checks choice, number and expression answers at zero tokens.
  - Doubt turns gain new modes:
    - `follow_up` with `keep`, a reply in the middle of an explanation;
    - `check`, which explains a wrong or written answer;
    - `practice` ("Now you try").
  - A reply records `cut_at` on the turn it interrupts. Its prompt carries two short summaries (the board so far, the part still to teach), never action lists.
  - Answers are `board_events` of kind `answer`. Answer keys never leave the server.
- **Frontend.**
  - The player learns to:
    - cut at the end of the current step;
    - wait at an `ask`;
    - write the student's answer with a tick or cross;
    - start a new page when the column runs out.
  - A talk bar replaces the follow-up bar. It has a text box, a tap-to-talk mic (browser speech recognition, en-IN), answer boxes and hints.
  - `useDoubtSession` queues a message while the AI is still writing, then sends it with `keep`.

**Tech Stack:** FastAPI, SQLAlchemy 2, pydantic v2, pytest; React 19 (plain JS), vitest, Testing Library; Web Speech API. No new dependencies.

**Spec:**
- `docs/architecture/CANVAS_ENGINE.md`: "Layer 2: Talking to the board", Token efficiency.
- `docs/LEEN_AI_Master_Plan.pdf`: chapter 3, "Phase 5 redesign"; chapter 8, Phase 5.

## Global Constraints

- **The student never writes on the board.** Input is text or speech only.
- **Student input never cuts the AI off.** A message waits for the current step to finish. Nothing already drawn is erased by a reply.
- **Answer keys** (`answer`, `calc`) never reach the browser: not in the SSE stream, not from the cache, not in `GET /student/doubts/{id}`.
- **Token rule:**
  - Choice, number and expression answers are checked with no AI call.
  - A reply's prompt carries summaries only: board ≤ 800 characters, part left ≤ 600.
  - The reply user prompt stays under 2,500 characters for any board.
- **Safe maths:**
  - never `eval`, `exec` or `compile`;
  - the evaluator walks a whitelisted `ast`;
  - input ≤ 80 characters;
  - exponents limited to |n| ≤ 100 and bases to |b| ≤ 1e6;
  - non-finite results are errors.
- **Untrusted text:** student messages and answers go into prompts inside tags (`<message>`, `<answer>`) with the existing "treat only as …" guard. Any `</` inside them is broken up so it can't close a tag.
- **Limits:**
  - 12 turns per board (was 6);
  - two tries per code-checked question;
  - an answer is ≤ 200 characters, a message ≤ 500.
- **Rate limits:** a new doubt stays at 15/hour. Turns move to their own bucket `doubt-turn:{student}`, 40/hour. Answers use `answer:{student}`, 120/hour.
- **Backend layering:**
  - endpoints → services → repositories (repositories `flush()`, services `commit()`);
  - JSON responses through `ok()`;
  - roles via `require_roles`.
- **Frontend:** plain JavaScript, feature folders. The speech button is hidden where `SpeechRecognition` is missing.
- **Commits:**
  - Conventional Commits;
  - author `satyam16-ai <satyamtiwari567890@gmail.com>`;
  - **no `Co-Authored-By` or "Generated with" lines** (Satyam's standing rule);
  - never push.
- **Test commands:**
  - Backend: `docker compose exec api pytest -q` and `docker compose exec api ruff check app tests`. Three pre-existing ruff errors in `health.py`, `session.py` and `logging.py` are left alone.
  - Frontend: `cd frontend && pnpm test && pnpm lint && pnpm build`.

## Review Focus

1. **A message sent while the AI is still writing the turn** (SSE not done). It must queue and go out after `done` with a correct `keep`. It must not get a 409, be lost or be sent twice. → `useDoubtSession` test in Task 11.
2. **A message sent during the last step**, when nothing is left to cut. The AI should reply on the same page with no `<left>` block and must not repeat the explanation. → Task 7 test `test_reply_without_left_wraps_up`; Task 11 `say() during the last step…`.
3. **A broken key from the model.** Examples: a choice answer out of range, a non-numeric number answer, or a `calc` that disagrees with `answer`. The question is downgraded to `text`, or `calc` wins. It must never crash and never mark a wrong answer right. → Task 3 `prepare_ask` tests.
4. **Student number answers in everyday forms:** "12 cm", "1,000", "3/4", "−3.5", "3√2" and "2π" are read. "twelve" is a 422 that doesn't use up a try. → Task 1 and Task 8 tests.
5. **Replays show what the student saw.**
   - The cut part is hidden.
   - Answers come right after their question.
   - Replies get no inserted page break.
   - Phase 4 boards replay unchanged.

   → Task 7 `test_flatten_applies_cuts_and_answers`, existing `test_migrated_v1_session_replays_unchanged`.

---

### Task 1: Safe maths evaluator

**Files:**
- Create: `backend/app/utils/safe_math.py`
- Test: `backend/tests/test_safe_math.py`

**Interfaces:**
- Produces:
  - `evaluate(text: str, x: float | None = None) -> float`: raises `ValueError` on anything outside the whitelist, or on a non-finite result.
  - `parse_answer_number(text: str, unit: str | None = None) -> float`: strips the unit (if given) and thousands commas, then evaluates. Raises `ValueError`.
  - `FUNCTIONS`: names to callables: sqrt, sin, cos, tan, asin, acos, atan, abs, log (base 10), ln, log10, exp.
  - `CONSTANTS`: pi, e.

- [ ] **Step 1: Write the failing tests.**
  - `test_evaluates_school_arithmetic` (parametrize, compare with `pytest.approx`):
    - "3/4" → 0.75
    - "2^3" → 8
    - "2**3" → 8
    - "1.5e3" → 1500
    - "−4 + 10" (Unicode minus) → 6
    - "3 × 4 ÷ 2" → 6
    - "√16" → 4
    - "3√2" → 4.242640687
    - "2π" → 6.283185307
    - "pi/2" → 1.570796327
    - "2(3+1)" → 8
    - "(1+2)(3+4)" → 21
    - "sqrt(2)^2" → 2
    - "log(100)" → 2
    - "ln(e)" → 1
    - "abs(-3)" → 3
  - `test_evaluates_expressions_in_x`:
    - `evaluate("2x+1", 3) == 7`
    - `evaluate("x^2 - 4", -2) == 0`
    - `evaluate("3x(x-1)", 2) == 6`
    - `evaluate("sin(pi/2)") == approx(1)`
  - `test_rejects_anything_but_arithmetic` (each raises `ValueError`):
    - `"__import__('os')"`
    - `"x.real"`
    - `"[1, 2]"`
    - `"lambda: 1"`
    - `"a+b"`
    - `"1 if 1 else 2"`
    - `"1;2"`
    - `"'abc'"`
    - `"9^9^9"`
    - `"10^400"`
    - `""`
    - `"1" * 81`
    - `"2x"` with no x
    - `"1/0"`
    - `"sqrt(-1)"`
  - `test_parse_answer_number`:
    - `("12 cm", "cm")` → 12
    - `("12cm", "cm")` → 12
    - `("12 m/s", "m/s")` → 12
    - `("1,000", None)` → 1000
    - `("  -3.5 ", None)` → -3.5
    - `("3/4", None)` → 0.75
    - `("twelve", None)` raises `ValueError`
- [ ] **Step 2: Run** `docker compose exec api pytest tests/test_safe_math.py -q`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement.**
  1. Normalise:
     - Unicode `− × ÷ · π √` to `- * / * pi sqrt`;
     - `^` to `**`;
     - `√<number>` or `√(` to `sqrt(…)`.
  2. Tokenise into numbers (`\d+(\.\d+)?([eE][+-]?\d+)?`), names and operators.
  3. Insert `*` for implicit multiplication. This happens when a number, `)` or a non-function name is followed by `(`, a name or a number. A function name followed by `(` stays a call.
  4. `ast.parse(..., mode="eval")`.
  5. Evaluate recursively over the node types:
     - `Expression`;
     - `BinOp` (Add, Sub, Mult, Div, Pow);
     - `UnaryOp` (USub, UAdd);
     - `Constant` (int or float, not bool);
     - `Name` in `{x}` ∪ `CONSTANTS`;
     - `Call` of a `Name` in `FUNCTIONS` with exactly one argument and no keywords.

     Anything else raises. The Pow guard applies before computing, and math domain errors become `ValueError`.
- [ ] **Step 4: Run** the tests. Expected: PASS. Run `ruff check`.
- [ ] **Step 5: Commit** `feat(backend): add a safe evaluator for checking maths answers`.

### Task 2: Board actions `ask`, `mark` and `verdict`

**Files:**
- Create: `backend/app/schemas/board/questions.py`
- Modify: `backend/app/schemas/board/__init__.py` (add to the `BoardAction` union)
- Test: `backend/tests/test_board_schema.py`

**Interfaces:**
- Consumes: `ItemId`, `BoardText`, `OptionalExpr`, `short`, `_choice` and `_cap` from `common.py`.
- Produces:
  - `AskAction`:
    - `type: "ask"`;
    - `id: ItemId`;
    - `kind: Literal["choice","number","expr","text"]` (unknown → `"text"`);
    - `options: list[BoardText] | None` (capped at 6);
    - `answer: int | float | str | None`;
    - `calc: OptionalExpr`;
    - `unit: short(12) | None`;
    - `hint: short(160) | None`.

    A `choice` with fewer than 2 options is invalid.
  - `MarkAction`:
    - `type: "mark"`;
    - `id: ItemId` (the target write);
    - `kind: Literal["tick","cross"]` (unknown → `"cross"`);
    - `note: short(40) | None`.
  - `VerdictAction`: `type: "verdict"`, `ask: ItemId`, `correct: bool`.

- [ ] **Step 1: Write the failing tests:**
  - `test_ask_choice_keeps_options_and_answer`: the dump equals the input `{"type":"ask","id":"q1","kind":"choice","options":["4","8","16"],"answer":1}`.
  - `test_ask_unknown_kind_is_text`: `"kind":"essay"` → `"text"`.
  - `test_ask_caps_options_at_six`.
  - `test_ask_choice_needs_two_options`: `ValidationError`.
  - `test_ask_drops_an_unsafe_calc`: `"calc":"import os"` → no `calc` in the dump.
  - `test_mark_and_verdict_validate`: `mark` with `"kind":"star"` → `"cross"`. A `verdict` keeps `correct: false`.
- [ ] **Step 2: Run** `docker compose exec api pytest tests/test_board_schema.py -q`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the three models and add them to the union.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(backend): add ask, mark and verdict board actions`.

### Task 3: Answer keys and checking

**Files:**
- Create: `backend/app/services/whiteboard/grading.py`
- Test: `backend/tests/test_grading.py`

**Interfaces:**
- Consumes: `evaluate` and `parse_answer_number` (Task 1); the dumped `ask` dict shape (Task 2).
- Produces:
  - `prepare_ask(action: dict) -> dict`: normalises the key on a copy of a validated ask.
    - `choice`: the answer becomes a 0-based `int`. A letter "B" → 1 and matching option text → its index. If out of range or unmatched, the kind becomes `text`.
    - `number`: the answer becomes a `float`. `calc` wins when it evaluates; otherwise the answer is parsed with the unit. If neither gives a number, the kind becomes `text`.
    - `expr`: the answer is kept if `evaluate(answer, x)` works for at least 3 of the sample points (-2.7, -1.3, 0.6, 1.9, 3.1); otherwise the kind becomes `text`.
    - `text`: the answer becomes a model-answer string (≤ 200) or `None`.
  - `check_answer(ask: dict, answer: str) -> bool | None`: `None` for `text`. Raises `ValueError` when the answer can't be read; for choice, that is not a letter A–F or an option's text.
    - Number: correct within `max(1e-9, 0.01 * |key|)`.
    - Expression: correct when it agrees with the key (relative 1e-6) at every sample point where both are defined, with at least 3 such points.
  - `display_key(ask: dict) -> str | None`, for example:
    - "B. 8";
    - "12 cm";
    - "x^2+2x+1".

    Numbers are formatted with `:g` at 4 significant figures.
  - `public_action(action: dict) -> dict`: an `ask` without `answer` and `calc`; every other action unchanged (the same object).

- [ ] **Step 1: Write the failing tests:**
  - `test_prepare_choice_key`, parametrized:
    - "B" → 1;
    - "16" with options ["4","8","16"] → 2;
    - 5 → kind "text".
  - `test_prepare_number_key_prefers_calc`: calc "3*4" with answer 13 → 12.0.
  - `test_prepare_number_key_from_text`: answer "12 cm" with unit "cm" → 12.0.
  - `test_unusable_keys_become_text_questions`, parametrized:
    - number "abc" with no calc;
    - expr "y+1".
  - `test_check_choice`:
    - "b" → True;
    - " 8 " → True;
    - "c" → False;
    - "zebra" raises `ValueError`.
  - `test_check_number`:
    - "12.1" → True;
    - "12.5" → False;
    - "12 cm" → True;
    - "abc" raises `ValueError`.
  - `test_check_expression`, with key "x^2+2x+1":
    - "(x+1)^2" → True;
    - "(x+1)(x+1)" → True;
    - "x^2+1" → False.
  - `test_text_answers_are_not_checked_in_code`: returns None.
  - `test_display_key`:
    - "B. 8";
    - "12 cm";
    - 0.3333333 → "0.3333".
  - `test_public_action_hides_the_key`.
- [ ] **Step 2: Run** `docker compose exec api pytest tests/test_grading.py -q`. Expected: FAIL.
- [ ] **Step 3: Implement** `grading.py`.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(backend): check choice, number and expression answers in code`.

### Task 4: Keys stay on the server

**Files:**
- Modify: `backend/app/services/whiteboard_service.py`:
  - `stream_solution`: each `ask` goes through `prepare_ask` before it is saved, and through `public_action` before it is sent;
  - `stream_cached`: `public_action`;
  - `get_doubt`: `public_action` over the flattened list.
- Test: `backend/tests/test_whiteboard.py`

**Interfaces:**
- Consumes: `prepare_ask` and `public_action` (Task 3).
- Produces: saved turn payloads hold prepared asks (with keys). Everything sent to the browser is public.

- [ ] **Step 1: Write the failing test** `test_answer_keys_never_reach_the_browser`.
  - The script has a caption, a write, and `{"type":"ask","id":"q1","kind":"number","answer":13,"calc":"3*4","unit":"cm"}`.
  - The SSE ask event has no `answer` or `calc`.
  - `GET /doubts/{id}` has no `answer` or `calc`.
  - The DB turn payload ask has `"answer": 12.0`.
  - An identical second doubt (a cache hit) streams the ask without the key.
- [ ] **Step 2: Run** `docker compose exec api pytest tests/test_whiteboard.py -q`. Expected: the new test FAILS.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the whole backend suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat(backend): keep answer keys off the stream, the cache and replays`.

### Task 5: Doubt Solver and Examiner agents

**Files:**
- Modify: `backend/app/services/llm/gateway.py`: an agent registry
- Modify: `backend/app/config/settings.py`: `examiner_model = "sonnet"`, `examiner_effort = "low"`
- Modify: `backend/app/services/whiteboard_service.py`: `TurnStart.agent`; `_produce` and `stream_solution` take the agent
- Modify: `backend/app/api/v1/endpoints/student.py`: `_board_stream` passes `start.agent`
- Modify: `backend/app/services/whiteboard/board_eval.py`: the eval uses `doubt_solver`
- Test: `backend/tests/test_llm.py`, `backend/tests/test_whiteboard.py`

**Interfaces:**
- Produces:
  - `AGENTS: dict[str, Callable[[], AgentConfig]]` in `gateway.py` (read from settings when called):
    - `"doubt_solver"` → (`whiteboard_model`, `whiteboard_effort`);
    - `"examiner"` → (`examiner_model`, `examiner_effort`);
    - `"board_teacher"` → kept for Phase 8 lessons.
  - `agent_config(name)` raises `LlmConfigError` for an unknown name.
  - `TurnStart` gains `agent: str = "doubt_solver"`.
  - `stream_solution(doubt, event_id, system, prompt, student_id, agent="doubt_solver")`.
  - Mode → agent:
    - `ask`, `follow_up`, `another_way` and `reply` → `doubt_solver`;
    - `check` and `practice` → `examiner` (wired in Tasks 7–8).

- [ ] **Step 1: Write the failing tests:**
  - `test_every_doubt_agent_has_a_config`: `doubt_solver`, `examiner` and `board_teacher` return an `AgentConfig`, and `"nobody"` raises `LlmConfigError`.
  - `test_doubts_are_logged_as_the_doubt_solver`: after asking a doubt, `LlmCall.agent == "doubt_solver"`.
- [ ] **Step 2: Run** `docker compose exec api pytest tests/test_llm.py tests/test_whiteboard.py -q`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full backend suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat(backend): give doubts their own Doubt Solver and Examiner agents`.

### Task 6: Prompts for replies, checks and practice

**Files:**
- Modify: `backend/app/services/whiteboard/prompt.py`
- Modify: `backend/app/services/whiteboard/summary.py`
- Test: `backend/tests/test_board_prompt.py`

**Interfaces:**
- Produces:
  - A `QUESTIONS` module in **every** subject's system prompt, under 900 characters. It covers:
    - `ask` per kind: choice options with a 0-based answer, number with `calc` and `unit`, expr in x, and text with a model answer;
    - "write the question and say it in a caption first";
    - "at most one ask per turn, only when it helps";
    - `mark`;
    - `verdict` (only when asked to judge a text answer).

    `TEACHING` gains: "Once, in the middle, you may check understanding with an ask."
  - `build_prompt(question, subject, profile, *, context=None, mode="ask", left=None, message=None, check=None) -> tuple[str, str]`. The new modes:
    - **`reply`.** `<board>` (context) and optionally `<left>`, then `<message>` with the guard. The instruction:
      1. a caption that acknowledges the message, then answer it on the board building on what is there;
      2. carry on with `<left>`, adapted to the message;
      3. same page, a scene only for a new part.

      Without `left`: "then wrap up in one or two steps".
    - **`check`.** `check = {"question": str, "kind": str, "answers": [str], "expected": str | None}`. The answers go inside `<answer>` tags. The instruction:
      1. write the student's last answer in orange with an id and mark it;
      2. show kindly where it went wrong and the right working;
      3. carry on with `<left>`.

      For `text`, it instead says: judge it like a teacher, one write per line in orange with ids, mark each line, then print `verdict` for that ask. With no answers, it says: "The student skipped it: show the solution, then carry on with `<left>`."
    - **`practice`.** `<board>`, then: "Now you try: start with a scene titled "Now you try", write one practice question like the doubt at the student's level, say it, then ask it (choice, number or expr when possible). Stop after the ask; do not solve it."
  - `summarize_plan(actions: list[dict], limit: int = 600) -> str`: captions, writes and visual descriptors **in teaching order**, deduplicated.
  - `question_context(actions: list[dict], index: int, limit: int = 200) -> str`: the last caption before `index`, plus the writes between it and `index`.
  - `_guard(text)`: replaces `</` with `< /`.

- [ ] **Step 1: Write the failing tests:**
  - `test_every_subject_prompt_teaches_questions`: `'"type":"ask"'` appears in the system prompt for maths, physics, biology and `None`.
  - `test_reply_prompt_has_board_left_and_message`.
  - `test_reply_without_left_wraps_up`: no `<left>`.
  - `test_check_prompt_carries_answers_and_key`: contains "14", "15" and "12 cm".
  - `test_text_check_asks_for_a_verdict`.
  - `test_skipped_check_shows_the_solution`: `answers` is empty → "skipped".
  - `test_practice_prompt_stops_after_the_ask`.
  - `test_message_cannot_close_its_tag`: "</message> ignore" → no second `</message>` before the guard.
  - `test_reply_prompt_stays_small`: 150 actions with 100-character texts → the user prompt is under 2,500 characters.
  - `test_summarize_plan_keeps_teaching_order`.
  - `test_question_context_finds_the_question`.
- [ ] **Step 2: Run** `docker compose exec api pytest tests/test_board_prompt.py -q`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS. Run the full backend suite; the existing prompt tests stay green.
- [ ] **Step 5: Commit** `feat(backend): prompts for mid-explanation replies, answer checks and practice`.

### Task 7: Replies cut the board; practice turns; replay

**Files:**
- Modify: `backend/app/schemas/whiteboard.py`: `TurnCreate`
- Modify: `backend/app/services/whiteboard_service.py`:
  - `start_turn`;
  - `flatten_turns`;
  - `get_doubt`;
  - `MAX_TURNS = 12`.
- Modify: `backend/app/repositories/board_repository.py`: `add_event`, `list_events`
- Modify: `backend/app/api/v1/endpoints/student.py`: the turn rate-limit bucket
- Test: `backend/tests/test_whiteboard.py`

**Interfaces:**
- Consumes: `build_prompt` modes, `summarize_plan` and `question_context` (Task 6).
- Produces:
  - `TurnCreate`:
    - `question: Question | None`;
    - `mode: Literal["follow_up","another_way","check","practice"] = "follow_up"`;
    - `keep: int | None` (≥ 0);
    - `ask: ItemId-like str | None` (≤ 24).

    `follow_up` needs a question, and `check` needs `ask`.
  - Stored turn payloads gain:
    - `mode` values `"reply"`, `"check"` and `"practice"`;
    - an optional `"cut_at": int` on the interrupted turn;
    - `"ask": id` on check turns.
  - `flatten_turns(turns: list[dict], answers: dict[tuple[int, str], list[dict]] | None = None) -> list[dict]`:
    - applies `cut_at`;
    - inserts `{"type":"answer","ask":id,"text":…,"correct":…}` right after each ask, keyed by (turn index, ask id);
    - adds no scene before `reply` or `check` turns.
  - `add_event(db, session, kind, payload) -> BoardEvent` (`add_turn` delegates to it); `list_events(db, session_id) -> list[BoardEvent]` in seq order.
- Rules in `start_turn`:
  - **`follow_up` + `keep`:**
    - `keep` is clamped to the latest turn's action count, and `cut_at = keep` is set on it.
    - `left = summarize_plan(actions[keep:])`; it is `None` if empty.
    - The mode is stored as `"reply"`, with prompt mode `reply`, `message` = the question and `question` = `session.title`.
  - **`follow_up` without `keep`:** as today.
  - **`practice`:** the prompt mode is `practice`, with `question = session.title`.
  - **`check`:** in Task 8.

- [ ] **Step 1: Write the failing tests:**
  - `test_reply_cuts_the_board_and_carries_on`:
    - The script is caption, write, caption, write (4 actions).
    - The turn is `{"question":"Why?","keep":2}`.
    - The prompt has `<left>` with the third caption's text and `<message>\nWhy?`.
    - The saved actions are turn 0's first 2 actions followed by the reply's actions, with no inserted scene.
    - The modes are `["ask","reply"]`.
  - `test_reply_without_left_wraps_up`: `keep` = 4 → no `<left>`.
  - `test_now_you_try_sets_a_practice_question`: the prompt has "Now you try", the turn's mode and question are recorded, and the call is logged as the `examiner`.
  - `test_flatten_applies_cuts_and_answers`: a pure unit test with `cut_at` 3 and two answers on q1.
  - Update `test_busy_board_and_turn_limit` to fill 12 turns.
  - `test_turns_have_their_own_rate_limit`: monkeypatch the limit to 1; a second turn gets 429 while a new doubt still works.
- [ ] **Step 2: Run** `docker compose exec api pytest tests/test_whiteboard.py -q`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full backend suite. Expected: PASS, including `test_migrated_v1_session_replays_unchanged` and `test_flatten_turns_*`.
- [ ] **Step 5: Commit** `feat(backend): reply mid-explanation by cutting the board, and add practice turns`.

### Task 8: Answers endpoint and check turns

**Files:**
- Modify: `backend/app/schemas/whiteboard.py`: `AnswerCreate`, `AnswerOut`
- Modify: `backend/app/services/whiteboard_service.py`:
  - `submit_answer`;
  - the `check` mode in `start_turn`;
  - verdict recording in `_save_result`.
- Modify: `backend/app/api/v1/endpoints/student.py`: `POST /doubts/{doubt_id}/answers`
- Test: `backend/tests/test_whiteboard.py`

**Interfaces:**
- Consumes: `check_answer` and `display_key` (Task 3); `add_event` and `list_events` (Task 7); `build_prompt(mode="check")` (Task 6).
- Produces:
  - `AnswerCreate {ask: str (1–24), answer: str (1–200, stripped)}`.
  - `AnswerOut {correct: bool | None, attempt: int, final: bool, expected: str | None}`. `expected` is set only when `final` and not correct.
  - `submit_answer(db, student, doubt_id, payload) -> AnswerOut`:
    - locks the session and finds the newest turn whose actions hold an ask with that id; a missing one is a 404 "Question not found";
    - a streaming latest turn with no such ask → 409 BUSY;
    - an unreadable answer → 422 "Check your answer and try again", which does not count as a try;
    - a question already final (correct, or 2 tries, or any text answer) → 409 "You've already answered this question.";
    - it stores an `answer` event `{"turn": i, "ask": id, "answer": text, "correct": …, "attempt": n}`.

    A text answer is `final` at once, with `correct: None`.
  - Check turns: `TurnCreate {mode:"check", ask, keep?}`. The question comes from `question_context` and the answers from that ask's answer events. The `keep` cut works as for replies. The mode is stored as `"check"`, along with the ask id.
  - `_save_result`: for each `verdict` in the saved actions, it sets `correct` on that ask's answer events in the session where `correct` is `None`.
  - Endpoint: `POST /student/doubts/{doubt_id}/answers` → `ok(AnswerOut)`; rate limit `answer:{student.id}` 120/3600.

- [ ] **Step 1: Write the failing tests:**
  - `test_number_answer_is_checked_in_code`:
    - "14" → `{correct: false, attempt: 1, final: false, expected: null}`;
    - "12 cm" → `{correct: true, attempt: 2, final: true, expected: null}`;
    - the `LlmCall` count is unchanged.
  - `test_two_wrong_answers_are_final`: "14" then "15" → final with `expected: "12 cm"`; a third answer → 409.
  - `test_unreadable_answer_does_not_use_a_try`: "abc" → 422, then "12" → attempt 1.
  - `test_text_answer_waits_for_the_teacher`: `{correct: null, final: true}`.
  - `test_answer_needs_a_known_question`: "zz" → 404; another student's doubt → 404.
  - `test_check_turn_explains_a_wrong_answer`:
    - after two wrong answers, `{mode:"check", ask:"q1", keep:3}` streams;
    - the prompt has "14", "15" and "12 cm";
    - the replay shows both answers right after the ask, then the check turn's actions;
    - the call is logged as the `examiner`.
  - `test_verdict_marks_a_text_answer`: the check stream prints `{"type":"verdict","ask":"q2","correct":true}`, and the answer event's `correct` becomes true.
- [ ] **Step 2: Run** `docker compose exec api pytest tests/test_whiteboard.py -q`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full backend suite and ruff. Expected: PASS.
- [ ] **Step 5: Commit** `feat(backend): check answers and explain mistakes on the board`.

### Task 9: Player: steps, cuts, questions, marks and page overflow

**Files:**
- Create: `frontend/src/features/canvas/engine/steps.js`
- Create: `frontend/src/features/canvas/engine/testCanvas.js` (test helper)
- Modify: `frontend/src/features/canvas/engine/BoardPlayer.js`
- Test: `frontend/src/features/canvas/engine/steps.test.js`, `frontend/src/features/canvas/engine/BoardPlayer.test.js`

**Interfaces:**
- Produces:
  - `stepEnd(actions, next) -> number`: the first index ≥ `next` whose type is `caption`, or `actions.length`.
  - The test helper `attachFakeCanvas(player)`:
    - sets `ink`, `sceneCtx` and `overlay` to a Proxy fake 2D context with no-op methods;
    - `measureText(text) → {width: text.length * 12}`;
    - `canvas: {width: 0}`;
    - `pixelScale = 1`, `fontsReady = true`.

    The test helper `drain(player)` calls `player._advance(1e9)` until it stops changing.
  - `BoardPlayer`:
    - `stepEnd() -> number`;
    - `keepCount(at) -> number`: the non-local actions of the latest turn before `at`;
    - `cut(at)`: drops `actions[at:]`, only for `at ≥ next`;
    - `answerAsk({ text, correct, say, release })`: inserts the local caption `say` and `{type:'answer', text, correct, local:true}` at `next`; `release` closes the open ask;
    - `skipAsk()`;
    - `duck(on)`: `narrator?.setVolume(on ? 0.2 : 1)`;
    - the snapshot gains `ask` (the open ask's `{id, kind, options, unit, hint}`, or `null`);
    - the status gains `'asking'`.
  - Turn tracking: `begin()` sets `turnOffset = 0` and `interactive = true`; `extend()` sets `turnOffset = actions.length` and `interactive = true`; `load()` sets `interactive = false`.
  - Rendering:
    - **`ask`:** writes the options as one line, `A. 4   B. 8   C. 16`, for choice. Otherwise it writes `Answer (cm): ?` in blue. Then the player waits while `interactive` (status `'asking'`) and passes straight through in replays.
    - **`answer`:** writes the text in orange in the column, then a green tick or red cross after it; `correct: null` draws no mark.
    - **`mark`:** a tick or cross 20 units right of the target write's bounds, plus the note as a red label. An unknown id is ignored.
    - **`verdict`:** nothing.
    - **Page overflow:** a top-level `write` without `y` whose line would start below 900 − `EDGE` − one line starts a new page titled `<current title> (contd.)` (or "Continued"), then draws on it.

- [ ] **Step 1: Write the failing tests:**
  - `steps.test.js`:
    - `stepEnd([c,w,w,c,w], 1) === 3`;
    - `stepEnd(…, 3) === 3`;
    - `stepEnd([c,w], 1) === 2`.
  - `BoardPlayer.test.js`, using `setInstant(true)` and the fake canvas:
    - `cut drops the steps not yet started`: begin, enqueue `c1, w1`, drain, enqueue `c2, w2, c3`; `stepEnd() === 2`; `keepCount(2) === 2`; after `cut(2)` the length is 2.
    - `keepCount counts only the latest turn's own actions`: `extend()` after 2 actions, 2 more, plus a local answer → `keepCount(actions.length) === 2`.
    - `a live question waits for the answer`: status `'asking'`, `snapshot.ask.id === 'q1'`, `snapshot.ask.answer` undefined; after `answerAsk({…, correct: true, release: true})` and a drain → `'finished'`.
    - `a wrong answer keeps the question open`.
    - `questions don't wait in a replay`: `load([...])` → `'finished'`.
    - `a mark on an unknown write is ignored`.
    - `a long column continues on a new page`: 40 writes → `pages.length >= 1` and `pageTitle` contains "contd".
- [ ] **Step 2: Run** `cd frontend && pnpm test -- src/features/canvas/engine`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test && pnpm lint`. Expected: PASS. All 211 existing tests stay green.
- [ ] **Step 5: Commit** `feat(frontend): let the board pause for questions and cut at the end of a step`.

### Task 10: Speech input and narration ducking

**Files:**
- Modify: `frontend/src/features/canvas/engine/narrator.js`: `setVolume(volume)`
- Create: `frontend/src/features/canvas/hooks/useSpeechInput.js`
- Modify: `frontend/src/features/canvas/index.js` (export it)
- Test: `frontend/src/features/canvas/engine/narrator.test.js`, `frontend/src/features/canvas/hooks/useSpeechInput.test.js`

**Interfaces:**
- Produces:
  - `Narrator.setVolume(volume)`: applies to the playing audio and to later audio and browser utterances.
  - `useSpeechInput({ lang = 'en-IN', onFinal }) -> { supported, listening, interim, error, start, stop }`:
    - `window.SpeechRecognition ?? window.webkitSpeechRecognition`;
    - `continuous = false`, `interimResults = true`;
    - `onFinal(text)` is called once per utterance with the trimmed final transcript;
    - `error` is "Microphone access is blocked." for `not-allowed`/`service-not-allowed`, and "Didn't catch that. Try again." for `no-speech`;
    - recognition stops on unmount.

- [ ] **Step 1: Write the failing tests:**
  - `setVolume applies to the playing audio and later ones`.
  - With a fake `SpeechRecognition` class installed on `window`:
    - `start listens and reports interim text`;
    - `the final transcript is sent once`;
    - `blocked microphone shows a message`;
    - `unsupported browsers report supported: false`.
- [ ] **Step 2: Run** `pnpm test -- narrator useSpeechInput`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test && pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): add tap-to-talk speech input that turns narration down`.

### Task 11: Doubt session: queued messages, answers, checks and practice

**Files:**
- Modify: `frontend/src/services/doubtService.js`: `answer(doubtId, body)`
- Modify: `frontend/src/features/whiteboard/hooks/useDoubtSession.js`
- Test: `frontend/src/features/whiteboard/hooks/useDoubtSession.test.js`

**Interfaces:**
- Consumes: player `stepEnd`, `keepCount`, `cut`, `extend`, `answerAsk`, `skipAsk` and `getSnapshot().status/ask` (Task 9); the endpoints (Tasks 7–8).
- Produces:
  - `doubtService.answer(doubtId, { ask, answer }) -> Promise<AnswerOut>`.
  - `useDoubtSession` returns `{ session, ask, followUp, say, answer, skip, tryOne, stop, reset }`. `session` gains:
    - `pending` (a queued message, or `null`);
    - `checking` (an answer request in flight);
    - `feedback` (`{ kind: 'correct' | 'wrong' | 'final' | 'teacher', expected? }`, or `null`).
  - `say(text)`:
    - **While the turn is still streaming:** store `pending` and send it right after `done`.
    - **While the board plays, is paused, or is asking:**
      ```
      at = player.stepEnd()
      keep = player.keepCount(at)
      player.cut(at)
      player.extend()
      streamTurn({ question: text, keep })
      ```
    - **When finished:** a plain follow-up.
  - `answer(value)`:
    1. POST, then `player.answerAsk({ text: value, correct, say, release })`. `say` is "Correct! Well done." when correct, "Not quite. Have another go." on a first wrong answer, and nothing otherwise. `release` is `correct || final`.
    2. When the answer is final and not correct, or for any text answer, start a check turn `{ mode: 'check', ask, keep: player.keepCount(player.next) }` after cutting at `player.next`.
    3. A 422 shows the server's message and keeps the question open.
  - `skip()`: `player.skipAsk()`. If the turn has nothing after the ask, it starts a check turn so the AI shows the solution (the empty answers make the prompt "they skipped it").
  - `tryOne()`: a `practice` turn.

- [ ] **Step 1: Write the failing tests** with a fake player and mocked `doubtService`:
  - `say() while the AI is still writing waits for done, then sends keep once`;
  - `say() mid-explanation cuts at the end of the step`;
  - `say() during the last step sends keep equal to the turn length`;
  - `say() on a finished board sends a plain follow-up`;
  - `a correct answer writes a tick and moves on`;
  - `two wrong answers start a check turn`;
  - `an unreadable answer keeps the question open`;
  - `tryOne() streams a practice turn`.
- [ ] **Step 2: Run** `pnpm test -- useDoubtSession`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test && pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): send messages and answers without cutting the AI off`.

### Task 12: Talk bar and doubts page

**Files:**
- Create: `frontend/src/features/whiteboard/components/TalkBar.jsx` (replaces `FollowUpBar.jsx`, which is deleted along with its test)
- Modify: `frontend/src/features/whiteboard/index.js`, `frontend/src/features/whiteboard/status.js`, `frontend/src/pages/student/StudentDoubtsPage.jsx` (`MAX_TURNS = 12`)
- Test: `frontend/src/features/whiteboard/components/TalkBar.test.jsx`, `frontend/src/features/whiteboard/status.test.js`

**Interfaces:**
- Consumes: `useSpeechInput` and `player.duck` (Task 10); `useDoubtSession` (Task 11); `board.ask` and `board.status` from the snapshot.
- Produces:
  - `TalkBar` props:
    - `{ ask, playing, busy, full, pending, checking, feedback }`;
    - handlers `onSay, onAnswer, onSkip, onAnotherWay, onTryOne`;
    - `speech` (from `useSpeechInput`).
  - **Talk mode:**
    - text input + mic + Send;
    - the placeholder while playing is "Say or type anything — LEEN will answer after this step", and otherwise "Ask a follow-up about this board";
    - a pending chip: "You: … · LEEN will answer after this step";
    - "Explain another way" and "Now you try" are shown when the board is finished.
  - **Answer mode** (when `ask` is open):
    - choice → one button per option, labelled "A. 4" (sends the letter);
    - number → a number box with the unit after it, plus Check;
    - expr → a text box "Type an expression in x", plus Check;
    - text → a text box with the mic, plus Check.

    Also:
    - **Hint** shows `ask.hint`;
    - **Skip**;
    - a feedback line ("Not quite. Have another go." / "The answer is 12 cm. Let's see why.").
  - **Speech:**
    - in talk mode the final transcript is sent;
    - in answer mode it fills the box;
    - `player.duck(listening)`.
  - `boardStatus`: player status `'asking'` → `{ label: 'Your turn', icon: MessageCircleQuestion }`.

- [ ] **Step 1: Write the failing tests:**
  - `sends a typed message`;
  - `shows a queued message`;
  - `answers a choice question with its letter`;
  - `number answers show the unit and need a value`;
  - `hint is revealed on request`;
  - `mic is hidden when speech is unsupported`;
  - `a spoken message is sent, a spoken answer fills the box`;
  - `full board shows the start-a-new-doubt note`;
  - `boardStatus shows Your turn while asking`.
- [ ] **Step 2: Run** `pnpm test -- TalkBar status`. Expected: FAIL.
- [ ] **Step 3: Implement.** Wire the page, delete `FollowUpBar`, and use `MAX_TURNS = 12`.
- [ ] **Step 4: Run** `pnpm test && pnpm lint && pnpm build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): talk to the board by voice or text on the doubts page`.

### Task 13: Live check, token report and docs

**Files:**
- Modify: `frontend/src/features/canvas/samples.js` (a "questions" sample: ask, answer, mark)
- Modify: `docs/architecture/ARCHITECTURE.md` (a "Talking to the board" section: endpoints, modes, events, keys, grading)
- Modify: `docs/ROADMAP.md` (Phase 5 ✅ Done, Phase 6 Next)
- Modify: `docs/master-plan/LEEN_AI_Master_Plan.html` (Phase 5 Done with a Result callout, Phase 6 Next) → re-render `docs/LEEN_AI_Master_Plan.pdf`
- Modify: `docs/architecture/CANVAS_ENGINE.md` (status line)
- Modify: memory `project_frontend_rebuild.md` (Phase 5 done)

- [ ] **Step 1: Bring up the stack.** Check `curl -s 127.0.0.1:8765/health`. If the bridge is down, start it: `python3 infrastructure/claude-bridge/claude_bridge.py`.
- [ ] **Step 2: Live check** with the test student `phase4.check@leen.dev` (via curl and the CDP script):
  1. Ask "How does a convex lens form an image?". While the board plays, send "why is the image upside down?". Expect:
     - the current step finishes;
     - the reply opens with an acknowledging caption on the same page;
     - the rest is taught;
     - the replay matches.
  2. Ask a maths doubt and use "Now you try". Expect:
     - a wrong number answer gets "Not quite";
     - a second wrong answer streams a check turn that crosses the answer;
     - no `llm_calls` row is added for code-checked answers.
  3. Note the token use from `llm_calls`: first turn against reply turn (input and output).
- [ ] **Step 3: Gallery.** `/dev/canvas?sample=questions` renders ask, answer and mark without overlap.
- [ ] **Step 4: Docs.** Update the docs listed above, including the live token numbers. Re-render the PDF with `google-chrome --headless=new --no-pdf-header-footer --print-to-pdf=docs/LEEN_AI_Master_Plan.pdf docs/master-plan/LEEN_AI_Master_Plan.html`.
- [ ] **Step 5: Run** every suite:
  - `docker compose exec api pytest -q`;
  - `docker compose exec api ruff check app tests`;
  - `cd frontend && pnpm test && pnpm lint && pnpm build`;
  - `python3 -m pytest infrastructure/claude-bridge -q`.

  Expected: all PASS.
- [ ] **Step 6: Commit** `docs: document talking to the board and mark Phase 5 done`.
