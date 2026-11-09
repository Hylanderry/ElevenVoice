"""In-process HTTP callers (the MCP tools) follow the backend's real bind address."""
import pathlib
import re

import pytest


@pytest.mark.parametrize("env,expected", [
    ({}, "http://127.0.0.1:3900"),
    ({"ELEVENVOICE_PORT": "3912"}, "http://127.0.0.1:3912"),
    ({"ELEVENVOICE_PORT": "3912", "ELEVENVOICE_BIND_HOST": "0.0.0.0"}, "http://127.0.0.1:3912"),
    ({"ELEVENVOICE_BIND_HOST": "::"}, "http://[::1]:3900"),
    ({"ELEVENVOICE_BIND_HOST": "192.168.1.5", "ELEVENVOICE_PORT": "4000"}, "http://192.168.1.5:4000"),
    ({"ELEVENVOICE_API_URL": "https://proxy.example/vs/", "ELEVENVOICE_PORT": "4000"},
     "https://proxy.example/vs"),
])
def test_backend_self_url(monkeypatch, env, expected):
    from services.network_share import backend_self_url

    for name in ("ELEVENVOICE_PORT", "ELEVENVOICE_BIND_HOST", "ELEVENVOICE_API_URL"):
        monkeypatch.delenv(name, raising=False)
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    assert backend_self_url() == expected


@pytest.mark.parametrize("env,expected", [
    ({}, "http://127.0.0.1:3900"),
    ({"ELEVENVOICE_HOST": "10.0.0.2", "ELEVENVOICE_PORT": "3912"}, "http://10.0.0.2:3912"),
    # A remote backend behind a TLS proxy with a path prefix (exported by the
    # Integrations → Model Context Protocol card) keeps scheme and prefix.
    ({"ELEVENVOICE_URL": "https://gpu.example/elevenvoice/", "ELEVENVOICE_PORT": "1"},
     "https://gpu.example/elevenvoice"),
])
def test_mcp_shim_targets_the_configured_backend(monkeypatch, env, expected):
    from mcp_shim.__main__ import _base_url

    for name in ("ELEVENVOICE_URL", "ELEVENVOICE_HOST", "ELEVENVOICE_PORT"):
        monkeypatch.delenv(name, raising=False)
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    assert _base_url() == (f"{expected}/mcp/", f"{expected}/health")


def test_no_backend_module_hard_codes_the_default_port():
    """Class guard: backend code resolves its own URL, never a literal :39xx URL."""
    root = pathlib.Path(__file__).resolve().parents[1] / "backend"
    pattern = re.compile(r"""["']https?://(?:localhost|127\.0\.0\.1):39\d\d""")
    # Documented CLI fallbacks, used only when no env var names the backend.
    allowed = {"speech_client/__main__.py"}
    offenders = [
        rel for p in root.rglob("*.py")
        if (rel := p.relative_to(root).as_posix()) not in allowed
        and pattern.search(p.read_text(encoding="utf-8", errors="ignore"))
    ]
    assert offenders == []


@pytest.mark.parametrize("url,sent", [
    ("http://127.0.0.1:3912", True),
    ("http://[::1]:3900", True),
    ("https://gpu.example/elevenvoice", True),
    ("http://192.168.1.5:3900", False),  # plain http off-host: never leak the key
])
def test_api_key_only_travels_over_https_or_loopback(monkeypatch, url, sent):
    from mcp_shim.__main__ import _credentials_allowed
    from services.network_share import backend_auth_headers

    monkeypatch.setenv("ELEVENVOICE_API_KEY", "k" * 40)
    expected = {"Authorization": "Bearer " + "k" * 40} if sent else {}
    assert backend_auth_headers(url) == expected
    assert _credentials_allowed(url) is sent
    monkeypatch.delenv("ELEVENVOICE_API_KEY")
    assert backend_auth_headers(url) == {}
