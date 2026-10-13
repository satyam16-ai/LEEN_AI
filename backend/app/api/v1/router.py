# =============================================================================
# V1 API Router — Aggregates all v1 endpoints
# =============================================================================

from fastapi import APIRouter, Depends

from app.api.v1.dependencies.auth import require_csrf_header
from app.api.v1.endpoints import (
    admin_users,
    auth,
    health,
    parent,
    profile,
    student,
    teacher,
    tts,
)

# The CSRF check only applies to state-changing methods, so it is safe router-wide.
router = APIRouter(dependencies=[Depends(require_csrf_header)])

router.include_router(health.router, tags=["Health"])
router.include_router(auth.router, prefix="/auth", tags=["Auth"])
router.include_router(profile.router, prefix="/profile", tags=["Profile"])
router.include_router(student.router, prefix="/student", tags=["Student"])
router.include_router(parent.router, prefix="/parent", tags=["Parent"])
router.include_router(teacher.router, prefix="/teacher", tags=["Teacher"])
router.include_router(admin_users.router, prefix="/admin/users", tags=["Admin · Users"])
router.include_router(tts.router, prefix="/tts", tags=["Narration"])
