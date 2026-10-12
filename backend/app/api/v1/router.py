# =============================================================================
# V1 API Router — Aggregates all v1 endpoints
# =============================================================================

from fastapi import APIRouter, Depends

from app.api.v1.dependencies.auth import require_csrf_header
from app.api.v1.endpoints import admin_users, auth, health

router = APIRouter()

router.include_router(health.router, tags=["Health"])
router.include_router(
    auth.router, prefix="/auth", tags=["Auth"], dependencies=[Depends(require_csrf_header)]
)
router.include_router(
    admin_users.router,
    prefix="/admin/users",
    tags=["Admin · Users"],
    dependencies=[Depends(require_csrf_header)],
)
