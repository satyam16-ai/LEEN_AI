# =============================================================================
# Profile Endpoints — /api/v1/profile (any signed-in user)
# =============================================================================

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.api.v1.dependencies.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.profile import ProfileUpdate
from app.schemas.response import ok
from app.services import profile_service

router = APIRouter()


@router.get("")
def get_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(profile_service.get_profile(db, user))


@router.patch("")
def update_profile(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ok(profile_service.update_profile(db, user, payload), "Profile updated")


@router.post("/avatar")
def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Read one byte past the limit so oversized uploads are detected without buffering them.
    data = file.file.read(settings.max_avatar_bytes + 1)
    return ok(profile_service.set_avatar(db, user, data), "Profile photo updated")


@router.delete("/avatar")
def delete_avatar(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(profile_service.remove_avatar(db, user), "Profile photo removed")
