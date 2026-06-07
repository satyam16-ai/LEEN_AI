# Project Structure

> Complete folder-by-folder breakdown of the AI Personal Teacher System monorepo.

```
leen_ai/
│
├── frontend/                          React + Vite application
│   ├── public/                        Static assets (served as-is)
│   ├── src/
│   │   ├── assets/                    Images, fonts, static files
│   │   │   ├── images/
│   │   │   └── fonts/
│   │   ├── components/                Reusable UI components
│   │   │   ├── layout/                Layout components (Navbar, Footer)
│   │   │   └── ui/                    Generic UI components (buttons, cards)
│   │   ├── hooks/                     Custom React hooks
│   │   ├── layouts/                   Page layout wrappers (RootLayout)
│   │   ├── pages/                     Route-level page components
│   │   │   ├── LandingPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   └── DashboardPage.jsx
│   │   ├── routes/                    React Router configuration
│   │   ├── services/                  API client (Axios instance)
│   │   ├── store/                     State management (React Query provider)
│   │   ├── utils/                     Helper/utility functions
│   │   ├── App.jsx                    Root application component
│   │   ├── main.jsx                   Entry point (renders App into DOM)
│   │   └── index.css                  Global styles + TailwindCSS
│   ├── index.html                     HTML entry point
│   ├── vite.config.js                 Vite configuration
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
│   │   │       │   ├── __init__.py
│   │   │       │   └── health.py      GET /api/v1/health
│   │   │       └── dependencies/      Request-scoped dependencies
│   │   │           └── __init__.py
│   │   ├── config/                    Application configuration
│   │   │   ├── __init__.py
│   │   │   └── settings.py           Pydantic settings from env
│   │   ├── core/                      Core utilities
│   │   │   ├── __init__.py
│   │   │   ├── exceptions.py         Global exception handlers
│   │   │   └── logging.py            Structured logging setup
│   │   ├── database/                  Database layer
│   │   │   ├── __init__.py
│   │   │   └── session.py            SQLAlchemy engine & session
│   │   ├── middlewares/               Request/response middleware
│   │   │   ├── __init__.py
│   │   │   ├── logging.py            Request logging middleware
│   │   │   └── request_id.py         Request ID middleware
│   │   ├── models/                    SQLAlchemy ORM models
│   │   │   ├── __init__.py
│   │   │   └── user.py               User model + Role enum
│   │   ├── schemas/                   Pydantic schemas
│   │   │   ├── __init__.py
│   │   │   └── response.py           Standardized response schemas
│   │   ├── services/                  Business logic layer
│   │   │   ├── __init__.py
│   │   │   └── redis_service.py       Redis connection wrapper
│   │   ├── repositories/             Data access layer (future)
│   │   │   └── __init__.py
│   │   ├── utils/                     Helper utilities
│   │   │   └── __init__.py
│   │   ├── __init__.py
│   │   └── main.py                   FastAPI app factory
│   ├── alembic/                       Database migrations
│   │   ├── versions/                  Migration files
│   │   ├── env.py                    Migration environment
│   │   └── script.py.mako            Migration template
│   ├── tests/                         Test suite
│   │   └── __init__.py
│   ├── alembic.ini                   Alembic configuration
│   ├── pyproject.toml                Python project config
│   ├── requirements.txt              Production dependencies
│   ├── requirements-dev.txt          Development dependencies
│   └── .env.example
│
├── docs/                              Project documentation
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
1. Create page in `frontend/src/pages/`
2. Add route in `frontend/src/routes/index.jsx`
3. Create components in `frontend/src/components/`
4. Add API calls in `frontend/src/services/`

### Backend
1. Create model in `backend/app/models/`
2. Create schema in `backend/app/schemas/`
3. Create endpoint in `backend/app/api/v1/endpoints/`
4. Register in `backend/app/api/v1/router.py`
5. Generate migration: `alembic revision --autogenerate -m "add X"`
