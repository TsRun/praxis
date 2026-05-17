#!/usr/bin/env tsx
/**
 * Unified PGN ingestion script.
 *
 * Usage
 * -----
 *   # Ingest a single PGN file
 *   npm run ingest -- --file path/to.pgn --source label
 *
 *   # Ingest a TWIC range (downloads + unzips + concatenates + ingests)
 *   npm run ingest -- --twic --from 920 --to 1614 [--concurrency 6]
 *
 *   # Common flags
 *   --depth N         per-game ply depth (default 24 → 12 full moves of theory)
 *   --no-stats        skip rebuild-stats after ingest
 *
 * Pipeline
 * --------
 * 1. Resolve a single PGN file path (either --file directly, or by downloading
 *    a TWIC range and concatenating into one big PGN — that avoids the per-
 *    issue node/tsx startup cost).
 * 2. Streamed parse with a stable fingerprint dedupe (white|black|date|result|
 *    event|first-20-plies). Existing fingerprints are loaded into a Set so
 *    each game is an O(1) check.
 * 3. Walk the first `--depth` plies. Each accepted game produces one row in
 *    `game` plus N rows in `game_move` (each denormalized with result,
 *    mover_elo, white_fide_id, black_fide_id — so the explorer needs no JOIN).
 * 4. After ingest, run scripts/rebuild-stats.ts unless --no-stats.
 *
 * Dedupe + resumability
 * ---------------------
 * `game.fingerprint` is UNIQUE; running the same source twice is a no-op.
 * TWIC zips and per-issue PGNs cache under data/twic/.
 */

import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, unlink, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { Chess } from 'chess.js';
import { makePool, ensureSchema, epdFromFen } from '../server/db.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const TWIC_DIR = resolve(ROOT, 'data', 'twic');

// ─── arg parsing ─────────────────────────────────────────────────────────────

interface Args {
  mode: 'file' | 'twic';
  file?: string;
  source?: string;
  from?: number;
  to?: number;
  concurrency: number;
  depth: number;
  rebuildStats: boolean;
}

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const has = (flag: string) => a.includes(flag);
  const get = (flag: string, def?: string): string | undefined => {
    const i = a.indexOf(flag);
    return i !== -1 ? a[i + 1] : def;
  };

  const isTwic = has('--twic');
  const isFile = has('--file');
  if (!isTwic && !isFile) {
    console.error(
      'usage: ingest --file <path.pgn> [--source NAME]\n' +
        '       ingest --twic --from N --to M [--concurrency N]\n' +
        '       (common: --depth N · --no-stats)',
    );
    process.exit(1);
  }
  if (isTwic && isFile) {
    console.error('error: --twic and --file are mutually exclusive');
    process.exit(1);
  }

  return {
    mode: isTwic ? 'twic' : 'file',
    file: get('--file'),
    source: get('--source'),
    from: isTwic ? Number(get('--from')) : undefined,
    to: isTwic ? Number(get('--to')) : undefined,
    concurrency: Number(get('--concurrency', '6')),
    depth: Number(get('--depth', '24')),
    rebuildStats: !has('--no-stats'),
  };
}

// ─── TWIC download / concat ─────────────────────────────────────────────────

async function fileSize(path: string): Promise<number> {
  try { return (await stat(path)).size; } catch { return 0; }
}

async function downloadOneTwic(issue: number): Promise<boolean> {
  const zipPath = resolve(TWIC_DIR, `twic${issue}.zip`);
  if ((await fileSize(zipPath)) > 1024) return true;
  const url = `https://theweekinchess.com/zips/twic${issue}g.zip`;
  const res = await fetch(url);
  if (!res.ok || !res.body) return false;
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(zipPath));
  if ((await fileSize(zipPath)) < 1024) {
    await unlink(zipPath).catch(() => {});
    return false;
  }
  return true;
}

async function unzipTwic(issue: number): Promise<string | null> {
  const pgnPath = resolve(TWIC_DIR, `twic${issue}.pgn`);
  if ((await fileSize(pgnPath)) > 0) return pgnPath;
  const zipPath = resolve(TWIC_DIR, `twic${issue}.zip`);
  if ((await fileSize(zipPath)) === 0) return null;
  await new Promise<void>((res, rej) => {
    const p = spawn('unzip', ['-o', '-d', TWIC_DIR, zipPath], { stdio: ['ignore', 'ignore', 'pipe'] });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`unzip exit ${c}`))));
  });
  if ((await fileSize(pgnPath)) > 0) return pgnPath;
  const entries = await readdir(TWIC_DIR);
  const m = entries.find((n) => n.includes(String(issue)) && n.endsWith('.pgn'));
  return m ? resolve(TWIC_DIR, m) : null;
}

