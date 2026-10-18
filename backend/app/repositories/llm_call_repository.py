# =============================================================================
# LLM call repository
# =============================================================================

from sqlalchemy.orm import Session

from app.models.llm_call import LlmCall


def create(db: Session, **fields) -> LlmCall:
    call = LlmCall(**fields)
    db.add(call)
    db.flush()
    return call
