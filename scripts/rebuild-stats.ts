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
    const insertSql = `
      INSERT INTO move_stats_new
        (parent_fen, san, uci, child_fen, games, white_wins, draws, black_wins, rating_sum, rating_n)
      SELECT gm.parent_fen,
             gm.san,
             MIN(gm.uci),
             MIN(gm.child_fen),
             COUNT(*),
             SUM((g.result = 'W')::int),
             SUM((g.result = 'D')::int),
             SUM((g.result = 'B')::int),
             COALESCE(SUM(
               CASE WHEN gm.ply % 2 = 1 THEN g.white_elo ELSE g.black_elo END
             ), 0),
             COUNT(NULLIF(
               CASE WHEN gm.ply % 2 = 1 THEN g.white_elo ELSE g.black_elo END, 0
             ))
        FROM game_move gm
        JOIN game g ON g.id = gm.game_id
       GROUP BY gm.parent_fen, gm.san`;
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
