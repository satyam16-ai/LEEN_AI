# =============================================================================
# Global Exception Handlers
# =============================================================================

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("leen_ai")


def register_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers on the FastAPI app."""

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        """Handle HTTP exceptions with a consistent response format."""
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "message": exc.detail,
                "data": None,
            },
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Return field-level validation errors inside the standard envelope."""
        errors = []
        for error in exc.errors():
            location = [str(part) for part in error.get("loc", ()) if part not in ("body", "query")]
            message = error.get("msg", "Invalid value").removeprefix("Value error, ")
            errors.append({"field": ".".join(location) or None, "message": message})
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "message": errors[0]["message"] if len(errors) == 1 else "Validation failed",
                "data": {"errors": errors},
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        """
        Catch-all for unhandled exceptions.
        Returns a generic error message to the client (no internal details leaked).
        Logs the full error server-side for debugging.
        """
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "An unexpected error occurred. Please try again later.",
                "data": None,
            },
        )
