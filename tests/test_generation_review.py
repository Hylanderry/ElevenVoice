"""Version review on generation takes: approval + revision note.

  * Migration 0018 adds ``approved`` and ``review_note`` to an existing DB,
    keeps rows, no-ops on a fresh install, downgrades cleanly and converges
    with ``_BASE_SCHEMA`` (dual-path discipline).
  * ``PUT /history/{id}/review`` is a partial update: approve, note, or both;
    an empty note clears it; unknown takes 404; an empty body is rejected; a
    DB without the columns heals and succeeds.
  * Approved takes behave like starred ones for keeping: they stay visible past
    the recency window and the retention cap never prunes them.
"""
import sqlite3

from core.db import _BASE_SCHEMA
from test_generation_takes import (  # noqa: F401  (the `api` fixture is used by name)
    _cols,
    _insert_take,
    _patch_router_db,
    _run_alembic,
    _seed_pre_takes_db,
    _stamp,
    api,
)


def _review(dbf, take_id):
    with sqlite3.connect(str(dbf)) as conn:
        return conn.execute(
            "SELECT approved, review_note FROM generation_history WHERE id=?", (take_id,)
        ).fetchone()


# ── migration 0018 ───────────────────────────────────────────────────────────


def test_migration_0018_adds_review_columns_and_keeps_rows(tmp_path):
    dbf = tmp_path / "user.db"
    _seed_pre_takes_db(dbf)
    _stamp(str(dbf), "0008_pronunciation_dictionary")

    _run_alembic("upgrade", str(dbf))

    assert {"approved", "review_note"} <= _cols(dbf)
    with sqlite3.connect(str(dbf)) as conn:
        row = conn.execute(
            "SELECT text, COALESCE(approved, 0), review_note FROM generation_history WHERE id='old1'"
        ).fetchone()
    assert row == ("hello", 0, None)


def test_migration_0018_idempotent_on_fresh_install(tmp_path):
    dbf = tmp_path / "fresh.db"
    with sqlite3.connect(str(dbf)) as conn:
        conn.executescript(_BASE_SCHEMA)
    _stamp(str(dbf), "0017_job_events_unique_seq")
    _run_alembic("upgrade", str(dbf))  # columns already exist: must not raise
    assert {"approved", "review_note"} <= _cols(dbf)


def test_migration_0018_downgrade_drops_columns(tmp_path):
    dbf = tmp_path / "user.db"
    _seed_pre_takes_db(dbf)
    _stamp(str(dbf), "0008_pronunciation_dictionary")
    _run_alembic("upgrade", str(dbf))
    _run_alembic("downgrade", str(dbf), target="0017_job_events_unique_seq")
    assert not {"approved", "review_note"} & _cols(dbf)


def test_migrated_and_fresh_review_columns_match(tmp_path):
    mig = tmp_path / "mig.db"
    _seed_pre_takes_db(mig)
    _stamp(str(mig), "0008_pronunciation_dictionary")
    _run_alembic("upgrade", str(mig))

    fresh = tmp_path / "fresh.db"
    with sqlite3.connect(str(fresh)) as conn:
        conn.executescript(_BASE_SCHEMA)

    def shape(path):
        with sqlite3.connect(str(path)) as conn:
            return {
                r[1]: (r[2], r[4])
                for r in conn.execute("PRAGMA table_info(generation_history)")
                if r[1] in ("approved", "review_note")
            }

    assert shape(mig) == shape(fresh) == {"approved": ("INTEGER", "0"), "review_note": ("TEXT", "NULL")}


# ── review contract ──────────────────────────────────────────────────────────


def test_approve_and_note_are_partial_updates(api):
    client, dbf, outdir, _gen = api
    _insert_take(dbf, outdir, "t1", 1.0)

    r = client.put("/history/t1/review", json={"approved": True})
    assert r.status_code == 200
    assert r.json() == {"id": "t1", "approved": True, "note": None}

    r = client.put("/history/t1/review", json={"note": "  More pause before the last line.  "})
    assert r.json() == {"id": "t1", "approved": True, "note": "More pause before the last line."}
    assert _review(dbf, "t1") == (1, "More pause before the last line.")

    r = client.put("/history/t1/review", json={"approved": False})
    assert r.json()["note"] == "More pause before the last line."  # untouched
    assert _review(dbf, "t1") == (0, "More pause before the last line.")


def test_empty_note_clears_it(api):
    client, dbf, outdir, _gen = api
    _insert_take(dbf, outdir, "t1", 1.0)
    client.put("/history/t1/review", json={"note": "keep"})
    r = client.put("/history/t1/review", json={"note": "   "})
    assert r.json()["note"] is None
    assert _review(dbf, "t1") == (0, None)


def test_review_rejects_empty_body_and_long_note(api):
    client, dbf, outdir, _gen = api
    _insert_take(dbf, outdir, "t1", 1.0)
    assert client.put("/history/t1/review", json={}).status_code == 400
    assert client.put("/history/t1/review", json={"note": "x" * 2001}).status_code == 422


def test_review_unknown_take_404s(api):
    client, *_ = api
    assert client.put("/history/nope/review", json={"approved": True}).status_code == 404


def test_review_heals_pre_migration_schema(tmp_path, monkeypatch):
    import api.routers.generation as gen

    dbf = tmp_path / "old.db"
    _seed_pre_takes_db(dbf)
    _patch_router_db(monkeypatch, gen, dbf)
    monkeypatch.setattr(gen, "OUTPUTS_DIR", str(tmp_path))

    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    app = FastAPI()
    app.include_router(gen.router)
    client = TestClient(app, client=("127.0.0.1", 50000))

    r = client.put("/history/old1/review", json={"approved": True, "note": "final"})
    assert r.status_code == 200
    assert _review(dbf, "old1") == (1, "final")


# ── keeping approved takes ───────────────────────────────────────────────────


def test_list_history_includes_approved_beyond_recency_window(api):
    client, dbf, outdir, _gen = api
    for i in range(52):
        _insert_take(dbf, outdir, f"t{i:03d}", float(i))
    client.put("/history/t000/review", json={"approved": True})

    rows = client.get("/history").json()
    ids = [r["id"] for r in rows]
    assert "t000" in ids and "t001" not in ids
    approved = next(r for r in rows if r["id"] == "t000")
    assert approved["approved"] == 1 and "review_note" in approved


def test_prune_spares_approved_takes(api, monkeypatch):
    client, dbf, outdir, gen = api
    monkeypatch.setattr("core.prefs.get", lambda k, d=None: 3)
    wavs = {f"t{i}": _insert_take(dbf, outdir, f"t{i}", float(i)) for i in range(5)}
    client.put("/history/t0/review", json={"approved": True})

    assert gen._prune_history_over_cap() == 2

    with sqlite3.connect(str(dbf)) as conn:
        kept = {r[0] for r in conn.execute("SELECT id FROM generation_history")}
    assert kept == {"t0", "t3", "t4"}
    assert wavs["t0"].exists()
