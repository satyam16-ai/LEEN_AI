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


def _serialize(data: Any) -> Any:
    if isinstance(data, BaseModel):
        return data.model_dump(mode="json")
    if isinstance(data, list):
        return [_serialize(item) for item in data]
    return data


def ok(data: Any = None, message: str = "OK") -> dict:
    """Build a success envelope. Pydantic models (or lists of them) become JSON-safe dicts."""
    return {"success": True, "message": message, "data": _serialize(data)}
