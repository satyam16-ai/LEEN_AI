import uuid

import pytest

from app.models.user import UserRole
from app.services import tts_service

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
