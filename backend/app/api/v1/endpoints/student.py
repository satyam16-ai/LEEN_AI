# =============================================================================
# Student Endpoints — /api/v1/student (parent link code, classes, doubts)
# =============================================================================

from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.v1.dependencies.auth import require_roles
from app.core import rate_limit
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.family import CodeRequest
from app.schemas.response import ok
from app.schemas.whiteboard import AnswerCreate, DoubtCreate, TurnCreate
from app.services import classroom_service, family_service, whiteboard_service

router = APIRouter()
current_student = require_roles(UserRole.STUDENT)
# New doubts and turns on a board are limited separately: replies, checks and practice add up.
DOUBT_LIMIT = 15
TURN_LIMIT = 40
ANSWER_LIMIT = 120


@router.get("/link-code")
def get_link_code(student: User = Depends(current_student), db: Session = Depends(get_db)):
    return ok(family_service.get_link_code(db, student))


@router.post("/link-code")
def regenerate_link_code(student: User = Depends(current_student), db: Session = Depends(get_db)):
    return ok(family_service.regenerate_link_code(db, student), "New code generated")


@router.get("/parents")
def list_parents(student: User = Depends(current_student), db: Session = Depends(get_db)):
    return ok(family_service.list_parents(db, student))


@router.delete("/parents/{parent_id}")
def remove_parent(
    parent_id: str, student: User = Depends(current_student), db: Session = Depends(get_db)
):
    family_service.unlink(db, parent_id, student.id)
    return ok(message="Parent access removed")


@router.get("/classes")
def list_classes(student: User = Depends(current_student), db: Session = Depends(get_db)):
    return ok(classroom_service.list_for_student(db, student))


@router.post("/classes/join", status_code=status.HTTP_201_CREATED)
def join_class(
    payload: CodeRequest, student: User = Depends(current_student), db: Session = Depends(get_db)
):
    rate_limit.enforce(f"class-join:{student.id}", 10, 900)
    joined = classroom_service.join(db, student, payload.code)
    return ok(joined, f"You joined {joined.name}")


@router.delete("/classes/{classroom_id}")
def leave_class(
    classroom_id: str, student: User = Depends(current_student), db: Session = Depends(get_db)
):
    classroom_service.leave(db, student, classroom_id)
    return ok(message="You left the class")


def _board_stream(start: whiteboard_service.TurnStart, student: User) -> StreamingResponse:
    if start.cached_actions is not None:
        events = whiteboard_service.stream_cached(start.doubt, start.cached_actions)
    else:
        events = whiteboard_service.stream_solution(
            start.doubt,
            start.event_id,
            start.system,
            start.prompt,
            student.id,
            start.agent,
            start.sources,
        )
    return StreamingResponse(
        events,
        media_type="text/event-stream",
        # Nginx would otherwise buffer the stream and the board would draw in one go.
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/doubts")
def ask_doubt(
    payload: DoubtCreate, student: User = Depends(current_student), db: Session = Depends(get_db)
):
    """Stream the whiteboard explanation as server-sent events."""
    rate_limit.enforce(f"doubt:{student.id}", DOUBT_LIMIT, 3600)
    return _board_stream(whiteboard_service.start_doubt(db, student, payload), student)


@router.post("/doubts/{doubt_id}/turns")
def add_doubt_turn(
    doubt_id: str,
    payload: TurnCreate,
    student: User = Depends(current_student),
    db: Session = Depends(get_db),
):
    """Stream a follow-up, reply, another explanation, check or practice onto the same board."""
    rate_limit.enforce(f"doubt-turn:{student.id}", TURN_LIMIT, 3600)
    return _board_stream(whiteboard_service.start_turn(db, student, doubt_id, payload), student)


@router.post("/doubts/{doubt_id}/answers")
def answer_question(
    doubt_id: str,
    payload: AnswerCreate,
    student: User = Depends(current_student),
    db: Session = Depends(get_db),
):
    """Check the student's answer to a question on the board (in code, no model call)."""
    rate_limit.enforce(f"answer:{student.id}", ANSWER_LIMIT, 3600)
    return ok(whiteboard_service.submit_answer(db, student, doubt_id, payload))


@router.get("/doubts")
def list_doubts(student: User = Depends(current_student), db: Session = Depends(get_db)):
    return ok(whiteboard_service.list_doubts(db, student))


@router.get("/doubts/{doubt_id}")
def get_doubt(
    doubt_id: str, student: User = Depends(current_student), db: Session = Depends(get_db)
):
    return ok(whiteboard_service.get_doubt(db, student, doubt_id))


@router.delete("/doubts/{doubt_id}")
def delete_doubt(
    doubt_id: str, student: User = Depends(current_student), db: Session = Depends(get_db)
):
    whiteboard_service.delete_doubt(db, student, doubt_id)
    return ok(message="Doubt deleted")
