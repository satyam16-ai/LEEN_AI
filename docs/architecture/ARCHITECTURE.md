# Architecture

## Overview

The AI Personal Teacher System is a full-stack application with a clear separation between frontend and backend, connected via versioned FastAPI API endpoints.

```
                    ┌───────────────────────────────┐
  Browser ─────────▶│  Nginx  (localhost:8081)       │
                    │   /        → web  (Vite :3000)  │
                    │   /api/*   → api  (FastAPI :8000)│
                    └──────────────┬────────────────┘
                                   │
                ┌──────────────────┼──────────────────┐
          ┌─────▼──────┐    ┌──────▼─────┐    ┌───────▼──────┐
          │ PostgreSQL │    │   Redis    │◀───│ Celery worker │──▶ Mailpit (SMTP, dev)
          │   :5432    │    │   :6379    │    └──────────────┘
          └────────────┘    └────────────┘

  api ──HTTP (host.docker.internal:8765)──▶ Claude Code bridge (host terminal) ──▶ `claude -p`
```

The SPA and the API are served from **one origin**: Nginx in Docker, or the Vite `/api` proxy in local dev. This lets auth cookies stay `SameSite=Lax` with no CORS on the request path.

---

## Frontend Architecture

**Technology:** React + Vite + TailwindCSS

```
frontend/src/
├── components/
│   ├── ui/          Design-system primitives (Button, Input, FormField, Dialog, …)
│   ├── layout/      PublicNavbar, PublicFooter, AppSidebar, AppTopbar, UserMenu
│   ├── dashboard/   PageHeader, WelcomeBanner, StatCard, FeatureCard, ChecklistCard
│   └── landing/     Landing page sections
├── features/        Domain logic grouped by feature
│   ├── auth/        forms, guards, session + mutation hooks, zod schemas, role constants
│   ├── profile/     avatar uploader, learning-profile fields, onboarding wizard
│   ├── family/      parent link code, linked parents/children
│   ├── classes/     class dialogs/cards, join code panel, roster, join form
│   └── admin/       user table, create/edit user, admin hooks
├── pages/           Route-level pages (auth/, dashboard/, student/, parent/, teacher/, admin/, settings/, errors/)
├── layouts/         RootLayout, PublicLayout, AuthLayout, AppLayout
├── routes/          Router tree with guards
├── services/        Axios client + per-domain services (auth, profile, family, classroom, adminUsers)
├── store/           QueryClient, ThemeProvider
├── config/          Per-role navigation
├── hooks/           useTheme, useDocumentTitle, useDebouncedValue, useScrolled
└── utils/           cn, apiError, redirect, format, passwordStrength
```

### Key Decisions

- **React Router** data router. Guards are layout routes: `GuestOnly`, `RequireAuth` and `RequireRole`.
- **React Query** owns server state. The signed-in user is the `['auth', 'me']` query, the single source of truth for auth state, so there is no separate auth context.
- **Axios** client sends cookies (`withCredentials`) and the CSRF header. On a 401 it runs a single shared refresh and retries the request.
- **TailwindCSS v4** with semantic tokens (`bg-card`, `text-muted-foreground`, …) defined for light and `.dark`. Fonts are self-hosted via Fontsource.
- **react-hook-form + zod** for forms. Server `422` field errors are mapped onto inputs.
- **Radix primitives** (dialog, dropdown) for accessible overlays. All styling is our own.

---

## Backend Architecture

**Technology:** FastAPI + SQLAlchemy + Alembic

```
backend/app/
├── api/
│   └── v1/                  Version 1 API
│       ├── endpoints/       Route handlers
│       └── dependencies/    Request-scoped dependencies
├── config/                  Pydantic settings
├── core/                    Exception handlers, logging
├── database/                SQLAlchemy engine & session
├── models/                  SQLAlchemy ORM models
├── schemas/                 Pydantic request/response schemas
├── services/                Business logic (auth_service) & integrations (redis)
├── repositories/            Data access (user_repository, token_repository)
├── middlewares/              Request/response middleware
└── utils/                   Helper utilities
```

