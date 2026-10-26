# =============================================================================
# Local embeddings — a small multilingual model (fastembed, ONNX, no API key)
# turns passages and questions into 384-number vectors for pgvector. The model
# is loaded once per process, on first use.
# =============================================================================

import math
import threading
from collections.abc import Callable

from app.config import settings

Embedder = Callable[[list[str]], list[list[float]]]

_model = None
_lock = threading.Lock()
_override: Embedder | None = None


def override(embedder: Embedder | None) -> None:
    """Swap the model for `embedder` (tests); None restores the real model."""
    global _override
    _override = embedder


def _load():
    global _model
    with _lock:
        if _model is None:
            from fastembed import TextEmbedding

            _model = TextEmbedding(settings.embedding_model)
    return _model


def _normalise(vector) -> list[float]:
    values = [float(value) for value in vector]
    norm = math.sqrt(sum(value * value for value in values)) or 1.0
    return [value / norm for value in values]


def embed(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    vectors = _override(texts) if _override else list(_load().embed(texts))
    return [_normalise(vector) for vector in vectors]
