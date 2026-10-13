# =============================================================================
# Parent Endpoints — /api/v1/parent (linked children)
# =============================================================================

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies.auth import require_roles
from app.core import rate_limit
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.family import CodeRequest
from app.schemas.response import ok
from app.services import family_service

router = APIRouter()
current_parent = require_roles(UserRole.PARENT)


@router.get("/children")
def list_children(parent: User = Depends(current_parent), db: Session = Depends(get_db)):
    return ok(family_service.list_children(db, parent))


@router.post("/children", status_code=status.HTTP_201_CREATED)
def link_child(
    payload: CodeRequest, parent: User = Depends(current_parent), db: Session = Depends(get_db)
):
    # Link codes are short; cap guesses per parent.
    rate_limit.enforce(f"link-redeem:{parent.id}", 10, 900)
    child = family_service.redeem_link_code(db, parent, payload.code)
    return ok(child, f"{child.name} is now linked to your account")


@router.delete("/children/{student_id}")
def unlink_child(
    student_id: str, parent: User = Depends(current_parent), db: Session = Depends(get_db)
):
    family_service.unlink(db, parent.id, student_id)
    return ok(message="Child unlinked")
