# =============================================================================
# Parent ↔ Student link schemas
# =============================================================================

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.user import UserSummary


class LinkCodeOut(BaseModel):
    code: str
    expires_at: datetime


class CodeRequest(BaseModel):
    code: str = Field(min_length=4, max_length=20)


class LinkedParentOut(UserSummary):
    linked_at: datetime


class LinkedChildOut(UserSummary):
    linked_at: datetime
    grade: int | None = None
    board: str | None = None
    school_name: str | None = None
    profile_complete: bool = False
    class_count: int = 0
