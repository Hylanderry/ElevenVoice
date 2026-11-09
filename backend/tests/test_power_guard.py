import time

import pytest

from core import power_guard


@pytest.fixture(autouse=True)
def fresh(monkeypatch):
    monkeypatch.setattr(power_guard, "_applied", None)
    monkeypatch.delenv("ELEVENVOICE_POWER_MODE", raising=False)
    yield


def test_light_gpus_get_the_safe_profile():
    assert power_guard.mode_for_hardware(4.0) == "safe"  # GTX 1650
    assert power_guard.mode_for_hardware(6.0) == "safe"
    assert power_guard.mode_for_hardware(8.0) == "balanced"
    assert power_guard.mode_for_hardware(None) == "balanced"  # CPU only
    assert power_guard.mode_for_hardware(24.0) == "performance"  # never 100 % by default


def test_explicit_mode_wins(monkeypatch):
    monkeypatch.setenv("ELEVENVOICE_POWER_MODE", "full")
    assert power_guard.resolve()["mode"] == "full"
    monkeypatch.setenv("ELEVENVOICE_POWER_MODE", "nonsense")
    assert power_guard.resolve()["mode"] in power_guard.PROFILES


def test_rest_keeps_the_active_share():
    # 60 % active: 6 s of work → 4 s of rest.
    assert power_guard.rest_seconds(6.0, 0.60) == pytest.approx(4.0)
    assert power_guard.rest_seconds(600.0, 0.60) == power_guard.MAX_REST_SECONDS
    assert power_guard.rest_seconds(5.0, 1.0) == 0.0


def test_guarded_job_rests_after_running(monkeypatch):
    monkeypatch.setattr(power_guard, "_applied", {"mode": "safe", "gpu_memory": 0.7, "cpu": 0.5, "duty": 0.5})
    slept = []
    clock = iter([100.0, 104.0])
    monkeypatch.setattr(time, "monotonic", lambda: next(clock))
    monkeypatch.setattr(time, "sleep", lambda s: slept.append(s))
    monkeypatch.setattr(power_guard, "gpu_vitals", lambda: None)
    assert power_guard.guarded(lambda: "ok")() == "ok"
    assert slept == [pytest.approx(4.0)]  # 4 s of work at 50 % → 4 s of rest


def test_hot_or_power_limited_gpus_rest_longer():
    assert power_guard.thermal_rest(10.0, None) == 0.0
    assert power_guard.thermal_rest(10.0, (65.0, 0.5)) == 0.0
    assert power_guard.thermal_rest(10.0, (80.0, 0.5)) == 10.0
    assert power_guard.thermal_rest(1.0, (60.0, 0.97)) == 3.0
    assert power_guard.thermal_rest(1.0, (90.0, 0.5)) == power_guard.MAX_REST_SECONDS
