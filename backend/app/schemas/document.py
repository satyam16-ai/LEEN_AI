# =============================================================================
# Document schemas — a student's uploaded book pages
# =============================================================================

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    subject: str
    topic_id: str | None
    title: str
    media_type: str
    pages: int
    # queued | reading | ready | failed
    status: str
    error: str | None
    created_at: datetime
