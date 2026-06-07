#!/usr/bin/env bash
# =============================================================================
# Database reset script — drops and recreates the database
# =============================================================================
set -euo pipefail

echo "⚠️  This will DROP and RECREATE the database. Press Ctrl+C to cancel."
read -r -p "Continue? [y/N] " response
if [[ ! "$response" =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR/backend"

echo "Resetting database..."

# Run in Docker if available
if docker compose ps postgres 2>/dev/null | grep -q "running"; then
  docker compose exec postgres psql -U leen -c "DROP DATABASE IF EXISTS leen_ai;"
  docker compose exec postgres psql -U leen -c "CREATE DATABASE leen_ai;"
  echo "Database recreated via Docker."
else
  echo "PostgreSQL Docker container not running. Please start it first:"
  echo "  docker compose up postgres -d"
  exit 1
fi

# Run migrations
if [ -d ".venv" ]; then
  source .venv/bin/activate
fi

alembic upgrade head
echo "Migrations applied. Database is ready."
