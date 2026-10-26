# =============================================================================
# Private file storage — student uploads (syllabus photos, book pages, doubt
# photos). Kept under settings.private_root, which is never served at /media:
# files only leave through endpoints that check the owner.
# =============================================================================

import io
import logging
import threading
import uuid
from dataclasses import dataclass
from pathlib import Path

import pypdfium2 as pdfium
from fastapi import HTTPException, status
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings

logger = logging.getLogger("leen_ai")

ALLOWED_IMAGE_FORMATS = {"PNG", "JPEG", "WEBP"}
MAX_IMAGE_PIXELS = 40_000_000
MAX_EDGE = 2000
MAX_RENDER_SCALE = 3.0
INVALID_IMAGE = "Upload a JPG, PNG or WEBP image."
INVALID_PDF = "Upload a PDF that opens normally and isn't password-protected."

# PDFium is not thread-safe, and sync endpoints run in a thread pool.
_pdfium_lock = threading.Lock()


@dataclass(frozen=True)
class StoredFile:
    name: str  # relative to private_root, e.g. "pages/<hex>.jpg"
    media_type: str
    pages: int


def root() -> Path:
    return Path(settings.private_root)


def path_of(name: str) -> Path:
    """The file's path, or 404 for any name that would leave private_root."""
    base = root().resolve()
    path = (base / name).resolve()
    if path == base or not path.is_relative_to(base):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found.")
    return path


def read_bytes(name: str) -> bytes:
    return path_of(name).read_bytes()


def remove(name: str) -> None:
    try:
        path_of(name).unlink(missing_ok=True)
    except (HTTPException, OSError):
        logger.warning("Could not delete stored file")


def _check_size(data: bytes) -> None:
    if len(data) > settings.max_upload_bytes:
        megabytes = settings.max_upload_bytes // (1024 * 1024)
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE, f"Files must be {megabytes} MB or smaller."
        )
    if not data:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "That file is empty.")


def _write(folder: str, suffix: str, data: bytes) -> str:
    name = f"{folder}/{uuid.uuid4().hex}{suffix}"
    path = path_of(name)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return name


def _jpeg(image: Image.Image, max_edge: int = MAX_EDGE) -> bytes:
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        background = Image.new("RGB", image.size, "white")
        background.paste(image.convert("RGBA"), mask=image.convert("RGBA").getchannel("A"))
        image = background
    image = image.convert("RGB")
    image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    output = io.BytesIO()
    # Re-encoding strips metadata (EXIF location and the like) and guarantees a real image.
    image.save(output, format="JPEG", quality=85)
    return output.getvalue()


def to_jpeg(data: bytes, max_edge: int = MAX_EDGE) -> bytes:
    """Check an uploaded image and re-encode it as JPEG with its long edge ≤ max_edge."""
    try:
        with Image.open(io.BytesIO(data)) as source:
            if source.format not in ALLOWED_IMAGE_FORMATS:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, INVALID_IMAGE)
            if source.width * source.height > MAX_IMAGE_PIXELS:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_CONTENT, "That image is too large."
                )
            return _jpeg(ImageOps.exif_transpose(source), max_edge)
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, INVALID_IMAGE) from exc


def save_image(data: bytes, folder: str) -> StoredFile:
    _check_size(data)
    name = _write(folder, ".jpg", to_jpeg(data))
    return StoredFile(name, "image/jpeg", 1)


def save_pdf(data: bytes, folder: str) -> StoredFile:
    _check_size(data)
    with _pdfium_lock:
        try:
            document = pdfium.PdfDocument(data)
        except pdfium.PdfiumError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, INVALID_PDF) from exc
        try:
            pages = len(document)
        finally:
            document.close()
    if not 0 < pages <= settings.max_pdf_pages:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"PDFs can have at most {settings.max_pdf_pages} pages.",
        )
    name = _write(folder, ".pdf", data)
    return StoredFile(name, "application/pdf", pages)


def save_upload(data: bytes, folder: str) -> StoredFile:
    """Store a photo or a PDF, telling them apart by their bytes, not the client's word."""
    if data[:5] == b"%PDF-":
        return save_pdf(data, folder)
    return save_image(data, folder)


def pdf_texts(name: str) -> list[str]:
    """The text layer of each page ("" for scanned pages)."""
    with _pdfium_lock:
        document = pdfium.PdfDocument(path_of(name))
        try:
            return [page.get_textpage().get_text_range() for page in document]
        finally:
            document.close()


def pdf_page_jpeg(name: str, index: int, max_edge: int = MAX_EDGE) -> bytes:
    """Render one PDF page as a JPEG (for OCR or a vision call)."""
    with _pdfium_lock:
        document = pdfium.PdfDocument(path_of(name))
        try:
            page = document[index]
            width, height = page.get_size()
            scale = min(max_edge / max(width, height, 1), MAX_RENDER_SCALE)
            image = page.render(scale=scale).to_pil()
        finally:
            document.close()
    return _jpeg(image, max_edge)
