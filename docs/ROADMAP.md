# Roadmap

LEEN AI is an AI tuition teacher built around one core engine: the **AI-powered 2D canvas**. The student uploads their syllabus once. Every day the AI plans a one-hour class and teaches it on the canvas like a human tuition teacher. It draws and explains, asks questions, and lets the student speak up or type at any time without cutting it off. It checks their answers on the board in red pen and adapts the next class to what it learned. It is **fully AI**: every job, from reading the syllabus to reporting to parents, is done by its own AI agent.

The full plan is in **[LEEN_AI_Master_Plan.pdf](LEEN_AI_Master_Plan.pdf)**: decisions, current system, product loop, engine design, per-phase detail, data model, risks and the demo script. Its source is [master-plan/LEEN_AI_Master_Plan.html](master-plan/LEEN_AI_Master_Plan.html). The engine design is also in [architecture/CANVAS_ENGINE.md](architecture/CANVAS_ENGINE.md).

Work ships in phases, ordered by dependency. Each phase delivers working backend and frontend features together. The "PDF §" column refers to the product plan in `docs/Utility_Docs/`.

| #   | Phase                                        | PDF §          | Status  | What ships |
| --- | -------------------------------------------- | -------------- | ------- | ---------- |
| 1   | Auth, RBAC, design system, app shell         | §6             | ✅ Done | Cookie JWT with rotating refresh tokens, role dependencies, design system, landing page, sign-in/up, password flows, a dashboard shell per role, admin user list + create teacher, `create-admin` CLI |
| 2   | Profiles & relationships                     | 7.1            | ✅ Done | Profiles and avatars, student onboarding (class, board, subjects, level, language), parent↔child link codes, teacher classes with join codes, admin user management, daily token cleanup |
| 3   | **Canvas engine v1: AI whiteboard doubts**   | 7.4            | ✅ Done | Claude Code bridge, live pencil with eraser and captions, 2D animations, validated board-action protocol over SSE, history and replay, neural Indian-English narration, PNG export |
| 4   | **Canvas engine v2: richer visuals**         | 7.5, 7.13      | ✅ Done | LLM gateway (provider switch, per-agent config, token logging in `llm_calls`); Board Protocol v2 computed by a math engine (mathjs, d3-scale, dagre) so the AI sends short commands, with a renderer registry; scenes, camera, auto-layout; plots, geometry, tables, diagram templates, flowcharts, charts, number line, chemical equations; `board_sessions` / `board_events` (doubts migrated); follow-up questions on the same board; "Explain another way"; engine moved to `features/canvas` |
| 5   | **Talk to the board**                        | 7.4, 7.6, 7.9  | Next    | *Agents: Doubt Solver, Examiner.* The student talks to the board by voice (push-to-talk, en-IN) or a text box, at any time; the AI never gets cut off: it finishes its current step, then works the message into the explanation and carries on; `ask` / `mark` / `verdict`; choice, number and expression answers checked in code at zero tokens, written answers checked by the AI, which copies them onto the board and marks the wrong line in red; "Now you try" in doubts |
| 6   | **Syllabus & knowledge base (RAG)**          | 7.1, 7.2       | Planned | *Agents: Syllabus Reader, Librarian.* Image-input spike first; one-time syllabus or contents-page upload per subject → editable topic tree; books and notes ingestion (Celery, OCR, local embeddings, pgvector); retrieval in doubts with page citations; doubts by photo; Syllabus page |
| 7   | **Student model & daily planner**            | 7.7, 7.10, 7.14 | Planned | *Agents: Planner, Coach.* Onboarding adds daily minutes, study days, exam and date; `topic_mastery`, `learner_profiles`, a student card in every prompt; Planner with subject rotation and spaced revision; Today page; overnight pre-generation; topic practice that moves mastery |
| 8   | **Daily tuition class** (the core loop)      | 7.3, 7.8       | Planned | *Agents: Lesson Designer, Board Teacher, Homework Agent.* Lesson Designer; class orchestrator (warm-up → teach + checkpoints → practice → wrap-up); the student can talk at any time; reteach a different way; pause and resume; prefetch; homework set; class player; Coach summaries; replay |
| 9   | **Homework & tests**                         | 7.8, 7.9       | Planned | *Agents: Homework Agent, Test Maker.* Homework (a photo of paper working, or typed) graded in the background with red-pen review; weekly and chapter tests, timed and auto-graded, with every mistake explained on the canvas |
| 10  | **Progress & analytics**                     | 7.10, 7.14     | Planned | *Agents: Progress Analyst.* Mastery map, time spent, streaks, weak areas, insights; admin platform and AI-usage stats |
| 11  | **Parent dashboard & notifications**         | 7.11           | Planned | *Agents: Parent Reporter.* Per-child class status, scores, weak areas, alerts, class replays; notification centre; weekly email report via Celery beat |
| 12  | **Voice, video & Hindi**                     | 7.6, 7.12      | Planned | Hindi/Hinglish board and Hindi neural voices; class video export; Hindi interface |
| 13  | **Production & polish**                      | —              | Planned | Anthropic API provider for deployment, HTTPS + secure cookies, CSP review, CI, monitoring, PWA, accessibility, Playwright E2E, email verification, licensed TTS |
| —   | **Future: teachers**                         | —              | Later   | After Phase 13: teacher-shared class syllabus, tests assigned to a class, class analytics. Until then the product is fully AI |

