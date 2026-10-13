# syntax=docker/dockerfile:1
# =============================================================================
# Backend Dockerfile — FastAPI + Python
# Migrations run on API start; the Celery worker overrides CMD and skips them.
# =============================================================================

FROM python:3.12-slim AS base
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=10

# ---- Development ----
FROM base AS development
COPY requirements.txt requirements-dev.txt ./
# Cache mount: rebuilds and retries reuse downloaded wheels instead of re-fetching everything.
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt -r requirements-dev.txt
COPY . .
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"]

# ---- Production ----
FROM base AS production
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt
COPY . .
RUN mkdir -p /app/media/avatars && chown -R appuser:appgroup /app/media
USER appuser
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4"]
