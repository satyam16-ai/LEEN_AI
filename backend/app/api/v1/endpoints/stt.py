# =============================================================================
# Voice Input Endpoint — /api/v1/stt (Hindi speech to text through Sarvam AI).
# English speech is recognised in the browser; Hindi recordings come here so the
# Sarvam key stays on the server.
# =============================================================================

import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.v1.dependencies.auth import get_current_user
from app.core import rate_limit
from app.models.user import User
from app.schemas.response import ok
from app.services import sarvam

router = APIRouter()
logger = logging.getLogger("leen_ai")

MAX_AUDIO_BYTES = 1024 * 1024
AUDIO_TYPES = ("audio/webm", "audio/ogg", "audio/wav", "audio/mpeg", "audio/mp4")
UNAVAILABLE = "Voice input is unavailable right now."


def _limited_user(user: User = Depends(get_current_user)) -> User:
    rate_limit.enforce(f"stt:{user.id}", 120, 3600)
    return user


@router.post("")
async def transcribe(file: UploadFile = File(...), user: User = Depends(_limited_user)):
    """The text of a short Hindi recording (a few seconds of webm, ogg, wav, mp3 or mp4)."""
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in AUDIO_TYPES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Send a short audio recording.")
    # Read one byte past the limit so oversized uploads are detected without buffering them.
    audio = await file.read(MAX_AUDIO_BYTES + 1)
    if not audio or len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The recording is too long.")
    try:
        text = await sarvam.speech_to_text(audio, file.filename or "speech", content_type)
    except sarvam.SarvamError as error:
        logger.warning("Voice input failed: %r", error)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, UNAVAILABLE) from error
    return ok({"text": text})
