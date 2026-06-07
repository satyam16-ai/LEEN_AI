# 🎓 AI Personal Teacher System

> An AI-powered personalized education platform for students, parents, and educators.

---

## Tech Stack

| Layer          | Technology                           |
| -------------- | ------------------------------------ |
| Frontend       | React, Vite, TailwindCSS, React Router |
| Backend        | FastAPI, Python 3.12+                |
| Database       | PostgreSQL 16, SQLAlchemy, Alembic   |
| Cache          | Redis 7                             |
| Proxy          | Nginx (reverse proxy)               |
| Infrastructure | Docker, Docker Compose              |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm
- Python 3.12+
- Docker & Docker Compose

### Option 1: Docker (Recommended)

```bash
# Clone & start everything
cp .env.example .env
docker compose up
```

Everything is served through **Nginx** on a single port:

- App → http://localhost
- API → http://localhost/api/v1/health
- API Docs → http://localhost/docs

### Option 2: Local Development

```bash
# Run the setup script
./infrastructure/scripts/setup.sh

# Terminal 1 — Frontend
cd frontend && pnpm dev

# Terminal 2 — Backend
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload

# Terminal 3 — Database & Cache
docker compose up postgres redis
```

## Project Structure

```
├── frontend/          React + Vite application
├── backend/           FastAPI application
│   └── app/
│       ├── api/v1/    Versioned API endpoints
│       ├── config/    App configuration
│       ├── core/      Exception handlers, logging
│       ├── database/  SQLAlchemy session & engine
│       ├── models/    SQLAlchemy models
│       ├── schemas/   Pydantic schemas
│       ├── services/  Business logic & integrations
│       └── middlewares/
├── docs/              Project documentation
└── infrastructure/    Docker, Nginx, scripts
```

## Documentation

- [Setup Guide](docs/setup/SETUP.md)
- [Architecture](docs/architecture/ARCHITECTURE.md)
- [Project Structure](docs/architecture/PROJECT_STRUCTURE.md)
- [Deployment Guide](docs/setup/DEPLOYMENT.md)
- [Contributing](docs/standards/CONTRIBUTING.md)
- [Development Guide](docs/standards/DEVELOPMENT_GUIDE.md)
- [Coding Standards](docs/standards/CODING_STANDARDS.md)

## License

Private — All rights reserved.
