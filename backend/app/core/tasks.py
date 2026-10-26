# =============================================================================
# Celery Tasks
# =============================================================================

import logging
import smtplib
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage

from app.config import settings
from app.core.celery_app import celery_app
from app.database import SessionLocal
from app.repositories import token_repository

logger = logging.getLogger("leen_ai")


@celery_app.task(name="app.core.tasks.health_check_task")
def health_check_task():
    """Sample task to verify Celery worker is running."""
    logger.info("Celery health check task executed successfully")
    return {"status": "healthy", "worker": "celery"}


def send_email(to_email: str, subject: str, body: str, html: str | None = None) -> None:
    message = EmailMessage()
    message["From"] = settings.email_from
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)
    if html:
        message.add_alternative(html, subtype="html")

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)


@celery_app.task(name="app.core.tasks.send_email_task", bind=True, max_retries=3)
def send_email_task(self, to_email, subject, body, html=None):
    """Send a transactional email via SMTP, retrying on failure."""
    try:
        send_email(to_email, subject, body, html)
        logger.info("Email sent: subject=%s", subject)
        return {"status": "sent"}
    except (smtplib.SMTPException, OSError) as exc:
        logger.exception("Email delivery failed; retrying")
        raise self.retry(exc=exc, countdown=60) from exc


@celery_app.task(name="app.core.tasks.cleanup_expired_tokens")
def cleanup_expired_tokens():
    """Daily: drop refresh/reset tokens that expired more than a day ago."""
    with SessionLocal() as db:
        refresh, reset = token_repository.purge_expired(
            db, older_than=datetime.now(UTC) - timedelta(days=1)
        )
        db.commit()
    logger.info("Token cleanup: %d refresh, %d reset tokens removed", refresh, reset)
    return {"refresh_tokens": refresh, "reset_tokens": reset}


@celery_app.task(name="app.core.tasks.read_syllabus_task")
def read_syllabus_task(subject_id: str):
    """The Syllabus Reader: a contents-page upload → a draft topic tree."""
    from app.services import syllabus_service

    syllabus_service.read_syllabus(subject_id)
