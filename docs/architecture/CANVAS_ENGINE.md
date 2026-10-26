# Canvas Engine

The core engine of LEEN AI is the **AI-powered 2D canvas**: the board the AI teaches on, and everything behind it. This document is the design that Phases 4–8 build against. The phase-by-phase breakdown, decisions log and demo script are in the [master plan PDF](../LEEN_AI_Master_Plan.pdf). The roadmap is in [ROADMAP.md](../ROADMAP.md).

**Status:**
- **Phase 3** built canvas engine v1, the whiteboard tutor.
- **Phase 4** built canvas engine v2: the LLM gateway, Board Protocol v2 visuals, board sessions with follow-up turns, the board cache, per-subject prompts, and a dev gallery at `/dev/canvas`.
- **Phase 5** built talking to the board (Layer 2): voice or text at any time without cutting the AI off, `ask`/`mark`/`verdict`, answers checked in code, check and "Now you try" turns, and the Doubt Solver and Examiner agents.

The as-built details are in [ARCHITECTURE.md](ARCHITECTURE.md#ai-whiteboard-tutor). Layers 3–5 are planned (Phases 6–8).

## The daily tuition loop

1. **One-time setup.** Onboarding adds daily minutes (default 60), study days and an optional target exam and date. **Per subject, the syllabus or a book's contents page is uploaded once** (photo or PDF). The AI extracts *Subject → Chapters → Topics*, and the student reviews and confirms it. Books and notes can be uploaded too, for RAG.
2. **Today's class.** There is one class a day on one subject. The Planner rotates subjects, favouring weak subjects, near exams and subjects not studied for a while. The plan shows the topic(s), an agenda and why it chose them. The student can switch. The plan is made on the first open of the day, or overnight by Celery beat.
3. **The class, about one hour on the canvas.**

   | Part     | Default    | What happens |
   | -------- | ---------- | ------------ |
   | Warm-up  | ~5 min     | 2–3 quick questions on revision-due topics of today's subject |
   | Teach    | ~25–30 min | Scenes (board pages): idea → visual → worked example → **checkpoint** question |
   | Practice | ~20 min    | Easy to hard questions, answered by voice or text and marked **on the board**; hints on request |
   | Wrap-up  | ~5 min     | Summary board, homework (3–5 questions), preview of the next class |

   The split adapts to the day. **The student can talk at any time**, by voice or text: the AI finishes its step, answers, and carries on. A failed checkpoint gets up to two reteaches *a different way*; after that the class moves on and the topic is flagged weak. A class can be paused and resumed the same day.
4. **Check and adapt.** Every graded answer updates the student model, which the next plan reads.
5. Homework, tests, progress and the parent view all read the same session data.

**Anti-goals.** The design has failed if:
- the canvas becomes a slideshow of static text;
- the student can't speak up at any time, or the tutor loses its place when they do;
- teaching drifts outside the student's syllabus;
- grading says "wrong" without showing *where*.

## Principles

- **The AI says *what*; the engine decides *how it looks*.** The model emits semantic actions (`plot y = x^2 from -3 to 3`, `triangle A(0,0) B(4,0) C(0,3)`). The engine computes geometry, layout and animation.
- **Plain data from the model.** Every model output is validated against a pydantic schema before it reaches the browser or the database, as `app/services/whiteboard/parser.py` does today.
- **One AI agent per job.** Every piece of work belongs to its own agent, with its own prompt, output schema, model setting and token log. Agents call code tools for anything that can be computed (math engine, answer checker, planner scores), so they spend tokens only on judgment and words. Code is the plumbing: it routes work between agents, keeps time and stores results.
- **Short streamed steps.** One AI call covers one scene, one checkpoint or one grading. This fits the bridge's per-call limit and lets the class adapt between steps.
- **Every session is an append-only event log.** Replay, time spent, analytics, the parent view and continuous improvement all read it.
- **Token-efficient by design.** If something can be computed, the engine computes it with a math library; the AI only names it. See [Token efficiency](#token-efficiency).

## Layer 1: Board Protocol v2

*Built in Phase 4.* The v1 actions stay unchanged: `caption`, `write`, `underline`, `box`, `erase`, `line`, `arrow`, `rect`, `circle`, `clear`, `pause`, `object`, `animate`, `stop`, `remove`.

Visuals are drawn stroke by stroke, like the pencil. Any visual can take `at: [x, y, w, h]` and `color`. Without `at`, it stacks down the stage (x 920–1540, y 100–860).

| Action | Fields (as built) | The board computes |
| ------ | ----------------- | ------------------ |
| `scene` | `title` | Keeps the page as a thumbnail, wipes the board, writes the title |
| `focus` | `at` (none zooms back out) | A CSS zoom of up to 2.5× |
| `column` | `side`: left \| right \| full | Which column a write without x/y flows into; each column keeps its own place |
| `plot` | `fns` (≤4 expressions of x), `x` [lo, hi], `y` [lo, hi]?, `points` {name: [x, y]}, `labels`, `shade` {fn, from, to}, `xlabel`, `ylabel` | Curves (mathjs, 240 samples, split at asymptotes), axes and ticks (d3-scale), shading |
| `numberline` | `range`, `marks`, `labels` {name: value}, `interval` {from, to, open: [bool, bool]} | Ticks, dots, open and closed ends |
| `geo` | `pts` {A: [x, y]} (2–12), `shapes` ("AB", "ABC"), `angles` ("ABC"), `right`, `sides` {AB: label}, `circles` [{c, r \| through}] | Fitting to the box, angle values, label positions |
| `table` | `head`, `rows`, or `fn` with `xs` | The values (for `fn`), column widths, text size |
| `chart` | `kind`: bar \| pie \| line, `labels`, `values`, `title`, `unit` | Scales, bars, slices, axes |
| `flow` | `nodes` (2–10), `edges` [[i, j]] (none = a chain), `kind`: chart \| mind, `dir`: TB \| LR | Layout (dagre), or a radial mind map |
| `diagram` | `kind`: circuit (`parts`, `layout`), lens or mirror (`shape`, `f`, `u`, `h`), fbd (`body`, `forces` [{dir, label, size}]), atom (`z`, `symbol`), cell (`cell`, `labels`), apparatus (`items`); plus `title` | Image position by the lens or mirror formula, Bohr shells, symbol and label placement |

Built since:
- `ask`, `mark` and `verdict` (Phase 5): the board asks, marks answers and records verdicts;
- `image` (Phase 6): the student's photo on a photo doubt. Only the server sends it; one written by the model is dropped;
- `cite` (Phase 6): `{"type":"cite","source":N}` names one of the numbered `<sources>` (the student's own pages). The server fills in the document, page and title, and the player draws a tappable "📖 title · p.N" chip.

**Adding a primitive** means adding three things:
1. a pydantic model on the backend;
2. a renderer in the frontend registry (`type → render(ctx, action, clock)`);
3. a short section in the prompt's command reference.

## Layer 2: Talking to the board

**The student never writes on the board; only the AI does.** The student talks to it at any time:
- a **text box** under the board, always open;
- a **mic button** (push to talk). The browser's speech recognition (en-IN) turns speech into text and sends it when they stop speaking. While the mic is on, narration is turned down so the mic doesn't hear the teacher. Browsers without speech recognition show only the text box.

**Student input never cuts the AI off.** Like a real teacher, the AI finishes the step it is on, then works the message in:
1. The AI writes a board turn in seconds, but playing it takes minutes. So when a message arrives, the browser knows how far the board has played.
2. The browser picks the cut: the end of the current step (the next caption not yet shown). Everything before it plays on.
3. It sends the message with `keep` (how many of the turn's actions stay) straight away, so the AI works while the current step finishes. If the AI is still writing the turn, the message waits until it is done.
4. The server keeps the first `keep` actions (`cut_at` on the turn). It sends the AI a short summary of the board so far, a summary of the part not yet taught, and the message.
5. The AI acknowledges the message and answers it on the board. Then it teaches what was left, adapted to the message: slower, skipped, or with another picture. The unplayed part is replaced.

**Questions and checking**
- `ask {id, kind: choice | number | expr | text, options?, unit?, hint?, answer, calc?}`. The board writes the answer line (and the options), the player waits, and the talk bar becomes the answer box. The `answer` key never reaches the browser.
- Choice, number and expression answers are checked **in code**, instantly, with no AI call:
  - a small safe evaluator (Python `ast`, no `eval`) reads fractions, roots and π;
  - a whole-number key needs the exact number; a decimal key accepts the student's value rounded to the places they typed, or within 0.1%;
  - expressions match when they agree at several sample values of x;
  - for `number`, the AI sends the sum as `calc` and the code works out the key, which catches arithmetic slips.
- The board writes the student's answer in orange with a tick or a cross. A wrong answer gets one more try, with the hint. A second wrong answer makes the AI explain the mistake on the board, then carry on.
- `text` answers go to the AI. It copies the student's lines onto the board in orange, marks each with `mark {id, kind: tick | cross, note?}`, explains, and records `verdict {ask, correct}`.
- Answers are stored as `answer` board events, and replays show them.

**In Phase 5** this lives inside **Ask a doubt**:
- messages in the middle of an explanation;
- checkpoint questions the AI chooses to ask;
- **"Now you try"**, a similar question after the explanation.

The daily class (Phase 8) reuses all of it.

## Layer 3: AI agents and the class conductor

**Every job is done by an AI agent.** Each agent is a prompt, an output schema and a model/effort setting. All of them call the model through the LLM gateway, and each call is logged under the agent's name.

| Agent | Its job | Phase |
| ----- | ------- | ----- |
| **Doubt Solver** | Answers doubts on the board, follow-ups, "explain another way", and the student's messages in the middle of an explanation | 3–5 |
| **Examiner** | Sets questions with answer keys (checkpoints, "Now you try", practice); checks answers, using the answer checker for choice, number and expression answers and judging written ones; explains mistakes on the board | 5 |
| **Syllabus Reader** | Reads a contents page or syllabus (photo or PDF) into chapters and topics | 6 |
| **Librarian** | Reads uploaded books and notes (scanned pages by vision), tags pages to syllabus topics, finds the right pages for a topic or a doubt | 6 |
| **Planner** | Plans each day: picks the subject and topic from scores computed in code, writes the agenda and the "why" | 7 |
| **Coach** | Keeps the student model: mastery notes, misconceptions, pace and the explanation styles that work | 7 |
| **Lesson Designer** | Designs the hour: scenes with goals, visuals and examples, checkpoints and practice; uses the student's books | 8 |
| **Board Teacher** | Teaches each scene of the class on the board, reteaches a different way, runs the wrap-up | 8 |
| **Homework Agent** | Sets homework at the end of class; checks submitted homework (photo or typed) in the background with red pen | 8–9 |
| **Test Maker** | Builds weekly and chapter tests (mixed types, timed) from the topics studied | 9 |
| **Progress Analyst** | Turns the numbers (computed in code) into insights: weak areas, trends, what to study next | 10 |
| **Parent Reporter** | Writes the weekly parent report and the alert messages | 11 |

A small piece of code, the **class conductor**, routes work between the agents in this order and keeps the time budget (it trims extra practice when the class runs long):

```
planned → warmup → teach(scene i) ⇄ checkpoint → practice(question j) → wrapup → completed
            ↘ student message → reply → (carry on)
                                 checkpoint failed once or twice → reteach (a different way)
```

- **Planner scores.** Code computes each subject's and topic's score: rotation weighted by weakness, exam date and days since last studied; syllabus order; revisions due (simplified SM-2); unfinished topics; daily minutes. The Planner agent picks from the top candidates and explains its choice in a few lines.
- **Answer keys.** For number questions the Examiner sends the sum (`calc`) and the answer checker computes the key; written questions carry a model answer. The student can say "I think that's wrong" and the Examiner re-checks.
- **Step streaming.**
  - Each `POST /student/lessons/{id}/advance` carries the student's input: an answer, a message, "next" or "hint".
  - It streams the next step over SSE, ending at an `ask` or at the end of a segment.
  - It uses the same events, 15 s pings and save-in-`finally` as `whiteboard_service.stream_solution`.
- **Prefetch.** While the student answers a checkpoint, the next scene is generated.

## Layer 4: Student model

- **`topic_mastery`** (student × topic):
  - score 0–1, confidence, attempts, correct;
  - `last_practiced_at`, `next_review_at`;
  - status: not_started / learning / practicing / mastered.

  It is updated after every graded answer with a weighted (Elo-like) rule.
- **`learner_profiles`**: pace, explanation styles that worked, recent misconceptions, language mix. The Coach maintains it.
- **Student card:** every prompt gets a card of under 300 tokens with:
  - class, board, level and language;
  - mastery of the current topic and its prerequisites;
  - top misconceptions;
  - styles that work.

## Layer 5: Syllabus and knowledge base (RAG)

- **Syllabus:** an upload goes to the Syllabus Reader, and the student confirms the result. The topic tree is the backbone for plans, mastery and tests.
- **Book pages, not whole books** (20 Oct 2026). The student adds the pages of the topic they are studying (a photo, or a PDF of up to 20 pages). Celery processes them:
  1. Text comes from the PDF's text layer, or from local OCR (Tesseract, English + Hindi, zero tokens). The Librarian reads a page by vision only when OCR's confidence is low.
  2. The text is split into chunks of ≤ 2,000 characters, never across pages.
  3. Chunks are embedded with a free local multilingual model (`paraphrase-multilingual-MiniLM-L12-v2` via fastembed, 384 numbers).
  4. They are stored in pgvector (Postgres image `pgvector/pgvector:pg16`, HNSW cosine index).
- **Retrieval:** per topic, it feeds the Lesson Designer and Board Teacher; per doubt, the Doubt Solver. Boards cite pages with `cite`. Without books, the AI teaches from its own knowledge, kept to the syllabus topic, board and class.
- This is the RAG pipeline promised in the project synopsis. pgvector fills the vector-store role the synopsis names as Qdrant.

## Layer 6: LLM gateway

- `app/services/llm/` is the single way to call a model:
  - `stream_text(agent, system, prompt, images=())`
  - `complete(agent, system, prompt, images=())` (the whole reply, for background jobs; the caller validates it)
- `LLM_PROVIDER` selects `claude_bridge` (default) or `anthropic_api` (for deployment).
- Model, effort and timeout are set per agent.
- Every call is logged in `llm_calls`: agent, duration, input/output/cached tokens and `cost_usd` (from the CLI's result event, forwarded by the bridge), and status.
- **Image input through the bridge** (Phase 6): `claude -p --input-format stream-json` with image content blocks, tools still disabled. It was the first option tried, and it worked (a 360×120 test image cost about 250 input tokens). The bridge accepts up to 3 images per call. `gateway.complete()` joins a stream for background jobs.

## Token efficiency

Tokens are the main running cost and the main source of delay. The rule: **if it can be computed, the engine computes it; the AI only names it.**

| Where | How tokens are saved |
| ----- | -------------------- |
| Graphs | The AI sends `plot y=x^2, x from -3 to 3` (~25 tokens); the engine evaluates the curve |
| Tables of values | The AI sends the expression and x values; the engine fills the cells |
| Geometry | The AI sends vertices; the engine computes angles, arcs, lengths, label positions |
| Diagrams | Template name + a few parameters instead of 30+ line and arrow commands |
| Flowcharts | Nodes and edges only; a layout library places them |
| Layout and defaults | Auto-layout means most actions carry no coordinates; defaults are omitted |
| Grading | Choice, number and expression answers checked in code by a safe evaluator (tolerance, equivalence by sampling) at zero tokens; the AI judges only written answers |
| Answer keys | For number questions the AI sends the sum (`calc`) and code works out the key, instead of a second AI solve |
| Student messages | A reply mid-explanation carries two short summaries (the board so far, the part still to teach), not the action lists |
| Prompt size | Command reference split by subject; follow-ups get a board summary under 200 tokens; student card under 300 tokens; fixed prompt parts cached (`cache_control` on the API provider) |
| Model routing | Each agent gets the smallest model that does its job: Haiku for the Planner, Coach, Progress Analyst and Parent Reporter; Sonnet at low effort for the board agents; more effort only for reading photos and judging written answers |
| Reuse | The same doubt (normalised question, class, board, level, language) is served from cache at zero tokens |
| Measurement | Input, output and cached tokens logged per call. Phase 4 records a v1 baseline and must stay at or below it |

**Math engine and libraries** (free, local, versions pinned when built):

| Job | Library |
| --- | ------- |
| Expression evaluation: plots and tables of values | mathjs, loaded only on canvas pages |
| Axes, ticks, scales, chart shapes | d3-scale, d3-shape |
| Flowchart and mind-map layout | dagre |
| Geometry: angles, arcs, label placement | small in-house vector helpers |
| Answer checking: numeric tolerance, expression equivalence | A small safe evaluator on Python's `ast` (backend); SymPy only if a later phase needs symbolic algebra |

## Frontend

- The engine moves from `features/whiteboard/engine/` to `features/canvas/`. That folder holds:
  - the player and renderer registry;
  - scenes and the camera;
  - the talk bar (voice and text) and answer boxes;
  - timeline and replay;
  - the narrator.
- Doubts, classes, homework review, test review and the parent replay all mount the same `<Canvas>`.
- Reused as they are:
  - `BoardPlayer.js`, `strokes.js`, `mathText.js`, `motion.js`, `scene.js`, `sprites.js`, `narrator.js`;
  - `utils/sse.js`;
  - the refresh-and-retry stream in `doubtService.stream()`.

## Data model by phase

| Phase | Tables and columns |
| ----- | ------------------ |
| 4     | `board_sessions` (kind doubt\|class\|homework\|test_review, student, subject, topic, status, protocol version, minutes), `board_events` (session, seq, kind, payload JSONB); `whiteboard_doubts` rows migrated in; `llm_calls` |
| 5     | No new tables: an `ask` lives in its board turn, answers are `board_events` of kind `answer`, and turns gain `cut_at` |
| 6     | `syllabus_uploads`, `syllabus_subjects`, `syllabus_chapters`, `syllabus_topics` (per student); `documents`, `document_chunks` (pgvector) |
| 7     | `student_profiles` + daily_minutes, study_days, target_exam, exam_date; `question_items` (moved from Phase 5: questions get topics here); `topic_mastery`; `learner_profiles`; `daily_plans` |
| 8     | `lesson_outlines`; `assignments` (homework or test; the class wrap-up creates homework) |
| 9     | `submissions`, `submission_grades` |
| 11    | `notifications`, weekly report snapshots |

## API outline

| Area | Endpoints |
| ---- | --------- |
| Syllabus and books | `POST /student/syllabus/uploads`, `GET`/`PUT /student/syllabus/{subject}`, `POST /student/documents` |
| Today | `GET /student/today` (makes the plan if missing), `POST /student/today/switch` |
| Lesson (the daily class) | `POST /student/lessons` (start or resume), `POST /student/lessons/{id}/advance` (SSE), `GET /student/lessons/{id}` (replay), `POST /student/lessons/{id}/pause`. These are not `/student/classes`, which is the existing classroom API. |
| Doubts | Existing `/student/doubts`; `POST /student/doubts/{id}/turns` (follow-up, reply mid-explanation, another way, check, "Now you try"); `POST /student/doubts/{id}/answers`; photo doubts in Phase 6 |
| Homework and tests | `GET /student/assignments`, `POST /student/assignments/{id}/submit`, review endpoints |
| Progress | `GET /student/progress`, `GET /parent/children/{id}/progress` |

## Risks

| Risk | Plan |
| ---- | ---- |
| Image input through the bridge | Spike at the start of Phase 6, with the three-step fallback above |
| Speech recognition | Browser speech recognition works only in Chrome and Edge, and sends audio to the browser maker's service. The text box always works; a local speech model can replace it later (Phase 12) |
| Latency (5–20 s per step) | Plans prepared ahead; drawing starts on the first streamed action; next scene prefetched during checkpoints |
| Bridge capacity (2 runs at once) | Enough for a demo; raise `--max-concurrent`; the API provider for real users |
| Board clutter | Auto-layout cursor, columns, scenes, camera focus |
| Wrong answer keys | Number keys computed in code from `calc`, numeric tolerance; the student can say "I think that's wrong" and the AI re-checks |
| Cost per class (15–30 calls) | Math-engine visuals, subject-split prompts, caching, model routing, grading in code; tokens per agent visible in `llm_calls` |
| Embedding model size | Loaded once per process; ingestion only in Celery |
