#!/usr/bin/env bash
# =============================================================================
# First-time project setup script
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# ---- Check prerequisites ----
info "Checking prerequisites..."

command -v node  >/dev/null 2>&1 || error "Node.js is required. Install from https://nodejs.org"
command -v pnpm  >/dev/null 2>&1 || error "pnpm is required. Run: npm install -g pnpm"
command -v python3 >/dev/null 2>&1 || error "Python 3.12+ is required. Install from https://python.org"

info "Node.js  $(node --version)"
info "pnpm     $(pnpm --version)"
info "Python   $(python3 --version)"

# ---- Environment files ----
info "Setting up environment files..."

if [ ! -f "$ROOT_DIR/.env" ]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  info "Created .env from .env.example"
fi

if [ ! -f "$ROOT_DIR/backend/.env" ]; then
  cp "$ROOT_DIR/backend/.env.example" "$ROOT_DIR/backend/.env"
  info "Created backend/.env from .env.example"
fi

if [ ! -f "$ROOT_DIR/frontend/.env" ]; then
  cp "$ROOT_DIR/frontend/.env.example" "$ROOT_DIR/frontend/.env"
  info "Created frontend/.env from .env.example"
fi

# ---- Frontend dependencies ----
info "Installing frontend dependencies..."
cd "$ROOT_DIR/frontend"
pnpm install

# ---- Backend dependencies ----
info "Installing backend dependencies..."
cd "$ROOT_DIR/backend"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt

info ""
info "============================================"
info "  Setup complete! Next steps:"
info ""
info "  Local development:"
info "    Frontend: cd frontend && pnpm dev"
info "    Backend:  cd backend && source .venv/bin/activate && uvicorn app.main:app --reload"
info ""
info "  Docker development:"
info "    docker compose up"
info "============================================"
