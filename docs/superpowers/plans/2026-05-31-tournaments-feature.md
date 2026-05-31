# Tournaments Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/tournaments` tab where any signed-in user browses French chess tournaments (scraped from chess-results.com into a `tournament` table) through toggled Map and List views, filtered by région and time control.

**Architecture:** A pure-function chess-results parser + geocoder feed an idempotent ingest script that upserts into a new `tournament` table. A `GET /api/tournaments` route (auth-gated) serves the filtered/sorted list including coordinates. A React `/tournaments` page renders a shared filter bar over a Map (d3-geo) / List toggle.

**Tech Stack:** TypeScript, Fastify, Postgres (`pg`), React + Vite, react-router, d3-geo (already a dep), `node-html-parser` (new dep), zod, vitest.

---

## File Structure

- `server/tournaments/parse.ts` — pure parsers: detail-page HTML → fields; cadence classifier; geocode-context parser. (new)
- `server/tournaments/geocode.ts` — geocode a city via `geocode_cache` + api-adresse.data.gouv.fr. (new)
- `server/tournaments/chess-results.ts` — fetch helpers (list page → tnr ids; detail page → parsed record) built on `parse.ts`. (new)
- `scripts/ingest-tournaments.ts` — CLI orchestrator: list → detail → geocode → upsert. (new)
- `server/routes-tournaments.ts` — `GET /api/tournaments`, `GET /api/tournaments/regions`. (new)
- `server/migrations/2026-05-31-tournaments.sql` — `tournament` + `geocode_cache` tables. (new)
- `server/index.ts` — register `tournamentRoutes`. (modify)
- `src/lib/api.ts` — `tournaments` client section + types. (modify)
- `src/tournaments/TournamentsPage.tsx` — page shell, filter bar, view toggle. (new)
- `src/tournaments/TournamentList.tsx` — list rows. (new)
- `src/tournaments/TournamentMap.tsx` — d3-geo France map + markers. (new)
- `src/tournaments/france-regions.geo.json` — simplified region boundaries. (new, fetched)
- `src/App.tsx` — add `/tournaments` route. (modify)
- `src/trainer/TrainerLayout.tsx`, `src/student/StudentLayout.tsx` — add nav link. (modify)
- Tests: `server/tournaments/parse.test.ts`, `server/tournaments/geocode.test.ts`, `src/tournaments/TournamentsPage.test.tsx`, `tests/e2e/tournaments.spec.ts`.

---

## Task 1: Database migration

**Files:**
- Create: `server/migrations/2026-05-31-tournaments.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Tournaments browsing feature. `tournament` holds scraped chess-results.com
-- events (France for now); `geocode_cache` memoizes city -> lat/lon/region so
-- re-ingests don't re-hit the geocoder. Idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS tournament (
  id           SERIAL PRIMARY KEY,
  source       TEXT NOT NULL,
  source_ref   TEXT NOT NULL,
  name         TEXT NOT NULL,
  url          TEXT NOT NULL,
  country      TEXT NOT NULL DEFAULT 'FRA',
  location     TEXT,
  region       TEXT,
  department   TEXT,
  lat          DOUBLE PRECISION,
  lon          DOUBLE PRECISION,
  start_date   DATE,
  end_date     DATE,
  rounds       INTEGER,
  cadence      TEXT,
  time_control TEXT,
  avg_rating   INTEGER,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_ref)
);
CREATE INDEX IF NOT EXISTS tournament_start_idx   ON tournament (start_date);
CREATE INDEX IF NOT EXISTS tournament_region_idx  ON tournament (region);
CREATE INDEX IF NOT EXISTS tournament_cadence_idx ON tournament (cadence);

CREATE TABLE IF NOT EXISTS geocode_cache (
  query      TEXT PRIMARY KEY,
  lat        DOUBLE PRECISION,
  lon        DOUBLE PRECISION,
  region     TEXT,
  department TEXT,
  resolved   BOOLEAN NOT NULL DEFAULT TRUE,
  cached_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Mirror the DDL into `server/schema.sql`** so local `ensureSchema` bootstraps it. Append the same two `CREATE TABLE`/`CREATE INDEX` statements to the end of `server/schema.sql`.

- [ ] **Step 3: Apply locally and verify**

Run: `psql "$DATABASE_URL" -f server/migrations/2026-05-31-tournaments.sql` (or via `scripts/apply-migrations.sh`)
Expected: `CREATE TABLE` / `CREATE INDEX` with no error; re-running is a no-op.

- [ ] **Step 4: Commit**

```bash
git add server/migrations/2026-05-31-tournaments.sql server/schema.sql
git commit -m "feat(tournaments): add tournament + geocode_cache tables"
```

---

## Task 2: Add `node-html-parser` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

Run: `npm install node-html-parser@^6`
Expected: added to `dependencies`, `package-lock.json` updated.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add node-html-parser for chess-results scraping"
```

