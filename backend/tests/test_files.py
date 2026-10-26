import io

import pytest
from fastapi import HTTPException
from PIL import Image

from app.config import settings
from app.services import files
from tests.samples import image_pdf, jpeg_with_exif, png, text_pdf


def test_save_image_reencodes_jpeg_and_strips_metadata():
    stored = files.save_image(png(3000, 1000), "pages")

    assert stored.media_type == "image/jpeg"
    assert stored.pages == 1
    assert stored.name.startswith("pages/") and stored.name.endswith(".jpg")
    with Image.open(files.path_of(stored.name)) as image:
        assert image.format == "JPEG"
        assert image.size == (2000, 667)

    tagged = files.save_image(jpeg_with_exif(), "pages")
    with Image.open(files.path_of(tagged.name)) as image:
        assert not image.getexif()


def test_save_image_rejects_non_images():
    before = set(files.root().rglob("*"))
    with pytest.raises(HTTPException) as error:
        files.save_image(b"hello, not an image", "pages")
    assert error.value.status_code == 422
    assert set(files.root().rglob("*")) == before


def test_save_image_rejects_oversize(monkeypatch):
    monkeypatch.setattr(settings, "max_upload_bytes", 1000)
    with pytest.raises(HTTPException) as error:
        files.save_image(png(400, 400, "red") + b"\0" * 1000, "pages")
    assert error.value.status_code == 413


def test_save_upload_sniffs_pdf_and_image():
    assert files.save_upload(text_pdf(["One"]), "pages").media_type == "application/pdf"
    assert files.save_upload(png(), "pages").media_type == "image/jpeg"


def test_save_pdf_counts_pages_and_reads_text():
    stored = files.save_pdf(text_pdf(["Newton's first law", "Inertia"]), "pages")

    assert (stored.media_type, stored.pages) == ("application/pdf", 2)
    texts = files.pdf_texts(stored.name)
    assert len(texts) == 2
    assert "Newton" in texts[0] and "Inertia" in texts[1]

    page = files.pdf_page_jpeg(stored.name, 1)
    with Image.open(io.BytesIO(page)) as image:
        assert image.format == "JPEG" and max(image.size) <= 2000


def test_save_pdf_rejects_too_many_pages():
    with pytest.raises(HTTPException) as error:
        files.save_pdf(image_pdf(settings.max_pdf_pages + 1), "pages")
    assert error.value.status_code == 422


def test_save_pdf_rejects_broken_files():
    with pytest.raises(HTTPException) as error:
        files.save_pdf(b"%PDF-1.4 but nothing else", "pages")
    assert error.value.status_code == 422


def test_path_of_blocks_traversal():
    for name in ("../etc/passwd", "/etc/passwd", "pages/../../x"):
        with pytest.raises(HTTPException) as error:
            files.path_of(name)
        assert error.value.status_code == 404


def test_remove_is_quiet_when_missing():
    stored = files.save_image(png(), "pages")
    files.remove(stored.name)
    files.remove(stored.name)
    assert not files.path_of(stored.name).exists()
