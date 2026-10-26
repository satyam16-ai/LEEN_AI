# =============================================================================
# Shared LLM input types.
# =============================================================================

from dataclasses import dataclass


@dataclass(frozen=True)
class ImageInput:
    """One image for a vision call: JPEG, PNG or WEBP bytes."""

    media_type: str
    data: bytes
