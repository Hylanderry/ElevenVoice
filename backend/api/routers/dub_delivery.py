"""Client delivery for dubbing projects: a pre-delivery check and a ready-to-send package.

``GET  /dub/delivery/check/{job_id}``   — what is ready, what needs attention.
``GET  /dub/delivery/package/{job_id}`` — one zip per project: dubbed audio,
SRT/VTT subtitles and the timed script for each language, plus the check report.
"""
from __future__ import annotations

import asyncio
import json
import os
import time
import zipfile
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse

from api.routers.dub_core import _get_job, _safe_lang_or_400
from api.routers.dub_export import (
    _job_dir_or_400,
    _optional_dub_artifact,
    _segments_for_lang,
    dub_export_srt,
    dub_export_vtt,
)
from core.browser_guard import reject_cross_site_get
from core.http_headers import content_disposition
from core.path_security import portable_filename
from services import dub_delivery

router = APIRouter(tags=["Dubbing delivery"])

# Packages older than this are swept when a new one is written.
PACKAGE_RETENTION_SECONDS = 24 * 60 * 60


def _job_or_404(job_id: str) -> dict:
    _job_dir_or_400(job_id)
    job = _get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def _assess(job_id: str, job: dict) -> tuple[dict, dict[str, Optional[str]]]:
    tracks = job.get("dubbed_tracks") or {}
    paths: dict[str, Optional[str]] = {}
    for lang, info in tracks.items():
        value = info.get("path") if isinstance(info, dict) else None
        try:
            paths[lang] = _optional_dub_artifact(value, job_id)
        except HTTPException:
            paths[lang] = None  # an unsafe stored path is reported as a missing track
    segments = {lang: _segments_for_lang(job, lang) for lang in tracks}
    return dub_delivery.check_delivery(job, paths, segments), paths


@router.get("/dub/delivery/check/{job_id}", dependencies=[Depends(reject_cross_site_get)])
async def delivery_check(job_id: str):
    job = _job_or_404(job_id)
    result, _paths = await asyncio.to_thread(_assess, job_id, job)
    return {"job_id": job_id, "filename": job.get("filename") or "", **result}


def _sweep_old_packages(folder: str) -> None:
    cutoff = time.time() - PACKAGE_RETENTION_SECONDS
    try:
        entries = list(os.scandir(folder))
    except FileNotFoundError:
        return
    for entry in entries:
        if entry.is_file() and entry.name.startswith("delivery_") and entry.stat().st_mtime < cutoff:
            try:
                os.remove(entry.path)
            except OSError:
                pass


@router.get("/dub/delivery/package/{job_id}", dependencies=[Depends(reject_cross_site_get)])
async def delivery_package(
    job_id: str,
    langs: str = Query("", description="Comma-separated language codes; empty includes every dubbed language."),
):
    job = _job_or_404(job_id)
    result, paths = await asyncio.to_thread(_assess, job_id, job)
    wanted = [_safe_lang_or_400(lang.strip()) for lang in langs.split(",") if lang.strip()]
    langs = [lang for lang in result["languages"] if not wanted or lang in wanted]
    langs = [lang for lang in langs if paths.get(lang)]
    if not langs:
        raise HTTPException(status_code=409, detail="No dubbed track is ready to deliver.")

    base = portable_filename(os.path.splitext(job.get("filename") or "project")[0], "project")
    files: list[tuple[str, bytes | str]] = []
    for lang in langs:
        for exporter, ext in ((dub_export_srt, "srt"), (dub_export_vtt, "vtt")):
            try:
                response = await exporter(job_id, dual=False, lang=lang)
                files.append((f"{base}/subtitles/{base}_{lang}.{ext}", bytes(response.body)))
            except HTTPException:
                pass  # no transcript for this track: the check report already says so
        script = dub_delivery.script_text(_segments_for_lang(job, lang))
        if script:
            files.append((f"{base}/script/{base}_{lang}.txt", script.encode("utf-8")))
    files.append((f"{base}/delivery-report.txt", dub_delivery.report_text(job.get("filename") or base, result).encode("utf-8")))
    files.append((f"{base}/delivery.json", json.dumps({"job_id": job_id, "languages": langs, **result}, indent=2).encode("utf-8")))

    folder = os.path.join(_job_dir_or_400(job_id), "exports")
    os.makedirs(folder, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    target = os.path.join(folder, f"delivery_{stamp}.zip")

    def _write() -> None:
        _sweep_old_packages(folder)
        tmp = target + ".part"
        with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for lang in langs:
                # Audio is already compressed or large PCM: store it as is.
                archive.write(
                    paths[lang],
                    f"{base}/audio/{base}_{lang}{os.path.splitext(paths[lang])[1] or '.wav'}",
                    compress_type=zipfile.ZIP_STORED,
                )
            for name, data in files:
                archive.writestr(name, data)
        os.replace(tmp, target)

    await asyncio.to_thread(_write)
    download = portable_filename(f"{base}_delivery.zip", "delivery.zip")
    return FileResponse(
        target,
        media_type="application/zip",
        headers={"Content-Disposition": content_disposition(download)},
    )
