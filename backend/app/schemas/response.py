# =============================================================================
# Base Response Schemas
# =============================================================================

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
    data: dict | list | None = None
