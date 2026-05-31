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
| Data source | **FIDE** (`ratings.fide.com`) — the full FIDE-rated OTB tournament base. Discovery via `a_tournaments.php?country=FRA[&period=…]` (+ `a_tournaments_panel.php?…&periods_tab=1` for the period list, back to 2002); cadence/end-date enriched from `tournament_information.phtml?event=…`. Stored with `country` so worldwide is a later toggle. Default ingest run is bounded by a configurable period cutoff; full all-time backfill and `country=all` are available via flags. |
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
  players      INTEGER,                         -- FIDE detail shows player count
  cadence      TEXT,                            -- 'classic' | 'rapid' | 'blitz' | NULL
  time_control TEXT,                            -- raw, e.g. "90 min + 30 sec increment"
  period       TEXT,                            -- FIDE rating period, e.g. '2026-07-01'
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

Flags: `--country` (default `FRA`; `all` for worldwide), `--from` (period
cutoff `YYYY-MM-01`, default env `TOURNAMENTS_HISTORY_FROM` → `2024-01-01`),
`--no-detail` (skip per-event enrichment), `--full` (ignore cutoff, all periods).

1. **Periods**: GET `a_tournaments_panel.php?country=<C>&periods_tab=1` →
   `[{frl_publish:'2026-06-01', txt2:'June 2026'}, …]`. Keep periods
   `>= --from` (or all with `--full`). If the list is empty, fall back to the
   default current view (no `period` param).
2. **List**: for each kept period, GET
   `a_tournaments.php?country=<C>&period=<frl_publish>` → `{data:[[event_id,
   name, city, type, start_date, rcvd, period_label, period_date, flag], …]}`.
   This already yields event_id, name, city, start_date, period — cheap.
3. **Detail** (unless `--no-detail`): GET
   `tournament_information.phtml?event=<id>` and parse the info table for
   country, end date, player count, and **time control** (its
   `Standard|Rapid|Blitz` word → cadence `classic|rapid|blitz`).
4. **Geocode** the city via `geocode_cache`, falling back to
   `https://api-adresse.data.gouv.fr/search/?q=<city>&type=municipality&limit=1`
   (France-only; non-FRA rows keep NULL coords until a global geocoder is
   added). Parse `features[0].geometry.coordinates` (lon, lat) and
   `properties.context` (`"50, Manche, Normandie"` → department + region).
   Cache hits and misses.
5. **Upsert** into `tournament` keyed on `(source, source_ref)`.

Politeness: a fixed descriptive `User-Agent`, a small delay between requests,
and both caches keep volume sane. The list JSON needs no HTML parser; the
detail page is parsed with **`node-html-parser`** (new dependency — small,
dependency-free DOM). Scheduling is out of scope for phase 1 (run manually /
wire a daily cron on the current period later). Full all-time / all-country
backfill (~450k events) is possible via `--full --country all` but is an
operator decision, not the default.

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
