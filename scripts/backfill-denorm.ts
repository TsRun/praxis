#!/usr/bin/env tsx
/**
 * Backfill game_move.{result, mover_elo, white_fide_id, black_fide_id}
 * for rows ingested before the denorm columns existed.
 *
 * Runs the update in committed batches so progress is durable and locks
 * don't block other operations for tens of minutes.
 */

import { makePool } from '../server/db.js';

const BATCH = 200_000;

async function main() {
  const pool = makePool();
  const client = await pool.connect();
  try {
    const start = Date.now();
    let totalDone = 0;

    // Total to do — for progress display only
    const { rows: countRows } = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM game_move WHERE result IS NULL`,
    );
    const total = Number(countRows[0].n);
    console.log(`backfill target: ${total.toLocaleString()} rows`);
    if (total === 0) {
      console.log('nothing to do.');
      return;
    }

    while (true) {
      const { rowCount } = await client.query(
        `WITH batch AS (
           SELECT ctid FROM game_move WHERE result IS NULL LIMIT $1
         )
         UPDATE game_move gm SET
           result        = g.result,
           mover_elo     = CASE WHEN gm.ply % 2 = 1 THEN g.white_elo ELSE g.black_elo END,
           white_fide_id = g.white_fide_id,
           black_fide_id = g.black_fide_id
           FROM game g, batch
          WHERE gm.ctid = batch.ctid AND g.id = gm.game_id`,
        [BATCH],
      );
      if (!rowCount) break;
      totalDone += rowCount;
      const sec = (Date.now() - start) / 1000;
      const pct = ((totalDone / total) * 100).toFixed(1);
      const rate = totalDone / sec;
      const etaSec = ((total - totalDone) / rate).toFixed(0);
      console.log(
        `  ${totalDone.toLocaleString()} / ${total.toLocaleString()} (${pct}%) · ${rate.toFixed(0)}/s · ETA ${etaSec}s`,
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
