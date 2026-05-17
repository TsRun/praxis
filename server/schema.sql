-- Opening tree index over OTB games. Postgres flavor.

CREATE TABLE IF NOT EXISTS game (
  fingerprint TEXT PRIMARY KEY,
  white       TEXT,
  black       TEXT,
  white_elo   INTEGER,
  black_elo   INTEGER,
  event_date  TEXT,
  result      TEXT,           -- "1-0" / "0-1" / "1/2-1/2"
  source      TEXT,
  ingested_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS move (
  parent_fen  TEXT NOT NULL,  -- EPD (4 fields)
  san         TEXT NOT NULL,
  uci         TEXT NOT NULL,
  child_fen   TEXT NOT NULL,
  games       BIGINT NOT NULL DEFAULT 0,
  white_wins  BIGINT NOT NULL DEFAULT 0,
  draws       BIGINT NOT NULL DEFAULT 0,
  black_wins  BIGINT NOT NULL DEFAULT 0,
  rating_sum  BIGINT NOT NULL DEFAULT 0,
  rating_n    BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (parent_fen, san)
);

CREATE INDEX IF NOT EXISTS idx_move_parent ON move(parent_fen);
