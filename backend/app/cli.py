# =============================================================================
# Management CLI
#   python -m app.cli create-admin --email admin@leen.ai --name "Admin"
#   python -m app.cli board-eval --label v1 --out evals/board-v1.json
# =============================================================================

import argparse
import asyncio
import getpass
import json
import sys
from pathlib import Path

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


def board_eval(args: argparse.Namespace) -> None:
    from app.services.whiteboard import board_eval as evaluation

    report = asyncio.run(evaluation.run_board_eval(args.label))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")

    print(f"{'subject':<12} {'actions':>7} {'dropped':>7} {'in':>6} {'out':>6} {'cached':>7}  question")
    for run in report["runs"]:
        status = f"  ERROR {run['error']}" if run["error"] else ""
        print(
            f"{run['subject']:<12} {run['actions']:>7} {run['dropped']:>7} "
            f"{run['input_tokens']:>6} {run['output_tokens']:>6} {run['cache_read_tokens']:>7}  "
            f"{run['question'][:50]}{status}"
        )
    print(
        f"median: actions {report['median_actions']:g}, input {report['median_input_tokens']:g}, "
        f"output {report['median_output_tokens']:g} tokens -> {out}"
    )

    if args.compare:
        baseline = json.loads(Path(args.compare).read_text())
        problems = evaluation.compare(report, baseline)
        for problem in problems:
            print(f"FAIL: {problem}")
        if problems:
            sys.exit(1)
        print(f"OK: no worse than {args.compare}")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)

    admin = commands.add_parser("create-admin", help="Create an admin account")
    admin.add_argument("--email", required=True)
    admin.add_argument("--name", required=True)
    admin.add_argument("--password", help="Omit to be prompted securely")
    admin.set_defaults(func=create_admin)

    evaluation = commands.add_parser(
        "board-eval", help="Run sample doubts through the board teacher and report tokens"
    )
    evaluation.add_argument("--label", required=True)
    evaluation.add_argument("--out", required=True)
    evaluation.add_argument("--compare", help="Baseline report; exit 1 if this run is worse")
    evaluation.set_defaults(func=board_eval)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
