"""Generation takes: approval and revision note on generation_history

Revision ID: 0018_generation_history_review
Revises: 0017_job_events_unique_seq
Create Date: 2026-11-06 00:00:00.000000

Adds ``generation_history.approved INTEGER DEFAULT 0`` and
``generation_history.review_note TEXT DEFAULT NULL`` behind version review:
approve the take a project signs off on and keep a note of what changed.
Approved takes are exempt from the retention cap, like starred ones, and both
round-trip through ``PUT /history/{id}/review``.

Additive + idempotent (guarded by PRAGMA table_info, like 0009). The same
columns are declared in ``core/db.py::_BASE_SCHEMA`` so fresh installs and
migrated DBs converge, and ``_reconcile_additive_columns`` adds them where
alembic cannot run.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0018_generation_history_review"
down_revision: Union[str, None] = "0017_job_events_unique_seq"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    rows = bind.execute(sa.text(f"PRAGMA table_info({table})")).fetchall()
    return any(r[1] == column for r in rows)


def _has_table(name: str) -> bool:
    bind = op.get_bind()
    row = bind.execute(
        sa.text("SELECT name FROM sqlite_master WHERE type='table' AND name=:n"),
        {"n": name},
    ).fetchone()
    return row is not None


def upgrade() -> None:
    if not _has_table("generation_history"):
        return
    # Literal DDL so the shape byte-matches _BASE_SCHEMA (the dual-path
    # convergence test compares a migrated DB with a fresh install).
    if not _has_column("generation_history", "approved"):
        op.execute("ALTER TABLE generation_history ADD COLUMN approved INTEGER DEFAULT 0")
    if not _has_column("generation_history", "review_note"):
        op.execute("ALTER TABLE generation_history ADD COLUMN review_note TEXT DEFAULT NULL")


def downgrade() -> None:
    if not _has_table("generation_history"):
        return
    for column in ("review_note", "approved"):
        if _has_column("generation_history", column):
            op.drop_column("generation_history", column)
