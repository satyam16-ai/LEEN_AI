# =============================================================================
# V1 API Router — Aggregates all v1 endpoints
# =============================================================================

from fastapi import APIRouter

from app.api.v1.endpoints import health

router = APIRouter()

# Register all v1 endpoint routers here
router.include_router(health.router, tags=["Health"])

# Future v1 endpoints:
# router.include_router(users.router, prefix="/users", tags=["Users"])
# router.include_router(courses.router, prefix="/courses", tags=["Courses"])
