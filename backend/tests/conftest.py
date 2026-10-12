import os
import re

# Point the app at a dedicated test database before any app module is imported.
_BASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://leen:leen_dev_password@localhost:5432/leen_ai"
)
_SERVER_URL, _ = _BASE_URL.rsplit("/", 1)
TEST_DB = "leen_ai_test"
os.environ["DATABASE_URL"] = f"{_SERVER_URL}/{TEST_DB}"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["APP_ENV"] = "test"

import psycopg  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import UserRole  # noqa: E402
from app.services import auth_service  # noqa: E402

CSRF = {"X-Requested-With": "XMLHttpRequest"}
PASSWORD = "Str0ngPass!"


def _ensure_test_database() -> None:
    with psycopg.connect(f"{_SERVER_URL}/postgres", autocommit=True) as conn:
        exists = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (TEST_DB,)).fetchone()
        if exists is None:
            conn.execute(f'CREATE DATABASE "{TEST_DB}"')


@pytest.fixture(scope="session", autouse=True)
def _schema():
    _ensure_test_database()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _clean_tables():
    yield
    tables = ", ".join(table.name for table in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} CASCADE"))


class _Outbox(list):
    def delay(self, to_email, subject, body, html=None):
        self.append({"to": to_email, "subject": subject, "body": body, "html": html})

    def reset_token_for(self, email: str) -> str:
        message = next(m for m in reversed(self) if m["to"] == email)
        return re.search(r"token=([\w-]+)", message["body"]).group(1)


@pytest.fixture(autouse=True)
def outbox(monkeypatch):
    box = _Outbox()
    monkeypatch.setattr(auth_service, "send_email_task", box)
    return box


@pytest.fixture
def make_client():
    def factory(**kwargs) -> TestClient:
        headers = kwargs.pop("headers", CSRF)
        return TestClient(app, headers=headers, **kwargs)

    return factory


@pytest.fixture
def client(make_client):
    return make_client()


@pytest.fixture
def create_user():
    def factory(email: str, role: UserRole, password: str = PASSWORD, name: str = "Test User"):
        with SessionLocal() as db:
            return auth_service.create_user(
                db, name=name, email=email, password=password, role=role
            )

    return factory


@pytest.fixture
def login(make_client):
    def factory(email: str, password: str = PASSWORD, remember_me: bool = False) -> TestClient:
        session_client = make_client()
        response = session_client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password, "remember_me": remember_me},
        )
        assert response.status_code == 200, response.text
        return session_client

    return factory
