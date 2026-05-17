#!/usr/bin/env tsx
/**
 * Batch-download and ingest a range of TWIC issues.
 *
 * Usage:
 *   npx tsx scripts/twic-batch.ts --from 1000 --to 1614
 *   npx tsx scripts/twic-batch.ts --from 500 --to 1614 --concurrency 8
 *
 * Strategy
 * --------
 * - Phase 1: download all zips in parallel (skip ones that already exist).
 * - Phase 2: unzip and concatenate every issue's PGN into ONE big file.
 * - Phase 3: spawn scripts/ingest.ts once against the big file. This avoids
 *   ~3s of node + tsx startup cost per issue (matters at scale).
 * - Resumable: zips and the concatenated PGN live under data/twic/; the
 *   ingester dedupes by fingerprint so re-runs are safe.
 *
 * TWIC license: "Free for personal use only. All rights are reserved."
 * Raw PGN is gitignored. Use Lumbra (CC BY-NC-SA) for any redistributable
 * dataset.
 */

import { spawn } from 'node:child_process';
import { createWriteStream, createReadStream } from 'node:fs';
import { mkdir, stat, unlink, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const DATA_DIR = resolve(ROOT, 'data', 'twic');

interface Args {
  from: number;
  to: number;
  concurrency: number;
  depth: number;
}

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (flag: string, def?: string) => {
    const i = a.indexOf(flag);
    return i !== -1 ? a[i + 1] : def;
  };
  const from = Number(get('--from'));
  const to = Number(get('--to'));
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 1 || to < from) {
    console.error('usage: tsx scripts/twic-batch.ts --from <N> --to <M> [--concurrency 6] [--depth 16]');
    process.exit(1);
  }
  return {
    from,
    to,
    concurrency: Number(get('--concurrency', '6')),
    depth: Number(get('--depth', '16')),
  };
}

async function fileSize(path: string): Promise<number> {
  try {
    const s = await stat(path);
    return s.size;
  } catch {
    return 0;
  }
}

async function downloadOne(issue: number): Promise<boolean> {
  const zipPath = resolve(DATA_DIR, `twic${issue}.zip`);
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

async function unzipIfNeeded(issue: number): Promise<string | null> {
  const pgnPath = resolve(DATA_DIR, `twic${issue}.pgn`);
  if ((await fileSize(pgnPath)) > 0) return pgnPath;
  const zipPath = resolve(DATA_DIR, `twic${issue}.zip`);
  if ((await fileSize(zipPath)) === 0) return null;
  await new Promise<void>((res, rej) => {
    const proc = spawn('unzip', ['-o', '-d', DATA_DIR, zipPath], { stdio: ['ignore', 'ignore', 'pipe'] });
    proc.on('exit', (c) => (c === 0 ? res() : rej(new Error(`unzip ${zipPath} exit ${c}`))));
  });
  // Some TWIC issues unzip with slightly different inner names — find the pgn for this issue
  if ((await fileSize(pgnPath)) > 0) return pgnPath;
  const entries = await readdir(DATA_DIR);
  const match = entries.find((n) => n.includes(String(issue)) && n.endsWith('.pgn'));
  return match ? resolve(DATA_DIR, match) : null;
}

async function concat(pgnPaths: string[], outPath: string): Promise<void> {
  await unlink(outPath).catch(() => {});
  const out = createWriteStream(outPath);
  for (const p of pgnPaths) {
    await new Promise<void>((res, rej) => {
      const stream = createReadStream(p);
      stream.on('end', res);
      stream.on('error', rej);
      stream.pipe(out, { end: false });
    });
    out.write('\n\n');
  }
  out.end();
  await new Promise<void>((res) => out.on('close', res));
}

async function runIngest(pgnPath: string, depth: number, source: string): Promise<void> {
  await new Promise<void>((res, rej) => {
    const proc = spawn(
      'npx',
      ['tsx', 'scripts/ingest.ts', pgnPath, '--depth', String(depth), '--source', source],
      { cwd: ROOT, stdio: 'inherit' },
    );
    proc.on('exit', (c) => (c === 0 ? res() : rej(new Error(`ingest exit ${c}`))));
  });
}

async function main() {
  const args = parseArgs();
  await mkdir(DATA_DIR, { recursive: true });

  const issues = Array.from({ length: args.to - args.from + 1 }, (_, i) => args.from + i);
  console.log(`Range: twic${args.from}..twic${args.to} (${issues.length} issues)`);
  console.log(`Data dir: ${DATA_DIR}`);
  console.log(`Concurrency: ${args.concurrency} downloads\n`);

  // Phase 1: download with bounded concurrency
  let downloaded = 0;
  let missing = 0;
  const queue = [...issues];

  async function worker() {
    while (queue.length > 0) {
      const issue = queue.shift();
      if (issue == null) return;
      try {
        const ok = await downloadOne(issue);
        if (ok) downloaded++;
        else missing++;
      } catch {
        missing++;
      }
      process.stdout.write(
        `\r download: ${downloaded} ok · ${missing} missing · ${issues.length - downloaded - missing} pending     `,
      );
    }
  }
  await Promise.all(Array.from({ length: args.concurrency }, worker));
  console.log('\n');

  // Phase 2: unzip everything
  console.log('unzipping…');
  const pgnPaths: string[] = [];
  let unzipped = 0;
  for (const issue of issues) {
    const p = await unzipIfNeeded(issue).catch(() => null);
    if (p) {
      pgnPaths.push(p);
      unzipped++;
    }
  }
  console.log(`  ${unzipped} PGNs ready`);

  if (pgnPaths.length === 0) {
    console.log('nothing to ingest.');
    return;
  }

  // Phase 3: concat and single ingest
  const concatPath = resolve(DATA_DIR, `twic-batch-${args.from}-${args.to}.pgn`);
  console.log(`concatenating into ${concatPath}…`);
  await concat(pgnPaths, concatPath);
  const sz = await fileSize(concatPath);
  console.log(`  ${(sz / 1024 / 1024).toFixed(1)} MB combined`);

  console.log('\nrunning ingest…');
  await runIngest(concatPath, args.depth, `twic-batch-${args.from}-${args.to}`);

  // Phase 4: clean the big concat file (zips and per-issue PGNs stay cached)
  await unlink(concatPath).catch(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
