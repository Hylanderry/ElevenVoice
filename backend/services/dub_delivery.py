"""Pre-delivery checks and client delivery content for a dubbing project.

Pure functions: the router resolves the job's files and passes them in, so the
rules here are testable without a job directory or a running pipeline.

A check item is ``{"id", "status", "lang", **params}`` with status ``pass``,
``warn`` or ``fail``. The client turns ids + params into localized text.
"""
from __future__ import annotations

import math
import os
from typing import Callable, Iterable

# A dubbed track may run a little past the source (fades, a trailing breath)
# before it is worth a warning.
DURATION_TOLERANCE_RATIO = 0.03
DURATION_TOLERANCE_SECONDS = 0.5
# Under this RMS the track is treated as silent (≈ -80 dBFS).
SILENT_RMS = 1e-4
# Samples at or above this magnitude count as clipped.
CLIP_LEVEL = 0.999
# Warn once more than this share of samples is clipped.
CLIP_FRACTION_WARN = 0.001

_BLOCK_FRAMES = 1 << 18


def audio_levels(path: str) -> dict:
    """Peak, RMS and clipped-sample share of a track, read in blocks."""
    import numpy as np
    import soundfile as sf

    peak = 0.0
    sum_sq = 0.0
    clipped = 0
    count = 0
    with sf.SoundFile(path) as handle:
        rate = handle.samplerate
        for block in handle.blocks(blocksize=_BLOCK_FRAMES, dtype="float32", always_2d=True):
            if not block.size:
                continue
            magnitude = np.abs(block)
            peak = max(peak, float(magnitude.max()))
            sum_sq += float(np.square(block, dtype=np.float64).sum())
            clipped += int((magnitude >= CLIP_LEVEL).sum())
            count += block.size
        frames = handle.frames
    rms = math.sqrt(sum_sq / count) if count else 0.0
    return {
        "peak": peak,
        "rms": rms,
        "clipped_fraction": clipped / count if count else 0.0,
        "seconds": frames / rate if rate else 0.0,
    }


def _blank(text: object) -> bool:
    return not isinstance(text, str) or not text.strip()


def check_delivery(
    job: dict,
    track_paths: dict[str, str | None],
    segments_by_lang: dict[str, list],
    levels: Callable[[str], dict] = audio_levels,
) -> dict:
    """Assess whether a dubbing project is ready to hand over."""
    items: list[dict] = []
    segments = job.get("segments") or []
    items.append({
        "id": "transcript",
        "status": "pass" if segments else "fail",
        "lang": None,
        "count": len(segments),
    })
    tracks = job.get("dubbed_tracks") or {}
    items.append({
        "id": "tracks",
        "status": "pass" if tracks else "fail",
        "lang": None,
        "count": len(tracks),
    })
    source_seconds = float(job.get("duration") or 0)
    for lang in sorted(tracks):
        info = tracks[lang] if isinstance(tracks[lang], dict) else {}
        path = track_paths.get(lang)
        if not path or not os.path.isfile(path):
            items.append({"id": "track_file", "status": "fail", "lang": lang})
            continue
        items.append({"id": "track_file", "status": "pass", "lang": lang})

        lang_segments = segments_by_lang.get(lang) or []
        missing = sum(1 for seg in lang_segments if _blank(seg.get("text")))
        items.append({
            "id": "untranslated",
            "status": "warn" if missing else "pass",
            "lang": lang,
            "count": missing,
            "total": len(lang_segments),
        })

        try:
            measured = levels(path)
        except Exception as exc:  # unreadable audio is a delivery blocker, not a crash
            items.append({"id": "audio", "status": "fail", "lang": lang, "error": type(exc).__name__})
            continue
        if measured["rms"] < SILENT_RMS:
            items.append({"id": "silent", "status": "fail", "lang": lang})
        else:
            clipped = measured["clipped_fraction"]
            items.append({
                "id": "clipping",
                "status": "warn" if clipped > CLIP_FRACTION_WARN else "pass",
                "lang": lang,
                "percent": round(clipped * 100, 2),
            })

        track_seconds = float(info.get("duration") or measured.get("seconds") or 0)
        stretches_video = info.get("timing_strategy") == "stretch_video"
        limit = source_seconds * (1 + DURATION_TOLERANCE_RATIO) + DURATION_TOLERANCE_SECONDS
        over = source_seconds > 0 and not stretches_video and track_seconds > limit
        items.append({
            "id": "duration",
            "status": "warn" if over else "pass",
            "lang": lang,
            "track_seconds": round(track_seconds, 1),
            "source_seconds": round(source_seconds, 1),
        })

    worst = "pass"
    for item in items:
        if item["status"] == "fail":
            worst = "fail"
            break
        if item["status"] == "warn":
            worst = "warn"
    return {"status": worst, "languages": sorted(tracks), "items": items}


def _clock(seconds: float) -> str:
    seconds = max(0, int(seconds or 0))
    return f"{seconds // 3600:02d}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}"


def script_text(segments: Iterable[dict]) -> str:
    """The dubbed script with start times, one line per segment."""
    lines = []
    for seg in segments:
        text = (seg.get("text") or "").strip()
        if not text:
            continue
        speaker = seg.get("speaker") or seg.get("speaker_id")
        prefix = f"[{_clock(seg.get('start', 0))}]"
        lines.append(f"{prefix} {speaker}: {text}" if speaker else f"{prefix} {text}")
    return "\n".join(lines) + ("\n" if lines else "")


def report_text(filename: str, result: dict) -> str:
    """Plain-text summary of the checks, shipped inside the delivery package."""
    lines = [f"Delivery report: {filename}", f"Overall: {result['status'].upper()}", ""]
    for item in result["items"]:
        lang = f" [{item['lang']}]" if item.get("lang") else ""
        extras = {k: v for k, v in item.items() if k not in ("id", "status", "lang")}
        detail = ", ".join(f"{k}={v}" for k, v in extras.items())
        lines.append(f"{item['status'].upper():5} {item['id']}{lang}" + (f" ({detail})" if detail else ""))
    return "\n".join(lines) + "\n"
