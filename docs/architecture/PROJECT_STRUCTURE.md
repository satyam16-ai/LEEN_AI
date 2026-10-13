# Project Structure

> Complete folder-by-folder breakdown of the AI Personal Teacher System monorepo.

```
leen_ai/
│
├── frontend/                          React + Vite application (plain JS)
│   ├── public/                        favicon.svg, theme-init.js (applies theme before first paint)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                    Design-system primitives (Button, Input, FormField, Dialog, …)
│   │   │   ├── layout/                PublicNavbar, PublicFooter, AppSidebar, AppTopbar, UserMenu
│   │   │   ├── dashboard/             PageHeader, WelcomeBanner, StatCard, FeatureCard, ChecklistCard
│   │   │   └── landing/               Landing page sections
│   │   ├── features/
│   │   │   ├── auth/                  components/ (forms), guards/, hooks/, schemas.js, constants.js
│   │   │   ├── profile/               AvatarUploader, LearningProfileFields, OnboardingWizard, hooks/
│   │   │   ├── family/                LinkCodeCard, LinkedParentsList, LinkChildCard, ChildCard, hooks/
│   │   │   ├── classes/               ClassFormDialog, JoinCodePanel, RosterTable, JoinClassCard, hooks/
│   │   │   ├── whiteboard/            AI tutor: engine/ (BoardPlayer canvas player, maths text layout,
│   │   │   │                          hand-drawn strokes, pencil/duster, narrator, scene + motion
│   │   │   │                          + sprites for 2D animation), Whiteboard,
│   │   │   │                          NarrationMenu, DoubtComposer,
│   │   │   │                          StepsList, DoubtHistory, hooks/ (useDoubtSession streams SSE)
│   │   │   └── admin/                 UsersTable, CreateUserDialog, EditUserForm, hooks/, schemas.js
│   │   ├── pages/                     LandingPage, auth/, dashboard/, student/, parent/, teacher/,
│   │   │                              admin/, settings/ (layout + profile/security/appearance), errors/
│   │   ├── layouts/                   RootLayout, PublicLayout, AuthLayout, AppLayout
│   │   ├── routes/index.jsx           Router tree + guards
│   │   ├── services/                  api.js (Axios + refresh), auth/profile/family/classroom/adminUsers/doubt services
│   │   ├── store/                     queryClient, ThemeProvider
│   │   ├── config/navigation.js       Sidebar items per role ("Soon" items carry their phase)
│   │   ├── hooks/                     useTheme, useDocumentTitle, useDebouncedValue, useScrolled
│   │   ├── utils/                     cn, apiError, redirect, format, passwordStrength, sse (stream parser)
│   │   ├── test/                      Vitest setup + render helpers
│   │   ├── App.jsx                    Providers + session-expiry / cross-tab sync
│   │   ├── main.jsx                   Entry point (fonts, styles, App)
│   │   └── index.css                  Tailwind v4 + light/dark design tokens
│   ├── index.html
│   ├── vite.config.js                 Vite + Vitest config, /api proxy
│   ├── jsconfig.json                  `@/` alias for editors
│   ├── package.json
│   ├── pnpm-lock.yaml
│   └── .env.example
│
├── backend/                           FastAPI application
│   ├── app/
│   │   ├── api/                       API layer (versioned)
│   │   │   ├── __init__.py
│   │   │   └── v1/                    Version 1 API
│   │   │       ├── __init__.py
│   │   │       ├── router.py          V1 router aggregator
│   │   │       ├── endpoints/         Endpoint handlers
│   │   │       │   ├── health.py      GET /api/v1/health
│   │   │       │   ├── auth.py        /api/v1/auth/* (register, login, refresh, …)
│   │   │       │   ├── profile.py     /api/v1/profile (+ avatar)
│   │   │       │   ├── student.py     /api/v1/student (link code, parents, classes)
│   │   │       │   ├── parent.py      /api/v1/parent/children
│   │   │       │   ├── teacher.py     /api/v1/teacher/classes
│   │   │       │   └── admin_users.py /api/v1/admin/users (+ detail, edit, reset link)
│   │   │       └── dependencies/
│   │   │           └── auth.py        get_current_user, require_roles, CSRF check
│   │   ├── config/                    Application configuration
│   │   │   ├── __init__.py
│   │   │   └── settings.py           Pydantic settings from env
│   │   ├── core/                      Core utilities
│   │   │   ├── __init__.py
│   │   │   ├── exceptions.py         Global exception handlers (incl. 422 envelope)
│   │   │   ├── logging.py            Structured logging setup
│   │   │   ├── security.py           Password hashing, JWT, auth cookies
│   │   │   ├── rate_limit.py         Redis fixed-window limiter
│   │   │   ├── celery_app.py         Celery config (queue: default)
│   │   │   └── tasks.py              send_email_task (SMTP)
│   │   ├── database/                  Database layer
│   │   │   ├── __init__.py
│   │   │   └── session.py            SQLAlchemy engine & session
│   │   ├── middlewares/               Request/response middleware
│   │   │   ├── __init__.py
│   │   │   ├── logging.py            Request logging middleware
│   │   │   └── request_id.py         Request ID middleware
│   │   ├── models/                    SQLAlchemy ORM models
│   │   │   ├── __init__.py
│   │   │   ├── user.py               User model + Role enum
│   │   │   ├── auth_token.py         RefreshToken, PasswordResetToken
│   │   │   ├── profile.py            StudentProfile, ParentStudentLink
│   │   │   └── classroom.py          Classroom, ClassEnrollment
│   │   ├── schemas/                   Pydantic schemas
│   │   │   ├── __init__.py
│   │   │   ├── response.py           Response envelope + ok() helper
│   │   │   ├── auth.py               Auth request schemas
│   │   │   └── user.py               UserOut, admin schemas, password rules
│   │   ├── services/                  Business logic layer
│   │   │   ├── __init__.py
│   │   │   ├── redis_service.py       Redis connection wrapper
│   │   │   ├── auth_service.py        Registration, sessions, rotation, password flows
│   │   │   ├── profile_service.py     Profile updates, avatar processing
│   │   │   ├── family_service.py      Link codes, parent ↔ student links
│   │   │   ├── classroom_service.py   Classes, join codes, enrollments
│   │   │   ├── admin_user_service.py  User detail, edits, (de)activation
│   │   │   ├── whiteboard_service.py  Doubts: start, SSE stream of board actions, history
│   │   │   ├── tts_service.py         Neural narration audio (edge-tts) with Redis cache
│   │   │   ├── whiteboard/            prompt.py (system prompt), parser.py (NDJSON → validated actions)
│   │   │   └── llm/claude_bridge.py   Streams text from the Claude Code bridge
│   │   ├── repositories/             Data access layer
│   │   │   ├── user_repository.py
│   │   │   └── token_repository.py
│   │   ├── utils/                     Helper utilities
│   │   │   └── __init__.py
│   │   ├── cli.py                    `python -m app.cli create-admin`
│   │   └── main.py                   FastAPI app factory
│   ├── alembic/                       Database migrations
│   │   ├── versions/                  0001_auth_schema, 0002_profiles_and_classes
│   │   ├── env.py                    Migration environment
│   │   └── script.py.mako            Migration template
│   ├── tests/                         Pytest suite (real Postgres test DB)
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   └── test_admin_users.py
│   ├── alembic.ini                   Alembic configuration
│   ├── pyproject.toml                Python project config
│   ├── requirements.txt              Production dependencies
│   ├── requirements-dev.txt          Development dependencies
│   └── .env.example
│
├── docs/                              Project documentation
│   ├── ROADMAP.md                    Phased rebuild plan
│   ├── architecture/
│   │   ├── ARCHITECTURE.md           System architecture
│   │   └── PROJECT_STRUCTURE.md      This file
│   ├── setup/
│   │   └── SETUP.md                  Installation guide
│   └── standards/
│       ├── CONTRIBUTING.md           Contribution guidelines
│       ├── CODING_STANDARDS.md       Code conventions
│       └── DEVELOPMENT_GUIDE.md      Development workflow
│
├── infrastructure/                    DevOps & deployment
│   ├── docker/
│   │   ├── web.Dockerfile            Frontend Docker image
│   │   └── api.Dockerfile            Backend Docker image
│   ├── claude-bridge/                Runs on the host: exposes `claude -p` to the API (AI tutor)
│   └── scripts/
│       ├── setup.sh                  First-time setup
│       └── reset-db.sh              Database reset
│
├── .github/
│   └── workflows/
│       └── ci.yml                    CI pipeline
│
├── docker-compose.yml                 Development environment
├── .editorconfig                      Editor settings
├── .env.example                       Environment template
├── .gitignore
├── .prettierrc                        Code formatting
├── .prettierignore
└── README.md                          Project overview
```

## Adding New Features

### Frontend
1. Add API calls as a service in `frontend/src/services/` (use `apiClient` + `unwrap`)
2. Put feature logic (hooks, forms, schemas) in `frontend/src/features/<feature>/`
3. Create the page in `frontend/src/pages/` and export it from `pages/index.js`
4. Register the route in `frontend/src/routes/index.jsx` inside the right `RequireRole` block, with `handle: { title }`
5. Add or enable the sidebar entry in `frontend/src/config/navigation.js`

### Backend
1. Create model in `backend/app/models/`
2. Create schema in `backend/app/schemas/`
3. Create endpoint in `backend/app/api/v1/endpoints/` (plain `def`, protected with `require_roles(...)`)
4. Register in `backend/app/api/v1/router.py`
5. Generate migration: `alembic revision --autogenerate -m "add X"`
