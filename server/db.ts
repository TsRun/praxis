import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export interface MoveRow {
  san: string;
  uci: string;
  child_fen: string;
  games: string; // bigint comes back as string from pg
  white_wins: string;
  draws: string;
  black_wins: string;
  rating_sum: string;
  rating_n: string;
}

export const DEFAULT_DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://localhost:5432/openings';

export function makePool(connectionString = DEFAULT_DATABASE_URL): pg.Pool {
  // Enable TLS for any non-local Postgres. `pg` only negotiates TLS if either
  // the connection string sets `sslmode=require` OR we pass an `ssl` option.
  // Without this, a connection string that omits `sslmode` (the default for
  // Railway's internal-network URL) sends the password and every query in
  // plaintext if the host is ever reachable off-loopback.
  const isLocal = /(?:^|@)(localhost|127\.0\.0\.1|::1)[:/]/.test(connectionString);
  const wantsSsl = process.env.PGSSL === '1'
    || (!isLocal && process.env.PGSSL !== '0');
  const sslOpt = wantsSsl
    ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== '0' }
    : false;
  return new pg.Pool({ connectionString, max: 10, ssl: sslOpt });
}

export async function ensureSchema(pool: pg.Pool): Promise<void> {
  const sql = readFileSync(resolve(here, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

export function epdFromFen(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}