### Key Decisions

- **Versioned API** (`/api/v1/`, `/api/v2/`) for backward compatibility
- **Service-Repository pattern** for clean separation of concerns
- **Pydantic Settings** for type-safe configuration from environment
- **Alembic** for database migration management
- **Middleware pipeline:** Request ID → Logging → CORS

### API Versioning Strategy

Each API version gets its own directory under `app/api/`:

```
app/api/
├── v1/
│   ├── router.py          Aggregates all v1 endpoints
│   ├── endpoints/         Individual endpoint modules
│   └── dependencies/      v1-specific dependencies
└── v2/                    (future version)
    ├── router.py
    ├── endpoints/
    └── dependencies/
```

New versions are registered in `app/main.py`:
```python
app.include_router(v1_router, prefix="/api/v1")
app.include_router(v2_router, prefix="/api/v2")  # future
```

---

## Database Architecture

**Technology:** PostgreSQL 16 + SQLAlchemy 2.1 (psycopg 3)

### Current Schema

| Table                   | Purpose                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `users`                 | Accounts with one role (`student`/`parent`/`teacher`/`admin`), Argon2 password hash, `token_version` |
| `refresh_tokens`        | SHA-256 hashes of refresh tokens, grouped into rotation families |
| `password_reset_tokens` | SHA-256 hashes of single-use reset tokens (30 min)            |
| `student_profiles`      | Class, board, school, subjects, learning level, language; parent link code (48 h) |
| `parent_student_links`  | Parent ↔ student links (unique pair)                          |
| `classrooms`            | Teacher-owned classes with a unique 6-character join code     |
| `class_enrollments`     | Student ↔ classroom membership (unique pair)                  |
| `board_sessions`        | One board the AI teaches on (today: a doubt). Title, subject, status `streaming` → `complete`/`failed`, protocol version, cache key |
| `board_events`          | Append-only log per board. A doubt's events are its turns: `{question, mode, actions, status, error, cached}` as JSONB |
| `llm_calls`             | One row per model call: agent, model, status, duration, input/output/cached tokens, cost |

`users.avatar_filename` points at a re-encoded 256×256 WebP under `MEDIA_ROOT/avatars/`, served at `/media/avatars/<file>` (FastAPI static files behind Nginx).

### Migration Strategy

- All schema changes go through Alembic migrations
- The `api` container runs `alembic upgrade head` on every start
- Auto-generate migrations: `alembic revision --autogenerate -m "description"`
- Apply migrations: `alembic upgrade head`
- Rollback: `alembic downgrade -1`

---

## Infrastructure

### Docker Compose Services

| Service    | Image              | Host port | Purpose                                  |
| ---------- | ------------------ | --------- | ---------------------------------------- |
| `nginx`    | nginx:alpine       | 8081      | Single entry point (SPA + `/api`)        |
| `web`      | Custom (Vite)      | —         | Frontend dev server (behind Nginx)       |
| `api`      | Custom (FastAPI)   | —         | Backend (behind Nginx); runs migrations  |
| `worker`   | Custom (FastAPI)   | —         | Celery worker on the `default` queue (emails) with embedded beat (daily token cleanup, 03:00 UTC) |
| `mailpit`  | axllent/mailpit    | 8025      | Dev SMTP server + inbox UI               |
| `postgres` | postgres:16-alpine | 5432      | Database                                 |
| `redis`    | redis:7-alpine     | 6379      | Cache, rate limits, Celery broker        |


### Network

All services communicate over the `leen-network` bridge network. The backend connects to `postgres:5432` and `redis:6379` using Docker service names.

---

## Authentication & Authorization

### Roles

