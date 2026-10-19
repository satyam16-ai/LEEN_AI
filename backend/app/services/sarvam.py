# =============================================================================
# Sarvam AI — Indian-language speech: Bulbul text-to-speech, Saaras speech-to-text
# and transliteration.
# Needs SARVAM_API_KEY (keep it in backend/.env, which git ignores).
# =============================================================================

import base64

import httpx

from app.config import settings

TIMEOUT_SECONDS = 20
# Tests swap in an httpx.MockTransport; None means the real network.
TRANSPORT: httpx.AsyncBaseTransport | None = None


class SarvamError(Exception):
    """Sarvam could not be reached, refused the request, or sent something unusable."""


async def _post(
    path: str, payload: dict | None = None, *, files: dict | None = None, data: dict | None = None
) -> dict:
    """POST JSON (`payload`) or a multipart form (`files` and `data`) to Sarvam."""
    if not settings.sarvam_api_key:
        raise SarvamError("SARVAM_API_KEY is not set")
    async with httpx.AsyncClient(
        base_url=settings.sarvam_api_url,
        headers={"api-subscription-key": settings.sarvam_api_key},
        timeout=TIMEOUT_SECONDS,
        transport=TRANSPORT,
    ) as client:
        try:
            if files is not None:
                response = await client.post(path, files=files, data=data)
            else:
                response = await client.post(path, json=payload)
        except httpx.HTTPError as error:
            raise SarvamError(f"Sarvam is unreachable: {error!r}") from error
    if response.status_code != 200:
        raise SarvamError(f"Sarvam {path} returned {response.status_code}: {response.text[:200]}")
    try:
        return response.json()
    except ValueError as error:
        raise SarvamError(f"Sarvam {path} returned invalid JSON") from error


async def transliterate(text: str, source: str = "en-IN", target: str = "hi-IN") -> str:
    """`text` in another script, e.g. Hinglish in English letters -> Devanagari."""
    data = await _post(
        "/transliterate",
        {"input": text, "source_language_code": source, "target_language_code": target},
    )
    result = data.get("transliterated_text")
    if not isinstance(result, str) or not result.strip():
        raise SarvamError("Sarvam returned no transliteration")
    return result


async def speech_to_text(audio: bytes, filename: str, content_type: str) -> str:
    """What was said in a short recording, as Hinglish in English letters (like the captions)."""
    data = await _post(
        "/speech-to-text",
        files={"file": (filename, audio, content_type)},
        data={
            "model": settings.sarvam_stt_model,
            "mode": settings.sarvam_stt_mode,
            "language_code": "hi-IN",
        },
    )
    transcript = data.get("transcript")
    if not isinstance(transcript, str) or not transcript.strip():
        raise SarvamError("Sarvam heard nothing")
    return transcript.strip()


async def text_to_speech(text: str, speaker: str, language: str = "hi-IN") -> bytes:
    """MP3 of `text` read by a Bulbul `speaker`."""
    data = await _post(
        "/text-to-speech",
        {
            "text": text,
            "language_code": language,
            "speaker": speaker,
            "model": settings.sarvam_tts_model,
            "pace": settings.sarvam_tts_pace,
            "output_audio_codec": "mp3",
        },
    )
    try:
        return base64.b64decode(data["audios"][0], validate=True)
    except (KeyError, IndexError, TypeError, ValueError) as error:
        raise SarvamError("Sarvam returned no audio") from error
