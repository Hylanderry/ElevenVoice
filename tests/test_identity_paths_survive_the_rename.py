"""The visible product name changed; established user-data identities did not."""

import json
import os
import re

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WHY = (
    "This identity locates existing user data. Changing it without a migration "
    "silently orphans voices, projects, settings, or runtime files."
)


def _read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as file:
        return file.read()


def test_electron_recognises_the_final_tauri_identity():
    source = _read("electron/src/main/backend.ts")
    assert "const TAURI_APP_ID = 'com.hylanderry.elevenvoice'" in source, WHY


def test_the_backend_data_directories_migrate_from_the_previous_names():
    """New ElevenVoice folders, and the old ones are still found and moved."""
    source = _read("backend/core/config.py")
    for literal in ('"ElevenVoice", "data"', '"ElevenVoice", "hf_cache"', '".elevenvoice"', '"Omni" + "Voice"', "_move_legacy_dir", "_rename_legacy_files"):
        assert literal in source, f"{literal} is missing. {WHY}"


def test_the_database_filename_is_unchanged():
    assert "elevenvoice.db" in _read("backend/core/config.py"), WHY


def test_the_python_package_name_is_unchanged():
    assert re.search(r'(?m)^name\s*=\s*"omnivoice"', _read("pyproject.toml")), WHY


def test_the_model_class_name_is_unchanged():
    import omnivoice
    from services.model_manager import _lazy_omnivoice

    assert _lazy_omnivoice() is omnivoice.OmniVoice, WHY


@pytest.mark.parametrize("env_var", ["ELEVENVOICE_DATA_DIR", "ELEVENVOICE_CACHE_DIR"])
def test_the_public_env_var_prefix_is_unchanged(env_var):
    source = _read("backend/core/config.py") + _read("backend/core/user_env.py")
    assert env_var in source, WHY


def test_the_product_and_artifact_names_are_eleven_voice():
    config = json.loads(_read("config/app.json"))
    builder = _read("electron/electron-builder.config.mjs")
    assert config["productName"] == "ElevenVoice"
    assert "productName: PRODUCT_NAME" in builder
    assert "artifactPrefix" in builder
