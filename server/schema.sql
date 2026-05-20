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
  rating        INTEGER,
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

-- ─── ChessCoach trainer SaaS — unified user model ──────────────────────────

-- Single user table; `roles` is a multi-select set chosen at signup
-- ('trainer', 'student', 'self'). A user can be any combination.
CREATE TABLE IF NOT EXISTS app_user (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT,  -- NULL allowed: OAuth-only accounts have no password.
  name          TEXT NOT NULL,
  roles         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
                CHECK (roles <@ ARRAY['trainer','student','self']::TEXT[]),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_user_roles ON app_user USING gin (roles);

-- Multiple OAuth identities can point at one app_user (google now, lichess
-- later). PK on (provider, subject) prevents the same provider account
-- from being linked twice.
CREATE TABLE IF NOT EXISTS oauth_identity (
  provider   TEXT   NOT NULL,
  subject    TEXT   NOT NULL,
  user_id    BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  linked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, subject)
);
CREATE INDEX IF NOT EXISTS idx_oauth_identity_user ON oauth_identity(user_id);

CREATE TABLE IF NOT EXISTS session (
  id          TEXT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_user ON session(user_id);

-- Mentor link: a trainer-user and a student-user. A trainer's "roster" is
-- the set of rows with trainer_user_id = me; a student's "trainers" is the
-- rows with student_user_id = me.
CREATE TABLE IF NOT EXISTS mentor (
  trainer_user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  student_user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  linked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (trainer_user_id, student_user_id)
);

-- Invite tokens used to bring in students by email. The invitee may or
-- may not already be an app_user; we resolve at /accept time.
CREATE TABLE IF NOT EXISTS invite (
  token            TEXT PRIMARY KEY,
  trainer_user_id  BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  student_email    TEXT NOT NULL,
  student_name     TEXT NOT NULL,
  expires_at       TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS opening_study (
  id          BIGSERIAL PRIMARY KEY,
  owner_id    BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  root_fen    TEXT NOT NULL,
  eco         TEXT,
  side        CHAR(1) NOT NULL CHECK (side IN ('w','b')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A node in the opening tree. parent_id NULL = a top-level child of the
-- study's root_fen. Two nodes can never share (study_id, parent_id, san):
-- if a child with the same move already exists, the trainer's "make a
-- move" action just navigates to it instead of creating a duplicate.
CREATE TABLE IF NOT EXISTS opening_node (
  id          BIGSERIAL PRIMARY KEY,
  study_id    BIGINT NOT NULL REFERENCES opening_study(id) ON DELETE CASCADE,
  parent_id   BIGINT REFERENCES opening_node(id) ON DELETE CASCADE,
  parent_fen  TEXT NOT NULL,
  san         TEXT NOT NULL,
  uci         TEXT NOT NULL,
  fen         TEXT NOT NULL,
  ply         INTEGER NOT NULL,
  is_main     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (study_id, parent_id, san)
);

CREATE INDEX IF NOT EXISTS idx_opening_node_study  ON opening_node(study_id);
CREATE INDEX IF NOT EXISTS idx_opening_node_parent ON opening_node(study_id, parent_id);

-- A chapter is a rich-text payload attached to one specific node.
-- Title + markdown body. The student sees it when they reach the node
-- (in browse mode) or when they answer a quiz card (correct or wrong).
CREATE TABLE IF NOT EXISTS opening_chapter (
  node_id    BIGINT PRIMARY KEY REFERENCES opening_node(id) ON DELETE CASCADE,
  title      TEXT,
  body_md    TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-(user, node) spaced-repetition state for the quiz. The student is
-- quizzed on nodes where it's *their* side to move (the side they're
-- training for, from opening_study.side). Opponent-side nodes are played
-- automatically by the system.
CREATE TABLE IF NOT EXISTS node_quiz_state (
  user_id        BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  node_id        BIGINT NOT NULL REFERENCES opening_node(id) ON DELETE CASCADE,
  correct_streak INTEGER NOT NULL DEFAULT 0,
  wrong_count    INTEGER NOT NULL DEFAULT 0,
  last_seen_at   TIMESTAMPTZ,
  next_due_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_node_quiz_due ON node_quiz_state(user_id, next_due_at);

CREATE TABLE IF NOT EXISTS game_study (
  id           BIGSERIAL PRIMARY KEY,
  owner_id     BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  pgn          TEXT NOT NULL,
  headers_json JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_annotation (
  id          BIGSERIAL PRIMARY KEY,
  study_id    BIGINT NOT NULL REFERENCES game_study(id) ON DELETE CASCADE,
  ply         SMALLINT NOT NULL,
  comment_md  TEXT,
  is_quiz     BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (study_id, ply)
);

-- An assignment of a study to a user (which can be another user or the
-- same user when working solo with the 'self' role).
CREATE TABLE IF NOT EXISTS assignment (
  id           BIGSERIAL PRIMARY KEY,
  assignee_id  BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  study_kind   TEXT NOT NULL CHECK (study_kind IN ('opening','game','tactic')),
  study_id     BIGINT NOT NULL,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (assignee_id, study_kind, study_id)
);

CREATE TABLE IF NOT EXISTS quiz_attempt (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  game_study_id  BIGINT NOT NULL REFERENCES game_study(id) ON DELETE CASCADE,
  ply            SMALLINT NOT NULL,
  attempted_san  TEXT NOT NULL,
  correct        BOOLEAN NOT NULL,
  attempted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quiz_attempt ON quiz_attempt(user_id, game_study_id);

-- ─── Tactical sets ──────────────────────────────────────────────────────────
-- A flat collection of puzzles. Each puzzle is a FEN + a solution line of
-- SAN moves; the student plays their plies on a Chessground board and the
-- viewer auto-plays the expected opponent plies in between. Attempts are
-- logged in tactic_attempt; "progress" is distinct puzzles answered
-- correctly at least once.
CREATE TABLE IF NOT EXISTS tactic_set (
  id          BIGSERIAL PRIMARY KEY,
  owner_id    BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tactic_puzzle (
  id            BIGSERIAL PRIMARY KEY,
  set_id        BIGINT NOT NULL REFERENCES tactic_set(id) ON DELETE CASCADE,
  ord           INTEGER NOT NULL,
  fen           TEXT NOT NULL,
  solution_san  TEXT[] NOT NULL,
  comment_md    TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tactic_puzzle_set ON tactic_puzzle(set_id, ord);

CREATE TABLE IF NOT EXISTS tactic_attempt (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  puzzle_id     BIGINT NOT NULL REFERENCES tactic_puzzle(id) ON DELETE CASCADE,
  correct       BOOLEAN NOT NULL,
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tactic_attempt_user_puzzle
  ON tactic_attempt(user_id, puzzle_id);
