"""Preflight reports what is already on the computer (ffmpeg, downloaded models).

The checks are informational: they always pass, so nothing a user already has (or
lacks) can block setup, and they carry structured fields the client localizes.
"""
from api.routers.setup import wizard
from services import media_tools


def _by_id(checks):
    return {check["id"]: check for check in checks}


def test_reports_found_ffmpeg_and_cached_models(monkeypatch):
    monkeypatch.setattr(media_tools, "_resolve", lambda tool: "/usr/bin/ffmpeg")
    monkeypatch.setattr(media_tools, "_classify_origin", lambda tool, path: "system")
    monkeypatch.setattr(media_tools, "_tool_version", lambda path: "7.1")
    first = wizard.KNOWN_MODELS[0]["repo_id"]
    monkeypatch.setattr(wizard, "is_cached", lambda repo_id: repo_id == first)

    checks = _by_id(wizard._installed_checks())

    ffmpeg = checks["installed_ffmpeg"]
    assert ffmpeg["status"] == "pass"
    assert ffmpeg["found"] is True
    assert (ffmpeg["origin"], ffmpeg["version"], ffmpeg["path"]) == ("system", "7.1", "/usr/bin/ffmpeg")
    models = checks["installed_models"]
    assert models["status"] == "pass"
    assert models["found"] is True
    assert [item["repo_id"] for item in models["items"]] == [first]


def test_missing_items_never_block_setup(monkeypatch):
    monkeypatch.setattr(media_tools, "_resolve", lambda tool: None)
    monkeypatch.setattr(wizard, "is_cached", lambda repo_id: False)

    checks = _by_id(wizard._installed_checks())

    assert checks["installed_ffmpeg"]["status"] == "pass"
    assert checks["installed_ffmpeg"]["found"] is False
    assert checks["installed_models"]["status"] == "pass"
    assert checks["installed_models"]["items"] == []


def test_lookup_errors_degrade_to_not_found(monkeypatch):
    def boom(_tool):
        raise OSError("PATH unreadable")

    monkeypatch.setattr(media_tools, "_resolve", boom)

    def broken_cache(_repo_id):
        raise OSError("cache unreadable")

    monkeypatch.setattr(wizard, "is_cached", broken_cache)

    checks = _by_id(wizard._installed_checks())

    assert checks["installed_ffmpeg"]["found"] is False
    assert checks["installed_models"]["found"] is False
