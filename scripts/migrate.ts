#!/usr/bin/env tsx
/**
 * Apply pending SQL migrations to the database in `DATABASE_URL`, using `pg`
 * (no psql binary needed — works inside the slim Railway image). Tracks applied
 * filenames in `schema_migrations`; idempotent and safe to run on every deploy.
 *
 * Wired as the Railway pre-deploy command (see railway.toml), so migrations
 * reach the Railway Postgres on each deploy — no self-hosted runner, no manual
 * step. Run order is alphabetical by filename (use numeric/date prefixes).
 *
 * Local use: DATABASE_URL=postgres://… tsx scripts/migrate.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makePool } from '../server/db.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, '../server/migrations');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[migrate] DATABASE_URL is not set — nothing to do');
    process.exit(1);
  }
  const pool = makePool();
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  let applied = 0;
  for (const name of files) {
    const { rowCount } = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [name]);
    if (rowCount) {
      console.log(`[migrate] skip ${name} (already applied)`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, name), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [name]);
      await client.query('COMMIT');
      console.log(`[migrate] applied ${name}`);
      applied++;
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(`[migrate] FAILED ${name}: ${(e as Error).message}`);
      throw e;
    } finally {
      client.release();
    }
  }
  console.log(`[migrate] done: ${applied} applied, ${files.length - applied} already current`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
