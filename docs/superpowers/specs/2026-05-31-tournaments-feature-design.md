# Tournaments feature — design

**Date:** 2026-05-31
**Status:** Approved (user goal: "Implement it fully")

## Goal

A new **Tournaments** tab where any signed-in user browses chess tournaments.
Phase 1 = **France**, sourced from chess-results.com, with two interchangeable
views — a **map** and a **list** — both reacting to the same filters (région,
time control) and a sort control. Built so a worldwide phase 2 is purely
additive.

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Data source | **chess-results.com first**, filtered to France (`fed=FRA`). Adapter-based so other sources slot in later. |
| "Follow" scope | **Browse only** — no per-user state, no notifications in phase 1. |
| Placement / access | Top-bar **Tournaments** tab at `/tournaments`, visible to **any signed-in user** (trainer + student). |
| Filter/sort | **Filter + sort**: région and time control filter both views; a sort control reorders (date / name / région). |
| Time window | **All, including past**, with a configurable history horizon and a date filter. |
| Layout | **Toggle** (segmented Map \| List switch) — matches the "2 choices" framing, mobile-friendly. Split-view is a noted future enhancement. |

## Architecture

```
chess-results.com ──scrape──▶ scripts/ingest-tournaments.ts ──upsert──▶ Postgres `tournament`
                                       │                                      ▲
                                       └─ geocode (api-adresse.data.gouv.fr) ─┘  (lat/lon, région, département; cached)

React /tournaments ──/api/tournaments?filters──▶ Fastify routes-tournaments.ts ──SELECT──▶ `tournament`
   (List view + d3-geo France map, both fed by one filtered query)
```

Three isolated units:

1. **Source adapter + ingest** (`scripts/ingest-tournaments.ts`,
   `server/tournaments/chess-results.ts`, `server/tournaments/geocode.ts`) —
   turns a federation into rows in `tournament`. Knows nothing about the API or UI.
2. **API** (`server/routes-tournaments.ts`) — reads `tournament`, applies
   filters/sort, returns JSON. Knows nothing about scraping.
3. **UI** (`src/tournaments/*`) — renders filters + toggled Map/List from the API.

### Data model — migration `server/migrations/2026-05-31-tournaments.sql`

```sql
CREATE TABLE IF NOT EXISTS tournament (
  id           SERIAL PRIMARY KEY,
  source       TEXT NOT NULL,                 -- 'chess-results'
  source_ref   TEXT NOT NULL,                 -- the tnr id, e.g. '1403794'
  name         TEXT NOT NULL,
  url          TEXT NOT NULL,                  -- link out to chess-results
  country      TEXT NOT NULL DEFAULT 'FRA',
  location     TEXT,                           -- raw city, e.g. 'AGNEAUX'
  region       TEXT,                           -- derived via geocoder, e.g. 'Normandie'
  department   TEXT,                           -- e.g. 'Manche (50)'
  lat          DOUBLE PRECISION,
  lon          DOUBLE PRECISION,
  start_date   DATE,
  end_date     DATE,
  rounds       INTEGER,
  cadence      TEXT,                           -- 'classic' | 'rapid' | 'blitz' | NULL
  time_control TEXT,                           -- raw, e.g. "90'x40+30\" -> 30'+30\""
  avg_rating   INTEGER,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_ref)
);
CREATE INDEX IF NOT EXISTS tournament_start_idx  ON tournament (start_date);
CREATE INDEX IF NOT EXISTS tournament_region_idx ON tournament (region);
CREATE INDEX IF NOT EXISTS tournament_cadence_idx ON tournament (cadence);

CREATE TABLE IF NOT EXISTS geocode_cache (
  query      TEXT PRIMARY KEY,                 -- normalized location string
  lat        DOUBLE PRECISION,
  lon        DOUBLE PRECISION,
  region     TEXT,
  department TEXT,
  resolved   BOOLEAN NOT NULL DEFAULT TRUE,    -- FALSE = looked up, no match (don't retry)
  cached_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Migration is idempotent (`IF NOT EXISTS`) and reaches Railway through the
existing `migrate.yml` pipeline. No data dropped.

### Ingest (`npm run ingest:tournaments`)

1. **List**: fetch the chess-results France federation listing
   (`fed.aspx?lan=1&fed=FRA` plus `Transfer.aspx?key5=TS&fed=FRA` for the full
   set), across the status buckets needed to cover upcoming + running + finished.
   Extract `tnr<ID>` links.
2. **Horizon**: skip tournaments whose start date is older than
   `TOURNAMENTS_HISTORY_FROM` (env, default `2024-01-01`).
3. **Detail**: for each new or stale id, fetch
   `tnr<ID>.aspx?lan=1&turdet=YES` and parse the header table:
   Federation, Location, Date (start→end), Number of rounds,
   Time control + its `(Standard|Rapid|Blitz)` label, Rating-Ø.
4. **Classify cadence** from the label: Standard→`classic`, Rapid→`rapid`,
   Blitz→`blitz`.
5. **Geocode** the location via `geocode_cache`, falling back to
   `https://api-adresse.data.gouv.fr/search/?q=<city>&type=municipality&limit=1`.
   Parse `features[0].geometry.coordinates` (lon, lat) and
   `properties.context` (`"50, Manche, Normandie"` → department + region).
   Cache hits and misses.
