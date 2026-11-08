"""The first OmniVoice import is serialized.

Startup preload and a /generate that arrives during it both call
``_lazy_omnivoice`` on different threads. Without serialization one thread could
receive the half-initialized module ("cannot import name 'OmniVoice'"). The
import body must run once, with every caller getting the same class.
"""
import threading
import time

import services.model_manager as mm


def test_concurrent_first_imports_run_once_and_agree(monkeypatch):
    monkeypatch.setattr(mm, "_OmniVoice", None)
    inside = 0
    peak = 0
    calls = 0
    guard = threading.Lock()

    class FakeOmniVoice:
        pass

    def slow_import():
        nonlocal inside, peak, calls
        with guard:
            inside += 1
            calls += 1
            peak = max(peak, inside)
        time.sleep(0.05)  # widen the window two unsynchronized imports would race in
        with guard:
            inside -= 1
        if mm._OmniVoice is None:
            mm._OmniVoice = FakeOmniVoice
        return mm._OmniVoice

    monkeypatch.setattr(mm, "_import_omnivoice_locked", slow_import)

    results = []
    threads = [threading.Thread(target=lambda: results.append(mm._lazy_omnivoice())) for _ in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert peak == 1, "two threads were inside the first import at once"
    assert results == [FakeOmniVoice] * 8


def test_cached_class_skips_the_lock(monkeypatch):
    sentinel = object()
    monkeypatch.setattr(mm, "_OmniVoice", sentinel)

    def must_not_run():
        raise AssertionError("import ran although the class was cached")

    monkeypatch.setattr(mm, "_import_omnivoice_locked", must_not_run)
    assert mm._lazy_omnivoice() is sentinel
