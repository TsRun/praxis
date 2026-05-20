-- Per-user API keys for programmatic access (MCP server, CI, etc).
-- The full key is shown ONCE at mint time; only the SHA-256 hash is stored.
-- key_prefix (first 12 chars of the issued key) is kept verbatim so the user
-- can recognise their own keys in the list.

CREATE TABLE IF NOT EXISTS api_key (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  key_hash      TEXT NOT NULL UNIQUE,
  key_prefix    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_key_user ON api_key(user_id);
CREATE INDEX IF NOT EXISTS idx_api_key_hash ON api_key(key_hash);
