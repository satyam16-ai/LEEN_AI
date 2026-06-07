# =============================================================================
# Celery Application Configuration
# =============================================================================

from celery import Celery

from app.config import settings

# Use Redis as both broker and result backend
celery_app = Celery(
    "leen_ai",
    broker=f"redis://{settings.redis_host}:{settings.redis_port}/0",
    backend=f"redis://{settings.redis_host}:{settings.redis_port}/1",
)

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # Timezone
    timezone="UTC",
    enable_utc=True,

    # Task behavior
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,

    # Result expiration (24 hours)
    result_expires=86400,

    # Auto-discover tasks from all app modules
    task_routes={
        "app.core.tasks.*": {"queue": "default"},
    },
)

# Auto-discover tasks in all 'tasks' modules under app/
celery_app.autodiscover_tasks(["app.core"])
