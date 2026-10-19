import httpx
import pytest

from app.config import settings
from app.models.user import UserRole
from app.services import sarvam

STT = "/api/v1/stt"
AUDIO = ("speech.webm", b"\x1aE\xdf\xa3fake-webm", "audio/webm;codecs=opus")


@pytest.fixture
def fake_sarvam(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(
            (request.url.path, request.headers.get("api-subscription-key"), request.content)
        )
        return httpx.Response(200, json={"request_id": "r1", "transcript": " yeh triangle hai "})

    monkeypatch.setattr(settings, "sarvam_api_key", "test-key")
    monkeypatch.setattr(sarvam, "TRANSPORT", httpx.MockTransport(handler))
    return calls


def test_hindi_speech_becomes_hinglish_text(signed_in, fake_sarvam):
    student = signed_in("s@example.com", UserRole.STUDENT)

    response = student.post(STT, files={"file": AUDIO})

    assert response.status_code == 200
    assert response.json()["data"] == {"text": "yeh triangle hai"}
    [(path, key, body)] = fake_sarvam
    assert (path, key) == ("/speech-to-text", "test-key")
    for field, value in (
        ("model", b"saaras:v3"),
        ("mode", b"translit"),
        ("language_code", b"hi-IN"),
    ):
        assert f'name="{field}"'.encode() in body and value in body
    assert b"fake-webm" in body


def test_stt_rejects_wrong_type_and_big_files(signed_in, fake_sarvam, client):
    student = signed_in("s@example.com", UserRole.STUDENT)

    image = student.post(STT, files={"file": ("x.png", b"\x89PNG", "image/png")})
    big = student.post(STT, files={"file": ("big.webm", b"0" * (1024 * 1024 + 1), "audio/webm")})
    empty = student.post(STT, files={"file": ("e.webm", b"", "audio/webm")})

    assert (image.status_code, big.status_code, empty.status_code) == (422, 422, 422)
    assert fake_sarvam == []
    assert client.post(STT, files={"file": AUDIO}).status_code == 401


def test_stt_without_a_key_is_503(signed_in, fake_sarvam, monkeypatch):
    monkeypatch.setattr(settings, "sarvam_api_key", "")
    student = signed_in("s@example.com", UserRole.STUDENT)

    response = student.post(STT, files={"file": AUDIO})

    assert response.status_code == 503
    assert response.json()["message"] == "Voice input is unavailable right now."
    assert fake_sarvam == []


def test_stt_failure_is_logged(signed_in, monkeypatch, caplog):
    def handler(request):
        return httpx.Response(500, json={"error": {"message": "boom"}})

    monkeypatch.setattr(settings, "sarvam_api_key", "test-key")
    monkeypatch.setattr(sarvam, "TRANSPORT", httpx.MockTransport(handler))
    student = signed_in("s@example.com", UserRole.STUDENT)

    with caplog.at_level("WARNING", logger="leen_ai"):
        response = student.post(STT, files={"file": AUDIO})

    assert response.status_code == 503
    assert "Voice input failed" in caplog.text
