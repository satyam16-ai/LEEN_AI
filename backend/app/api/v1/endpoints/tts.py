# =============================================================================
# Narration Endpoint — /api/v1/tts (spoken captions for the whiteboard tutor)
# =============================================================================

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.v1.dependencies.auth import get_current_user
from app.core import rate_limit
from app.models.user import User
from app.services import tts_service

router = APIRouter()

Voice = Literal["neerja", "prabhat", "ishita", "shubh"]


def _limited_user(user: User = Depends(get_current_user)) -> User:
    rate_limit.enforce(f"tts:{user.id}", 600, 3600)
    return user


@router.get("", response_class=Response)
async def speak(
    text: Annotated[str, Query(min_length=1, max_length=400)],
    voice: Voice = tts_service.DEFAULT_VOICE,
    user: User = Depends(_limited_user),
):
    """MP3 of `text` in a natural Indian voice (English: neerja, prabhat; Hindi: ishita, shubh)."""
    text = text.strip()
    if not text:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Text is required")
    try:
        audio = await tts_service.synthesize(text, voice)
    except tts_service.TtsUnavailableError as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Narration is unavailable right now."
        ) from error
    return Response(
        audio,
        media_type="audio/mpeg",
        # Same text + voice always gives the same audio; let the browser keep it.
        headers={"Cache-Control": "private, max-age=604800"},
    )
