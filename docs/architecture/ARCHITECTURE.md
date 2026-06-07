# Architecture

## Overview

The AI Personal Teacher System is a full-stack application with a clear separation between frontend and backend, connected via a versioned REST API.

```
┌─────────────────┐     ┌──────────────────────────┐
│   React + Vite  │────▶│  FastAPI (/api/v1/...)    │
│   Port 3000     │     │  Port 8000               │
└─────────────────┘     └────────┬─────────────────┘
                                 │
                      ┌──────────┴──────────┐
                      │                     │
                ┌─────▼─────┐       ┌───────▼──────┐
                │ PostgreSQL │       │    Redis     │
                │ Port 5432  │       │  Port 6379   │
                └────────────┘       └──────────────┘
```

---

## Frontend Architecture

**Technology:** React + Vite + TailwindCSS

```
frontend/src/
├── components/     Reusable UI components
│   ├── layout/     Navbar, Footer
│   └── ui/         Buttons, Cards, Inputs (future)
├── pages/          Route-level page components
├── layouts/        Page layout wrappers
├── hooks/          Custom React hooks
├── services/       API client (Axios)
├── store/          State management (React Query)
├── routes/         React Router configuration
├── types/          (reserved for future use)
├── utils/          Helper functions
└── assets/         Images, fonts
```

### Key Decisions

- **React Router** for client-side routing with a `RootLayout` wrapper
- **React Query** for server state management (caching, refetching)
- **Axios** with interceptors for API communication
- **TailwindCSS v4** with custom design tokens (oklch colors)

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
├── services/                Business logic & external integrations
├── repositories/            Data access layer (future)
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

**Technology:** PostgreSQL 16 + SQLAlchemy 2.0

### Current Schema

| Table   | Purpose                          |
| ------- | -------------------------------- |
| `users` | Foundation model for DB verification |

### Migration Strategy

- All schema changes go through Alembic migrations
- Auto-generate migrations: `alembic revision --autogenerate -m "description"`
- Apply migrations: `alembic upgrade head`
- Rollback: `alembic downgrade -1`

---

## Infrastructure

### Docker Compose Services

| Service    | Image              | Port | Purpose          |
| ---------- | ------------------ | ---- | ---------------- |
| `web`      | Custom (Vite)      | 3000 | Frontend dev     |
| `api`      | Custom (FastAPI)   | 8000 | Backend dev      |
| `worker`   | Custom (FastAPI)   | N/A  | Celery background tasks |
| `postgres` | postgres:16-alpine | 5432 | Database         |
| `redis`    | redis:7-alpine     | 6379 | Cache & Celery broker |


### Network

All services communicate over the `leen-network` bridge network. The backend connects to `postgres:5432` and `redis:6379` using Docker service names.

---

## Security Considerations

- CORS restricted to `localhost:3000` in development
- Global exception handler returns generic errors to clients
- API docs (`/docs`, `/redoc`) disabled in production
- Docker production images run as non-root user
- No secrets hardcoded — all via environment variables
- TODO(security): Authentication, CSRF, rate limiting to be implemented
