#!/usr/bin/env tsx
/**
 * Ingest a PGN file into the openings Postgres index.
 *
 * Usage:
 *   npx tsx scripts/ingest.ts <path-to.pgn> [--depth 16] [--source name]
 *   DATABASE_URL=postgres://... npx tsx scripts/ingest.ts ...
 *
 * Streams the file (constant memory regardless of file size), dedupes games
 * by stable fingerprint, walks the first `depth` plies and aggregates per
 * (parent EPD, SAN) edge stats with ON CONFLICT UPSERT.
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { Chess } from 'chess.js';
import { makePool, ensureSchema, epdFromFen } from '../server/db.js';

interface Headers {
  [key: string]: string;
}

interface RawGame {
  headers: Headers;
  moveText: string;
}

const DEFAULT_DEPTH = 16;

async function* readGames(path: string): AsyncGenerator<RawGame> {
  const stream = createReadStream(path, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let headers: Headers = {};
  let moveTextLines: string[] = [];
  let inHeaders = true;

  for await (const line of rl) {
    if (line.startsWith('[')) {
      if (!inHeaders && (Object.keys(headers).length > 0 || moveTextLines.length > 0)) {
        yield { headers, moveText: moveTextLines.join(' ').trim() };
        headers = {};
        moveTextLines = [];
      }
      inHeaders = true;
      const m = line.match(/^\[(\w+)\s+"(.*)"\]/);
      if (m) headers[m[1]] = m[2];
    } else if (line.trim() === '') {
      if (inHeaders && Object.keys(headers).length > 0) {
        inHeaders = false;
      }
    } else {
      inHeaders = false;
      moveTextLines.push(line);
    }
  }
  if (Object.keys(headers).length > 0 || moveTextLines.length > 0) {
    yield { headers, moveText: moveTextLines.join(' ').trim() };
  }
}

function fingerprint(headers: Headers, firstMoves: string[]): string {
  const w = (headers.White ?? '').trim().toLowerCase();
  const b = (headers.Black ?? '').trim().toLowerCase();
  const d = (headers.Date ?? headers.UTCDate ?? '').trim();
  const r = (headers.Result ?? '').trim();
  const e = (headers.Event ?? '').trim().toLowerCase();
  const opening = firstMoves.slice(0, 20).join(' ');
  return createHash('sha1')
    .update(`${w}|${b}|${d}|${r}|${e}|${opening}`)
    .digest('hex');
}

function parseElo(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function resultDelta(result: string) {
  if (result === '1-0') return { ww: 1, dr: 0, bw: 0 };
  if (result === '0-1') return { ww: 0, dr: 0, bw: 1 };
  if (result === '1/2-1/2') return { ww: 0, dr: 1, bw: 0 };
  return null;
}

function stripComments(s: string): string {
  return s
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\$\d+/g, ' ');
}

function extractSanMoves(moveText: string): string[] {
  const cleaned = stripComments(moveText).replace(/\d+\.(\.\.)?/g, ' ');
  return cleaned
    .split(/\s+/)
    .filter((tok) => tok && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok));
}

interface MoveEdge {
  parent_fen: string;
  san: string;
  uci: string;
  child_fen: string;
  ww: number;
  dr: number;
  bw: number;
  rsum: number;
  rn: number;
}

async function flushBatch(pool: ReturnType<typeof makePool>, gameRows: Array<unknown[]>, edges: MoveEdge[]) {
  if (gameRows.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Bulk insert games using a multi-row VALUES clause with ON CONFLICT DO NOTHING.
    const gameValues: unknown[] = [];
    const gamePlaceholders: string[] = [];
    for (let i = 0; i < gameRows.length; i++) {
      const off = i * 9;
      gamePlaceholders.push(
        `($${off + 1},$${off + 2},$${off + 3},$${off + 4},$${off + 5},$${off + 6},$${off + 7},$${off + 8},$${off + 9})`,
      );
      gameValues.push(...gameRows[i]);
    }
    await client.query(
      `INSERT INTO game (fingerprint, white, black, white_elo, black_elo, event_date, result, source, ingested_at)
       VALUES ${gamePlaceholders.join(',')}
       ON CONFLICT (fingerprint) DO NOTHING`,
      gameValues,
    );

    // Aggregate edges within the batch first (reduce UPSERT round-trips).
    type Agg = MoveEdge & { games: number };
    const aggMap = new Map<string, Agg>();
    for (const e of edges) {
      const k = `${e.parent_fen}|${e.san}`;
      const cur = aggMap.get(k);
      if (cur) {
        cur.games++;
        cur.ww += e.ww; cur.dr += e.dr; cur.bw += e.bw;
        cur.rsum += e.rsum; cur.rn += e.rn;
      } else {
        aggMap.set(k, { ...e, games: 1 });
      }
    }
    const agg = [...aggMap.values()];

    // Bulk upsert edges in chunks of 200 (param limit safety).
    const CHUNK = 200;
    for (let i = 0; i < agg.length; i += CHUNK) {
      const slice = agg.slice(i, i + CHUNK);
      const params: unknown[] = [];
      const placeholders: string[] = [];
      slice.forEach((e, idx) => {
        const off = idx * 10;
        placeholders.push(
          `($${off + 1},$${off + 2},$${off + 3},$${off + 4},$${off + 5},$${off + 6},$${off + 7},$${off + 8},$${off + 9},$${off + 10})`,
        );
        params.push(e.parent_fen, e.san, e.uci, e.child_fen, e.games, e.ww, e.dr, e.bw, e.rsum, e.rn);
      });
      await client.query(
        `INSERT INTO move
           (parent_fen, san, uci, child_fen, games, white_wins, draws, black_wins, rating_sum, rating_n)
         VALUES ${placeholders.join(',')}
         ON CONFLICT (parent_fen, san) DO UPDATE SET
           games = move.games + EXCLUDED.games,
           white_wins = move.white_wins + EXCLUDED.white_wins,
           draws = move.draws + EXCLUDED.draws,
           black_wins = move.black_wins + EXCLUDED.black_wins,
           rating_sum = move.rating_sum + EXCLUDED.rating_sum,
           rating_n = move.rating_n + EXCLUDED.rating_n`,
        params,
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function isAlreadyIngested(pool: ReturnType<typeof makePool>, fp: string): Promise<boolean> {
  const { rowCount } = await pool.query('SELECT 1 FROM game WHERE fingerprint = $1', [fp]);
  return (rowCount ?? 0) > 0;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('usage: tsx scripts/ingest.ts <pgn-file> [--depth N] [--source NAME]');
    process.exit(1);
  }
  const pgnPath = resolve(args[0]);
  const depthArg = args.indexOf('--depth');
  const depth = depthArg !== -1 ? Number(args[depthArg + 1]) : DEFAULT_DEPTH;
  const sourceArg = args.indexOf('--source');
  const source = sourceArg !== -1 ? args[sourceArg + 1] : 'unknown';

  const pool = makePool();
  await ensureSchema(pool);

  let read = 0;
  let kept = 0;
  let skippedDup = 0;
  let skippedNoResult = 0;
  let skippedInvalid = 0;

  // Pre-load fingerprints already in the DB (set lookup avoids per-game query for big runs).
  console.log('loading existing fingerprints…');
  const seen = new Set<string>();
  const stream = await pool.query({
    text: 'SELECT fingerprint FROM game',
    rowMode: 'array',
  });
  for (const r of stream.rows) seen.add(r[0] as string);
  console.log(`  found ${seen.size} already-ingested games`);

  const BATCH = 500;
  let gameRows: unknown[][] = [];
  let edges: MoveEdge[] = [];

  const t0 = Date.now();
  let lastPrint = 0;

  for await (const game of readGames(pgnPath)) {
    read++;
    const sanMoves = extractSanMoves(game.moveText);
    const result = (game.headers.Result ?? '').trim();
    const delta = resultDelta(result);
    if (!delta) {
      skippedNoResult++;
      continue;
    }
    const fp = fingerprint(game.headers, sanMoves);
    if (seen.has(fp)) {
      skippedDup++;
      continue;
    }
    seen.add(fp);

    const whiteElo = parseElo(game.headers.WhiteElo);
    const blackElo = parseElo(game.headers.BlackElo);

    const chess = new Chess();
    let valid = true;
    const localEdges: MoveEdge[] = [];
    const limit = Math.min(depth, sanMoves.length);

    for (let i = 0; i < limit; i++) {
      const parent = epdFromFen(chess.fen());
      const sideToMove = chess.turn();
      let mv;
      try {
        mv = chess.move(sanMoves[i]);
      } catch {
        mv = null;
      }
      if (!mv) { valid = false; break; }
      const uci = `${mv.from}${mv.to}${mv.promotion ?? ''}`;
      const child = epdFromFen(chess.fen());
      const elo = sideToMove === 'w' ? whiteElo : blackElo;
      localEdges.push({
        parent_fen: parent,
        san: mv.san,
        uci,
        child_fen: child,
        ww: delta.ww, dr: delta.dr, bw: delta.bw,
        rsum: elo ?? 0,
        rn: elo != null ? 1 : 0,
      });
    }

    if (!valid) {
      skippedInvalid++;
      continue;
    }

    gameRows.push([
      fp,
      game.headers.White ?? null,
      game.headers.Black ?? null,
      whiteElo,
      blackElo,
      game.headers.Date ?? game.headers.UTCDate ?? null,
      result,
      source,
      Date.now(),
    ]);
    for (const e of localEdges) edges.push(e);
    kept++;

    if (gameRows.length >= BATCH) {
      await flushBatch(pool, gameRows, edges);
      gameRows = [];
      edges = [];
      const now = Date.now();
      if (now - lastPrint > 1000) {
        const rate = read / Math.max(1, (now - t0) / 1000);
        process.stdout.write(
          `\r read=${read} kept=${kept} dup=${skippedDup} no-result=${skippedNoResult} invalid=${skippedInvalid} (${rate.toFixed(0)}/s)    `,
        );
        lastPrint = now;
      }
    }
  }
  if (gameRows.length > 0) await flushBatch(pool, gameRows, edges);

  console.log(`\n done. read=${read} kept=${kept} dupes=${skippedDup} no-result=${skippedNoResult} invalid=${skippedInvalid}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
