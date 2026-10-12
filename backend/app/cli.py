# =============================================================================
# Management CLI
#   python -m app.cli create-admin --email admin@leen.ai --name "Admin"
# =============================================================================

import argparse
import getpass
import sys

from fastapi import HTTPException
from pydantic import TypeAdapter, ValidationError

from app.database import SessionLocal
from app.models.user import UserRole
from app.schemas.user import Email, Name, Password
from app.services import auth_service


def _validate(adapter_type, value: str, label: str) -> str:
    try:
        return TypeAdapter(adapter_type).validate_python(value)
    except ValidationError as exc:
        message = exc.errors()[0]["msg"].removeprefix("Value error, ")
        sys.exit(f"Invalid {label}: {message}")


def create_admin(args: argparse.Namespace) -> None:
    email = _validate(Email, args.email, "email")
    name = _validate(Name, args.name, "name")
    password = args.password or getpass.getpass("Password: ")
    if not args.password and password != getpass.getpass("Confirm password: "):
        sys.exit("Passwords do not match")
    password = _validate(Password, password, "password")

    with SessionLocal() as db:
        try:
            user = auth_service.create_user(
                db, name=name, email=email, password=password, role=UserRole.ADMIN
            )
        except HTTPException as exc:
            sys.exit(str(exc.detail))
    print(f"Admin created: {user.email}")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)

    admin = commands.add_parser("create-admin", help="Create an admin account")
    admin.add_argument("--email", required=True)
    admin.add_argument("--name", required=True)
    admin.add_argument("--password", help="Omit to be prompted securely")
    admin.set_defaults(func=create_admin)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