## AI agents

Every job has its own AI agent: a prompt, an output schema and a model setting, with every call logged under its name in `llm_calls`. Agents call code tools for anything that can be computed (the math engine, the answer checker, the planner's scores), so they spend tokens only on judgment and words. Code only routes work between them. The design is in [architecture/CANVAS_ENGINE.md](architecture/CANVAS_ENGINE.md#layer-3-ai-agents-and-the-class-conductor).

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

## Product plan coverage

| PDF § | Feature             | Phase(s) |
| ----- | ------------------- | -------- |
| 7.1   | Profile and setup   | 2, 6, 7  |
| 7.2   | Content upload      | 6        |
| 7.3   | Teaching            | 8        |
| 7.4   | Doubts              | 3, 4, 5  |
| 7.5   | Visuals             | 4        |
| 7.6   | Voice and video     | 5, 12    |
| 7.7   | Learning plan       | 7        |
| 7.8   | Homework            | 8, 9     |
| 7.9   | Tests               | 5, 9     |
| 7.10  | Tracking            | 7, 10    |
| 7.11  | Parents             | 11       |
| 7.12  | Languages           | 12       |
| 7.13  | Multi-agent         | 4–11     |
| 7.14  | Improvement         | 7, 10    |

The business model (§9: subscriptions, premium and institutional plans) is out of scope.

## What changed from the previous roadmap (18 Oct 2026)

- The canvas is now the core engine that every teaching feature runs through.
- Standalone streaming chat is dropped; follow-up questions happen on the board.
- RAG stays early (Phase 6), on pgvector in Postgres instead of a separate vector database.
- Quizzes became homework and tests on the two-way board.
- The study planner became the daily tuition class.
- The old 8 phases are now 13.

**Phase 5 redesign (18 Oct 2026).** The student never writes on the board. They talk to it by voice or a text box, and the AI works what they say into the explanation without stopping, the way a real teacher does. Voice input (English through the browser, Hindi through Sarvam AI) moved from Phase 12 to Phase 5. The image-input spike and doubts by photo moved to Phase 6, where the syllabus photo needs them.

**Hindi voice (19 Oct 2026).** Hindi narration uses **Sarvam AI** (Bulbul voices Ishita and Shubh) and is built already, ahead of Phase 12. Captions stay Hinglish in English letters; only the copy sent for speech is transliterated to Devanagari. Hindi voice input will use Sarvam's speech-to-text when Phase 5 builds the mic.

**Fully AI and teachers (18 Oct 2026).** The product is fully AI, with an AI agent for every job. No new teacher features for now; they come in a future phase after Phase 13. What Phase 2 built stays: teachers create classes, and students join with a code.

Future items in the app (the sidebar entries and dashboard cards marked **Soon**) are labelled with the phase that delivers them. That label comes from `frontend/src/config/navigation.js` and the dashboard pages. Update it when a phase ships.
