-- Round A1 hardening: widen the status CHECK constraints to allow the
-- intermediate "claiming" states the new status-guarded mutations need.
--
--   primary_submissions: 'submitted' → 'processing' → 'completed'
--   operative_requests:  'requested' → 'approving'  → 'approved'
--
-- SQLite doesn't support ALTER TABLE ... DROP CONSTRAINT, so we use the
-- canonical "rename + recreate + copy" dance, all wrapped in a single
-- transaction so the table is never visible mid-rebuild.
--
-- Note: the legacy_alter_table pragma keeps the FK names stable so other
-- tables still reference these correctly after the rename.

PRAGMA legacy_alter_table = 1;

-- ===== primary_submissions =====
-- Add 'processing' to the allowed values; everything else stays the same.

CREATE TABLE primary_submissions_new (
  id TEXT PRIMARY KEY,
  primary_id TEXT NOT NULL REFERENCES primaries(id) ON DELETE CASCADE,
  submitted_by TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft','submitted','processing','completed','rejected')),
  period_start TEXT,
  period_end TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  item_count INTEGER NOT NULL DEFAULT 0,
  total_gross_minor INTEGER NOT NULL DEFAULT 0,
  submitted_at INTEGER NOT NULL,
  processed_at INTEGER,
  processed_by TEXT REFERENCES users(id),
  rejection_reason TEXT,
  created_at INTEGER NOT NULL,
  job_card_type TEXT,
  date_ending TEXT
);

INSERT INTO primary_submissions_new
  SELECT id, primary_id, submitted_by, status, period_start, period_end,
         notes, source, item_count, total_gross_minor, submitted_at,
         processed_at, processed_by, rejection_reason, created_at,
         job_card_type, date_ending
    FROM primary_submissions;

DROP TABLE primary_submissions;
ALTER TABLE primary_submissions_new RENAME TO primary_submissions;

-- ===== operative_requests =====
-- Add 'approving' to the allowed values.

CREATE TABLE operative_requests_new (
  id TEXT PRIMARY KEY,
  primary_id TEXT NOT NULL REFERENCES primaries(id) ON DELETE CASCADE,
  requested_by TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approving','approved','rejected','cancelled')),
  reviewed_at INTEGER,
  reviewed_by TEXT REFERENCES users(id),
  rejection_reason TEXT,
  resulting_subcontractor_id TEXT REFERENCES subcontractors(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO operative_requests_new
  SELECT id, primary_id, requested_by, name, mobile, email, notes, status,
         reviewed_at, reviewed_by, rejection_reason, resulting_subcontractor_id,
         created_at, updated_at
    FROM operative_requests;

DROP TABLE operative_requests;
ALTER TABLE operative_requests_new RENAME TO operative_requests;
