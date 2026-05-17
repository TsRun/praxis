#!/usr/bin/env tsx
/**
 * Rebuild the move_stats summary table from current game / game_move data.
 *
 * Run after a batch ingest. The explorer endpoint reads from move_stats for
 * unfiltered queries (the common case) which turns a multi-million-row
 * GROUP BY into a single indexed lookup.
 *
 * The rebuild itself is one big GROUP BY — on a million-game DB it takes
 * a couple of minutes; on a 10M-game DB closer to ten. We swap tables in
 * one transaction so the explorer doesn't see a half-built state.
 */

import { makePool, ensureSchema } from '../server/db.js';

async function main() {
  const pool = makePool();
  await ensureSchema(pool);
  const client = await pool.connect();
  try {
    const t0 = Date.now();
    console.log('rebuilding move_stats…');

    // Build a fresh staging table from current data, then atomically swap.
    await client.query('BEGIN');
    await client.query('DROP TABLE IF EXISTS move_stats_new');
    await client.query(`
      CREATE UNLOGGED TABLE move_stats_new (
        parent_fen TEXT NOT NULL,
        san        TEXT NOT NULL,
        uci        TEXT NOT NULL,
        child_fen  TEXT NOT NULL,
        games      BIGINT NOT NULL,
        white_wins BIGINT NOT NULL,
        draws      BIGINT NOT NULL,
        black_wins BIGINT NOT NULL,
        rating_sum BIGINT NOT NULL,
        rating_n   BIGINT NOT NULL
      )
    `);

    // The (parent_fen, san) key uniquely identifies the move from a position,
    // so uci and child_fen are functionally determined — MIN/MAX/ANY all work.
    //
    // Cap at ply 30: move_stats is the precomputed *opening* summary. Deep
    // middlegame positions are usually 1-game outliers (no aggregation value)
    // and bloat the summary. Filtered/deep queries still work via the live
    // game_move path.
    //
    // We can also skip the JOIN entirely — game_move already carries
    // denormalized result and mover_elo.
    const insertSql = `
      INSERT INTO move_stats_new
        (parent_fen, san, uci, child_fen, games, white_wins, draws, black_wins, rating_sum, rating_n)
      SELECT parent_fen,
             san,
             MIN(uci),
             MIN(child_fen),
             COUNT(*),
             SUM((result = 'W')::int),
             SUM((result = 'D')::int),
             SUM((result = 'B')::int),
             COALESCE(SUM(mover_elo), 0),
             COUNT(NULLIF(mover_elo, 0))
        FROM game_move
       WHERE ply <= 30
       GROUP BY parent_fen, san`;
    console.log('  populating move_stats_new (one large GROUP BY)…');
    const res = await client.query(insertSql);
    console.log(`  inserted ${res.rowCount?.toLocaleString()} (parent_fen, san) rows`);

    // Promote: rename old → drop, new → real, recreate indexes & PK.
    await client.query('ALTER TABLE move_stats_new SET LOGGED');
    await client.query(`ALTER TABLE move_stats_new ADD PRIMARY KEY (parent_fen, san)`);
    await client.query(`CREATE INDEX idx_move_stats_new_parent_games
                        ON move_stats_new(parent_fen, games DESC)`);
    await client.query('DROP TABLE IF EXISTS move_stats');
    await client.query('ALTER TABLE move_stats_new RENAME TO move_stats');
    await client.query(
      'ALTER INDEX idx_move_stats_new_parent_games RENAME TO idx_move_stats_parent_games',
    );
    await client.query('COMMIT');

    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`done in ${sec}s`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
