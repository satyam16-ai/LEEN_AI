# Canvas Engine

The core engine of LEEN AI is the **AI-powered 2D canvas**: the board the AI teaches on, and everything behind it. This document is the design that Phases 4–8 build against. The phase-by-phase breakdown, decisions log and demo script are in the [master plan PDF](../LEEN_AI_Master_Plan.pdf). The roadmap is in [ROADMAP.md](../ROADMAP.md).

Today's whiteboard tutor (Phase 3, described in [ARCHITECTURE.md](ARCHITECTURE.md#ai-whiteboard-tutor)) is **canvas engine v1**. Everything below extends it rather than replacing it.

## The daily tuition loop

1. **One-time setup.** Onboarding adds daily minutes (default 60), study days and an optional target exam and date. **Per subject, the syllabus or a book's contents page is uploaded once** (photo or PDF). The AI extracts *Subject → Chapters → Topics*, and the student reviews and confirms it. Books and notes can be uploaded too, for RAG. A teacher can share a class syllabus, and students import it.
2. **Today's class.** There is one class a day on one subject. The Planner rotates subjects, favouring weak subjects, near exams and subjects not studied for a while. The plan shows the topic(s), an agenda and why it chose them. The student can switch. The plan is made on the first open of the day, or overnight by Celery beat.
3. **The class, about one hour on the canvas.**

   | Part     | Default    | What happens |
   | -------- | ---------- | ------------ |
   | Warm-up  | ~5 min     | 2–3 quick questions on revision-due topics of today's subject |
   | Teach    | ~25–30 min | Scenes (board pages): idea → visual → worked example → **checkpoint** question |
   | Practice | ~20 min    | Easy to hard questions solved **on the board**, checked step by step; hints on request |
   | Wrap-up  | ~5 min     | Summary board, homework (3–5 questions), preview of the next class |

   The split adapts to the day. **Raise hand** at any time opens a doubt board, and the class then resumes. A failed checkpoint gets up to two reteaches *a different way*; after that the class moves on and the topic is flagged weak. A class can be paused and resumed the same day.
4. **Check and adapt.** Every graded answer updates the student model, which the next plan reads.
5. Homework, tests, progress and the parent view all read the same session data.

**Anti-goals.** The design has failed if:
- the canvas becomes a slideshow of static text;
- the tutor can't be interrupted;
- teaching drifts outside the student's syllabus;
- grading says "wrong" without showing *where*.

## Principles

