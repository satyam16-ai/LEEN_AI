# =============================================================================
# Fixed-window rate limiter backed by Redis. Fails open if Redis is down.
# =============================================================================

import logging
from collections.abc import Callable

import redis
from fastapi import HTTPException, Request, status

from app.config import settings
from app.services.redis_service import redis_service

logger = logging.getLogger("leen_ai")

TOO_MANY = "Too many attempts. Please wait a moment and try again."


def client_ip(request: Request) -> str:
    # Nginx overwrites X-Real-IP with the peer address; X-Forwarded-For is client-appendable.
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


def hit(key: str, limit: int, window_seconds: int) -> int | None:
    """Record one hit for `key`. Returns seconds until reset when over the limit, else None."""
    if not settings.rate_limit_enabled:
        return None
    client = redis_service.client
    if client is None:
        return None
    redis_key = f"ratelimit:{key}"
    try:
        pipe = client.pipeline()
        pipe.incr(redis_key)
        pipe.expire(redis_key, window_seconds, nx=True)
        pipe.ttl(redis_key)
        count, _, ttl = pipe.execute()
    except redis.RedisError:
        logger.warning("Rate limiter unavailable; allowing request")
        return None
    if count <= limit:
        return None
    return max(int(ttl), 1)


def enforce(key: str, limit: int, window_seconds: int) -> None:
    retry_after = hit(key, limit, window_seconds)
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=TOO_MANY,
            headers={"Retry-After": str(retry_after)},
        )


def rate_limit(scope: str, limit: int, window_seconds: int, key_fn: Callable[[Request], str]):
    """Dependency factory limiting requests per key derived from the request."""

    def dependency(request: Request) -> None:
        enforce(f"{scope}:{key_fn(request)}", limit, window_seconds)

    return dependency
