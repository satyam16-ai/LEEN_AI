# Roadmap

LEEN AI is an AI tuition teacher built around one core engine: the **AI-powered 2D canvas**. The student uploads their syllabus once. Every day the AI plans a one-hour class and teaches it on the canvas like a human tuition teacher. It draws and explains, asks questions, lets the student answer on the same board, checks their work in red pen, and adapts the next class to what it learned.

The full plan is in **[LEEN_AI_Master_Plan.pdf](LEEN_AI_Master_Plan.pdf)**: decisions, current system, product loop, engine design, per-phase detail, data model, risks and the demo script. Its source is [master-plan/LEEN_AI_Master_Plan.html](master-plan/LEEN_AI_Master_Plan.html). The engine design is also in [architecture/CANVAS_ENGINE.md](architecture/CANVAS_ENGINE.md).

Work ships in phases, ordered by dependency. Each phase delivers working backend and frontend features together. The "PDF §" column refers to the product plan in `docs/Utility_Docs/`.

| #   | Phase                                        | PDF §          | Status  | What ships |
| --- | -------------------------------------------- | -------------- | ------- | ---------- |
| 1   | Auth, RBAC, design system, app shell         | §6             | ✅ Done | Cookie JWT with rotating refresh tokens, role dependencies, design system, landing page, sign-in/up, password flows, a dashboard shell per role, admin user list + create teacher, `create-admin` CLI |
| 2   | Profiles & relationships                     | 7.1            | ✅ Done | Profiles and avatars, student onboarding (class, board, subjects, level, language), parent↔child link codes, teacher classes with join codes, admin user management, daily token cleanup |
| 3   | **Canvas engine v1: AI whiteboard doubts**   | 7.4            | ✅ Done | Claude Code bridge, live pencil with eraser and captions, 2D animations, validated board-action protocol over SSE, history and replay, neural Indian-English narration, PNG export |
| 4   | **Canvas engine v2: richer visuals**         | 7.5, 7.13      | ✅ Done | LLM gateway (provider switch, per-agent config, token logging in `llm_calls`); Board Protocol v2 computed by a math engine (mathjs, d3-scale, dagre) so the AI sends short commands, with a renderer registry; scenes, camera, auto-layout; plots, geometry, tables, diagram templates, flowcharts, charts, number line, chemical equations; `board_sessions` / `board_events` (doubts migrated); follow-up questions on the same board; "Explain another way"; engine moved to `features/canvas` |
| 5   | **Two-way board**                            | 7.4, 7.9       | Next    | Image-input spike first; student input by handwriting, typed maths or photo; answer widgets; `ask` / `mark` / `hint`; Examiner grading in code (SymPy for computable answers) and by vision, with red pen on numbered lines; `question_items`; "Now you try" and "Check my working" in doubts; doubts by photo |
| 6   | **Syllabus & knowledge base (RAG)**          | 7.1, 7.2       | Planned | One-time syllabus or contents-page upload per subject → editable topic tree; teacher-shared class syllabus; books and notes ingestion (Celery, OCR, local embeddings, pgvector); retrieval in doubts with page citations; Syllabus page |
| 7   | **Student model & daily planner**            | 7.7, 7.10, 7.14 | Planned | Onboarding adds daily minutes, study days, exam and date; `topic_mastery`, `learner_profiles`, a student card in every prompt; Planner with subject rotation and spaced revision; Today page; overnight pre-generation; topic practice that moves mastery |
| 8   | **Daily tuition class** (the core loop)      | 7.3, 7.8       | Planned | Lesson Designer; class orchestrator (warm-up → teach + checkpoints → practice → wrap-up); raise hand; reteach a different way; pause and resume; prefetch; homework set; class player; Coach summaries; replay |
| 9   | **Homework & tests**                         | 7.8, 7.9       | Planned | Homework graded in the background with red-pen review; weekly and chapter tests, timed and auto-graded, with every mistake explained on the canvas; teachers assign tests to classes |
| 10  | **Progress & analytics**                     | 7.10, 7.14     | Planned | Mastery map, time spent, streaks, weak areas, insights; teacher class analytics; admin platform and AI-usage stats |
| 11  | **Parent dashboard & notifications**         | 7.11           | Planned | Per-child class status, scores, weak areas, alerts, class replays; notification centre; weekly email report via Celery beat |
| 12  | **Voice, video & Hindi**                     | 7.6, 7.12      | Planned | Voice input and raise hand by voice; Hindi/Hinglish board and Hindi neural voices; class video export; Hindi interface |
| 13  | **Production & polish**                      | —              | Planned | Anthropic API provider for deployment, HTTPS + secure cookies, CSP review, CI, monitoring, PWA, accessibility, Playwright E2E, email verification, licensed TTS |

## Product plan coverage

| PDF § | Feature             | Phase(s) |
| ----- | ------------------- | -------- |
| 7.1   | Profile and setup   | 2, 6, 7  |
| 7.2   | Content upload      | 6        |
| 7.3   | Teaching            | 8        |
| 7.4   | Doubts              | 3, 4, 5  |
| 7.5   | Visuals             | 4        |
| 7.6   | Voice and video     | 12       |
| 7.7   | Learning plan       | 7        |
| 7.8   | Homework            | 8, 9     |
| 7.9   | Tests               | 5, 9     |
| 7.10  | Tracking            | 7, 10    |
| 7.11  | Parents             | 11       |
| 7.12  | Languages           | 12       |
| 7.13  | Multi-agent         | 4–8      |
| 7.14  | Improvement         | 7, 10    |

The business model (§9: subscriptions, premium and institutional plans) is out of scope.

## What changed from the previous roadmap (18 Oct 2026)

- The canvas is now the core engine that every teaching feature runs through.
- Standalone streaming chat is dropped; follow-up questions happen on the board.
- RAG stays early (Phase 6), on pgvector in Postgres instead of a separate vector database.
- Quizzes became homework and tests on the two-way board.
- The study planner became the daily tuition class.
- The old 8 phases are now 13.

Future items in the app (the sidebar entries and dashboard cards marked **Soon**) are labelled with the phase that delivers them. That label comes from `frontend/src/config/navigation.js` and the dashboard pages. Update it when a phase ships.
