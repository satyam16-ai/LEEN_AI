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

Frontend will be available at **http://localhost:3000**. Vite proxies `/api` to `http://localhost:8000`, so auth cookies stay same-origin. Override the target with `API_PROXY_TARGET`.

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

### 6. Create the first admin

```bash
cd backend
python -m app.cli create-admin --email admin@leen.dev --name "Site Admin"
# prompts for a password (8+ chars, at least one letter and one number)
```

Students and parents sign up from `/register`. Teachers are created by an admin under **Users → Add user**.

---

## Docker Development

Start the entire stack with a single command:

```bash
docker compose up -d
docker compose exec api python -m app.cli create-admin --email admin@leen.dev --name "Site Admin"
```

Migrations run automatically when the `api` container starts.

| Service        | URL                                   | Description |
| -------------- | ------------------------------------- | ----------- |
| Frontend       | http://localhost:8081                 | Served via Nginx reverse proxy |
| Backend API    | http://localhost:8081/api/v1          | Proxied via Nginx |
| API Docs       | http://localhost:8081/docs            | Swagger UI docs |
| Health Endpoint| http://localhost:8081/api/v1/health   | Health status |
| Mailpit        | http://localhost:8025                 | Dev inbox: password reset emails land here |
| Celery Worker  | N/A (runs tasks in background)        | Sends emails (queue `default`) |
| PostgreSQL     | localhost:5432                        | Database port mapping |
| Redis          | localhost:6379                        | Cache, rate limits, Celery broker |

### Running tests

```bash
docker compose exec api pytest -q          # backend (uses a separate leen_ai_test database)
docker compose exec api ruff check app tests
cd frontend && pnpm test && pnpm lint      # frontend (Vitest + ESLint)
```


### Useful Docker Commands

```bash
# Start in background
docker compose up -d

# View logs
docker compose logs -f api
docker compose logs -f web

# Rebuild after dependency changes (-V recreates the web container's node_modules volume)
docker compose up -d --build -V

# If Nginx returns 502 after the api/web containers were recreated
docker compose restart nginx

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

### Backend auth & email (`backend/.env`)

| Variable                   | Description                                         | Default                 |
| -------------------------- | --------------------------------------------------- | ----------------------- |
| `SECRET_KEY`               | JWT signing key: **set a random 32+ char value in production** | dev placeholder |
| `ACCESS_TOKEN_TTL_MINUTES` | Access token lifetime                               | 15                      |
| `REFRESH_TOKEN_TTL_DAYS`   | "Remember me" session lifetime                      | 30                      |
| `REFRESH_TOKEN_SESSION_TTL_HOURS` | Session lifetime without "remember me"       | 24                      |
| `PASSWORD_RESET_TTL_MINUTES` | Reset link validity                               | 30                      |
| `COOKIE_SECURE`            | `true` when served over HTTPS (required in prod)    | false                   |
| `CORS_ORIGINS`             | Comma-separated allowed origins                     | http://localhost:3000   |
| `FRONTEND_URL`             | Base URL used in email links                        | http://localhost:8081   |
| `RATE_LIMIT_ENABLED`       | Redis-backed rate limiting                          | true                    |
| `SMTP_HOST` / `SMTP_PORT`  | SMTP server (Mailpit in dev)                        | localhost / 1025        |
| `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_USE_TLS` | SMTP auth for real providers  | empty / false           |
| `EMAIL_FROM`               | Sender address                                      | LEEN AI <no-reply@leen.ai> |
| `DB_ECHO`                  | Log every SQL statement                             | false                   |
| `MEDIA_ROOT`               | Where uploads (avatars) are stored                  | media                   |
| `MAX_AVATAR_BYTES`         | Avatar upload size limit                            | 2097152 (2 MB)          |
| `LINK_CODE_TTL_HOURS`      | How long a student's parent link code stays valid   | 48                      |

### Frontend `.env`

| Variable        | Description   | Default                          |
| --------------- | ------------- | -------------------------------- |
| `VITE_API_URL`  | Backend API base path. Keep it relative so cookies are same-origin. | /api/v1 |

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
