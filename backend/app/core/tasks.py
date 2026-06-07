# =============================================================================
# Celery Tasks — Sample/Foundation Tasks
# =============================================================================

import logging

from app.core.celery_app import celery_app

logger = logging.getLogger("leen_ai")


@celery_app.task(name="app.core.tasks.health_check_task")
def health_check_task():
    """Sample task to verify Celery worker is running."""
    logger.info("Celery health check task executed successfully")
    return {"status": "healthy", "worker": "celery"}


@celery_app.task(name="app.core.tasks.send_email_task", bind=True, max_retries=3)
def send_email_task(self, to_email, subject, body):
    """
    Placeholder email task — demonstrates retry logic.
    Replace with actual email sending when implementing notifications.
    """
    try:
        # TODO: Implement actual email sending (SMTP / SendGrid / SES)
        logger.info("Email task: to=%s subject=%s", to_email, subject)
        return {"status": "sent", "to": to_email}
    except Exception as exc:
        logger.exception("Email task failed for %s", to_email)
        raise self.retry(exc=exc, countdown=60)
