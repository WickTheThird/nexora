-- In-app notifications. Every system event that emails a user also stores
-- a notification row so the user has a history they can see in the bell
-- icon. Idempotent in spirit: kind + entity_type + entity_id + recipient
-- caps duplicates. Read state is per-user (read_at).
--
-- Categories ("kind"):
--   submission_received    — admin: principal submitted a Job Card
--   submission_processed   — principal: admin processed it (advices live)
--   submission_rejected    — principal: admin rejected
--   advice_issued          — sub: a new payment advice is waiting
--   invoice_issued         — principal: BC raised an invoice for them
--   invoice_paid           — principal: invoice marked paid
--   operative_request_*    — admin/principal: lifecycle of an op-request
--   pairing_proposed       — principal: admin wants to assign sub X to you
--   pairing_revoked        — sub: a principal/admin closed the relationship
--   contract_signed        — principal: an operative under you signed
--   change_request_*       — admin: principal opened/updated a change req
--   welcome                — anyone: account created
CREATE TABLE IF NOT EXISTS notifications (
  id              TEXT PRIMARY KEY,
  recipient_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT,
  -- Optional deep link the user clicks to act on it.
  link            TEXT,
  -- Optional pointer back to the entity that produced this notification.
  entity_type     TEXT,
  entity_id       TEXT,
  read_at         INTEGER,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(recipient_id, read_at);

-- Per-user notification preferences. Currently just a JSON-ish map of
-- kind → channel (email / in_app / both / none). Empty/missing row =
-- defaults (everything goes both channels).
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- Stored as JSON string. Worker parses + merges with defaults.
  prefs_json  TEXT,
  updated_at  INTEGER NOT NULL
);
