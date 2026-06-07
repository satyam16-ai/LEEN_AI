# =============================================================================
# Logging Configuration
# =============================================================================

import logging
import sys

from app.config import settings


def setup_logging() -> None:
    """Configure structured logging for the application."""
    log_level = logging.DEBUG if settings.is_development else logging.INFO

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    # Application logger
    app_logger = logging.getLogger("leen_ai")
    app_logger.setLevel(log_level)
    app_logger.addHandler(handler)
    app_logger.propagate = False

    # SQLAlchemy logger (quiet in production)
    sa_logger = logging.getLogger("sqlalchemy.engine")
    sa_logger.setLevel(logging.WARNING if not settings.is_development else logging.INFO)

    # Uvicorn access logger
    uvicorn_logger = logging.getLogger("uvicorn.access")
    uvicorn_logger.setLevel(log_level)