| Role      | How the account is created                              | Home       |
| --------- | ------------------------------------------------------- | ---------- |
| `student` | Self sign-up                                            | `/student` |
| `parent`  | Self sign-up                                            | `/parent`  |
| `teacher` | An admin creates it (`POST /api/v1/admin/users`)        | `/teacher` |
| `admin`   | CLI: `python -m app.cli create-admin`, or another admin | `/admin`   |

### Tokens & cookies

| Cookie          | Contents                                   | Lifetime                                                     | Path           | Flags                         |
| --------------- | ------------------------------------------ | ------------------------------------------------------------ | -------------- | ----------------------------- |
| `access_token`  | JWT (HS256): `sub`, `role`, `tv`, `exp`     | 15 min                                                       | `/`            | HttpOnly, SameSite=Lax, Secure in prod |
| `refresh_token` | Opaque random token (only its SHA-256 is stored) | 30 days with "remember me", otherwise a session cookie (24 h server-side) | `/api/v1/auth` | HttpOnly, SameSite=Lax, Secure in prod |

- **Rotation.** Every `POST /auth/refresh` revokes the presented token and issues a new one in the same family.
- **Reuse detection.** If a revoked token is presented again, the whole family is revoked. The exception is a 30 s grace window for a token that was just rotated, which covers two tabs refreshing at the same time. That case gets a new access token only.
- **Instant invalidation.** `users.token_version` is embedded in access tokens (`tv`). Password reset and password change bump it and revoke every refresh token, so stolen tokens stop working immediately.
- **The frontend never reads tokens.** On a 401 it calls `/auth/refresh` once (single-flight) and retries the request. If that fails, the session is cleared and the guards redirect to `/login?next=…`.

### CSRF

Cookies are `SameSite=Lax`. Every POST/PUT/PATCH/DELETE must also send `X-Requested-With: XMLHttpRequest`, or come from the browser with `Sec-Fetch-Site: same-origin` (which keeps Swagger usable). Cross-site forms can't set either header.

### Endpoints

| Method | Path                         | Access         | Notes                                              |
| ------ | ---------------------------- | -------------- | -------------------------------------------------- |
| POST   | `/api/v1/auth/register`      | Guest          | `role` must be `student` or `parent`; starts a session |
| POST   | `/api/v1/auth/login`         | Guest          | `remember_me` controls refresh lifetime            |
| POST   | `/api/v1/auth/refresh`       | Refresh cookie | Rotates tokens                                     |
| POST   | `/api/v1/auth/logout`        | Any            | Revokes the token family, clears cookies           |
| GET    | `/api/v1/auth/me`            | Signed in      | Current user                                       |
| POST   | `/api/v1/auth/forgot-password` | Guest        | Always 200 (no account enumeration); emails a 30-min link |
| POST   | `/api/v1/auth/reset-password`  | Reset token  | Single use; signs out all sessions                 |
| POST   | `/api/v1/auth/change-password` | Signed in    | Wrong current password → 400; other sessions signed out |
| GET    | `/api/v1/admin/users`        | Admin          | `role`, `search`, `page`, `page_size`; includes counts per role |
| POST   | `/api/v1/admin/users`        | Admin          | Create a teacher (or any role)                     |
| GET    | `/api/v1/admin/users/{id}`   | Admin          | Detail incl. learning profile, parents/children, classes |
| PATCH  | `/api/v1/admin/users/{id}`   | Admin          | `name`, `email`, `role`, `is_active`; role change/deactivation signs the user out everywhere. Can't change own role/deactivate self; role change blocked while role-specific data exists |
| POST   | `/api/v1/admin/users/{id}/password-reset` | Admin | Emails a reset link                          |

#### Profiles, families and classes

