# =============================================================================
# FastAPI Application Factory
# =============================================================================

import logging

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging
from app.middlewares import LoggingMiddleware, RequestIdMiddleware
from app.api.v1.router import router as v1_router
from app.services import redis_service

logger = logging.getLogger("leen_ai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    # Startup
    setup_logging()
    logger.info("Starting %s (%s)", settings.app_name, settings.app_env)

    redis_service.connect()

    yield

    # Shutdown
    redis_service.disconnect()
    logger.info("Shutting down %s", settings.app_name)


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.app_name,
        description="AI Personal Teacher System — Backend API",
        version="0.1.0",
        docs_url="/docs" if settings.is_development else None,
        redoc_url="/redoc" if settings.is_development else None,
        lifespan=lifespan,
    )

    # ---- Middleware (order matters: last added = first executed) ----

    # CORS — restrict origins in production
    # TODO(security): Replace wildcard origins with explicit allowed origins for production
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"] if settings.is_development else [],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["*"],
    )

    app.add_middleware(LoggingMiddleware)
    app.add_middleware(RequestIdMiddleware)

    # ---- Exception Handlers ----
    register_exception_handlers(app)

    # ---- Versioned API Routers ----
    app.include_router(v1_router, prefix=settings.api_v1_prefix)

    # Future versions:
    # app.include_router(v2_router, prefix="/api/v2")

    return app


app = create_app()
