-- Multiple OAuth identities can point at one app_user (google now, lichess
-- later). Composite PK on (provider, subject) prevents the same provider
-- account from being linked twice, and makes the start-of-callback lookup
-- O(1).
CREATE TABLE IF NOT EXISTS oauth_identity (
  provider   TEXT   NOT NULL,
  subject    TEXT   NOT NULL,
  user_id    BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  linked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, subject)
);
CREATE INDEX IF NOT EXISTS idx_oauth_identity_user ON oauth_identity(user_id);

-- Allow Google-only accounts to exist without a password.
ALTER TABLE app_user ALTER COLUMN password_hash DROP NOT NULL;
