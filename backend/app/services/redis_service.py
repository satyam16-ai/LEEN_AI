# =============================================================================
# Redis Service
# =============================================================================

import logging

import redis

from app.config import settings

logger = logging.getLogger("leen_ai")


class RedisService:
    """Redis connection wrapper for cache and pub/sub operations."""

    def __init__(self):
        self._client: redis.Redis | None = None

    def connect(self) -> None:
        """Establish connection to Redis."""
        try:
            self._client = redis.Redis(
                host=settings.redis_host,
                port=settings.redis_port,
                decode_responses=True,
                socket_connect_timeout=5,
            )
            self._client.ping()
            logger.info("Redis connected at %s:%d", settings.redis_host, settings.redis_port)
        except redis.ConnectionError:
            logger.warning(
                "Redis unavailable at %s:%d — cache features will be disabled",
                settings.redis_host,
                settings.redis_port,
            )
            self._client = None

    def disconnect(self) -> None:
        """Close Redis connection."""
        if self._client:
            self._client.close()
            logger.info("Redis connection closed")

    @property
    def client(self) -> redis.Redis | None:
        return self._client

    @property
    def is_connected(self) -> bool:
        if not self._client:
            return False
        try:
            self._client.ping()
            return True
        except redis.ConnectionError:
            return False


redis_service = RedisService()
