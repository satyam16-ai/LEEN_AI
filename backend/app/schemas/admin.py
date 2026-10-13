# =============================================================================
# Admin user-detail schema
# =============================================================================

from pydantic import BaseModel

from app.schemas.classroom import ClassroomOut, StudentClassOut
from app.schemas.family import LinkedChildOut, LinkedParentOut
from app.schemas.profile import StudentProfileOut
from app.schemas.user import UserOut


class AdminUserDetail(BaseModel):
    user: UserOut
    student_profile: StudentProfileOut | None = None
    parents: list[LinkedParentOut] = []
    children: list[LinkedChildOut] = []
    classes_taught: list[ClassroomOut] = []
    classes_enrolled: list[StudentClassOut] = []
