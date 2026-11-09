import json

import pytest

from core import agent_access, prefs


@pytest.fixture
def tmp_prefs(tmp_path, monkeypatch):
    path = tmp_path / "prefs.json"
    monkeypatch.setattr(prefs, "_PREFS_PATH", str(path))
    agent_access._cache = None
    yield path
    agent_access._cache = None


def test_switches_default_on(tmp_prefs):
    assert agent_access.settings() == {"mcp": True, "openai_api": True}
    assert agent_access.blocked_feature("/mcp/") is None


def test_switching_off_blocks_only_that_surface(tmp_prefs):
    agent_access.update({"mcp": False})
    assert json.loads(tmp_prefs.read_text())["agent_access"] == {"mcp": False, "openai_api": True}
    assert agent_access.blocked_feature("/mcp") == "mcp"
    assert agent_access.blocked_feature("/mcp/tools") == "mcp"
    assert agent_access.blocked_feature("/v1/audio/speech") is None
    assert agent_access.blocked_feature("/generate") is None
    agent_access.update({"openai_api": False, "mcp": True})
    assert agent_access.blocked_feature("/v1/models") == "openai_api"
    assert agent_access.blocked_feature("/mcp/") is None


def test_agent_calls_keep_the_model_warm(tmp_prefs, monkeypatch):
    from services import model_manager

    monkeypatch.setattr(agent_access, "_last_agent_call", 0.0)
    base = model_manager._resolve_idle_timeout()
    agent_access.note_agent_call()
    assert model_manager._resolve_idle_timeout() == max(base, agent_access.AGENT_WARM_SECONDS)
