-- Email verification for self-serve signup. After signup we create the
-- account immediately but require email verification before first
-- sign-in. Token lives in a small dedicated table with TTL; we sweep
-- expired rows opportunistically.
--
-- email_verified flag on users itself so login can refuse cheaply.
-- Backfill: existing accounts (admin-created, approved-by-admin, etc.)
-- are treated as already-verified — they got their welcome email
-- through a trusted path.
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  used_at     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_email_verify_user ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verify_exp  ON email_verification_tokens(expires_at);
