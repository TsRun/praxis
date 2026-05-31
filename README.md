# Praxis

A chess-coaching SaaS. Trainers sign up, build opening studies and annotated
game reviews, invite students by email, track their progress. Students log in
to a personal dashboard with assigned studies — including a quiz mode for key
positions in game reviews.

Built on top of the OpeningTree opening explorer; the explorer becomes the
"library" trainers browse when building studies.

## Run locally

```bash
# Postgres 16
brew install postgresql@16
brew services start postgresql@16
createdb openings

# Project deps
npm install

# Backend (Fastify, http://127.0.0.1:5174)
npm run dev:server

# Frontend (Vite, http://localhost:5173)
npm run dev
```

Email is sent via Resend when `RESEND_API_KEY` is set; otherwise invite emails
are logged to stdout as `[email/dev]` lines so the flow still works offline.

## Roles

- **Trainer**: signs up at `/`, manages students at `/trainer/students`,
  builds studies at `/trainer/studies`. Two study types — opening (book-style
  with markdown notes anchored to FENs) and game (PGN + per-ply comments +
  quiz markers).
- **Student**: arrives via email invite link, lands at `/student/dashboard`,
  works through assigned studies. Quiz positions ask for SAN input and reveal
  the expected move plus the trainer's note after submission.

## Tournaments

Any signed-in user gets a **Tournois** tab at `/tournaments`: FIDE-rated OTB
tournaments (France-focused for now) shown as a sortable/filterable list or a
France map, filtered by région and time control (Classique / Rapide / Blitz).

Data comes from `ratings.fide.com` (no official API — structured scraping) and
is loaded into the `tournament` table by an ingest script; French cities are
geocoded once (cached) via the free `api-adresse.data.gouv.fr`:

```bash
# France, rating periods since the cutoff (default 2024-01-01), with per-event
# detail enrichment (cadence, end date, player count):
npm run ingest:tournaments

# tune the history cutoff, skip detail enrichment, or go worldwide:
npm run ingest:tournaments -- --from 2025-01-01
npm run ingest:tournaments -- --no-detail
npm run ingest:tournaments -- --country all --full   # ~450k events — operator decision
```

Env `TOURNAMENTS_HISTORY_FROM` sets the default period cutoff. The run is
idempotent (upsert on FIDE event id). `country` is stored on every row so a
worldwide UI is a later toggle; a daily cron on the current period keeps it
fresh (not wired in phase 1).

---

# OpeningTree (legacy / library)

A chess opening explorer with a focused, visual **move selection** for the current position: real over-the-board (OTB) games count, average Elo, W/D/B distribution, and the engine of choice for adding more sources later.

![Screenshot — Caro-Kann move selection](./page-carokann.png)

## Architecture

```
┌──────────────┐   /api/explorer   ┌──────────────┐   pg COPY/UPSERT   ┌────────────┐
│ React + Vite │ ────────────────▶ │ Fastify + pg │ ────────────────── │ Postgres   │
│  frontend    │ ◀──── JSON ────── │   backend    │                    │ openings db│
└──────────────┘                   └──────────────┘                    └────────────┘
                                          ▲
                                          │ scripts/ingest.ts (streamed PGN parsing,
                                          │ stable-fingerprint dedup, depth-bounded
                                          │ per-edge aggregation)
                                          │
                                  ┌───────┴────────┐
                                  │ PGN data       │
                                  │ (TWIC, Lumbra, │
                                  │  custom dumps) │
                                  └────────────────┘
```

- **Frontend** (this repo's `src/`): React 18 + Vite + TS + Tailwind. Renders a dense, visual `MoveSelection` panel beside an interactive board.
- **Backend** (`server/`): tiny Fastify + node-postgres app exposing `GET /api/explorer?fen=…`. Returns total games, white/draw/black aggregates, and per-move stats (san, games, w/d/b, `avg_elo`, child FEN).
- **Ingestion** (`scripts/ingest.ts`): streams a PGN file, dedupes games via stable fingerprint (`white|black|date|result|event|first-20-plies`), walks the first 16 plies, and UPSERTs `(parent_fen, san)` edges in batched transactions.

## Run

```bash
# 1. Postgres (already installed? skip this)
brew install postgresql@16
brew services start postgresql@16
createdb openings

# 2. Install deps
npm install

# 3. Boot the backend
npm run dev:server     # http://127.0.0.1:5174

# 4. Boot the frontend
npm run dev            # http://localhost:5173
```

## Ingest games

```bash
# Single PGN file
npm run ingest -- data/some-tournament.pgn --source twic1614

# Or with custom depth
npm run ingest -- data/some.pgn --depth 20 --source kingbase
```

The script logs ingestion progress (read / kept / dedupe / no-result / invalid) and is safe to re-run — the dedupe ledger in the `game` table prevents double-counting.

### Where to get OTB PGN

| Source | Size | License | Notes |
| --- | --- | --- | --- |
| [TWIC](https://theweekinchess.com/twic) | ~6–8K games/week | Personal use only | Easiest weekly fetch — `https://theweekinchess.com/zips/twic{N}g.zip` |
| [Lumbra's Gigabase](https://lumbrasgigabase.com/en/) | 10.3M OTB games | CC BY-NC-SA 4.0 | Best canonical source for a public, non-commercial deployment |
| [Caissabase](https://chess-db.com/) | ~3.9M | varies | Recent status unclear; check before relying on it |
| [Lichess Masters Explorer](https://lichess.org/api) | ~2.5M masters games | OAuth-gated 2026 | Smaller than Lumbra, but well-curated |

### Schema

```sql
CREATE TABLE game (
  fingerprint TEXT PRIMARY KEY,    -- sha1 of normalized (white|black|date|result|event|first-20-plies)
  white TEXT, black TEXT,
  white_elo INTEGER, black_elo INTEGER,
  event_date TEXT, result TEXT, source TEXT,
  ingested_at BIGINT NOT NULL
);

CREATE TABLE move (
  parent_fen TEXT NOT NULL,   -- EPD (4 fields)
  san TEXT NOT NULL,
  uci TEXT NOT NULL,
  child_fen TEXT NOT NULL,
  games BIGINT NOT NULL,
  white_wins BIGINT NOT NULL,
  draws BIGINT NOT NULL,
  black_wins BIGINT NOT NULL,
  rating_sum BIGINT NOT NULL,
  rating_n BIGINT NOT NULL,
  PRIMARY KEY (parent_fen, san)
);
```

## Frontend layout

```
src/
├── components/
│   ├── board/        ChessBoard, MoveList
│   ├── explorer/     MoveSelection (the headline), OpeningHeader
│   ├── tree/         NodePreview (mini-board hover, reused)
│   └── ui/           Icon, SearchBar
├── hooks/            useExplorer, useFenUrlSync, useKeyboardNav
├── lib/              cache, lichess (API client), eco
└── store/            gameStore (zustand)
```

The opening-name lookup uses the public [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) TSVs fetched through a Vite dev proxy (`/api/openings/{a..e}.tsv`).

## Scripts

```bash
npm run dev          # vite dev server
npm run dev:server   # fastify backend (auto-restart)
npm run ingest       # PGN ingestion (see above)
npm run build        # production build
npm run typecheck    # tsc -b --noEmit
npm test             # vitest
npm run e2e          # playwright
```

## Tests

Vitest unit tests (run via `npm test`) cover the API client, game store, PGN parser, opening tree, tactic engine, auth helpers, and chapter walker scope. See `tests/unit/` for the current set.

## Design + plan

Original specs and implementation plans were removed once their code shipped — refer to git history (`docs/superpowers/`) if you need them.
