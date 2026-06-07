# Development Guide

## Daily Development Workflow

### 1. Start Your Environment

**Docker (recommended):**
```bash
docker compose up
```

**Local:**
```bash
# Terminal 1 — Database & Cache
docker compose up postgres redis -d

# Terminal 2 — Backend
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 3 — Frontend
cd frontend && pnpm dev
```

### 2. Create a Feature Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

### 3. Develop

- Write code following the [Coding Standards](CODING_STANDARDS.md)
- Test your changes locally
- Commit frequently with [conventional commits](CONTRIBUTING.md#commit-convention)

### 4. Submit for Review

```bash
git push origin feature/your-feature-name
# Open a PR targeting the `develop` branch
```

---

## Adding a New API Endpoint

### Step 1: Create the endpoint

```python
# backend/app/api/v1/endpoints/courses.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def list_courses():
    return {"data": []}
```

### Step 2: Register in the v1 router

```python
# backend/app/api/v1/router.py
from app.api.v1.endpoints import courses

router.include_router(courses.router, prefix="/courses", tags=["Courses"])
```

### Step 3: Add model and migration (if needed)

```bash
cd backend
alembic revision --autogenerate -m "add courses table"
alembic upgrade head
```

---

## Adding a New Frontend Page

### Step 1: Create the page component

```jsx
// frontend/src/pages/CoursesPage.jsx
export function CoursesPage() {
  return (
    <div className="pt-24 px-4">
      <h1 className="text-3xl font-bold text-white">Courses</h1>
    </div>
  );
}
```

### Step 2: Export from pages index

```javascript
// frontend/src/pages/index.js
export { CoursesPage } from './CoursesPage';
```

### Step 3: Add route

```jsx
// frontend/src/routes/index.jsx
import { CoursesPage } from '@/pages';

// Inside the children array:
{ path: 'courses', element: <CoursesPage /> },
```

---

## Adding a New API Version

When breaking changes are needed:

### Step 1: Create v2 directory

```bash
mkdir -p backend/app/api/v2/{endpoints,dependencies}
touch backend/app/api/v2/__init__.py
touch backend/app/api/v2/endpoints/__init__.py
touch backend/app/api/v2/dependencies/__init__.py
```

### Step 2: Create v2 router

```python
# backend/app/api/v2/router.py
from fastapi import APIRouter
router = APIRouter()
# Register v2 endpoints here
```

### Step 3: Register in main app

```python
# backend/app/main.py
from app.api.v2.router import router as v2_router
app.include_router(v2_router, prefix="/api/v2")
```

### Step 4: Update settings

```python
# backend/app/config/settings.py
api_v2_prefix: str = "/api/v2"
```

---

## Database Migrations

```bash
cd backend

# Create a new migration
alembic revision --autogenerate -m "describe your change"

# Apply all pending migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# View migration history
alembic history

# Reset database (development only)
../infrastructure/scripts/reset-db.sh
```

---

## Useful Commands

### Frontend

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm preview      # Preview production build
pnpm lint         # Run ESLint
```

### Backend

```bash
uvicorn app.main:app --reload    # Start with auto-reload
ruff check .                     # Lint
ruff format .                    # Format
pytest                           # Run tests
```

### Docker

```bash
docker compose up               # Start all services
docker compose up -d             # Start in background
docker compose down              # Stop all services
docker compose logs -f api       # Tail API logs
docker compose exec api bash     # Shell into API container
docker compose up --build        # Rebuild images
```