async function concatFiles(paths: string[], out: string): Promise<void> {
  await unlink(out).catch(() => {});
  const w = createWriteStream(out);
  for (const p of paths) {
    await new Promise<void>((res, rej) => {
      const s = createReadStream(p);
      s.on('end', res);
      s.on('error', rej);
      s.pipe(w, { end: false });
    });
    w.write('\n\n');
  }
  w.end();
  await new Promise<void>((res) => w.on('close', res));
}

async function buildTwicRange(from: number, to: number, concurrency: number): Promise<string> {
  await mkdir(TWIC_DIR, { recursive: true });
  const issues = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  console.log(`TWIC range: twic${from}..twic${to} (${issues.length} issues)`);

  let done = 0;
  let missing = 0;
  const queue = [...issues];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const n = queue.shift();
        if (n == null) return;
        const ok = await downloadOneTwic(n).catch(() => false);
        if (ok) done++;
        else missing++;
        process.stdout.write(
          `\r download: ${done} ok · ${missing} missing · ${queue.length} pending     `,
        );
      }
    }),
  );
  console.log('');

  const pgnPaths: string[] = [];
  for (const n of issues) {
    const p = await unzipTwic(n).catch(() => null);
    if (p) pgnPaths.push(p);
  }
  if (pgnPaths.length === 0) throw new Error('No TWIC PGNs available after download');

  const out = resolve(TWIC_DIR, `twic-batch-${from}-${to}.pgn`);
  console.log(`concatenating ${pgnPaths.length} PGNs into ${out}…`);
  await concatFiles(pgnPaths, out);
  console.log(`  ${((await fileSize(out)) / 1024 / 1024).toFixed(1)} MB combined\n`);
  return out;
}

// ─── PGN parsing ─────────────────────────────────────────────────────────────

interface Headers { [key: string]: string; }
interface RawGame { headers: Headers; moveText: string; }

