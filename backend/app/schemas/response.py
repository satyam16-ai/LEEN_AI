# =============================================================================
# Base Response Schemas
# =============================================================================

from typing import Any

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Health check response schema."""

    status: str
    timestamp: str
    version: str


class ApiResponse(BaseModel):
    """Standardized API response wrapper."""

    success: bool = True
    message: str = "OK"
    data: Any = None


def ok(data: Any = None, message: str = "OK") -> dict:
    """Build a success envelope. Pydantic models in `data` are serialized to JSON-safe dicts."""
    if isinstance(data, BaseModel):
        data = data.model_dump(mode="json")
    return {"success": True, "message": message, "data": data}
