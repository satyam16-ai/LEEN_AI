#!/usr/bin/env python3
"""Claude Code bridge: lets the dockerized API use the Claude Code CLI on this machine.

The API container cannot see your Claude Code login, so this tiny server runs in a
terminal on the host instead. For every request it starts a headless, tool-less
`claude -p` run and streams the generated text back as NDJSON:

    {"type": "start"}
    {"type": "text", "text": "..."}            (many)
    {"type": "done", "duration_ms": 1234, "cost_usd": 0.01}
    {"type": "error", "message": "..."}         (instead of done, on failure)

Standard library only. Run it with:

    python3 infrastructure/claude-bridge/claude_bridge.py
"""

import argparse
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DEFAULT_TOKEN = "dev-bridge-token"
MAX_BODY_BYTES = 256 * 1024
ALLOWED_EFFORTS = {"low", "medium", "high", "xhigh", "max"}

log = logging.getLogger("claude-bridge")


def build_command(claude_bin, system, model, effort):
    """Headless run with every tool, MCP server, plugin and setting source disabled."""
    command = [
        claude_bin,
        "-p",
        "--output-format", "stream-json",
        "--verbose",
        "--include-partial-messages",
        "--no-session-persistence",
        "--tools", "",
        "--strict-mcp-config",
        "--disable-slash-commands",
        "--setting-sources", "",
        "--system-prompt", system,
    ]
    if model:
        command += ["--model", model]
    if effort:
        command += ["--effort", effort]
    return command


def extract_event(line):
    """Translate one line of `claude --output-format stream-json` into a bridge event.

    Returns None for lines the client does not need (init, thinking, message
    bookkeeping). Only visible text deltas and the final result are forwarded.
    """
    line = line.strip()
    if not line:
        return None
    try:
        event = json.loads(line)
    except json.JSONDecodeError:
        return None

    kind = event.get("type")
    if kind == "stream_event":
        inner = event.get("event") or {}
        delta = inner.get("delta") or {}
        if inner.get("type") == "content_block_delta" and delta.get("type") == "text_delta":
            text = delta.get("text") or ""
            return {"type": "text", "text": text} if text else None
        return None

    if kind == "result":
        if event.get("is_error") or event.get("subtype") != "success":
            message = event.get("result") or event.get("subtype") or "Claude Code run failed"
            return {"type": "error", "message": str(message)[:500]}
        return {
            "type": "done",
            "duration_ms": event.get("duration_ms"),
            "cost_usd": event.get("total_cost_usd"),
        }

    return None


class Bridge:
    def __init__(self, claude_bin, token, max_concurrent, timeout):
        self.claude_bin = claude_bin
        self.token = token
        self.timeout = timeout
        self.slots = threading.BoundedSemaphore(max_concurrent)
        self.workdir = tempfile.mkdtemp(prefix="claude-bridge-")

    def version(self):
        try:
            result = subprocess.run(
                [self.claude_bin, "--version"], capture_output=True, text=True, timeout=20
            )
            return result.stdout.strip() or None
        except (OSError, subprocess.TimeoutExpired):
            return None