async function* readGames(path: string): AsyncGenerator<RawGame> {
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  let headers: Headers = {};
  let moveTextLines: string[] = [];
  let inHeaders = true;
  for await (const line of rl) {
    if (line.startsWith('[')) {
      if (!inHeaders && (Object.keys(headers).length > 0 || moveTextLines.length > 0)) {
        yield { headers, moveText: moveTextLines.join(' ').trim() };
        headers = {}; moveTextLines = [];
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

function fingerprint(h: Headers, firstMoves: string[]): string {
  const w = (h.White ?? '').trim().toLowerCase();
  const b = (h.Black ?? '').trim().toLowerCase();
  const d = (h.Date ?? h.UTCDate ?? '').trim();
  const r = (h.Result ?? '').trim();
  const e = (h.Event ?? '').trim().toLowerCase();
  return createHash('sha1').update(`${w}|${b}|${d}|${r}|${e}|${firstMoves.slice(0, 20).join(' ')}`).digest('hex');
}

function parseInt0(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resultChar(r: string): 'W' | 'B' | 'D' | null {
  if (r === '1-0') return 'W';
  if (r === '0-1') return 'B';
  if (r === '1/2-1/2') return 'D';
  return null;
}

function extractSan(moveText: string): string[] {
  return moveText
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\$\d+/g, ' ')
    .replace(/\d+\.(\.\.)?/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
}

// ─── ingest core ─────────────────────────────────────────────────────────────

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
  edges: Array<{ ply: number; parent_fen: string; san: string; uci: string; child_fen: string; mover_elo: number | null }>;
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

async function flushBatch(
  pool: ReturnType<typeof makePool>,
  batch: AcceptedGame[],
  source: string,
): Promise<void> {
  if (batch.length === 0) return;
  // Lazy player stubs for FIDE IDs we haven't seen.
  const stubPairs = new Map<number, string>();
  for (const g of batch) {
    if (g.white_fide_id != null && g.white_name) stubPairs.set(g.white_fide_id, g.white_name);
    if (g.black_fide_id != null && g.black_name) stubPairs.set(g.black_fide_id, g.black_name);
  }
  await ensurePlayerStubs(pool, [...stubPairs.entries()].map(([fide_id, name]) => ({ fide_id, name })));

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

    // Moves: 10 cols per row, batch in chunks of 200 to stay under PG param limits.
    const COLS = 10;
    const CHUNK = 200;
    let moveParams: unknown[] = [];
    let moveRows: string[] = [];

    const flushMoves = async () => {
      if (moveRows.length === 0) return;
      await client.query(
        `INSERT INTO game_move
           (game_id, ply, parent_fen, san, uci, child_fen, result, mover_elo, white_fide_id, black_fide_id)
         VALUES ${moveRows.join(',')}`,
        moveParams,
      );
      moveRows = [];
      moveParams = [];
    };

    for (const g of batch) {
      const gid = fpToId.get(g.fingerprint);
      if (!gid) continue; // duplicate, skipped on conflict
      for (const e of g.edges) {
        const i = moveRows.length;
        const off = i * COLS;
        moveRows.push(
          `($${off + 1},$${off + 2},$${off + 3},$${off + 4},$${off + 5},$${off + 6},$${off + 7},$${off + 8},$${off + 9},$${off + 10})`,
        );
        moveParams.push(
          gid, e.ply, e.parent_fen, e.san, e.uci, e.child_fen,
          g.result, e.mover_elo, g.white_fide_id, g.black_fide_id,
        );
        if (moveRows.length >= CHUNK) await flushMoves();
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

async function ingestFile(pool: ReturnType<typeof makePool>, pgnPath: string, depth: number, source: string) {
  console.log('loading existing fingerprints…');
  const seen = new Set<string>();
  const fpStream = await pool.query({ text: 'SELECT fingerprint FROM game', rowMode: 'array' });
  for (const r of fpStream.rows) seen.add(r[0] as string);
  console.log(`  found ${seen.size.toLocaleString()} already-ingested games`);

  const BATCH = 250;
  let buffer: AcceptedGame[] = [];
  let read = 0, kept = 0, dup = 0, noResult = 0, invalid = 0;
  const t0 = Date.now();
  let lastPrint = 0;

  for await (const game of readGames(pgnPath)) {
    read++;
    const sanMoves = extractSan(game.moveText);
    const r = resultChar((game.headers.Result ?? '').trim());
    if (!r) { noResult++; continue; }
    const fp = fingerprint(game.headers, sanMoves);
    if (seen.has(fp)) { dup++; continue; }
    seen.add(fp);

    const wElo = parseInt0(game.headers.WhiteElo);
    const bElo = parseInt0(game.headers.BlackElo);
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
      const mover = (i % 2 === 0) ? wElo : bElo; // ply 1 = White moves → side-to-move is White
      edges.push({
        ply: i + 1,
        parent_fen: parent,
        san: mv.san,
        uci,
        child_fen: epdFromFen(chess.fen()),
        mover_elo: mover,
      });
    }
    if (!valid) { invalid++; continue; }

    buffer.push({
      fingerprint: fp,
      white_name: game.headers.White ?? null,
      black_name: game.headers.Black ?? null,
      white_fide_id: parseInt0(game.headers.WhiteFideId),
      black_fide_id: parseInt0(game.headers.BlackFideId),
      white_elo: wElo,
      black_elo: bElo,
      event: game.headers.Event ?? null,
      event_date: game.headers.Date ?? game.headers.UTCDate ?? null,
      result: r,
      edges,
    });
    kept++;

    if (buffer.length >= BATCH) {
      await flushBatch(pool, buffer, source);
      buffer = [];
      const now = Date.now();
      if (now - lastPrint > 1000) {
        const rate = read / Math.max(1, (now - t0) / 1000);
        process.stdout.write(
          `\r read=${read.toLocaleString()} kept=${kept.toLocaleString()} dup=${dup} no-result=${noResult} invalid=${invalid} (${rate.toFixed(0)}/s)    `,
        );
        lastPrint = now;
      }
    }
  }
  if (buffer.length > 0) await flushBatch(pool, buffer, source);

  console.log(
    `\n done. read=${read.toLocaleString()} kept=${kept.toLocaleString()} dup=${dup} no-result=${noResult} invalid=${invalid}`,
  );
  return kept;
}

async function rebuildStatsViaCli(): Promise<void> {
  console.log('\nrebuilding move_stats…');
  await new Promise<void>((res, rej) => {
    const p = spawn('npx', ['tsx', 'scripts/rebuild-stats.ts'], { cwd: ROOT, stdio: 'inherit' });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`rebuild-stats exit ${c}`))));
  });
}

// ─── entrypoint ──────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const pool = makePool();
  await ensureSchema(pool);

  let pgnPath: string;
  let source: string;

  if (args.mode === 'twic') {
    if (!Number.isFinite(args.from) || !Number.isFinite(args.to) || args.from! < 1 || args.to! < args.from!) {
      console.error('error: --twic needs --from N --to M (N ≥ 1, M ≥ N)');
      process.exit(1);
    }
    pgnPath = await buildTwicRange(args.from!, args.to!, args.concurrency);
    source = args.source ?? `twic-${args.from}-${args.to}`;
  } else {
    if (!args.file) {
      console.error('error: --file is required in file mode');
      process.exit(1);
    }
    pgnPath = resolve(args.file);
    source = args.source ?? 'unknown';
  }

  const kept = await ingestFile(pool, pgnPath, args.depth, source);
  await pool.end();

  if (args.rebuildStats && kept > 0) {
    await rebuildStatsViaCli();
  }
  console.log('\nall done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
