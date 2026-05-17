-- Opening tree index over OTB games, with player filtering support.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- One row per FIDE-listed player (bulk-loaded from ratings.fide.com).
-- Players observed in PGN with unknown FIDE id are inserted lazily by ingest
-- using a synthetic id below the FIDE range; those rows have origin='pgn'.
CREATE TABLE IF NOT EXISTS player (
  fide_id       INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  country       TEXT,
  title         TEXT,
  sex           CHAR(1),
  rating        INTEGER,
  rapid_rating  INTEGER,
  blitz_rating  INTEGER,
  birth_year    INTEGER,
  origin        TEXT NOT NULL DEFAULT 'fide'   -- 'fide' | 'pgn'
);

CREATE INDEX IF NOT EXISTS idx_player_name_trgm ON player USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_player_name_lower ON player (lower(name) text_pattern_ops);

CREATE TABLE IF NOT EXISTS game (
  id              BIGSERIAL PRIMARY KEY,
  fingerprint     TEXT UNIQUE NOT NULL,
  white_name      TEXT,
  black_name      TEXT,
  white_fide_id   INTEGER REFERENCES player(fide_id) ON DELETE SET NULL,
  black_fide_id   INTEGER REFERENCES player(fide_id) ON DELETE SET NULL,
  white_elo       INTEGER,
  black_elo       INTEGER,
  event           TEXT,
  event_date      TEXT,
  result          CHAR(1) NOT NULL,             -- 'W' | 'B' | 'D'
  source          TEXT,
  ingested_at     BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_white_fide ON game(white_fide_id);
CREATE INDEX IF NOT EXISTS idx_game_black_fide ON game(black_fide_id);

-- One row per ply per game, up to ingestion depth.
CREATE TABLE IF NOT EXISTS game_move (
  game_id     BIGINT NOT NULL REFERENCES game(id) ON DELETE CASCADE,
  ply         SMALLINT NOT NULL,
  parent_fen  TEXT NOT NULL,                    -- EPD (4 fields)
  san         TEXT NOT NULL,
  uci         TEXT NOT NULL,
  child_fen   TEXT NOT NULL,
  PRIMARY KEY (game_id, ply)
);

CREATE INDEX IF NOT EXISTS idx_game_move_parent ON game_move(parent_fen);
CREATE INDEX IF NOT EXISTS idx_game_move_parent_san ON game_move(parent_fen, san);