| Method | Path | Access | Notes |
| ------ | ---- | ------ | ----- |
| GET / PATCH | `/api/v1/profile` | Signed in | Name for everyone; learning-profile fields for students only |
| POST / DELETE | `/api/v1/profile/avatar` | Signed in | Multipart `file` (PNG/JPG/WebP ≤ 2 MB) → re-encoded WebP |
| GET / POST | `/api/v1/student/link-code` | Student | Get (auto-renewed) / regenerate the 8-char parent link code |
| GET | `/api/v1/student/parents` · DELETE `/{parent_id}` | Student | Linked parents / remove one |
| GET | `/api/v1/student/classes` · POST `/join` · DELETE `/{id}` | Student | Joined classes / join by code / leave |
| GET / POST | `/api/v1/parent/children` · DELETE `/{student_id}` | Parent | Linked children / link by code (code rotates after use) / unlink |
| GET / POST | `/api/v1/teacher/classes` | Teacher | List (with student counts) / create |
| GET / PATCH / DELETE | `/api/v1/teacher/classes/{id}` | Teacher (owner) | Detail with roster / edit / delete |
| POST | `/api/v1/teacher/classes/{id}/join-code` | Teacher (owner) | New join code (old one stops working) |
| DELETE | `/api/v1/teacher/classes/{id}/students/{student_id}` | Teacher (owner) | Remove a student |
| POST | `/api/v1/student/doubts` | Student | `{question, subject?}` → **`text/event-stream`** of the whiteboard explanation (see below) |
| POST | `/api/v1/student/doubts/{id}/turns` | Student (owner) | `{question}` (follow-up) or `{mode: "another_way"}` → **`text/event-stream`** onto the same board; 6 turns per board, 409 while one is streaming |
| GET | `/api/v1/student/doubts` · GET / DELETE `/{id}` | Student | History (newest first) / full board for replay with its `turns` / delete |
| GET | `/api/v1/tts?text=…&voice=neerja\|prabhat\|ishita\|shubh` | Signed in | MP3 narration of a caption (English: edge-tts; Hindi: Sarvam AI; cached 7 days) |

Protect new endpoints with `Depends(get_current_user)` or `Depends(require_roles(UserRole.TEACHER, ...))` from `app/api/v1/dependencies/auth.py`.

### Rate limits (Redis, fixed window, fail-open)

| Action          | Limit                                        |
| --------------- | -------------------------------------------- |
| Login           | 5 / min per IP + email                       |
| Register        | 10 / hour per IP                             |
| Forgot password | 3 / 15 min per email, 10 / 15 min per IP     |
| Redeem parent link code | 10 / 15 min per parent               |
| Join class      | 10 / 15 min per student                      |
| Ask a doubt     | 15 / hour per student (protects the Claude quota) |
| Narration audio | 600 / hour per user                          |

Over the limit returns `429` with a `Retry-After` header.

## AI Whiteboard Tutor

> This whiteboard is LEEN AI's core engine, now at **canvas engine v2** (Phase 4: visuals computed in the browser, board sessions with follow-ups, the LLM gateway). Talking to the board (Phase 5), the daily tuition class, agents and student model that build on it are designed in [CANVAS_ENGINE.md](CANVAS_ENGINE.md).

A student asks a doubt. The AI explains it on an HTML canvas in real time: a pencil writes the working, a duster erases and rewrites steps, and captions explain each step.

### Where the answers come from: the Claude Code bridge

The model is **Claude Code running on the developer's machine**, not an API key. The API container can't use the host's Claude Code login, so `infrastructure/claude-bridge/claude_bridge.py` runs in a terminal on the host. It is Python standard library only and listens on `127.0.0.1:8765`. The API reaches it at `http://host.docker.internal:8765`.

- For each request the bridge spawns `claude -p --output-format stream-json --include-partial-messages` with these flags:
  - `--tools ""` — no tools at all.
  - `--strict-mcp-config` and `--setting-sources ""` — no MCP servers, settings, plugins or hooks.
  - `--system-prompt <whiteboard prompt>`.

  Each run starts in an empty temporary directory. The bridge streams only the `text_delta` events back as NDJSON.
