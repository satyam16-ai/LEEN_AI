import io
from pathlib import Path

import pytest
from PIL import Image

from app.config import settings
from app.models.user import UserRole

PROFILE = "/api/v1/profile"


def image_bytes(fmt="PNG", size=(640, 480), color=(80, 70, 200)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, format=fmt)
    return buffer.getvalue()


def upload(client, data: bytes, filename="photo.png", content_type="image/png"):
    return client.post(f"{PROFILE}/avatar", files={"file": (filename, data, content_type)})


def avatar_path(url: str) -> Path:
    return Path(settings.media_root) / "avatars" / url.rsplit("/", 1)[-1]


def test_student_profile_starts_incomplete(signed_in):
    student = signed_in("s@example.com", UserRole.STUDENT)

    data = student.get(PROFILE).json()["data"]

    assert data["user"]["email"] == "s@example.com"
    assert data["student_profile"]["is_complete"] is False
    assert data["student_profile"]["subjects"] == []


def test_student_completes_learning_profile(signed_in):
    student = signed_in("s@example.com", UserRole.STUDENT)

    response = student.patch(
        PROFILE,
        json={
            "name": "Asha V",
            "grade": 9,
            "board": "cbse",
            "school_name": "  Kendriya Vidyalaya  ",
            "subjects": ["Maths", "Science", "maths"],
            "learning_level": "intermediate",
            "preferred_language": "hi",
        },
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["user"]["name"] == "Asha V"
    profile = data["student_profile"]
    assert profile["subjects"] == ["Maths", "Science"]
    assert profile["school_name"] == "Kendriya Vidyalaya"
    assert profile["is_complete"] is True


def test_partial_update_keeps_other_fields(signed_in):
    student = signed_in("s@example.com", UserRole.STUDENT)
    student.patch(PROFILE, json={"grade": 7, "board": "icse"})

    student.patch(PROFILE, json={"learning_level": "beginner"})

    profile = student.get(PROFILE).json()["data"]["student_profile"]
    assert (profile["grade"], profile["board"], profile["learning_level"]) == (
        7,
        "icse",
        "beginner",
    )


def test_non_students_cannot_set_learning_fields(signed_in):
    parent = signed_in("p@example.com", UserRole.PARENT)

    assert parent.patch(PROFILE, json={"name": "Meera Verma"}).status_code == 200
    response = parent.patch(PROFILE, json={"grade": 5})

    assert response.status_code == 400
    assert parent.get(PROFILE).json()["data"]["student_profile"] is None


@pytest.mark.parametrize(
    "payload",
    [{"grade": 13}, {"board": "unknown"}, {"learning_level": "expert"}, {"nickname": "x"}],
)
def test_profile_validation(signed_in, payload):
    student = signed_in("s@example.com", UserRole.STUDENT)

    response = student.patch(PROFILE, json=payload)

    assert response.status_code == 422
    assert response.json()["success"] is False


def test_avatar_upload_is_reencoded_served_and_replaced(signed_in):
    student = signed_in("s@example.com", UserRole.STUDENT)

    first = upload(student, image_bytes())
    assert first.status_code == 200
    first_url = first.json()["data"]["avatar_url"]
    assert first_url.startswith("/media/avatars/") and first_url.endswith(".webp")

    served = student.get(first_url)
    assert served.status_code == 200
    with Image.open(io.BytesIO(served.content)) as image:
        assert image.format == "WEBP"
        assert image.size == (256, 256)

    second_url = upload(student, image_bytes("JPEG"), "photo.jpg", "image/jpeg").json()["data"][
        "avatar_url"
    ]
    assert second_url != first_url
    assert not avatar_path(first_url).exists()
    assert student.get("/api/v1/auth/me").json()["data"]["avatar_url"] == second_url


def test_avatar_removal_deletes_file(signed_in):
    student = signed_in("s@example.com", UserRole.STUDENT)
    url = upload(student, image_bytes()).json()["data"]["avatar_url"]

    response = student.delete(f"{PROFILE}/avatar")

    assert response.status_code == 200
    assert response.json()["data"]["avatar_url"] is None
    assert not avatar_path(url).exists()


def test_avatar_rejects_non_images_and_large_files(signed_in, monkeypatch):
    student = signed_in("s@example.com", UserRole.STUDENT)

    fake = upload(student, b"<?php echo 'not an image'; ?>", "evil.png")
    assert fake.status_code == 400

    gif = upload(student, image_bytes("GIF"), "anim.gif", "image/gif")
    assert gif.status_code == 400

    monkeypatch.setattr(settings, "max_avatar_bytes", 1000)
    large = upload(student, image_bytes(size=(800, 800)))
    assert large.status_code == 413


def test_profile_requires_authentication(client):
    assert client.get(PROFILE).status_code == 401


def test_avatar_is_served_with_image_content_type(signed_in):
    student = signed_in("s@example.com", UserRole.STUDENT)
    url = upload(student, image_bytes()).json()["data"]["avatar_url"]

    assert student.get(url).headers["content-type"] == "image/webp"
