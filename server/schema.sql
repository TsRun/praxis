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
  origin        TEXT NOT NULL DEFAULT 'fide'
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
  result          CHAR(1) NOT NULL,
  source          TEXT,
  ingested_at     BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_white_fide ON game(white_fide_id);
CREATE INDEX IF NOT EXISTS idx_game_black_fide ON game(black_fide_id);

-- Per-ply rows. Denormalized columns (result, mover_elo, white_fide_id,
-- black_fide_id) duplicate data from `game` so the explorer never needs a
-- JOIN — even for player filters. That's the dominant cost at 30M+ rows.
CREATE TABLE IF NOT EXISTS game_move (
  game_id        BIGINT NOT NULL REFERENCES game(id) ON DELETE CASCADE,
  ply            SMALLINT NOT NULL,
  parent_fen     TEXT NOT NULL,
  san            TEXT NOT NULL,
  uci            TEXT NOT NULL,
  child_fen      TEXT NOT NULL,
  result         CHAR(1),
  mover_elo      INTEGER,
  white_fide_id  INTEGER,
  black_fide_id  INTEGER,
  PRIMARY KEY (game_id, ply)
);

CREATE INDEX IF NOT EXISTS idx_game_move_parent ON game_move(parent_fen);
CREATE INDEX IF NOT EXISTS idx_game_move_parent_san ON game_move(parent_fen, san);
-- Player-filter helpers (partial indexes — skip rows where the id is NULL).
CREATE INDEX IF NOT EXISTS idx_gm_parent_white_fide
  ON game_move(parent_fen, white_fide_id) WHERE white_fide_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gm_parent_black_fide
  ON game_move(parent_fen, black_fide_id) WHERE black_fide_id IS NOT NULL;

-- Precomputed (parent_fen, san) aggregates. Populated by scripts/ingest.ts
-- after each ingest batch (or manually via `npm run rebuild-stats`).
CREATE TABLE IF NOT EXISTS move_stats (
  parent_fen  TEXT NOT NULL,
  san         TEXT NOT NULL,
  uci         TEXT NOT NULL,
  child_fen   TEXT NOT NULL,
  games       BIGINT NOT NULL,
  white_wins  BIGINT NOT NULL,
  draws       BIGINT NOT NULL,
  black_wins  BIGINT NOT NULL,
  rating_sum  BIGINT NOT NULL,
  rating_n    BIGINT NOT NULL,
  PRIMARY KEY (parent_fen, san)
);

CREATE INDEX IF NOT EXISTS idx_move_stats_parent_games ON move_stats(parent_fen, games DESC);