- Requests need `Authorization: Bearer $CLAUDE_BRIDGE_TOKEN`. The custom header also forces a CORS preflight, which the bridge never answers, so a web page can't use the bridge.
- At most 2 runs at once, and each run is killed after 300 s. A run is also killed when the API disconnects, for example when the student presses **Stop**.
- Every call goes through the **LLM gateway** (`app/services/llm/gateway.py`):
  - `stream_text(agent, system, prompt, …)` picks the model and effort per agent;
  - it logs the call's token use in `llm_calls`;
  - `LLM_PROVIDER` selects the provider (`claude_bridge` today).
- The bridge forwards each run's `usage` (input, output, cache read and cache write tokens) with its `done` event.
- **Production:** add an `anthropic_api` provider to the gateway. Nothing that calls the gateway changes.

### Board protocol

Claude prints **one JSON action per line**, so the backend can validate and forward each action while the rest is still being written. The board is 1600×900 logical units and the canvas scales it to fit.

| Action | Fields |
| --- | --- |
| `caption` | `text`: the subtitle for the step that follows |
| `write` | `text` (`x^2`, `a_{n}` render as super/subscripts), `x`/`y` baseline (omit both to continue on the next line), `size` sm/md/lg/xl, `color`, optional `id` |
| `underline` / `box` | `id` of an earlier `write`. Sized from the real text bounds. |
| `erase` | `id` of an earlier `write`, or a region `x,y,w,h` |
| `line` / `arrow` | `from`, `to` |
| `rect` | `x,y,w,h`, `fill` (translucent highlighter) |
| `circle` | `x,y,r` |
| `clear` | Wipe the board |
| `pause` | `ms` |
| `object` | An animated picture: `id`, `shape` sprite/emoji/circle/rect/arrow, `x`,`y`, `size`, `label`. Can `follow` another object (offset `dx`,`dy`), point `toward` one, or hang from a `pivot`. |
| `animate` | `id`, `motion` fall/projectile/orbit/swing/move/path/oscillate/spin/pulse, plus that motion's settings (`to_y`, `bounce`, `vx`/`vy`, `around`, `period`, `angle`, …), and `loop`, `wait`, `trail` |
| `stop` / `remove` | Freeze an object / fade it out, together with the arrows attached to it |

`app/services/whiteboard/parser.py` buffers partial lines and validates every action against the pydantic union in `app/schemas/board/` (v1 actions in `v1.py`, v2 visuals in `visuals.py`):
- coordinates are clamped to the board and text is truncated;
- unknown colours and sizes fall back to defaults;
- code fences, prose and invalid lines are dropped;
- a doubt can have at most 150 actions.

Because the model's output becomes plain data, a prompt-injected question can't do more than change what gets drawn.

### Canvas engine v2: visuals, board sessions and tokens

