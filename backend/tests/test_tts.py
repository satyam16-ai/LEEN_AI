import base64
import json
import uuid
from types import SimpleNamespace

import httpx
import pytest

from app.config import settings
from app.models.user import UserRole
from app.services import sarvam, tts_service

TTS = "/api/v1/tts"


class FakeCommunicate:
    calls: list[tuple[str, str]] = []

    def __init__(self, text, voice, rate=None):
        self.text, self.voice = text, voice

    async def stream(self):
        FakeCommunicate.calls.append((self.text, self.voice))
        yield {"type": "WordBoundary", "offset": 0}
        yield {"type": "audio", "data": b"ID3fake-"}
        yield {"type": "audio", "data": self.voice.encode()}


class BrokenCommunicate(FakeCommunicate):
    async def stream(self):
        raise ConnectionError("no internet")
        yield  # pragma: no cover - makes this an async generator


@pytest.fixture
def fake_voice(monkeypatch):
    FakeCommunicate.calls = []
    monkeypatch.setattr(tts_service.edge_tts, "Communicate", FakeCommunicate)
    return FakeCommunicate


def test_signed_in_user_gets_mp3_and_repeats_come_from_cache(signed_in, fake_voice):
    student = signed_in("s@example.com", UserRole.STUDENT)
    text = f"x plus y whole squared {uuid.uuid4()}"

    first = student.get(TTS, params={"text": f"  {text} ", "voice": "prabhat"})
    second = student.get(TTS, params={"text": text, "voice": "prabhat"})

    assert first.status_code == 200
    assert first.headers["content-type"] == "audio/mpeg"
    assert "max-age" in first.headers["cache-control"]
    assert first.content == b"ID3fake-en-IN-PrabhatNeural"
    assert second.content == first.content
    assert fake_voice.calls == [(text, "en-IN-PrabhatNeural")]


def test_default_voice_is_neerja(signed_in, fake_voice):
    student = signed_in("s@example.com", UserRole.STUDENT)

    response = student.get(TTS, params={"text": f"Hello {uuid.uuid4()}"})

    assert response.content.endswith(b"en-IN-NeerjaNeural")


def test_validation_and_auth(client, signed_in, fake_voice):
    assert client.get(TTS, params={"text": "Hello"}).status_code == 401

    student = signed_in("s@example.com", UserRole.STUDENT)
    assert student.get(TTS, params={"text": ""}).status_code == 422
    assert student.get(TTS, params={"text": "   "}).status_code == 422
    assert student.get(TTS, params={"text": "x" * 401}).status_code == 422
    assert student.get(TTS, params={"text": "Hello", "voice": "robot"}).status_code == 422
    assert fake_voice.calls == []


def test_voice_service_failure_is_503(signed_in, monkeypatch):
    monkeypatch.setattr(tts_service.edge_tts, "Communicate", BrokenCommunicate)
    student = signed_in("s@example.com", UserRole.STUDENT)

    response = student.get(TTS, params={"text": f"Hello {uuid.uuid4()}"})

    assert response.status_code == 503
    assert response.json()["message"] == "Narration is unavailable right now."


# -- Hindi voices (Sarvam AI) ---------------------------------------------------

DEVANAGARI = "देखो, यहाँ फोकल लेंथ 10 cm है।"


def _digits() -> str:
    """A unique suffix with no letters, so script detection isn't thrown off."""
    return str(uuid.uuid4().int)[:12]


@pytest.fixture
def fake_sarvam(monkeypatch):
    fake = SimpleNamespace(requests=[], responses={})

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        fake.requests.append((request.url.path, request.headers.get("api-subscription-key"), body))
        status, payload = fake.responses.get(request.url.path, (404, {}))
        return httpx.Response(status, json=payload)

    monkeypatch.setattr(settings, "sarvam_api_key", "test-key")
    monkeypatch.setattr(sarvam, "TRANSPORT", httpx.MockTransport(handler))
    fake.responses["/transliterate"] = (200, {"transliterated_text": DEVANAGARI})
    audio = base64.b64encode(b"ID3hindi").decode()
    fake.responses["/text-to-speech"] = (200, {"request_id": "r1", "audios": [audio]})
    return fake


def test_hindi_voice_speaks_hinglish_through_sarvam(signed_in, fake_sarvam, fake_voice):
    student = signed_in("s@example.com", UserRole.STUDENT)
    text = f"Dekho, yahan focal length 10 cm hai {_digits()}"

    first = student.get(TTS, params={"text": text, "voice": "ishita"})
    second = student.get(TTS, params={"text": text, "voice": "ishita"})

    assert first.status_code == 200
    assert first.headers["content-type"] == "audio/mpeg"
    assert first.content == second.content == b"ID3hindi"
    transliterate, speech = fake_sarvam.requests  # the repeat came from the cache
    assert transliterate == (
        "/transliterate",
        "test-key",
        {"input": text, "source_language_code": "en-IN", "target_language_code": "hi-IN"},
    )
    path, key, body = speech
    assert (path, key) == ("/text-to-speech", "test-key")
    assert body["text"] == DEVANAGARI
    assert body["language_code"] == "hi-IN"
    assert body["speaker"] == "ishita"
    assert body["model"] == settings.sarvam_tts_model
    assert body["output_audio_codec"] == "mp3"
    assert fake_voice.calls == []


def test_devanagari_text_goes_straight_to_speech(signed_in, fake_sarvam):
    student = signed_in("s@example.com", UserRole.STUDENT)
    text = f"नमस्ते बच्चों {_digits()}"

    response = student.get(TTS, params={"text": text, "voice": "shubh"})

    assert response.status_code == 200
    [(path, _, body)] = fake_sarvam.requests
    assert path == "/text-to-speech"
    assert (body["text"], body["speaker"]) == (text, "shubh")


def test_failed_transliteration_still_speaks_the_text(signed_in, fake_sarvam):
    fake_sarvam.responses["/transliterate"] = (500, {"error": {"message": "boom"}})
    student = signed_in("s@example.com", UserRole.STUDENT)
    text = f"Dekho yeh triangle hai {_digits()}"

    response = student.get(TTS, params={"text": text, "voice": "ishita"})

    assert response.status_code == 200
    assert fake_sarvam.requests[-1][2]["text"] == text


def test_hindi_voice_without_a_key_is_503(signed_in, fake_sarvam, monkeypatch):
    monkeypatch.setattr(settings, "sarvam_api_key", "")
    student = signed_in("s@example.com", UserRole.STUDENT)

    response = student.get(TTS, params={"text": f"Namaste {_digits()}", "voice": "ishita"})

    assert response.status_code == 503
    assert fake_sarvam.requests == []


def test_sarvam_failure_is_503(signed_in, fake_sarvam):
    fake_sarvam.responses["/text-to-speech"] = (
        429,
        {"error": {"code": "insufficient_quota_error"}},
    )
    student = signed_in("s@example.com", UserRole.STUDENT)

    response = student.get(TTS, params={"text": f"Namaste {_digits()}", "voice": "shubh"})

    assert response.status_code == 503
    assert response.json()["message"] == "Narration is unavailable right now."
