"""Small real files for upload tests: images and PDFs built in memory."""

import io

from PIL import Image


def png(width: int = 300, height: int = 200, color: str = "white") -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (width, height), color).save(output, format="PNG")
    return output.getvalue()


def jpeg_with_exif(width: int = 300, height: int = 200) -> bytes:
    image = Image.new("RGB", (width, height), "white")
    exif = Image.Exif()
    exif[0x010F] = "PhoneMaker"  # Make
    output = io.BytesIO()
    image.save(output, format="JPEG", exif=exif)
    return output.getvalue()


def text_pdf(pages: list[str]) -> bytes:
    """A minimal valid PDF with one line of Helvetica text per page."""
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        None,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    kids = []
    for text in pages:
        safe = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream = f"BT /F1 12 Tf 72 720 Td ({safe}) Tj ET"
        objects.append(f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream")
        content = len(objects)
        objects.append(
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 3 0 R >> >> /Contents {content} 0 R >>"
        )
        kids.append(f"{len(objects)} 0 R")
    objects[1] = f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {len(kids)} >>"

    output = io.BytesIO()
    output.write(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(output.tell())
        output.write(f"{number} 0 obj\n{body}\nendobj\n".encode("latin-1"))
    xref = output.tell()
    output.write(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets:
        output.write(f"{offset:010d} 00000 n \n".encode())
    output.write(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return output.getvalue()


def image_pdf(page_count: int) -> bytes:
    """A PDF of blank image pages (no text layer), like a phone scan."""
    pages = [Image.new("RGB", (200, 280), "white") for _ in range(page_count)]
    output = io.BytesIO()
    pages[0].save(output, format="PDF", save_all=True, append_images=pages[1:])
    return output.getvalue()
