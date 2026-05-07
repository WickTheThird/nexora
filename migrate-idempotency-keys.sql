-- Round A6: idempotency keys for create endpoints. Frontend supplies an
-- Idempotency-Key header (crypto.randomUUID per click); worker caches the
-- response for 24h and replays it on retry.
--
-- Scoped per-user so two users can't collide on the same UUID. Auto-swept
-- by the worker on every check (cheap at low volume).
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key             TEXT PRIMARY KEY,
  owner_user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response_body   TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys(created_at);
