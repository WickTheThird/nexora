-- Operative Request flow (Enagh-style). Principal user requests a new
-- operative; admin reviews + approves (which creates the actual
-- subcontractor record + sends a temp-password invite) or rejects with a
-- reason. Status drives the principal-side visibility on their page.

CREATE TABLE IF NOT EXISTS operative_requests (
  id TEXT PRIMARY KEY,
  primary_id TEXT NOT NULL REFERENCES primaries(id) ON DELETE CASCADE,
  requested_by TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','rejected','cancelled')),
  reviewed_at INTEGER,
  reviewed_by TEXT REFERENCES users(id),
  rejection_reason TEXT,
  -- Once approved, this points at the Subcontractor row that was created.
  resulting_subcontractor_id TEXT REFERENCES subcontractors(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_op_requests_primary ON operative_requests(primary_id);
CREATE INDEX IF NOT EXISTS idx_op_requests_status ON operative_requests(status);
