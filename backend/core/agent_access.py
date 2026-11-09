"""Switches for how outside tools reach the engine.

``mcp``        — the MCP server at /mcp (Claude, Cursor, Codex, Hermes and other agents).
``openai_api`` — the OpenAI-compatible API under /v1 (n8n, scripts, SDKs).

Both default on and are stored in prefs.json, so they survive restarts. The
app's own screens use other routes and are never blocked by these switches.
"""
from __future__ import annotations

import json
import os
import threading
import time

from core import prefs

PREF_KEY = "agent_access"
DEFAULTS = {"mcp": True, "openai_api": True}
_GATES = (("/mcp", "mcp"), ("/v1/", "openai_api"))
_cache_lock = threading.Lock()
_cache: tuple[float, dict] | None = None
# Agents call in bursts; while one is active the voice model stays loaded longer
# so each call skips the reload (see model_manager._resolve_idle_timeout).
AGENT_WARM_SECONDS = 3600.0
_last_agent_call = 0.0


def note_agent_call() -> None:
    global _last_agent_call
    _last_agent_call = time.monotonic()


def agent_recently_active(window: float = AGENT_WARM_SECONDS) -> bool:
    return _last_agent_call > 0 and time.monotonic() - _last_agent_call < window


def _prefs_mtime() -> float:
    try:
        return os.path.getmtime(prefs._PREFS_PATH)  # noqa: SLF001 — same package
    except OSError:
        return 0.0


def settings() -> dict:
    """Current switches; cached until prefs.json changes."""
    global _cache
    mtime = _prefs_mtime()
    with _cache_lock:
        if _cache and _cache[0] == mtime:
            return dict(_cache[1])
    saved = prefs.get(PREF_KEY) or {}
    value = {k: bool(saved.get(k, v)) if isinstance(saved, dict) else v for k, v in DEFAULTS.items()}
    with _cache_lock:
        _cache = (mtime, value)
    return dict(value)


def update(changes: dict) -> dict:
    current = settings()
    for key in DEFAULTS:
        if key in changes and isinstance(changes[key], bool):
            current[key] = changes[key]
    prefs.set_(PREF_KEY, current)
    global _cache
    with _cache_lock:
        _cache = None
    return settings()


def blocked_feature(path: str) -> str | None:
    """The switched-off feature ``path`` belongs to, or None."""
    current = None
    for prefix, key in _GATES:
        if path == prefix.rstrip("/") or path.startswith(prefix):
            current = current or settings()
            if not current[key]:
                return key
    return None


class AgentAccessMiddleware:
    """Answer 403 for MCP or /v1 requests while their switch is off."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            feature = blocked_feature(path)
            if not feature and (path.startswith("/mcp") or path.startswith("/v1/")):
                note_agent_call()
            if feature:
                label = "MCP" if feature == "mcp" else "The OpenAI-compatible API"
                body = json.dumps({
                    "code": f"{feature}_disabled",
                    "message": f"{label} is turned off. Turn it on in ElevenVoice → Integrations.",
                }).encode()
                await send({
                    "type": "http.response.start",
                    "status": 403,
                    "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())],
                })
                await send({"type": "http.response.body", "body": body})
                return
        await self.app(scope, receive, send)
