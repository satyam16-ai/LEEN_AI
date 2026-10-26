# =============================================================================
# Chunker — splits page texts into overlapping passages for embedding. A chunk
# never spans two pages, so every citation points at one page.
# =============================================================================

from dataclasses import dataclass


@dataclass(frozen=True)
class Chunk:
    page: int
    text: str


def _cut(text: str, start: int, end: int) -> int:
    """Where to end a chunk: the last sentence end, else the last space, in its second half."""
    floor = start + (end - start) // 2
    sentence = text.rfind(". ", floor, end)
    if sentence != -1:
        return sentence + 1
    space = text.rfind(" ", floor, end)
    return space if space != -1 else end


def chunk_pages(pages: list[tuple[int, str]], size: int = 2000, overlap: int = 200) -> list[Chunk]:
    """(page, text) pairs → chunks of at most `size` characters, overlapping by about `overlap`."""
    chunks = []
    for page, raw in pages:
        text = " ".join(raw.split())
        start = 0
        while start < len(text):
            end = min(start + size, len(text))
            if end < len(text):
                end = _cut(text, start, end)
            piece = text[start:end].strip()
            if piece:
                chunks.append(Chunk(page, piece))
            if end >= len(text):
                break
            start = max(end - overlap, start + 1)
            space = text.find(" ", start, end)
            if space != -1:
                start = space + 1
    return chunks
