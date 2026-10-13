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

Protect new endpoints with `Depends(get_current_user)` or `Depends(require_roles(UserRole.TEACHER, ...))` from `app/api/v1/dependencies/auth.py`.

### Rate limits (Redis, fixed window, fail-open)

| Action          | Limit                                        |
| --------------- | -------------------------------------------- |
| Login           | 5 / min per IP + email                       |
| Register        | 10 / hour per IP                             |
| Forgot password | 3 / 15 min per email, 10 / 15 min per IP     |
| Redeem parent link code | 10 / 15 min per parent               |
| Join class      | 10 / 15 min per student                      |

Over the limit returns `429` with a `Retry-After` header.

## Security Considerations

- Passwords are hashed with Argon2id (`pwdlib`). Login compares against a dummy hash for unknown emails, so timing doesn't reveal which accounts exist.
- Uploaded images are decoded and re-encoded with Pillow (format allow-list, pixel cap, metadata stripped), so only real images are ever served
- Validation errors return the standard envelope: `{"success": false, "message": ..., "data": {"errors": [{"field", "message"}]}}`
- The global exception handler returns generic errors to clients
- API docs (`/docs`, `/redoc`) are disabled in production
- In production, settings refuse to start without a 32+ character `SECRET_KEY` and `COOKIE_SECURE=true`
- Docker production images run as a non-root user
- No secrets are hardcoded; everything comes from environment variables
