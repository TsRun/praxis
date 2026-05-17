#!/usr/bin/env tsx
/**
 * Backfill game_move.{result, mover_elo, white_fide_id, black_fide_id}
 * by iterating game.id ranges.
 *
 * The naive `WHERE result IS NULL` approach scans the whole game_move table
 * for each batch (no functional index on that predicate). Iterating by
 * game.id range hits the PK index on (game_id, ply) and runs ~50× faster.
 */

import { makePool } from '../server/db.js';

const CHUNK = 50_000; // 50K games per batch ≈ 800K plies, ~5-10 sec each

async function main() {
  const pool = makePool();
  const client = await pool.connect();
  try {
    const start = Date.now();

    const { rows: bounds } = await client.query<{ min: string | null; max: string | null }>(
      `SELECT MIN(id)::text AS min, MAX(id)::text AS max FROM game`,
    );
    const minId = Number(bounds[0].min ?? 0);
    const maxId = Number(bounds[0].max ?? 0);
    if (maxId === 0) {
      console.log('no games — nothing to do');
      return;
    }

    const totalGames = maxId - minId + 1;
    console.log(`backfilling plies for games ${minId.toLocaleString()}..${maxId.toLocaleString()} (${totalGames.toLocaleString()} games)`);

    let processed = 0;
    for (let lo = minId; lo <= maxId; lo += CHUNK) {
      const hi = Math.min(lo + CHUNK - 1, maxId);
      const t0 = Date.now();
      const { rowCount } = await client.query(
        `UPDATE game_move gm SET
           result        = g.result,
           mover_elo     = CASE WHEN gm.ply % 2 = 1 THEN g.white_elo ELSE g.black_elo END,
           white_fide_id = g.white_fide_id,
           black_fide_id = g.black_fide_id
         FROM game g
         WHERE g.id = gm.game_id
           AND gm.game_id BETWEEN $1 AND $2
           AND gm.result IS NULL`,
        [lo, hi],
      );
      processed += hi - lo + 1;
      const pct = ((processed / totalGames) * 100).toFixed(1);
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      const totalSec = (Date.now() - start) / 1000;
      const etaSec = Math.max(0, totalSec * (1 - processed / totalGames) / Math.max(0.001, processed / totalGames));
      console.log(
        `  ids ${lo.toLocaleString()}..${hi.toLocaleString()}: ${(rowCount ?? 0).toLocaleString()} rows in ${dt}s · ${pct}% · ETA ${etaSec.toFixed(0)}s`,
      );
    }

    console.log(`done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
