-- Self-serve signup requests. Anyone can submit one without an account
-- (the form is on the public marketing pages); admin reviews + approves
-- to create the actual user/sub/primary record.
--
-- We don't store passwords in this table — the admin's approve step
-- generates a temp password the same way handleAdminCreateSubcontractor
-- and handleAdminApproveOperativeRequest do.
--
-- kind: 'subcontractor' (operative requesting an account) or 'primary'
-- (developer / main contractor requesting an account).
CREATE TABLE IF NOT EXISTS signup_requests (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('subcontractor','primary')),
  full_name       TEXT NOT NULL,
  email           TEXT NOT NULL,
  mobile          TEXT,
  -- Sub-only fields
  trade           TEXT,
  -- Primary-only fields
  company_name    TEXT,
  company_vat     TEXT,
  -- Free-text "tell us a bit more"
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approving','approved','rejected','spam')),
  reviewed_at     INTEGER,
  reviewed_by     TEXT REFERENCES users(id),
  rejection_reason TEXT,
  -- Once approved, points at the user we created.
  resulting_user_id TEXT REFERENCES users(id),
  ip              TEXT,
  user_agent      TEXT,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_signup_status ON signup_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_signup_email  ON signup_requests(LOWER(email));
