# =============================================================================
# Local OCR (Tesseract, English + Hindi) — reads printed book pages without any
# AI call. The mean word confidence tells the Librarian when to look instead.
# =============================================================================

import io

import pytesseract
from PIL import Image

LANGUAGES = "eng+hin"


def read_page(jpeg: bytes) -> tuple[str, float]:
    """The page's text in reading order, and Tesseract's mean word confidence (0–100)."""
    with Image.open(io.BytesIO(jpeg)) as image:
        data = pytesseract.image_to_data(
            image.convert("RGB"), lang=LANGUAGES, output_type=pytesseract.Output.DICT
        )
    lines: dict[tuple[int, int, int], list[str]] = {}
    confidences = []
    for index, word in enumerate(data["text"]):
        word = word.strip()
        confidence = float(data["conf"][index])
        if not word or confidence < 0:
            continue
        confidences.append(confidence)
        line = (data["block_num"][index], data["par_num"][index], data["line_num"][index])
        lines.setdefault(line, []).append(word)
    text = "\n".join(" ".join(words) for words in lines.values())
    return text, (sum(confidences) / len(confidences) if confidences else 0.0)
