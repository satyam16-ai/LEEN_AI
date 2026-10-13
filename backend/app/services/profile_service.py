# =============================================================================
# Profile Service — name, learning profile, avatar
# =============================================================================

import io
import logging
import uuid
from pathlib import Path

from fastapi import HTTPException, status
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User, UserRole
from app.repositories import profile_repository
from app.schemas.profile import STUDENT_FIELDS, ProfileOut, ProfileUpdate, StudentProfileOut
from app.schemas.user import UserOut

logger = logging.getLogger("leen_ai")

AVATAR_SIZE = 256
ALLOWED_IMAGE_FORMATS = {"PNG", "JPEG", "WEBP"}
MAX_IMAGE_PIXELS = 40_000_000
INVALID_IMAGE = "Upload a PNG, JPG or WebP image."

EMPTY_STUDENT_PROFILE = StudentProfileOut(
    grade=None,
    board=None,
    school_name=None,
    subjects=[],
    learning_level=None,
    preferred_language="en",
    is_complete=False,
)


def avatar_dir() -> Path:
    return Path(settings.media_root) / "avatars"


def get_profile(db: Session, user: User) -> ProfileOut:
    student_profile = None
    if user.role == UserRole.STUDENT:
        record = profile_repository.get(db, user.id)
        student_profile = (
            StudentProfileOut.model_validate(record) if record else EMPTY_STUDENT_PROFILE
        )
    return ProfileOut(user=UserOut.model_validate(user), student_profile=student_profile)


def update_profile(db: Session, user: User, payload: ProfileUpdate) -> ProfileOut:
    fields = payload.model_fields_set
    student_fields = fields & STUDENT_FIELDS
    if student_fields and user.role != UserRole.STUDENT:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Learning profile fields are only available to students"
        )

    if "name" in fields:
        if payload.name is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Name can't be empty")
        user.name = payload.name

    if student_fields:
        profile = profile_repository.get_or_create(db, user.id)
        for field in student_fields:
            value = getattr(payload, field)
            if field == "subjects":
                value = value or []
            elif field == "preferred_language":
                value = value or "en"
            elif field == "school_name":
                value = value or None
            setattr(profile, field, value)

    db.commit()
    db.refresh(user)
    return get_profile(db, user)


def _process_avatar(data: bytes) -> bytes:
    try:
        with Image.open(io.BytesIO(data)) as source:
            if source.format not in ALLOWED_IMAGE_FORMATS:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, INVALID_IMAGE)
            if source.width * source.height > MAX_IMAGE_PIXELS:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "That image is too large.")
            image = ImageOps.exif_transpose(source)
            has_alpha = image.mode in ("RGBA", "LA") or (
                image.mode == "P" and "transparency" in image.info
            )
            image = image.convert("RGBA" if has_alpha else "RGB")
            image = ImageOps.fit(image, (AVATAR_SIZE, AVATAR_SIZE), Image.Resampling.LANCZOS)
            output = io.BytesIO()
            # Re-encoding strips metadata and guarantees we only ever serve a real image.
            image.save(output, format="WEBP", quality=85)
            return output.getvalue()
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, INVALID_IMAGE) from exc


def _delete_avatar_file(filename: str | None) -> None:
    if not filename:
        return
    try:
        (avatar_dir() / Path(filename).name).unlink(missing_ok=True)
    except OSError:
        logger.warning("Could not delete old avatar file")


def set_avatar(db: Session, user: User, data: bytes) -> UserOut:
    if len(data) > settings.max_avatar_bytes:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE, "Images must be 2 MB or smaller."
        )
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, INVALID_IMAGE)

    encoded = _process_avatar(data)
    filename = f"{uuid.uuid4().hex}.webp"
    directory = avatar_dir()
    directory.mkdir(parents=True, exist_ok=True)
    (directory / filename).write_bytes(encoded)

    previous = user.avatar_filename
    user.avatar_filename = filename
    db.commit()
    db.refresh(user)
    _delete_avatar_file(previous)
    return UserOut.model_validate(user)


def remove_avatar(db: Session, user: User) -> UserOut:
    previous = user.avatar_filename
    user.avatar_filename = None
    db.commit()
    db.refresh(user)
    _delete_avatar_file(previous)
    return UserOut.model_validate(user)