- **The AI says *what*; the engine decides *how it looks*.** The model emits semantic actions (`plot y = x^2 from -3 to 3`, `triangle A(0,0) B(4,0) C(0,3)`). The engine computes geometry, layout and animation.
- **Plain data from the model.** Every model output is validated against a pydantic schema before it reaches the browser or the database, as `app/services/whiteboard/parser.py` does today.
- **Deterministic control, AI content.** Code runs the class state machine, scheduling, subject rotation, spaced revision, and MCQ and numeric grading. The model writes explanations and questions and judges free-form work.
- **Short streamed steps.** One AI call covers one scene, one checkpoint or one grading. This fits the bridge's per-call limit and lets the class adapt between steps.
- **Every session is an append-only event log.** Replay, time spent, analytics, the parent view and continuous improvement all read it.
- **Token-efficient by design.** If something can be computed, the engine computes it with a math library; the AI only names it. See [Token efficiency](#token-efficiency).

## Layer 1: Board Protocol v2

The v1 actions stay unchanged: `caption`, `write`, `underline`, `box`, `erase`, `line`, `arrow`, `rect`, `circle`, `clear`, `pause`, `object`, `animate`, `stop`, `remove`. Everything draws stroke by stroke, like the existing pencil.

| Group        | Actions | Notes |
| ------------ | ------- | ----- |
| Structure    | `scene`, `focus`, `column` | `scene {title}` starts a new page; earlier pages stay in a thumbnail strip. `focus {x,y,w,h}` moves the camera. A `write` without x/y flows down the active column. |
| Graphs       | `axes`, `plot` | Function graphs from a safe expression evaluator (never `eval`), with points, shaded regions and labels |
| Geometry     | `point`, `segment`, `polygon`, `angle`, `arc` | Math units mapped to the board; angle arcs, equal-length ticks, dimension labels |
| Tables       | `table` | Rows revealed one at a time |
| Diagrams     | `diagram {template, params, labels[]}` | Leader-line labels. Starter set: circuit, ray optics, free-body, atom/Bohr, cell, simple apparatus |
| Infographics | `flow`, `chart`, `numberline` | Flowcharts and mind maps with automatic layout; bar, pie and line charts |
| Chemistry    | `write` | Chemical equations through `mathText` (subscripts, →, ⇌) |
| Media        | `image` | An uploaded photo, such as the student's question |
| Interaction  | `ask`, `mark`, `hint` | `ask {id, kind: mcq\|numeric\|short\|board, prompt, options?, region?}` pauses the player. `mark {target_line, kind: tick\|cross\|circle\|note}` is the red pen. `hint` is revealed on request. |
| Grounding    | `cite {source, page}` | A chip linking to the page of an uploaded book |

**Adding a primitive** means adding three things:
1. a pydantic model on the backend;
2. a renderer in the frontend registry (`type → render(ctx, action, clock)`);
3. a short section in the prompt's command reference.

## Layer 2: Two-way board

**Three first-class ways to answer:** handwriting on the board, a typed answer in `mathText` syntax, or a photo of paper working. This keeps the board usable with a mouse, touch, stylus or phone.

**Grading**
- MCQ and numeric answers are graded in code, with a tolerance and unit variants.
- Free-form answers:
  1. The browser groups strokes into numbered **lines** by clustering on y.
  2. It sends an image of the answer area with the line numbers drawn on. Photos go as they are, and typed answers as text.
  3. The Examiner returns a verdict per line, a score and feedback.
  4. `mark` actions target line numbers, so the engine places ticks and crosses exactly. The design doesn't rely on vision models for pixel positions.

**In Phase 5**, before classes exist, the two-way board lives inside **Ask a doubt**:
- "Now you try" sets a similar question after each explanation.
- "Check my working" marks a photo of the student's own solution.

## Layer 3: Class orchestrator and agents

The orchestrator is a deterministic state machine:

```
planned → warmup → teach(scene i) ⇄ checkpoint → practice(question j) → wrapup → completed
            ↘ raise_hand → doubt → (resume)
                                 checkpoint failed once or twice → reteach (a different way)
```

A time-budget tracker trims extra practice when the class runs long.

| Agent               | Runs when                       | Produces |
| ------------------- | ------------------------------- | -------- |
| **Syllabus Reader** | A syllabus or contents page is uploaded | JSON tree of chapters and topics, with order and page numbers when present |
| **Lesson Designer** | Today's plan is made            | Outline: scenes (goal, visual format, examples), checkpoints, practice skeleton; uses RAG when books exist |
| **Board Teacher**   | Each scene, reteach and wrap-up | Streamed Protocol v2 actions with captions (today's whiteboard prompt, evolved) |
| **Examiner**        | Writing questions; grading      | Questions with key, rubric, difficulty and topic; grades for free-form and photo answers |
| **Doubt Solver**    | Raise hand; standalone doubts   | Board actions, aware of the class and the student's books |
| **Coach**           | End of class; weekly            | Mastery and misconception updates, student and parent summaries |

- **Planner** is code, not an agent. It picks the subject (rotation weighted by weakness, exam date and days since last studied), then topics from syllabus order, mastery, revisions due (simplified SM-2), unfinished topics and daily minutes.
- **Answer-key self-check.** The Examiner solves each generated question a second time, independently. If the answers disagree, the question is discarded.
- **Step streaming.**
  - Each `POST /student/classes/{id}/advance` carries the student's input: an answer, raise-hand text, "next" or "hint".
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
- **Books and notes**, processed in Celery:
  1. Text is extracted from PDFs, and scanned pages are read through the gateway's vision call.
  2. The text is chunked by page and heading.
  3. Chunks are embedded with a free local multilingual model.
  4. They are stored in pgvector: the Postgres image becomes `pgvector/pgvector:pg16`, with a `CREATE EXTENSION vector` migration.
- **Retrieval:** per topic, it feeds the Lesson Designer and Board Teacher; per doubt, the Doubt Solver. Boards cite pages with `cite`. Without books, the AI teaches from its own knowledge, kept to the syllabus topic, board and class.
- This is the RAG pipeline promised in the project synopsis. pgvector fills the vector-store role the synopsis names as Qdrant.

## Layer 6: LLM gateway

- `app/services/llm/` is the single way to call a model:
  - `stream_text(agent, system, prompt, images=[])`
  - `complete_json(agent, system, prompt, schema, images=[])`
- `LLM_PROVIDER` selects `claude_bridge` (default) or `anthropic_api` (for deployment).
- Model, effort and timeout are set per agent.
- Every call is logged in `llm_calls`: agent, duration, input/output/cached tokens and `cost_usd` (from the CLI's result event, forwarded by the bridge), and status.
- **Image input through the bridge** is the first task of Phase 5. The options, in order:
  1. `claude -p --input-format stream-json` with image content blocks.
  2. The bridge writes the image into the run's empty temp directory and enables only Claude Code's `Read` tool for that run.
  3. The `anthropic_api` provider for vision calls only. This needs agreement to use an API key.

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
| Grading | MCQ, numeric and algebraic answers checked in code with SymPy (equivalence, tolerance, units); the AI judges only working that can't be computed |
| Answer keys | SymPy re-computes numeric answers where possible, instead of a second AI solve |
| Prompt size | Command reference split by subject; follow-ups get a board summary under 200 tokens; student card under 300 tokens; fixed prompt parts cached (`cache_control` on the API provider) |
| Model routing | Haiku for summaries, syllabus tidy-up and classification; Sonnet at low effort for the board; more effort only for free-form grading |
| Reuse | The same doubt (normalised question, class, board, level, language) is served from cache at zero tokens |
| Measurement | Input, output and cached tokens logged per call. Phase 4 records a v1 baseline and must stay at or below it |

**Math engine and libraries** (free, local, versions pinned when built):

| Job | Library |
| --- | ------- |
| Expression evaluation: plots, tables of values, instant numeric checks in the browser | mathjs, loaded only on canvas pages |
| Axes, ticks, scales, chart shapes | d3-scale, d3-shape |
| Flowchart and mind-map layout | dagre |
| Geometry: angles, arcs, label placement | small in-house vector helpers |
| Answer checking: algebraic equivalence, numeric tolerance, units | SymPy and pint (backend) |

## Frontend

- The engine moves from `features/whiteboard/engine/` to `features/canvas/`. That folder holds:
  - the player and renderer registry;
  - scenes and the camera;
  - the student input layer and answer widgets;
  - raise hand;
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
| 5     | `question_items` (subject, topic text or topic_id, kind, prompt, options, answer_key, rubric, difficulty, source); answer images under `media/answers/` |
| 6     | `syllabus_uploads`, `syllabus_subjects`, `syllabus_chapters`, `syllabus_topics` (per student, plus teacher-shared copies); `documents`, `document_chunks` (pgvector) |
| 7     | `student_profiles` + daily_minutes, study_days, target_exam, exam_date; `topic_mastery`; `learner_profiles`; `daily_plans` |
| 8     | `lesson_outlines`; `assignments` (homework or test; the class wrap-up creates homework) |
| 9     | `submissions`, `submission_grades` |
| 11    | `notifications`, weekly report snapshots |

## API outline

| Area | Endpoints |
| ---- | --------- |
| Syllabus and books | `POST /student/syllabus/uploads`, `GET`/`PUT /student/syllabus/{subject}`, `POST /student/syllabus/import/{classroom_id}`, `POST /student/documents`, teacher `POST /teacher/classes/{id}/syllabus` |
| Today | `GET /student/today` (makes the plan if missing), `POST /student/today/switch` |
| Class | `POST /student/classes` (start or resume), `POST /student/classes/{id}/advance` (SSE), `GET /student/classes/{id}` (replay), `POST /student/classes/{id}/pause` |
| Doubts | Existing `/student/doubts` plus follow-ups, "Now you try", photo input, "Check my working" |
| Homework and tests | `GET /student/assignments`, `POST /student/assignments/{id}/submit`, review endpoints, teacher assignment to classes |
| Progress | `GET /student/progress`, `GET /parent/children/{id}/progress`, teacher class analytics |

## Risks

| Risk | Plan |
| ---- | ---- |
| Image input through the bridge | Spike at the start of Phase 5, with the three-step fallback above |
| Latency (5–20 s per step) | Plans prepared ahead; drawing starts on the first streamed action; next scene prefetched during checkpoints |
| Bridge capacity (2 runs at once) | Enough for a demo; raise `--max-concurrent`; the API provider for real users |
| Board clutter | Auto-layout cursor, columns, scenes, camera focus |
| Wrong answer keys | Independent re-solve, numeric tolerance, "report this question" |
| Cost per class (15–30 calls) | Math-engine visuals, subject-split prompts, caching, model routing, SymPy grading; tokens per agent visible in `llm_calls` |
| Embedding model size | Loaded once per process; ingestion only in Celery |
