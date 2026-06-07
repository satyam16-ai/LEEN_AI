# Setup Guide

## Prerequisites

| Tool             | Version  | Install                             |
| ---------------- | -------- | ----------------------------------- |
| Node.js          | 20+      | https://nodejs.org                  |
| pnpm             | 9+       | `npm install -g pnpm`               |
| Python           | 3.12+    | https://python.org                  |
| Docker           | 24+      | https://docs.docker.com/get-docker/ |
| Docker Compose   | 2.20+    | Included with Docker Desktop        |

---

## Automated Setup

Run the setup script to install everything at once:

```bash
./infrastructure/scripts/setup.sh
```

This will:
1. Check prerequisites
2. Copy `.env.example` → `.env` for all services
3. Install frontend dependencies (pnpm)
4. Create Python virtual environment and install backend dependencies

---

## Manual Setup

### 1. Environment Variables

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Edit the `.env` files as needed. See [Environment Variables](#environment-variables) below.

### 2. Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Frontend will be available at **http://localhost:3000**.

### 3. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate       # Linux/macOS
# .venv\Scripts\activate        # Windows

pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload
```

Backend will be available at **http://localhost:8000**.

### 4. Database & Redis (via Docker)

```bash
docker compose up postgres redis -d
```

### 5. Database Migrations

```bash
cd backend
alembic upgrade head
```

---

## Docker Development

Start the entire stack with a single command:

```bash
docker compose up
```

| Service    | URL                                   |
| ---------- | ------------------------------------- |
| Frontend   | http://localhost:3000                  |
| Backend    | http://localhost:8000                  |
| API Docs   | http://localhost:8000/docs             |
| Health     | http://localhost:8000/api/v1/health    |
| PostgreSQL | localhost:5432                         |
| Redis      | localhost:6379                         |

### Useful Docker Commands

```bash
# Start in background
docker compose up -d

# View logs
docker compose logs -f api
docker compose logs -f web

# Rebuild after dependency changes
docker compose up --build

# Stop everything
docker compose down

# Stop and remove volumes (reset data)
docker compose down -v
```

---

## Environment Variables

### Root `.env`

| Variable            | Description                  | Default                |
| ------------------- | ---------------------------- | ---------------------- |
| `APP_NAME`          | Application name             | ai-personal-teacher    |
| `APP_ENV`           | Environment                  | development            |
| `APP_PORT`          | Backend port                 | 8000                   |
| `DATABASE_URL`      | PostgreSQL connection string | (see .env.example)     |
| `POSTGRES_DB`       | Database name                | leen_ai                |
| `POSTGRES_USER`     | Database user                | leen                   |
| `POSTGRES_PASSWORD` | Database password            | leen_dev_password      |
| `REDIS_HOST`        | Redis host                   | localhost              |
| `REDIS_PORT`        | Redis port                   | 6379                   |

### Frontend `.env`

| Variable        | Description   | Default                          |
| --------------- | ------------- | -------------------------------- |
| `VITE_API_URL`  | Backend API URL | http://localhost:8000/api/v1   |

---

## Troubleshooting

### Port already in use

```bash
# Find process on port 3000
lsof -i :3000
kill -9 <PID>
```

### Docker containers won't start

```bash
# Reset everything
docker compose down -v
docker compose up --build
```

### Database connection refused

Ensure PostgreSQL is running:
```bash
docker compose up postgres -d
docker compose exec postgres pg_isready -U leen
```

### Python virtual environment issues

```bash
cd backend
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
