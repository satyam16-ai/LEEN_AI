# =============================================================================
# Text-to-speech — natural Indian voices for whiteboard narration.
# English: Microsoft's neural voices through edge-tts (no API key; needs internet).
# Hindi: Sarvam AI's Bulbul voices (needs SARVAM_API_KEY). Captions for Hindi
# students are Hinglish in English letters, so they are transliterated to
# Devanagari first, which Bulbul reads far better.
# Audio is cached in Redis, so replays and repeated captions are instant.
# =============================================================================

import asyncio
import hashlib
import logging
import re

import edge_tts
import redis
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.services import sarvam

logger = logging.getLogger("leen_ai")

VOICES = {
    "neerja": "en-IN-NeerjaNeural",
    "prabhat": "en-IN-PrabhatNeural",
}
# Sarvam Bulbul speakers for Hindi.
HINDI_VOICES = {
    "ishita": "ishita",
    "shubh": "shubh",
}
LATIN = re.compile(r"[A-Za-z]")
DEVANAGARI = re.compile(r"[\u0900-\u097F]")
DEFAULT_VOICE = "neerja"
# A touch slower than conversational speed, for students following along.
SPEAKING_RATE = "-5%"
SYNTH_TIMEOUT_SECONDS = 20

_cache: redis.Redis | None = None


class TtsUnavailableError(Exception):
    """The voice service could not produce audio (offline, blocked or changed)."""


def _cache_client() -> redis.Redis:
    global _cache
    if _cache is None:
        # Binary-safe client: the shared one decodes responses to str.
        _cache = redis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
    return _cache


def _cache_key(text: str, voice: str) -> str:
    if voice in HINDI_VOICES:
        style = f"{settings.sarvam_tts_model}@{settings.sarvam_tts_pace}"
    else:
        style = SPEAKING_RATE
    digest = hashlib.sha256(f"{voice}|{style}|{text}".encode()).hexdigest()
    return f"tts:{digest}"


def _cached(key: str) -> bytes | None:
    try:
        return _cache_client().get(key)
    except redis.RedisError:
        return None


def _store(key: str, audio: bytes) -> None:
    try:
        _cache_client().set(key, audio, ex=settings.tts_cache_ttl_seconds)
    except redis.RedisError:
        logger.warning("TTS cache unavailable; audio not cached")


async def _speak_hindi(text: str, speaker: str) -> bytes:
    spoken = text
    if LATIN.search(text) and not DEVANAGARI.search(text):
        try:
            spoken = await sarvam.transliterate(text)
        except sarvam.SarvamError as error:
            logger.warning("Transliteration failed; speaking the text as written: %r", error)
    return await sarvam.text_to_speech(spoken, speaker)


async def _generate(text: str, voice: str) -> bytes:
    if voice in HINDI_VOICES:
        return await _speak_hindi(text, HINDI_VOICES[voice])
    audio = bytearray()
    communicate = edge_tts.Communicate(text, VOICES[voice], rate=SPEAKING_RATE)
    async with asyncio.timeout(SYNTH_TIMEOUT_SECONDS):
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio.extend(chunk["data"])
    return bytes(audio)


async def synthesize(text: str, voice: str = DEFAULT_VOICE) -> bytes:
    """MP3 audio of `text` read by `voice` (a key of VOICES or HINDI_VOICES)."""
    if not settings.tts_enabled:
        raise TtsUnavailableError("Narration is turned off")
    key = _cache_key(text, voice)
    cached = await run_in_threadpool(_cached, key)
    if cached:
        return cached
    try:
        audio = await _generate(text, voice)
    except Exception as error:  # noqa: BLE001 - network, protocol or timeout errors
        logger.warning("Text-to-speech failed: %r", error)
        raise TtsUnavailableError(str(error)) from error
    if not audio:
        raise TtsUnavailableError("The voice service returned no audio")
    await run_in_threadpool(_store, key, audio)
    return audio
