# =============================================================================
# Celery Tasks
# =============================================================================

import logging
import smtplib
from email.message import EmailMessage

from app.config import settings
from app.core.celery_app import celery_app

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
