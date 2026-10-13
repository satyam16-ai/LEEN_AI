# Claude Code bridge

The AI whiteboard tutor gets its answers from **Claude Code running on your machine**, not from an API key.

The API container can't see your Claude Code login, so this small server runs in a terminal on the host. The API reaches it at `http://host.docker.internal:8765`. For each doubt, the bridge starts a headless `claude -p` run and streams the text back.

## Run it

```bash
claude --version          # Claude Code must be installed
claude                    # sign in once, then exit
python3 infrastructure/claude-bridge/claude_bridge.py
```

Keep that terminal open while you use **Ask a doubt**. If the bridge isn't running, the app says "The AI tutor is offline".

| Option / env var | Default | Meaning |
| --- | --- | --- |
| `--host` / `CLAUDE_BRIDGE_HOST` | `127.0.0.1` | Bind address. Loopback is enough for Docker Desktop. |
| `--port` / `CLAUDE_BRIDGE_PORT` | `8765` | Port. If you change it, also change `CLAUDE_BRIDGE_URL` for the API. |
| `CLAUDE_BRIDGE_TOKEN` | `dev-bridge-token` | Shared secret. It must match the API's `CLAUDE_BRIDGE_TOKEN`. |
| `CLAUDE_BIN` | `claude` on `PATH` | Path to the Claude Code CLI. |
| `--max-concurrent` | `2` | Parallel runs allowed. Extra requests get `503 busy`. |
| `--timeout` | `300` | Seconds before a run is killed. |

**Plain Linux Docker Engine (not Docker Desktop):** containers reach the host through the bridge network gateway, so start the bridge with `--host 0.0.0.0`. Keep the token secret.

## What a run can do

Every run uses `--tools ""`, `--strict-mcp-config`, `--disable-slash-commands` and `--setting-sources ""`, and starts in an empty temporary directory. Claude can only produce text: it can't read files, run commands or load your plugins, hooks or MCP servers. A prompt-injected question can only change the words that come back, and the API validates those against the whiteboard action schema.

Requests need `Authorization: Bearer <token>`. Browsers send a CORS preflight for that header, and the bridge never answers one, so a web page can't use your Claude quota through the bridge.

## Protocol

`GET /health` returns `{"ok": true, "claude_version": "..."}`.

`POST /v1/stream` takes `{"system": "...", "prompt": "...", "model": "sonnet", "effort": "low"}`. The response streams `application/x-ndjson`, one event per line:

```json
{"type": "start"}
{"type": "text", "text": "..."}
{"type": "done", "duration_ms": 8123, "cost_usd": 0.02}
```

On failure, the stream ends with `{"type": "error", "message": "..."}` instead of `done`.

## Production

This bridge is for development and demos on your own machine. A deployed LEEN AI should call the Anthropic API instead. Only `backend/app/services/llm/claude_bridge.py` needs to change.

## Tests

```bash
python3 -m pytest infrastructure/claude-bridge -q
```