6. **Upsert** into `tournament` keyed on `(source, source_ref)`.

Politeness: a fixed descriptive `User-Agent`, a small delay between requests,
and the geocode cache keep request volume low. HTML parsed with
**`node-html-parser`** (new dependency — small, dependency-free DOM).
Scheduling is out of scope for phase 1 (run manually / wire a cron later).

### API (`server/routes-tournaments.ts`, registered in `server/index.ts`)

All routes require an authenticated session (reuse the existing auth guard).

- `GET /api/tournaments` — query params: `region`, `cadence`
  (`classic|rapid|blitz`), `from`, `to` (dates), `q` (name search),
  `sort` (`date|name|region`, default `date`). Returns the full filtered list
  including `lat`/`lon` so the map and list share one request. Validated with
  zod (matching existing route style).
- `GET /api/tournaments/regions` — distinct non-null régions present, for the
  filter dropdown.

### Frontend (`src/tournaments/`)

- **Route**: add `/tournaments` in `src/App.tsx`, wrapped in
  `RequireRole anyOf={['trainer','student','self']}`.
- **Nav**: add a `Tournaments` link to the top bar. Both `TrainerLayout` and
  `StudentLayout` get the link; `TournamentsPage` renders its own `TopBar` with
  the same link set so the tab is reachable from anywhere.
- **`TournamentsPage.tsx`**: filter bar (région `<select>`, cadence chips,
  date range, search box, sort `<select>`) + a segmented **Map | List** toggle.
  Filter state lives in the URL query string so views/links are shareable.
- **List view (`TournamentList.tsx`)**: rows — date block · name · city +
  région · cadence badge · rounds · link out to chess-results.
- **Map view (`TournamentMap.tsx`)**: a France map drawn with **d3-geo**
  (`d3` is already a dependency) using `geoConicConformal` fitted to a bundled
  simplified France GeoJSON (`src/tournaments/france-regions.geo.json`).
  One marker per tournament at its lat/lon; markers without coordinates are
  omitted (and counted in a "N not mapped" note — no silent drop). Clicking a
  marker shows a small popup with the same fields as a list row.
- **API client**: add a `tournaments` section to `src/lib/api.ts`.

## Error handling

- **Ingest**: per-tournament failures (parse error, geocode miss) are logged and
  skipped; the run continues and reports counts (added / updated / skipped /
  geocode-missed). A tournament with no coordinates is still stored and listed,
  just not pinned.
- **Geocode**: network/4xx → record a `resolved=FALSE` cache entry so we don't
  hammer the geocoder on re-runs; the tournament keeps NULL coords.
- **API**: invalid query params → 400 via zod; empty result → `[]`, not an error.
- **UI**: fetch failure → inline error + retry; empty filtered set → "No
  tournaments match" empty state; map with zero coords → falls back to a
  "switch to list" hint.

## Testing

- **Unit (vitest)**:
  - chess-results detail parser: fixture HTML → expected fields (incl. cadence
    classification and date range).
  - geocode `context` parser: `"50, Manche, Normandie"` → `{department, region}`.
  - API filter/sort logic against a seeded test set.
- **Component (testing-library)**: `TournamentsPage` toggles Map/List; cadence
  filter narrows rows.
- **E2E (playwright, smoke)**: signed-in user opens `/tournaments`, sees the
  list, toggles to the map, applies a région filter.

## Out of scope (phase 1)

Following/bookmarking, notifications, worldwide coverage, automated ingest
scheduling, split map+list layout. All are additive on top of this design.
