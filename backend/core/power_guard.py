"""Power guard: keeps voice generation from overloading light hardware.

Entry-level GPUs (4–6 GB, e.g. GTX 1650) can pull enough power at full,
sustained load to trip the PSU or the display driver (Windows logs show
Kernel-Power 41 and nvlddmkm resets) and reboot the computer. The guard keeps
the load below that edge:

* GPU memory capped to a share of the card, so it never thrashes into system RAM;
* CPU threads capped to a share of the cores, and the engine runs at low priority;
* one GPU job at a time;
* a duty cycle: after each job the hardware rests in proportion to the time it
  worked, so heat and power never build up across a long narration.

Profiles (percentages of the hardware the engine may use):

===========  ==========  ====  ==========================================
profile      GPU memory  CPU   active time (rest = the remaining share)
===========  ==========  ====  ==========================================
safe         70 %        50 %  60 %   GPUs up to 6 GB
balanced     85 %        75 %  85 %   GPUs up to 10 GB and CPU-only computers
performance  90 %        90 %  95 %   larger GPUs (default there)
full         100 %       100 % 100 %  only when asked for explicitly
===========  ==========  ====  ==========================================

Whatever the profile, on NVIDIA cards every job also reads the GPU temperature
and power draw (``nvidia-smi``) and rests longer when the card runs hot or near
its power limit — a strong card on a weak power supply restarts a computer
just as easily as a small one.

``ELEVENVOICE_POWER_MODE`` (or the ``power_mode`` preference) picks one of
``safe``, ``balanced``, ``performance``, ``full`` or ``auto`` (default). Never raises.
"""
from __future__ import annotations

import logging
import math
import os
import threading
import time

logger = logging.getLogger("elevenvoice.power_guard")

PROFILES: dict[str, dict[str, float]] = {
    "safe": {"gpu_memory": 0.70, "cpu": 0.50, "duty": 0.60},
    "balanced": {"gpu_memory": 0.85, "cpu": 0.75, "duty": 0.85},
    "performance": {"gpu_memory": 0.90, "cpu": 0.90, "duty": 0.95},
    "full": {"gpu_memory": 1.00, "cpu": 1.00, "duty": 1.00},
}
MAX_REST_SECONDS = 30.0
HOT_C = 78          # rest as long as the job ran
CRITICAL_C = 84     # long rest
POWER_NEAR_LIMIT = 0.92
_lock = threading.Lock()
_applied: dict | None = None


def _requested_mode() -> str:
    mode = (os.environ.get("ELEVENVOICE_POWER_MODE") or "").strip().lower()
    if not mode:
        try:
            from core import prefs

            mode = str(prefs.get("power_mode") or "").strip().lower()
        except Exception:  # noqa: BLE001
            mode = ""
    return mode if mode in PROFILES or mode == "auto" else "auto"


def mode_for_hardware(gpu_total_gb: float | None) -> str:
    """Profile for a CUDA card of ``gpu_total_gb`` (None: no CUDA GPU)."""
    if gpu_total_gb is None:
        return "balanced"
    if gpu_total_gb <= 6.5:
        return "safe"
    if gpu_total_gb <= 10.5:
        return "balanced"
    return "performance"


def _gpu_total_gb(torch) -> float | None:
    try:
        if torch.cuda.is_available():
            return torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
    except Exception:  # noqa: BLE001
        pass
    return None


def resolve(torch=None) -> dict:
    """The active profile: ``{"mode", "gpu_memory", "cpu", "duty"}``."""
    mode = _requested_mode()
    if mode == "auto":
        if torch is None:
            try:
                import torch as _torch  # noqa: PLC0415

                torch = _torch
            except Exception:  # noqa: BLE001
                torch = None
        mode = mode_for_hardware(_gpu_total_gb(torch) if torch is not None else None)
    return {"mode": mode, **PROFILES[mode]}


def apply(torch=None) -> dict:
    """Apply the profile once per process (threads, VRAM share, priority, workers)."""
    global _applied
    with _lock:
        if _applied is not None:
            return dict(_applied)
        profile = resolve(torch)
        if profile["mode"] in ("safe", "balanced"):
            # One job on the GPU at a time unless the user explicitly asked for more.
            os.environ.setdefault("ELEVENVOICE_GPU_WORKERS", "1")
        try:
            if torch is None:
                import torch as _torch  # noqa: PLC0415

                torch = _torch
            cores = os.cpu_count() or 4
            torch.set_num_threads(max(1, math.floor(cores * profile["cpu"])))
            if profile["gpu_memory"] < 1.0 and torch.cuda.is_available():
                torch.cuda.set_per_process_memory_fraction(profile["gpu_memory"], 0)
                torch.backends.cudnn.benchmark = False
        except Exception as exc:  # noqa: BLE001
            logger.warning("power guard: torch limits not applied (%s)", exc)
        if profile["mode"] != "full":
            try:
                import psutil  # noqa: PLC0415

                proc = psutil.Process()
                if hasattr(psutil, "BELOW_NORMAL_PRIORITY_CLASS"):
                    proc.nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
                else:
                    proc.nice(min(19, max(proc.nice(), 5)))
            except Exception as exc:  # noqa: BLE001
                logger.warning("power guard: priority not lowered (%s)", exc)
        logger.info(
            "power guard: %s profile — GPU memory %d%%, CPU %d%%, active %d%%",
            profile["mode"], round(profile["gpu_memory"] * 100), round(profile["cpu"] * 100),
            round(profile["duty"] * 100),
        )
        _applied = profile
        return dict(profile)


def rest_seconds(busy_seconds: float, duty: float) -> float:
    """Rest after ``busy_seconds`` of work so active time stays at ``duty``."""
    if duty >= 1.0 or busy_seconds <= 0:
        return 0.0
    return min(MAX_REST_SECONDS, busy_seconds * (1.0 - duty) / max(duty, 0.05))


def gpu_vitals() -> tuple[float, float] | None:
    """(temperature °C, power draw / power limit) of the hottest NVIDIA GPU, or None."""
    import shutil
    import subprocess

    exe = shutil.which("nvidia-smi")
    if not exe:
        return None
    try:
        out = subprocess.run(
            [exe, "--query-gpu=temperature.gpu,power.draw,power.limit", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=3,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        ).stdout
        worst = None
        for line in out.strip().splitlines():
            temp, draw, limit = (part.strip() for part in line.split(","))
            ratio = float(draw) / float(limit) if limit not in ("", "[N/A]") and float(limit) > 0 else 0.0
            reading = (float(temp), ratio)
            worst = reading if worst is None or reading > worst else worst
        return worst
    except Exception:  # noqa: BLE001 — no reading never blocks generation
        return None


def thermal_rest(busy_seconds: float, vitals: tuple[float, float] | None) -> float:
    """Extra rest when the GPU is hot or close to its power limit."""
    if not vitals:
        return 0.0
    temp, power = vitals
    if temp >= CRITICAL_C:
        return MAX_REST_SECONDS
    if temp >= HOT_C or power >= POWER_NEAR_LIMIT:
        return min(MAX_REST_SECONDS, max(busy_seconds, 3.0))
    return 0.0


def guarded(fn):
    """Wrap a blocking GPU/CPU job so it rests afterwards per the profile."""

    def _run():
        profile = _applied or apply()
        start = time.monotonic()
        try:
            return fn()
        finally:
            busy = time.monotonic() - start
            pause = rest_seconds(busy, profile["duty"])
            if profile["mode"] != "full":
                pause = max(pause, thermal_rest(busy, gpu_vitals()))
            if pause > 0:
                time.sleep(pause)

    return _run
