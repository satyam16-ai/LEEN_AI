# =============================================================================
# Logging Middleware
# =============================================================================

import time
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("leen_ai")


class LoggingMiddleware(BaseHTTPMiddleware):
    """Logs incoming requests and outgoing responses with timing."""

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.perf_counter()

        # Log request (never log sensitive data like auth headers or body)
        logger.info(
            "Request: %s %s",
            request.method,
            request.url.path,
        )

        response: Response = await call_next(request)

        elapsed_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            "Response: %s %s → %d (%.1fms)",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )

        return response
