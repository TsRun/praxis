-- Tournaments browsing feature. `tournament` holds FIDE-rated OTB events
-- scraped from ratings.fide.com (France-focused for now, `country` stored so
-- worldwide is a later toggle). `geocode_cache` memoizes city -> lat/lon/region
-- so re-ingests don't re-hit the geocoder. Idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS tournament (
  id           SERIAL PRIMARY KEY,
  source       TEXT NOT NULL,                  -- 'fide'
  source_ref   TEXT NOT NULL,                  -- FIDE event id, e.g. '472202'
  name         TEXT NOT NULL,
  url          TEXT NOT NULL,                  -- link out to FIDE
  country      TEXT NOT NULL DEFAULT 'FRA',
  location     TEXT,                           -- raw city, e.g. 'NICE'
  region       TEXT,                           -- derived via geocoder, e.g. 'Normandie'
  department   TEXT,                           -- e.g. 'Manche (50)'
  lat          DOUBLE PRECISION,
  lon          DOUBLE PRECISION,
  start_date   DATE,
  end_date     DATE,
  players      INTEGER,                        -- FIDE detail shows player count
  cadence      TEXT,                           -- 'classic' | 'rapid' | 'blitz' | NULL
  time_control TEXT,                           -- raw, e.g. '90 min + 30 sec increment'
  period       TEXT,                           -- FIDE rating period, e.g. '2026-07-01'
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_ref)
);
CREATE INDEX IF NOT EXISTS tournament_start_idx   ON tournament (start_date);
CREATE INDEX IF NOT EXISTS tournament_region_idx  ON tournament (region);
CREATE INDEX IF NOT EXISTS tournament_cadence_idx ON tournament (cadence);
CREATE INDEX IF NOT EXISTS tournament_country_idx ON tournament (country);

CREATE TABLE IF NOT EXISTS geocode_cache (
  query      TEXT PRIMARY KEY,                 -- normalized location string
  lat        DOUBLE PRECISION,
  lon        DOUBLE PRECISION,
  region     TEXT,
  department TEXT,
  resolved   BOOLEAN NOT NULL DEFAULT TRUE,    -- FALSE = looked up, no match (don't retry)
  cached_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
