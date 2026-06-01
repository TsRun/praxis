#!/usr/bin/env tsx
/**
 * Ingest FIDE-rated OTB tournaments (ratings.fide.com) into the `tournament`
 * table. France-focused by default; `--country all` for worldwide.
 *
 * Usage:
 *   npm run ingest:tournaments                       # FRA, periods since --from
 *   npm run ingest:tournaments -- --from 2025-01-01
 *   npm run ingest:tournaments -- --country all --full   # everything (huge!)
 *   npm run ingest:tournaments -- --no-detail        # skip per-event enrichment
 *   npm run ingest:tournaments -- --limit 50         # cap (smoke test)
 *
 * Idempotent: upsert keyed on (source, source_ref). Geocoding is memoized in
 * geocode_cache. Per-tournament failures are logged and skipped. Detail
 * enrichment (cadence, end date, player count, country) costs one request per
 * tournament — `--no-detail` skips it (cadence/end_date then NULL).
 */
import { makePool } from '../server/db.js';
import { listPeriods, listTournaments, fetchTournamentDetail, tournamentUrl } from '../server/tournaments/fide.js';
import { geocodeCity, type GeoCache, type GeoResult } from '../server/tournaments/geocode.js';

const argv = process.argv.slice(2);
const flag = (name: string): boolean => argv.includes(name);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const country = (opt('--country') ?? 'FRA').toUpperCase();
const from = opt('--from') ?? process.env.TOURNAMENTS_HISTORY_FROM ?? '2024-01-01';
const full = flag('--full');
// --current: skip period iteration and hit only the "current & future" view
// (a_tournaments.php with no period). Cheap, ideal for a daily refresh cron.
const current = flag('--current');
const noDetail = flag('--no-detail');
const limit = opt('--limit') ? parseInt(opt('--limit')!, 10) : Infinity;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const pool = makePool();
  const cache: GeoCache = {
    async get(q) {
      const { rows } = await pool.query<GeoResult>(
        'SELECT lat, lon, region, department, resolved FROM geocode_cache WHERE query = $1',
        [q],
      );
      return rows[0] ?? null;
    },
    async put(q, v) {
      await pool.query(
        `INSERT INTO geocode_cache(query, lat, lon, region, department, resolved)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (query) DO UPDATE SET
           lat=$2, lon=$3, region=$4, department=$5, resolved=$6, cached_at=now()`,
        [q, v.lat, v.lon, v.region, v.department, v.resolved],
      );
    },
  };

  // Periods to walk. Empty list (e.g. country=all panel quirk) -> the default
  // current view via a single null period.
  let periodKeys: (string | null)[];
  if (current) {
    periodKeys = [null]; // current & future view only
  } else {
    let periods = await listPeriods(country);
    if (!full) periods = periods.filter((p) => p.publish >= from);
    periodKeys = periods.length ? periods.map((p) => p.publish) : [null];
  }
  const scope = current ? 'current view' : full ? 'full' : `since ${from}`;
  console.log(`[tournaments] country=${country} periods=${periodKeys.length} (${scope}) detail=${!noDetail}`);

  const seen = new Set<string>();
  let added = 0, updated = 0, skipped = 0, noGeo = 0, count = 0;

  for (const period of periodKeys) {
    let rows;
    try {
      rows = await listTournaments(country, period);
    } catch (e) {
      console.warn(`[tournaments] list ${period ?? 'current'} failed: ${(e as Error).message}`);
      continue;
    }
    for (const row of rows) {
      if (count >= limit) break;
      if (seen.has(row.sourceRef)) continue;
      seen.add(row.sourceRef);
      count++;
      try {
        const detail = noDetail ? null : await fetchTournamentDetail(row.sourceRef);
        const city = detail?.city ?? row.city;
        const rowCountry = detail?.country ?? country;
        let geo: GeoResult = { lat: null, lon: null, region: null, department: null, resolved: false };
        if (city && rowCountry === 'FRA') geo = await geocodeCity(city, cache);
        if (!geo.lat && rowCountry === 'FRA') noGeo++;

        const res = await pool.query<{ inserted: boolean }>(
          `INSERT INTO tournament
             (source, source_ref, name, url, country, location, region, department,
              lat, lon, start_date, end_date, players, cadence, time_control, period, fetched_at)
           VALUES ('fide',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())
           ON CONFLICT (source, source_ref) DO UPDATE SET
             name=$2, url=$3, country=$4, location=$5, region=$6, department=$7,
             lat=$8, lon=$9, start_date=$10, end_date=$11, players=$12, cadence=$13,
             time_control=$14, period=$15, fetched_at=now()
           RETURNING (xmax = 0) AS inserted`,
          [
            row.sourceRef,
            detail?.name ?? row.name ?? `FIDE ${row.sourceRef}`,
            detail?.url ?? tournamentUrl(row.sourceRef),
            rowCountry,
            city,
            geo.region,
            geo.department,
            geo.lat,
            geo.lon,
            detail?.startDate ?? row.startDate,
            detail?.endDate ?? null,
            detail?.players ?? null,
            detail?.cadence ?? null,
            detail?.timeControl ?? null,
            row.period,
          ],
        );
        res.rows[0]?.inserted ? added++ : updated++;
        if (!noDetail) await sleep(350); // be polite when hitting detail pages
      } catch (e) {
        console.warn(`[tournaments] skip ${row.sourceRef}: ${(e as Error).message}`);
        skipped++;
      }
    }
    if (count >= limit) break;
  }

  console.log(`[tournaments] done: +${added} added, ${updated} updated, ${skipped} skipped, ${noGeo} FRA without coords`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