class Handler(BaseHTTPRequestHandler):
    server_version = "ClaudeBridge/1.0"
    bridge: Bridge  # set on the class in main()

    def log_message(self, format, *args):  # noqa: A002 - signature from the base class
        log.debug("%s - %s", self.address_string(), format % args)

    # -- helpers -------------------------------------------------------------

    def _json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self):
        return self.headers.get("Authorization") == f"Bearer {self.bridge.token}"

    def _emit(self, payload):
        self.wfile.write((json.dumps(payload) + "\n").encode())
        self.wfile.flush()

    # -- routes --------------------------------------------------------------

    def do_GET(self):  # noqa: N802 - http.server naming
        if self.path != "/health":
            return self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
        if not self._authorized():
            return self._json(HTTPStatus.UNAUTHORIZED, {"error": "bad token"})
        version = self.bridge.version()
        self._json(HTTPStatus.OK, {"ok": version is not None, "claude_version": version})

    def do_POST(self):  # noqa: N802 - http.server naming
        if self.path != "/v1/stream":
            return self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
        if not self._authorized():
            return self._json(HTTPStatus.UNAUTHORIZED, {"error": "bad token"})
        if self.headers.get_content_type() != "application/json":
            return self._json(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, {"error": "expected JSON"})

        length = int(self.headers.get("Content-Length") or 0)
        if not 0 < length <= MAX_BODY_BYTES:
            return self._json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "bad body size"})
        try:
            body = json.loads(self.rfile.read(length))
            system = str(body["system"])
            prompt = str(body["prompt"])
        except (ValueError, KeyError, TypeError):
            return self._json(HTTPStatus.BAD_REQUEST, {"error": "need system and prompt"})
        model = str(body.get("model") or "") or None
        effort = body.get("effort") if body.get("effort") in ALLOWED_EFFORTS else None

        if not self.bridge.slots.acquire(blocking=False):
            return self._json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "busy"})
        try:
            self._stream(system, prompt, model, effort)
        finally:
            self.bridge.slots.release()

    def _stream(self, system, prompt, model, effort):
        started = time.monotonic()
        command = build_command(self.bridge.claude_bin, system, model, effort)
        process = subprocess.Popen(
            command,
            cwd=self.bridge.workdir,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        # Kill runaway runs; the watchdog is cancelled once the process exits.
        watchdog = threading.Timer(self.bridge.timeout, process.kill)
        watchdog.start()

        # No Content-Length: the body ends when the connection closes (HTTP/1.0 style).
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/x-ndjson")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

        outcome = "error"
        try:
            process.stdin.write(prompt)
            process.stdin.close()
            self._emit({"type": "start"})

            finished = False
            for line in process.stdout:
                event = extract_event(line)
                if event is None:
                    continue
                self._emit(event)
                if event["type"] in ("done", "error"):
                    outcome = event["type"]
                    finished = True
                    break

            process.wait(timeout=10)
            if not finished:
                stderr = (process.stderr.read() or "").strip()
                reason = "timed out" if process.returncode == -9 else f"exit {process.returncode}"
                self._emit({"type": "error", "message": stderr[-500:] or f"claude {reason}"})
        except (BrokenPipeError, ConnectionResetError):
            outcome = "client disconnected"
        except subprocess.TimeoutExpired:
            outcome = "did not exit"
        finally:
            watchdog.cancel()
            if process.poll() is None:
                process.kill()
                process.wait()
            log.info(
                "stream model=%s effort=%s %s in %.1fs (prompt %d chars)",
                model or "default",
                effort or "default",
                outcome,
                time.monotonic() - started,
                len(prompt),
            )


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--host", default=os.environ.get("CLAUDE_BRIDGE_HOST", "127.0.0.1"))
    parser.add_argument(
        "--port", type=int, default=int(os.environ.get("CLAUDE_BRIDGE_PORT", "8765"))
    )
    parser.add_argument("--max-concurrent", type=int, default=2)
    parser.add_argument("--timeout", type=int, default=300, help="seconds per run")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    claude_bin = os.environ.get("CLAUDE_BIN") or shutil.which("claude")
    if not claude_bin:
        sys.exit("Could not find the `claude` CLI. Install Claude Code and run `claude` once to sign in.")

    token = os.environ.get("CLAUDE_BRIDGE_TOKEN", DEFAULT_TOKEN)
    Handler.bridge = Bridge(claude_bin, token, args.max_concurrent, args.timeout)
    version = Handler.bridge.version()
    if not version:
        sys.exit(f"`{claude_bin} --version` failed. Is Claude Code installed correctly?")

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.daemon_threads = True
    log.info("Claude Code bridge (%s) listening on http://%s:%d", version, args.host, args.port)
    if token == DEFAULT_TOKEN:
        log.info("Using the default dev token; set CLAUDE_BRIDGE_TOKEN to change it.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info("Stopping")
    finally:
        server.server_close()
        shutil.rmtree(Handler.bridge.workdir, ignore_errors=True)


if __name__ == "__main__":
    main()