---

## Task 3: Pure parsers (`server/tournaments/parse.ts`) — TDD

**Files:**
- Create: `server/tournaments/parse.ts`
- Test: `server/tournaments/parse.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { classifyCadence, parseGeocodeContext, parseTournamentDetail, extractTnrIds } from './parse.js';

describe('classifyCadence', () => {
  it('maps the chess-results label to our enum', () => {
    expect(classifyCadence('Time control (Standard)')).toBe('classic');
    expect(classifyCadence('Time control (Rapid)')).toBe('rapid');
    expect(classifyCadence('Time control (Blitz)')).toBe('blitz');
    expect(classifyCadence('Time control')).toBeNull();
  });
});

describe('parseGeocodeContext', () => {
  it('splits the api-adresse context string', () => {
    expect(parseGeocodeContext('50, Manche, Normandie')).toEqual({
      department: 'Manche (50)',
      region: 'Normandie',
    });
  });
  it('returns nulls for empty input', () => {
    expect(parseGeocodeContext('')).toEqual({ department: null, region: null });
  });
});

describe('extractTnrIds', () => {
  it('pulls tnr ids out of a federation listing', () => {
    const html = `<a href="tnr1403794.aspx?lan=1">Open</a><a href="tnr990520.aspx">X</a>`;
    expect(extractTnrIds(html)).toEqual(['1403794', '990520']);
  });
});

describe('parseTournamentDetail', () => {
  const html = `
    <table>
      <tr><td>Federation</td><td>France (FRA)</td></tr>
      <tr><td>Location</td><td><a href="https://maps.google.com/?q=x">AGNEAUX</a></td></tr>
      <tr><td>Number of rounds</td><td>9</td></tr>
      <tr><td>Time control (Standard)</td><td>90'x40+30" -&gt; 30'+30"</td></tr>
      <tr><td>Date</td><td>2026/07/04 to 2026/07/10</td></tr>
      <tr><td>Rating-&Oslash;</td><td>1991</td></tr>
    </table>`;
  it('extracts the header fields', () => {
    const r = parseTournamentDetail(html);
    expect(r.location).toBe('AGNEAUX');
    expect(r.rounds).toBe(9);
    expect(r.cadence).toBe('classic');
    expect(r.timeControl).toContain('90');
    expect(r.startDate).toBe('2026-07-04');
    expect(r.endDate).toBe('2026-07-10');
    expect(r.avgRating).toBe(1991);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run server/tournaments/parse.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `parse.ts`**

```ts
import { parse } from 'node-html-parser';

export type Cadence = 'classic' | 'rapid' | 'blitz';

export interface TournamentDetail {
  location: string | null;
  rounds: number | null;
  cadence: Cadence | null;
  timeControl: string | null;
  startDate: string | null; // ISO yyyy-mm-dd
  endDate: string | null;
  avgRating: number | null;
}

export function classifyCadence(label: string): Cadence | null {
  const m = /\((standard|rapid|blitz)\)/i.exec(label);
  if (!m) return null;
  const k = m[1].toLowerCase();
  return k === 'standard' ? 'classic' : (k as Cadence);
}

export function parseGeocodeContext(context: string): { department: string | null; region: string | null } {
  const parts = context.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) return { department: null, region: null };
  const [code, dept, ...rest] = parts;
  return { department: `${dept} (${code})`, region: rest.join(', ') };
}

export function extractTnrIds(html: string): string[] {
  const ids: string[] = [];
  const re = /tnr(\d+)\.aspx/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(html))) {
    if (!seen.has(m[1])) { seen.add(m[1]); ids.push(m[1]); }
  }
  return ids;
}

