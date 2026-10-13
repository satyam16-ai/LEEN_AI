# =============================================================================
# User Repository — DB access for users
# =============================================================================

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user import User, UserRole


def get_by_id(db: Session, user_id: str) -> User | None:
    return db.get(User, user_id)


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower()))


def create(db: Session, *, name: str, email: str, password_hash: str, role: UserRole) -> User:
    user = User(name=name, email=email.lower(), password_hash=password_hash, role=role)
    db.add(user)
    db.flush()
    return user


def count_active_admins(db: Session) -> int:
    return (
        db.scalar(
            select(func.count(User.id)).where(User.role == UserRole.ADMIN, User.is_active.is_(True))
        )
        or 0
    )


def list_users(
    db: Session,
    *,
    role: UserRole | None,
    search: str | None,
    page: int,
    page_size: int,
    is_active: bool | None = None,
) -> tuple[list[User], int]:
    query = select(User)
    if role:
        query = query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.is_active.is_(is_active))
    if search:
        pattern = f"%{search.lower()}%"
        query = query.where(
            func.lower(User.email).like(pattern) | func.lower(User.name).like(pattern)
        )
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(
        query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return list(items), total


def count_by_role(db: Session) -> dict[str, int]:
    rows = db.execute(select(User.role, func.count()).group_by(User.role)).all()
    counts = {role.value: 0 for role in UserRole}
    for role, count in rows:
        counts[role.value] = count
    return counts
