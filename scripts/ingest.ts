#!/usr/bin/env tsx
/**
 * Ingest a PGN file into the openings Postgres index.
 *
 * Usage:
 *   npx tsx scripts/ingest.ts <path-to.pgn> [--depth 16] [--source NAME]
 *
 * Streams the file, dedupes by stable fingerprint, writes one row to `game`
 * and N rows to `game_move` per accepted game. FIDE IDs from PGN headers
 * (WhiteFideId / BlackFideId, as TWIC ships them) are linked to the player
 * table; new ones found in PGN but absent from the player table are
 * inserted with origin='pgn' as a fallback.
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { Chess } from 'chess.js';
import { makePool, ensureSchema, epdFromFen } from '../server/db.js';

interface Headers { [key: string]: string; }
interface RawGame { headers: Headers; moveText: string; }

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
      if (inHeaders && Object.keys(headers).length > 0) inHeaders = false;
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
  return createHash('sha1').update(`${w}|${b}|${d}|${r}|${e}|${opening}`).digest('hex');
}

function parseInt0(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resultChar(result: string): 'W' | 'B' | 'D' | null {
  if (result === '1-0') return 'W';
  if (result === '0-1') return 'B';
  if (result === '1/2-1/2') return 'D';
  return null;
}

function stripComments(s: string): string {
  return s.replace(/\{[^}]*\}/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/\$\d+/g, ' ');
}

function extractSanMoves(moveText: string): string[] {
  const cleaned = stripComments(moveText).replace(/\d+\.(\.\.)?/g, ' ');
  return cleaned
    .split(/\s+/)
    .filter((tok) => tok && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok));
}

interface AcceptedGame {
  fingerprint: string;
  white_name: string | null;
  black_name: string | null;
  white_fide_id: number | null;
  black_fide_id: number | null;
  white_elo: number | null;
  black_elo: number | null;
  event: string | null;
  event_date: string | null;
  result: 'W' | 'B' | 'D';
  edges: Array<{ ply: number; parent_fen: string; san: string; uci: string; child_fen: string }>;
}

async function ensurePlayerStubs(
  pool: ReturnType<typeof makePool>,
  pairs: Array<{ fide_id: number; name: string }>,
) {
  if (pairs.length === 0) return;
  const params: unknown[] = [];
  const placeholders: string[] = [];
  pairs.forEach((p, i) => {
    placeholders.push(`($${i * 2 + 1},$${i * 2 + 2},'pgn')`);
    params.push(p.fide_id, p.name);
  });
  await pool.query(
    `INSERT INTO player (fide_id, name, origin) VALUES ${placeholders.join(',')}
     ON CONFLICT (fide_id) DO NOTHING`,
    params,
  );
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
  // Apply source attribution to the connection — every row inserted in this run
  // shares the same source label via a session GUC.
  // (We just store it on each row via the AcceptedGame path; ignore this for now.)

  console.log('loading existing fingerprints…');
  const seen = new Set<string>();
  const stream = await pool.query({ text: 'SELECT fingerprint FROM game', rowMode: 'array' });
  for (const r of stream.rows) seen.add(r[0] as string);
  console.log(`  found ${seen.size} already-ingested games`);

  const BATCH = 250;
  let buffer: AcceptedGame[] = [];

  let read = 0, kept = 0, dup = 0, noResult = 0, invalid = 0;
  const t0 = Date.now();
  let lastPrint = 0;

  for await (const game of readGames(pgnPath)) {
    read++;
    const sanMoves = extractSanMoves(game.moveText);
    const r = resultChar((game.headers.Result ?? '').trim());
    if (!r) { noResult++; continue; }
    const fp = fingerprint(game.headers, sanMoves);
    if (seen.has(fp)) { dup++; continue; }
    seen.add(fp);

    const chess = new Chess();
    let valid = true;
    const edges: AcceptedGame['edges'] = [];
    const limit = Math.min(depth, sanMoves.length);
    for (let i = 0; i < limit; i++) {
      const parent = epdFromFen(chess.fen());
      let mv;
      try { mv = chess.move(sanMoves[i]); } catch { mv = null; }
      if (!mv) { valid = false; break; }
      const uci = `${mv.from}${mv.to}${mv.promotion ?? ''}`;
      edges.push({ ply: i + 1, parent_fen: parent, san: mv.san, uci, child_fen: epdFromFen(chess.fen()) });
    }
    if (!valid) { invalid++; continue; }

    buffer.push({
      fingerprint: fp,
      white_name: game.headers.White ?? null,
      black_name: game.headers.Black ?? null,
      white_fide_id: parseInt0(game.headers.WhiteFideId),
      black_fide_id: parseInt0(game.headers.BlackFideId),
      white_elo: parseInt0(game.headers.WhiteElo),
      black_elo: parseInt0(game.headers.BlackElo),
      event: game.headers.Event ?? null,
      event_date: game.headers.Date ?? game.headers.UTCDate ?? null,
      result: r,
      edges,
    });
    kept++;

    if (buffer.length >= BATCH) {
      // Inject the source on each game (we keep it out of the AcceptedGame type
      // because the column is a constant per run).
      await flushBatchWithSource(pool, buffer, source);
      buffer = [];
      const now = Date.now();
      if (now - lastPrint > 1000) {
        const rate = read / Math.max(1, (now - t0) / 1000);
        process.stdout.write(
          `\r read=${read} kept=${kept} dup=${dup} no-result=${noResult} invalid=${invalid} (${rate.toFixed(0)}/s)    `,
        );
        lastPrint = now;
      }
    }
  }
  if (buffer.length > 0) await flushBatchWithSource(pool, buffer, source);

  console.log(`\n done. read=${read} kept=${kept} dup=${dup} no-result=${noResult} invalid=${invalid}`);
  await pool.end();
}

async function flushBatchWithSource(
  pool: ReturnType<typeof makePool>,
  batch: AcceptedGame[],
  source: string,
) {
  if (batch.length === 0) return;
  // Ensure player stubs first
  const stubPairs = new Map<number, string>();
  for (const g of batch) {
    if (g.white_fide_id != null && g.white_name) stubPairs.set(g.white_fide_id, g.white_name);
    if (g.black_fide_id != null && g.black_name) stubPairs.set(g.black_fide_id, g.black_name);
  }
  await ensurePlayerStubs(
    pool,
    [...stubPairs.entries()].map(([fide_id, name]) => ({ fide_id, name })),
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gameParams: unknown[] = [];
    const gameRows: string[] = [];
    batch.forEach((g, i) => {
      const off = i * 12;
      gameRows.push(
        `($${off + 1},$${off + 2},$${off + 3},$${off + 4},$${off + 5},$${off + 6},$${off + 7},$${off + 8},$${off + 9},$${off + 10},$${off + 11},$${off + 12})`,
      );
      gameParams.push(
        g.fingerprint,
        g.white_name,
        g.black_name,
        g.white_fide_id,
        g.black_fide_id,
        g.white_elo,
        g.black_elo,
        g.event,
        g.event_date,
        g.result,
        source,
        Date.now(),
      );
    });
    const { rows: inserted } = await client.query<{ id: string; fingerprint: string }>(
      `INSERT INTO game
         (fingerprint, white_name, black_name, white_fide_id, black_fide_id,
          white_elo, black_elo, event, event_date, result, source, ingested_at)
       VALUES ${gameRows.join(',')}
       ON CONFLICT (fingerprint) DO NOTHING
       RETURNING id, fingerprint`,
      gameParams,
    );

    const fpToId = new Map(inserted.map((r) => [r.fingerprint, r.id]));

    const moveParams: unknown[] = [];
    const moveRows: string[] = [];
    let i = 0;
    const flushMoves = async () => {
      if (moveRows.length === 0) return;
      await client.query(
        `INSERT INTO game_move (game_id, ply, parent_fen, san, uci, child_fen)
         VALUES ${moveRows.join(',')}`,
        moveParams,
      );
      moveRows.length = 0;
      moveParams.length = 0;
      i = 0;
    };
    for (const g of batch) {
      const gid = fpToId.get(g.fingerprint);
      if (!gid) continue;
      for (const e of g.edges) {
        const off = i * 6;
        moveRows.push(
          `($${off + 1},$${off + 2},$${off + 3},$${off + 4},$${off + 5},$${off + 6})`,
        );
        moveParams.push(gid, e.ply, e.parent_fen, e.san, e.uci, e.child_fen);
        i++;
        if (moveRows.length >= 1000) await flushMoves();
      }
    }
    await flushMoves();
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