function isoDate(s: string): string | null {
  const m = /(\d{4})[/-](\d{2})[/-](\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function parseTournamentDetail(html: string): TournamentDetail {
  const root = parse(html);
  const rows = root.querySelectorAll('tr');
  const out: TournamentDetail = {
    location: null, rounds: null, cadence: null,
    timeControl: null, startDate: null, endDate: null, avgRating: null,
  };
  for (const tr of rows) {
    const cells = tr.querySelectorAll('td');
    if (cells.length < 2) continue;
    const label = cells[0].text.trim();
    const valEl = cells[1];
    const val = valEl.text.trim();
    if (/^Location/i.test(label)) out.location = val || null;
    else if (/^Number of rounds/i.test(label)) out.rounds = parseInt(val, 10) || null;
    else if (/^Time control/i.test(label)) {
      out.cadence = classifyCadence(label);
      out.timeControl = val || null;
    } else if (/^Date/i.test(label)) {
      const m = val.split(/\s+to\s+/i);
      out.startDate = isoDate(m[0] ?? '');
      out.endDate = isoDate(m[1] ?? m[0] ?? '');
    } else if (/^Rating/i.test(label)) out.avgRating = parseInt(val, 10) || null;
  }
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run server/tournaments/parse.test.ts`
Expected: PASS (4 suites).

- [ ] **Step 5: Commit**

```bash
git add server/tournaments/parse.ts server/tournaments/parse.test.ts
git commit -m "feat(tournaments): pure chess-results parsers with tests"
```

---

## Task 4: Geocoder (`server/tournaments/geocode.ts`) — TDD

**Files:**
- Create: `server/tournaments/geocode.ts`
- Test: `server/tournaments/geocode.test.ts`

- [ ] **Step 1: Write the failing test** (inject fetch + a fake cache so it's pure)

```ts
import { describe, it, expect, vi } from 'vitest';
import { geocodeCity } from './geocode.js';

const apiResponse = {
  features: [{
    geometry: { coordinates: [-1.1, 49.1] },
    properties: { context: '50, Manche, Normandie' },
  }],
};

describe('geocodeCity', () => {
  it('returns coords + region from the address API and caches them', async () => {
    const cache = new Map<string, any>();
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => apiResponse });
    const r = await geocodeCity('AGNEAUX', {
      get: async (q) => cache.get(q) ?? null,
      put: async (q, v) => { cache.set(q, v); },
    }, fetchFn as any);
    expect(r).toEqual({ lat: 49.1, lon: -1.1, region: 'Normandie', department: 'Manche (50)', resolved: true });
    expect(cache.get('agneaux').resolved).toBe(true);
  });

  it('does not call the API on a cache hit', async () => {
    const cached = { lat: 1, lon: 2, region: 'X', department: 'Y', resolved: true };
    const fetchFn = vi.fn();
    const r = await geocodeCity('Paris', { get: async () => cached, put: async () => {} }, fetchFn as any);
    expect(r).toEqual(cached);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run server/tournaments/geocode.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `geocode.ts`**

```ts
import { parseGeocodeContext } from './parse.js';

export interface GeoResult {
  lat: number | null; lon: number | null;
  region: string | null; department: string | null;
  resolved: boolean;
}
export interface GeoCache {
  get(query: string): Promise<GeoResult | null>;
  put(query: string, value: GeoResult): Promise<void>;
}

export async function geocodeCity(
  city: string,
  cache: GeoCache,
  fetchFn: typeof fetch = fetch,
): Promise<GeoResult> {
  const query = city.trim().toLowerCase();
  if (!query) return { lat: null, lon: null, region: null, department: null, resolved: false };
  const hit = await cache.get(query);
  if (hit) return hit;

  let result: GeoResult = { lat: null, lon: null, region: null, department: null, resolved: false };
  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(city)}&type=municipality&limit=1`;
    const res = await fetchFn(url, { headers: { 'User-Agent': 'praxis-tournaments/1.0' } });
    if (res.ok) {
      const data = (await res.json()) as any;
      const f = data.features?.[0];
      if (f) {
        const [lon, lat] = f.geometry.coordinates;
        const { region, department } = parseGeocodeContext(f.properties?.context ?? '');
        result = { lat, lon, region, department, resolved: true };
      }
    }
  } catch {
    // network error: leave unresolved, still cache as miss to avoid hammering
  }
  await cache.put(query, result);
  return result;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run server/tournaments/geocode.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/tournaments/geocode.ts server/tournaments/geocode.test.ts
git commit -m "feat(tournaments): injectable geocoder with cache, tested"
```

---

## Task 5: chess-results fetch helpers (`server/tournaments/chess-results.ts`)

**Files:**
- Create: `server/tournaments/chess-results.ts`

No new unit test (thin I/O wrapper over tested `parse.ts`; covered via the ingest run).

- [ ] **Step 1: Implement**

```ts
import { extractTnrIds, parseTournamentDetail, type TournamentDetail } from './parse.js';

const BASE = 'https://chess-results.com';
const UA = 'praxis-tournaments/1.0 (+https://praxis.tsrun.dev)';

async function getHtml(url: string, fetchFn: typeof fetch): Promise<string> {
  const res = await fetchFn(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

/** List tnr ids for a federation. `art` selects the status bucket on fed.aspx. */
export async function listFederationTnrIds(
  fed: string,
  fetchFn: typeof fetch = fetch,
): Promise<string[]> {
  const url = `${BASE}/fed.aspx?lan=1&fed=${encodeURIComponent(fed)}`;
  return extractTnrIds(await getHtml(url, fetchFn));
}

export interface FetchedTournament extends TournamentDetail {
  sourceRef: string;
  url: string;
  name: string | null;
}

export async function fetchTournament(
  tnrId: string,
  fetchFn: typeof fetch = fetch,
): Promise<FetchedTournament> {
  const url = `${BASE}/tnr${tnrId}.aspx?lan=1&turdet=YES`;
  const html = await getHtml(url, fetchFn);
  const detail = parseTournamentDetail(html);
  const nameMatch = /<title>[^-]*-\s*([^<]+)<\/title>/i.exec(html);
  return {
    ...detail,
    sourceRef: tnrId,
    url: `${BASE}/tnr${tnrId}.aspx?lan=1`,
    name: nameMatch ? nameMatch[1].trim() : null,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add server/tournaments/chess-results.ts
git commit -m "feat(tournaments): chess-results fetch helpers"
```

---

## Task 6: Ingest script (`scripts/ingest-tournaments.ts`)

**Files:**
- Create: `scripts/ingest-tournaments.ts`
- Modify: `package.json` (add `"ingest:tournaments": "tsx scripts/ingest-tournaments.ts"` to scripts)

- [ ] **Step 1: Implement the orchestrator**

```ts
#!/usr/bin/env tsx
/**
 * Ingest French chess-results.com tournaments into the `tournament` table.
 * Usage: npm run ingest:tournaments [-- --fed FRA --from 2024-01-01]
 * Idempotent: upsert keyed on (source, source_ref). Geocoding is memoized
 * in geocode_cache. Per-tournament failures are logged and skipped.
 */
import { makePool } from '../server/db.js';
import { listFederationTnrIds, fetchTournament } from '../server/tournaments/chess-results.js';
import { geocodeCity, type GeoCache, type GeoResult } from '../server/tournaments/geocode.js';

const args = process.argv.slice(2);
const fed = argVal('--fed') ?? 'FRA';
const from = argVal('--from') ?? process.env.TOURNAMENTS_HISTORY_FROM ?? '2024-01-01';
function argVal(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const pool = makePool();
  const cache: GeoCache = {
    async get(q) {
      const { rows } = await pool.query<GeoResult>(
        'SELECT lat, lon, region, department, resolved FROM geocode_cache WHERE query = $1', [q]);
      return rows[0] ?? null;
    },
    async put(q, v) {
      await pool.query(
        `INSERT INTO geocode_cache(query, lat, lon, region, department, resolved)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (query) DO UPDATE SET lat=$2, lon=$3, region=$4, department=$5, resolved=$6, cached_at=now()`,
        [q, v.lat, v.lon, v.region, v.department, v.resolved]);
    },
  };

  const ids = await listFederationTnrIds(fed);
  console.log(`[tournaments] ${ids.length} ids from fed=${fed}`);
  let added = 0, updated = 0, skipped = 0, noGeo = 0;

  for (const id of ids) {
    try {
      const t = await fetchTournament(id);
      if (t.startDate && t.startDate < from) { skipped++; continue; }
      let geo: GeoResult = { lat: null, lon: null, region: null, department: null, resolved: false };
      if (t.location) geo = await geocodeCity(t.location, cache);
      if (!geo.lat) noGeo++;
      const res = await pool.query(
        `INSERT INTO tournament
           (source, source_ref, name, url, country, location, region, department,
            lat, lon, start_date, end_date, rounds, cadence, time_control, avg_rating, fetched_at)
         VALUES ('chess-results',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())
         ON CONFLICT (source, source_ref) DO UPDATE SET
           name=$2, url=$3, country=$4, location=$5, region=$6, department=$7,
           lat=$8, lon=$9, start_date=$10, end_date=$11, rounds=$12, cadence=$13,
           time_control=$14, avg_rating=$15, fetched_at=now()
         RETURNING (xmax = 0) AS inserted`,
        [t.sourceRef, t.name ?? `Tournament ${id}`, t.url, fed, t.location, geo.region,
         geo.department, geo.lat, geo.lon, t.startDate, t.endDate, t.rounds, t.cadence,
         t.timeControl, t.avgRating]);
      (res.rows[0] as any).inserted ? added++ : updated++;
      await sleep(400); // be polite
    } catch (e) {
      console.warn(`[tournaments] skip ${id}: ${(e as Error).message}`);
      skipped++;
    }
  }
  console.log(`[tournaments] done: +${added} added, ${updated} updated, ${skipped} skipped, ${noGeo} without coords`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Add the npm script**

In `package.json` `"scripts"`, add:
```json
"ingest:tournaments": "tsx scripts/ingest-tournaments.ts",
```

- [ ] **Step 3: Smoke-run against the dev DB**

Run: `DATABASE_URL=$DATABASE_URL npm run ingest:tournaments -- --fed FRA`
Expected: log line `done: +N added ...` and rows present:
`psql "$DATABASE_URL" -c "SELECT count(*), count(lat) FROM tournament;"`

- [ ] **Step 4: Commit**

```bash
git add scripts/ingest-tournaments.ts package.json
git commit -m "feat(tournaments): ingest script (list -> detail -> geocode -> upsert)"
```

---

## Task 7: API routes (`server/routes-tournaments.ts`) — TDD-lite

**Files:**
- Create: `server/routes-tournaments.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Implement the route**

```ts
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { requireUser } from './auth-guards.js';

const querySchema = z.object({
  region: z.string().optional(),
  cadence: z.enum(['classic', 'rapid', 'blitz']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().optional(),
  sort: z.enum(['date', 'name', 'region']).default('date'),
});

export async function tournamentRoutes(app: FastifyInstance, opts: { pool: Pool }) {
  const { pool } = opts;

  app.get('/api/tournaments', { preHandler: requireUser }, async (req, reply) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const f = parsed.data;
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (clause: string, val: unknown) => { params.push(val); where.push(clause.replace('?', `$${params.length}`)); };
    if (f.region) add('region = ?', f.region);
    if (f.cadence) add('cadence = ?', f.cadence);
    if (f.from) add('start_date >= ?', f.from);
    if (f.to) add('start_date <= ?', f.to);
    if (f.q) add('name ILIKE ?', `%${f.q}%`);
    const orderBy = f.sort === 'name' ? 'name ASC'
      : f.sort === 'region' ? 'region ASC NULLS LAST, start_date ASC'
      : 'start_date ASC';
    const sql = `SELECT id, name, url, location, region, department, lat, lon,
                        start_date, end_date, rounds, cadence, time_control, avg_rating
                   FROM tournament
                   ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                   ORDER BY ${orderBy} LIMIT 2000`;
    const { rows } = await pool.query(sql, params);
    return rows;
  });

  app.get('/api/tournaments/regions', { preHandler: requireUser }, async () => {
    const { rows } = await pool.query<{ region: string }>(
      `SELECT DISTINCT region FROM tournament WHERE region IS NOT NULL ORDER BY region`);
    return rows.map((r) => r.region);
  });
}
```

- [ ] **Step 2: Register in `server/index.ts`**

Add import near the other route imports:
```ts
import { tournamentRoutes } from './routes-tournaments.js';
```
Add registration after `await app.register(studentRoutes, { pool });`:
```ts
await app.register(tournamentRoutes, { pool });
```

- [ ] **Step 3: Verify with a manual request**

Run (server running): `curl -s -b "sid=<valid>" 'http://127.0.0.1:5174/api/tournaments?cadence=rapid' | head`
Expected: JSON array (possibly empty), HTTP 200. Without a session: `{"error":"auth required"}`.

- [ ] **Step 4: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.
```bash
git add server/routes-tournaments.ts server/index.ts
git commit -m "feat(tournaments): GET /api/tournaments + /regions (auth-gated)"
```

---

## Task 8: API client (`src/lib/api.ts`)

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Append the types + client**

```ts
export type Cadence = 'classic' | 'rapid' | 'blitz';
export interface TournamentRow {
  id: number; name: string; url: string;
  location: string | null; region: string | null; department: string | null;
  lat: number | null; lon: number | null;
  start_date: string | null; end_date: string | null;
  rounds: number | null; cadence: Cadence | null;
  time_control: string | null; avg_rating: number | null;
}
export interface TournamentFilters {
  region?: string; cadence?: Cadence; from?: string; to?: string; q?: string;
  sort?: 'date' | 'name' | 'region';
}
export const tournaments = {
  list: (f: TournamentFilters = {}) => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
    return api.get<TournamentRow[]>(`/api/tournaments?${qs.toString()}`);
  },
  regions: () => api.get<string[]>('/api/tournaments/regions'),
};
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/lib/api.ts
git commit -m "feat(tournaments): api client section"
```

---

## Task 9: France GeoJSON asset

**Files:**
- Create: `src/tournaments/france-regions.geo.json`

- [ ] **Step 1: Fetch a simplified regions GeoJSON**

Run:
```bash
curl -sL https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/regions/regions.geojson \
  -o src/tournaments/france-regions.geo.json
```
Expected: a valid FeatureCollection. Verify:
`node -e "const g=require('./src/tournaments/france-regions.geo.json'); console.log(g.type, g.features.length)"`
Expected: `FeatureCollection 13` (or similar count).

**Fallback if the fetch fails:** use `https://france-geojson.gregoiredavid.fr/repo/regions.geojson`. If both fail, commit a minimal metropolitan-France outline FeatureCollection (single Polygon) so the map still renders; note the degradation in the PR.

- [ ] **Step 2: Commit**

```bash
git add src/tournaments/france-regions.geo.json
git commit -m "feat(tournaments): bundle simplified France regions geojson"
```

---

## Task 10: Map view (`src/tournaments/TournamentMap.tsx`)

**Files:**
- Create: `src/tournaments/TournamentMap.tsx`

- [ ] **Step 1: Implement the d3-geo map**

```tsx
import { useMemo } from 'react';
import { geoConicConformal, geoPath } from 'd3-geo';
import type { TournamentRow } from '../lib/api';
import franceGeo from './france-regions.geo.json';

const W = 720, H = 720;

export function TournamentMap({ rows, onSelect }: {
  rows: TournamentRow[];
  onSelect: (t: TournamentRow) => void;
}) {
  const { pathD, project } = useMemo(() => {
    const projection = geoConicConformal().rotate([-3, 0]).center([0, 46.5])
      .fitSize([W, H], franceGeo as any);
    const path = geoPath(projection);
    return {
      pathD: (franceGeo as any).features.map((f: any) => path(f) ?? ''),
      project: (lon: number, lat: number) => projection([lon, lat]),
    };
  }, []);

  const mapped = rows.filter((r) => r.lat != null && r.lon != null);
  const unmapped = rows.length - mapped.length;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 720, background: 'var(--inset-bg)', borderRadius: 12 }}>
        {pathD.map((d, i) => (
          <path key={i} d={d} fill="rgba(125,125,125,0.08)" stroke="var(--border)" strokeWidth={0.6} />
        ))}
        {mapped.map((t) => {
          const p = project(t.lon!, t.lat!);
          if (!p) return null;
          const color = t.cadence === 'rapid' ? '#b8860b' : t.cadence === 'blitz' ? '#9c4dcc' : '#5b8cff';
          return (
            <circle key={t.id} cx={p[0]} cy={p[1]} r={5} fill={color} stroke="#fff" strokeWidth={1.2}
              style={{ cursor: 'pointer' }} onClick={() => onSelect(t)}>
              <title>{t.name} — {t.location}</title>
            </circle>
          );
        })}
      </svg>
      {unmapped > 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{unmapped} tournament(s) without coordinates not shown on the map — use the list view.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Ensure JSON import works** — `tsconfig.json` must have `"resolveJsonModule": true`. Verify; if missing, add it under `compilerOptions` and commit that change with this task.

- [ ] **Step 3: Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/tournaments/TournamentMap.tsx tsconfig.json
git commit -m "feat(tournaments): d3-geo France map view"
```

---

## Task 11: List view (`src/tournaments/TournamentList.tsx`)

**Files:**
- Create: `src/tournaments/TournamentList.tsx`

- [ ] **Step 1: Implement**

```tsx
import type { TournamentRow } from '../lib/api';

const CAD_LABEL: Record<string, string> = { classic: 'Classique', rapid: 'Rapide', blitz: 'Blitz' };
const CAD_COLOR: Record<string, string> = { classic: '#2e7d5b', rapid: '#b8860b', blitz: '#9c4dcc' };

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function TournamentList({ rows }: { rows: TournamentRow[] }) {
  if (rows.length === 0) {
    return <p style={{ color: 'var(--text-dim)', padding: '24px 0' }}>No tournaments match these filters.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((t) => (
        <a key={t.id} href={t.url} target="_blank" rel="noreferrer"
           style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px',
                    border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', color: 'inherit' }}>
          <div style={{ textAlign: 'center', minWidth: 44 }}>
            <strong style={{ fontSize: 15 }}>{fmtDate(t.start_date)}</strong>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{t.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {[t.location, t.region].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          {t.cadence && (
            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, color: '#fff', background: CAD_COLOR[t.cadence] }}>
              {CAD_LABEL[t.cadence]}
            </span>
          )}
          {t.rounds != null && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t.rounds} rondes</span>}
        </a>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tournaments/TournamentList.tsx
git commit -m "feat(tournaments): list view rows"
```

---

## Task 12: Page shell + filters (`src/tournaments/TournamentsPage.tsx`) — TDD

**Files:**
- Create: `src/tournaments/TournamentsPage.tsx`
- Test: `src/tournaments/TournamentsPage.test.tsx`

- [ ] **Step 1: Write the failing component test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TournamentsPage } from './TournamentsPage';
import * as apiMod from '../lib/api';

const sample = [
  { id: 1, name: 'Open de Paris', url: '#', location: 'Paris', region: 'Île-de-France',
    department: null, lat: 48.85, lon: 2.35, start_date: '2026-06-12', end_date: '2026-06-20',
    rounds: 9, cadence: 'classic', time_control: "90'", avg_rating: 1900 },
];

beforeEach(() => {
  vi.spyOn(apiMod.tournaments, 'list').mockResolvedValue(sample as any);
  vi.spyOn(apiMod.tournaments, 'regions').mockResolvedValue(['Île-de-France']);
});

describe('TournamentsPage', () => {
  it('renders the list then toggles to the map', async () => {
    render(<MemoryRouter><TournamentsPage /></MemoryRouter>);
    expect(await screen.findByText('Open de Paris')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /map|carte/i }));
    await waitFor(() => expect(document.querySelector('svg')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/tournaments/TournamentsPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the page**

```tsx
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TopBar } from '../components/ui/TopBar';
import { tournaments, type TournamentRow, type Cadence } from '../lib/api';
import { TournamentList } from './TournamentList';
import { TournamentMap } from './TournamentMap';
import { TOURNAMENT_NAV } from './nav';

const CADENCES: { key: Cadence; label: string }[] = [
  { key: 'classic', label: 'Classique' }, { key: 'rapid', label: 'Rapide' }, { key: 'blitz', label: 'Blitz' },
];

export function TournamentsPage() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [error, setError] = useState<string | null>(null);

  const region = params.get('region') ?? '';
  const cadence = (params.get('cadence') as Cadence | null) ?? undefined;
  const sort = (params.get('sort') as 'date' | 'name' | 'region' | null) ?? 'date';

  useEffect(() => { tournaments.regions().then(setRegions).catch(() => {}); }, []);
  useEffect(() => {
    setError(null);
    tournaments.list({ region: region || undefined, cadence, sort })
      .then(setRows).catch((e) => setError(e.message));
  }, [region, cadence, sort]);

  const patch = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    v ? next.set(k, v) : next.delete(k);
    setParams(next, { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar links={TOURNAMENT_NAV} />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px' }}>
        <h1 style={{ fontSize: 22, marginBottom: 14 }}>Tournois</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <select value={region} onChange={(e) => patch('region', e.target.value)} aria-label="Région">
            <option value="">Toutes régions</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {CADENCES.map((c) => (
            <button key={c.key} onClick={() => patch('cadence', cadence === c.key ? '' : c.key)}
              style={{ padding: '4px 10px', borderRadius: 999,
                       border: '1px solid var(--border)',
                       background: cadence === c.key ? '#5b8cff' : 'transparent',
                       color: cadence === c.key ? '#fff' : 'inherit' }}>
              {c.label}
            </button>
          ))}
          <select value={sort} onChange={(e) => patch('sort', e.target.value)} aria-label="Trier">
            <option value="date">Date</option><option value="name">Nom</option><option value="region">Région</option>
          </select>
          <div style={{ marginLeft: 'auto', display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setView('list')} aria-pressed={view === 'list'}
              style={{ padding: '6px 14px', background: view === 'list' ? '#5b8cff' : 'transparent', color: view === 'list' ? '#fff' : 'inherit' }}>Liste</button>
            <button onClick={() => setView('map')} aria-pressed={view === 'map'}
              style={{ padding: '6px 14px', background: view === 'map' ? '#5b8cff' : 'transparent', color: view === 'map' ? '#fff' : 'inherit' }}>Carte</button>
          </div>
        </div>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        {view === 'list'
          ? <TournamentList rows={rows} />
          : <TournamentMap rows={rows} onSelect={(t) => window.open(t.url, '_blank')} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/tournaments/nav.ts`** (shared nav link, reused by layouts)

```ts
export const TOURNAMENT_NAV = [
  { to: '/tournaments', label: 'Tournois', match: (p: string) => p.startsWith('/tournaments') },
];
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/tournaments/TournamentsPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tournaments/TournamentsPage.tsx src/tournaments/nav.ts src/tournaments/TournamentsPage.test.tsx
git commit -m "feat(tournaments): page shell with filters + view toggle"
```

---

## Task 13: Wire route + nav links

**Files:**
- Modify: `src/App.tsx`, `src/trainer/TrainerLayout.tsx`, `src/student/StudentLayout.tsx`

- [ ] **Step 1: Add the route in `src/App.tsx`**

Import:
```tsx
import { TournamentsPage } from './tournaments/TournamentsPage';
```
Add before the catch-all `<Route path="*" ...>`:
```tsx
<Route
  path="/tournaments"
  element={
    <RequireRole anyOf={['trainer', 'student', 'self']}>
      <TournamentsPage />
    </RequireRole>
  }
/>
```

- [ ] **Step 2: Add the link to `TrainerLayout` top bar**

In `src/trainer/TrainerLayout.tsx`, extend the `links` array with the Tournois entry (after Games):
```ts
{ to: '/tournaments', label: 'Tournois', match: (p: string) => p.startsWith('/tournaments') },
```

- [ ] **Step 3: Add the link to `StudentLayout` top bar**

In `src/student/StudentLayout.tsx`, find where `<TopBar links={...}>` is built and add the same Tournois entry. (If StudentLayout passes no links, add a `links={[{ to: '/tournaments', label: 'Tournois', match: (p) => p.startsWith('/tournaments') }]}` prop.)

- [ ] **Step 4: Typecheck + build + commit**

Run: `npm run typecheck && npm run build`
Expected: builds clean.
```bash
git add src/App.tsx src/trainer/TrainerLayout.tsx src/student/StudentLayout.tsx
git commit -m "feat(tournaments): route + top-bar nav for trainer & student"
```

---

## Task 14: E2E smoke + full test run

**Files:**
- Create: `tests/e2e/tournaments.spec.ts`

- [ ] **Step 1: Write a smoke spec** (follow the existing `tests/e2e/happy-path.spec.ts` sign-in helper pattern; reuse its login setup)

```ts
import { test, expect } from '@playwright/test';
// Reuse the project's sign-in helper/fixtures as happy-path.spec.ts does.
test('signed-in user can browse tournaments and toggle views', async ({ page }) => {
  // <sign in as an existing seeded user, per happy-path.spec.ts>
  await page.goto('/tournaments');
  await expect(page.getByRole('heading', { name: 'Tournois' })).toBeVisible();
  await page.getByRole('button', { name: 'Carte' }).click();
  await expect(page.locator('svg')).toBeVisible();
  await page.getByRole('button', { name: 'Liste' }).click();
});
```

- [ ] **Step 2: Run the unit/component suite**

Run: `npm test`
Expected: all green (parse, geocode, TournamentsPage suites included).

- [ ] **Step 3: Run typecheck + build once more**

Run: `npm run typecheck && npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/tournaments.spec.ts
git commit -m "test(tournaments): e2e smoke for browse + view toggle"
```

---

## Task 15: Docs + migration pipeline note

**Files:**
- Modify: `README.md`, `server/migrations/README.md`

- [ ] **Step 1:** Add a short "Tournaments" subsection to `README.md` documenting `npm run ingest:tournaments` (env `TOURNAMENTS_HISTORY_FROM`, default `2024-01-01`) and that data comes from chess-results.com.

- [ ] **Step 2:** Confirm `2026-05-31-tournaments.sql` is picked up by `scripts/apply-migrations.sh` (alphabetical) — no code change needed; note it in the migrations README changelog line.

- [ ] **Step 3: Commit**

```bash
git add README.md server/migrations/README.md
git commit -m "docs(tournaments): ingest usage + migration note"
```

---

## Self-Review notes

- **Spec coverage:** data model (T1), source adapter/ingest (T3–T6), geocode (T4), API filter+sort (T7), client (T8), map+list toggle (T9–T12), nav/access (T13), tests (T3,4,12,14), docs (T15). All spec sections mapped.
- **Type consistency:** `Cadence` defined once in `parse.ts`, re-declared in `api.ts` for the client boundary (intentional — server/client don't share types here, matching existing api.ts style). `TournamentRow` field names match the SQL `SELECT` column names in T7. `GeoResult`/`GeoCache` used identically in T4 and T6.
- **Known risk:** chess-results HTML structure is assumed from one sampled page; T6 smoke-run (Step 3) is the real validation — if labels differ, fix `parse.ts` regexes there before proceeding. The federation list page may need the `Transfer.aspx?key5=TS&fed=FRA` "view more" page for full coverage; T5 starts with `fed.aspx` and can be extended if the smoke-run shows too few ids.