**Visuals are computed, not drawn by the AI.**
- The AI sends one short line per visual: `plot`, `numberline`, `geo`, `table`, `chart`, `flow` or `diagram` (circuit, lens, mirror, free-body, atom, cell, apparatus), plus `scene`, `focus` and `column` to structure the board. Fields are listed in [CANVAS_ENGINE.md](CANVAS_ENGINE.md#layer-1-board-protocol-v2).
- The browser compiles each one in `src/features/canvas/engine/compile/` into `path`, `label` and `dot` primitives, plus v1 shapes, which the pencil animates. The libraries:
  - **mathjs** for expressions. It loads as its own chunk, and each expression's AST is checked against a whitelist before it is compiled.
  - **d3-scale** and **d3-shape** for axes, ticks and pie angles.
  - **dagre** for flowchart layout.
  - Small helpers for geometry angles, the lens and mirror formulas, and Bohr shells.
- **Placement:**
  - Visuals without `at` stack down the stage (x 920–1540).
  - Writes stay in their column, shrinking and then wrapping at spaces.
  - `scene` keeps the page as a thumbnail in the page strip and starts a new one.
  - `focus` zooms the board, at most 2.5×.
- A dev-only gallery at `/dev/canvas` draws one sample of every visual.

**Doubts are board sessions.**
- Each turn is a `board_events` row: the first question, then follow-ups or "explain another way". Migration 0005 moved every existing doubt in as a single-turn session; it is reversible, and a downgrade keeps the first turn.
- Replays flatten the turns, with a page break before each follow-up unless the model started one.
- A follow-up sends a board summary of at most 800 characters, built without an AI call, in place of the full history.
- An identical doubt asked by a student with the same profile is copied from an earlier v2 board with no model call. The match is on the normalised question plus subject, class, board, level and language.

**Token use.**
- The system prompt is a shared core plus only the modules a subject needs. Maths is 4.9k characters against 8.9k for v1, and the model is told never to compute what the board can.
- `python -m app.cli board-eval --label v2 --out evals/board-v2.json --compare evals/board-v1.json` runs 8 sample doubts (2 each of maths, physics, chemistry and biology), reports the tokens, and fails if the median output grows.

| Sample doubts (median) | v1 | v2 |
| --- | --- | --- |
| Output tokens | 1,494.5 | 593 (−60%) |
| Actions | 33.5 | 17.5 |
| Dropped lines | 0 | 0 |

### Streaming

`POST /api/v1/student/doubts` returns server-sent events. The same events come from `POST …/doubts/{id}/turns`, and a board served from the cache streams them at once with no `status` event:

```
event: doubt   data: {id, question, subject, status, created_at}
event: status  data: {state: "thinking"}
event: action  data: {...one validated action...}        (repeated)
event: done    data: {id, count}            or   event: error  data: {message}
: ping                                       (every 15 s while Claude is thinking)
```

- The response sets `X-Accel-Buffering: no`, so Nginx forwards each event as soon as it is written.
- The actions drawn so far are saved in a `finally` block, so a disconnect or a bridge failure still leaves a replayable (`failed`) board.
- The frontend reads the stream with `fetch` and `src/utils/sse.js`, not `EventSource`, because it needs a POST body and a 401 → refresh → retry.

### Frontend player

`src/features/canvas/engine/BoardPlayer.js` draws on two stacked canvases:

| Layer | What it holds |
| --- | --- |
| **ink** | Everything committed so far. |
| **overlay** | The glyph or stroke being drawn right now, plus the pencil or duster. It is cleared every frame. |
| CSS background | The paper grid in light mode, a chalkboard in dark mode. Erasing ink reveals the board underneath. |

How the player animates:
- Text is laid out glyph by glyph in the Kalam handwriting font, which has Devanagari, and revealed with a moving clip at handwriting speed.
- Shapes get a seeded hand-drawn wobble, so a replay looks identical.
- Captions are gated. Each stays on screen for at least `max(1.6 s, 45 ms × chars)`, and with narration on, until it has been spoken.
- Resizing or changing the theme redraws the committed actions.
- `prefers-reduced-motion` draws each step instantly.

### 2D animation

Explanations of motion (gravity, orbits, pendulums, projectiles, waves) can include moving pictures. These live on a third canvas, the **scene**, which sits between the ink and the pencil overlay and is redrawn every frame.

- **Pictures** (`engine/sprites.js`): built-in vector sprites (apple, ball, stone, earth, moon, sun, planet, star, rocket, car, block, drop, cloud, feather). They look the same on every device, with no emoji font needed. Circles and rectangles are traced by the pencil; other pictures pop in.
- **Motions** (`engine/motion.js`) are pure functions of time:
  - `fall`: ½gt², with bouncing hops of decreasing height;
  - `projectile`: x = x₀ + vₓt, y = y₀ + v_yt + ½gt², until it lands;
  - `orbit`: around a point, or around an object that is itself moving;
  - `swing`: a pendulum, θ = A·cos(2πt/T);
  - `move`, `path`, `oscillate`, `spin`, `pulse`.

  The vertical stage is 900 units, so gravity is exaggerated to 1400 units/s² to make a fall read clearly.
- **Objects** (`engine/scene.js`): an arrow can `follow` an object and point `toward` another, which shows forces such as gravity pulling the Moon. `trail` leaves a dotted path of about one orbit.
- **Timing:**
  - Motions run on the board clock, so pause and 1×/1.5×/2× speed apply to them too.
  - A one-shot motion holds the board until it ends (up to 15 s).
  - A `loop` keeps going while the explanation continues, and after **Done**.
  - Replaying or clearing the board removes every object.

### Narration

Captions are read aloud in English or Hindi. The student picks a voice from the board's **Voice** menu, and the choice is remembered on that device.

| Voice | Language | Provider |
| ----- | -------- | -------- |
| **Neerja** (female), **Prabhat** (male) | English | Microsoft's neural `en-IN` voices through edge-tts |
| **Ishita** (female), **Shubh** (male) | Hindi | [Sarvam AI](https://docs.sarvam.ai) Bulbul (`bulbul:v3`, `hi-IN`) |

**Hindi voices (Sarvam AI).**
- They need `SARVAM_API_KEY` in `backend/.env`, which git ignores. Don't put it in `backend/.env.example`: Compose loads that file into the containers, and an empty value there would override the real key.
- Captions for Hindi students are Hinglish in English letters, and Bulbul reads romanised text poorly. So `tts_service._speak_hindi()` first sends the caption to Sarvam's `/transliterate` (`en-IN` → `hi-IN`) and passes the Devanagari to `/text-to-speech`. Only the copy sent for speech changes; the caption on screen stays in English letters. Text already in Devanagari skips this step.
- If transliteration fails, the caption is spoken as written. If speech fails or the key is missing, the endpoint returns 503 and the browser's Hindi voice takes over.
- The client is `app/services/sarvam.py` (httpx, 20 s timeout). Model and pace come from `SARVAM_TTS_MODEL` (default `bulbul:v3`) and `SARVAM_TTS_PACE` (default 0.95).

- `app/services/tts_service.py` generates English audio with [edge-tts](https://github.com/rany2/edge-tts). It needs internet but no API key, at a slightly slow `-5%` rate. All audio is cached in Redis for 7 days under `tts:<sha256(voice|style|text)>`, where style is the edge-tts rate or the Sarvam model and pace, so a replay is instant and costs nothing.
- `engine/narrator.js` requests audio for each caption as it streams in, at most 2 at a time. Each caption is therefore ready by the time it appears. It plays through an `<audio>` element, which keeps up with the board's 1×/1.5×/2× speed, pause and stop.
- Before sending a caption, `speakableText()` rewrites the maths the way a teacher reads it, for example `(x+y)^2 = x^2 + 2xy` becomes "x plus y whole squared equals x squared plus 2 x y".
- If the voice service fails, the narrator falls back to the browser's best built-in voice (a Hindi one for the Hindi voices) and retries the server after a minute.
- `edge-tts` uses the service behind Microsoft Edge's *Read aloud* feature, without an official agreement. For a production deployment, swap `tts_service._generate()` for a licensed TTS API such as Azure Speech.

## Security Considerations

- Passwords are hashed with Argon2id (`pwdlib`). Login compares against a dummy hash for unknown emails, so timing doesn't reveal which accounts exist.
- Uploaded images are decoded and re-encoded with Pillow (format allow-list, pixel cap, metadata stripped), so only real images are ever served
- Validation errors return the standard envelope: `{"success": false, "message": ..., "data": {"errors": [{"field", "message"}]}}`
- The global exception handler returns generic errors to clients
- API docs (`/docs`, `/redoc`) are disabled in production
- In production, settings refuse to start without a 32+ character `SECRET_KEY` and `COOKIE_SECURE=true`
- Docker production images run as a non-root user
- No secrets are hardcoded; everything comes from environment variables
