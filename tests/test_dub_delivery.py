"""Client delivery for dubbing projects: pre-delivery checks and the package.

The check rules run on plain data (``services.dub_delivery``); the router test
fakes the job lookup and exporters so no pipeline or job directory is needed.
"""
import io
import json
import wave
import zipfile

import numpy as np
import pytest

from services import dub_delivery


def _wav(path, samples, rate=16000):
    data = (np.clip(samples, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        handle.writeframes(data.tobytes())
    return str(path)


def _tone(seconds, amplitude=0.3, rate=16000):
    t = np.arange(int(seconds * rate)) / rate
    return amplitude * np.sin(2 * np.pi * 220 * t)


def _by_id(result):
    return {(item["id"], item["lang"]): item for item in result["items"]}


def _job(**tracks):
    return {
        "filename": "intro.mp4",
        "duration": 10.0,
        "segments": [{"id": 0, "start": 0, "end": 2, "text": "Hello"}],
        "dubbed_tracks": tracks,
    }


# ── checks ───────────────────────────────────────────────────────────────────


def test_ready_project_passes_every_check(tmp_path):
    path = _wav(tmp_path / "es.wav", _tone(9.5))
    job = _job(es={"path": "es.wav", "duration": 9.5})
    result = dub_delivery.check_delivery(job, {"es": path}, {"es": [{"text": "Hola"}]})
    assert result["status"] == "pass"
    assert result["languages"] == ["es"]
    assert {item["status"] for item in result["items"]} == {"pass"}


def test_project_without_transcript_or_tracks_fails():
    result = dub_delivery.check_delivery({"segments": [], "dubbed_tracks": {}}, {}, {})
    items = _by_id(result)
    assert result["status"] == "fail"
    assert items[("transcript", None)]["status"] == "fail"
    assert items[("tracks", None)]["status"] == "fail"


def test_missing_track_file_fails_that_language(tmp_path):
    job = _job(fr={"path": "gone.wav"})
    result = dub_delivery.check_delivery(job, {"fr": str(tmp_path / "gone.wav")}, {"fr": []})
    assert result["status"] == "fail"
    assert _by_id(result)[("track_file", "fr")]["status"] == "fail"


def test_untranslated_segments_warn_with_counts(tmp_path):
    path = _wav(tmp_path / "de.wav", _tone(5))
    job = _job(de={"path": "de.wav", "duration": 5})
    segments = [{"text": "Hallo"}, {"text": "  "}, {"text": None}]
    item = _by_id(dub_delivery.check_delivery(job, {"de": path}, {"de": segments}))[("untranslated", "de")]
    assert (item["status"], item["count"], item["total"]) == ("warn", 2, 3)


def test_silent_and_clipped_tracks_are_flagged(tmp_path):
    silent = _wav(tmp_path / "silent.wav", np.zeros(16000))
    loud = _wav(tmp_path / "loud.wav", np.full(16000, 1.0))
    job = _job(it={"path": "silent.wav", "duration": 1}, pt={"path": "loud.wav", "duration": 1})
    items = _by_id(dub_delivery.check_delivery(job, {"it": silent, "pt": loud}, {}))
    assert items[("silent", "it")]["status"] == "fail"
    assert items[("clipping", "pt")]["status"] == "warn"
    assert items[("clipping", "pt")]["percent"] == 100.0


def test_track_longer_than_source_warns_unless_video_is_stretched(tmp_path):
    path = _wav(tmp_path / "es.wav", _tone(1))
    long_track = _job(es={"path": "es.wav", "duration": 12.0})
    assert _by_id(dub_delivery.check_delivery(long_track, {"es": path}, {}))[("duration", "es")]["status"] == "warn"
    stretched = _job(es={"path": "es.wav", "duration": 12.0, "timing_strategy": "stretch_video"})
    assert _by_id(dub_delivery.check_delivery(stretched, {"es": path}, {}))[("duration", "es")]["status"] == "pass"
    within = _job(es={"path": "es.wav", "duration": 10.4})
    assert _by_id(dub_delivery.check_delivery(within, {"es": path}, {}))[("duration", "es")]["status"] == "pass"


def test_unreadable_audio_is_a_failed_check_not_a_crash(tmp_path):
    bad = tmp_path / "bad.wav"
    bad.write_bytes(b"not audio")
    result = dub_delivery.check_delivery(_job(es={"path": "bad.wav"}), {"es": str(bad)}, {})
    assert _by_id(result)[("audio", "es")]["status"] == "fail"


def test_script_text_has_times_and_speakers():
    text = dub_delivery.script_text([
        {"start": 0, "text": "Olá"},
        {"start": 65.4, "text": "Tudo bem?", "speaker": "Ana"},
        {"start": 70, "text": "   "},
    ])
    assert text == "[00:00:00] Olá\n[00:01:05] Ana: Tudo bem?\n"


# ── router ───────────────────────────────────────────────────────────────────


@pytest.fixture
def client(tmp_path, monkeypatch):
    import api.routers.dub_delivery as router_module
    from fastapi import FastAPI, Response
    from fastapi.testclient import TestClient

    track = _wav(tmp_path / "track_es.wav", _tone(2))
    job = _job(es={"path": "track_es.wav", "duration": 2.0})
    job["segments"] = [{"id": 0, "start": 0, "end": 2, "text": "Hola"}]
    jobs = {"job1": job}
    monkeypatch.setattr(router_module, "_get_job", lambda job_id: jobs.get(job_id))
    monkeypatch.setattr(router_module, "_job_dir_or_400", lambda job_id: str(tmp_path / job_id))
    monkeypatch.setattr(router_module, "_optional_dub_artifact", lambda value, job_id: track if value else None)

    async def srt(job_id, dual=False, lang=None):
        return Response(content=f"1\n00:00:00,000 --> 00:00:02,000\nHola {lang}\n")

    async def vtt(job_id, dual=False, lang=None):
        return Response(content="WEBVTT\n")

    monkeypatch.setattr(router_module, "dub_export_srt", srt)
    monkeypatch.setattr(router_module, "dub_export_vtt", vtt)
    app = FastAPI()
    app.include_router(router_module.router)
    return TestClient(app, client=("127.0.0.1", 50000))


def test_check_endpoint_reports_items(client):
    body = client.get("/dub/delivery/check/job1").json()
    assert body["filename"] == "intro.mp4"
    assert body["status"] == "pass"
    assert client.get("/dub/delivery/check/nope").status_code == 404


def test_package_contains_audio_subtitles_script_and_report(client):
    response = client.get("/dub/delivery/package/job1")
    assert response.status_code == 200
    assert "intro_delivery.zip" in response.headers["content-disposition"]
    names = set(zipfile.ZipFile(io.BytesIO(response.content)).namelist())
    assert names == {
        "intro/audio/intro_es.wav",
        "intro/subtitles/intro_es.srt",
        "intro/subtitles/intro_es.vtt",
        "intro/script/intro_es.txt",
        "intro/delivery-report.txt",
        "intro/delivery.json",
    }
    archive = zipfile.ZipFile(io.BytesIO(response.content))
    assert json.loads(archive.read("intro/delivery.json"))["languages"] == ["es"]
    assert "Hola es" in archive.read("intro/subtitles/intro_es.srt").decode()


def test_package_without_ready_tracks_is_refused(client):
    assert client.get("/dub/delivery/package/job1?langs=fr").status_code == 409
