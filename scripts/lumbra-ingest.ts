#!/usr/bin/env tsx
/**
 * Download Lumbra's Gigabase OTB year-bucket PGNs from mega.nz, unzip them,
 * and feed each into scripts/ingest.ts. Lumbra is CC BY-NC-SA 4.0 and includes
 * TWIC games, so this single source covers our OTB needs end to end.
 *
 * Usage
 * -----
 *   npm run ingest:lumbra                           # all year buckets, in order
 *   npm run ingest:lumbra -- --only 2020-2024,2025  # specific buckets
 *   npm run ingest:lumbra -- --skip-download        # use already-cached pgns
 *   npm run ingest:lumbra -- --no-stats             # skip rebuild-stats at end
 *
 * mega.nz hosts the files; we use the `megajs` library to stream them as
 * decrypted bytes to disk. PGNs are gitignored under data/lumbra/.
 */

import { spawn } from 'node:child_process';
import { createWriteStream, createReadStream } from 'node:fs';
import { mkdir, stat, unlink, readdir, rename } from 'node:fs/promises';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { readFile } from 'node:fs/promises';
import { File as MegaFile } from 'megajs';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const DATA_DIR = resolve(ROOT, 'data', 'lumbra');

interface BucketEntry {
  label: string;
  url: string;
  mb: number;
}

async function fileSize(path: string): Promise<number> {
  try { return (await stat(path)).size; } catch { return 0; }
}

async function loadUrls(): Promise<BucketEntry[]> {
  const buf = await readFile(resolve(here, 'lumbra-urls.json'), 'utf8');
  const json = JSON.parse(buf) as { files: BucketEntry[] };
  return json.files;
}

async function downloadOne(entry: BucketEntry): Promise<string | null> {
  // Mega downloads use the URL's filename hint. We pass an explicit name.
  await mkdir(DATA_DIR, { recursive: true });
  const dest = resolve(DATA_DIR, `lumbra-otb-${entry.label}.zip`);
  if ((await fileSize(dest)) > 1024 * 100) return dest; // resume: keep cached

  console.log(`  ↓ ${entry.label} (~${entry.mb} MB) → ${basename(dest)}`);
  const file = MegaFile.fromURL(entry.url);
  await file.loadAttributes();
  // megajs's download() returns a Readable; pipe to disk
  const stream = file.download({});
  await pipeline(stream as unknown as NodeJS.ReadableStream, createWriteStream(dest));
  return dest;
}

async function unzip(zipPath: string): Promise<string[]> {
  // Lumbra archives are 7z (despite the .zip suffix on our cache name).
  // Extract into a sibling dir, then return all extracted .pgn paths.
  const extractDir = zipPath.replace(/\.zip$/, '');
  await mkdir(extractDir, { recursive: true });
  await new Promise<void>((res, rej) => {
    const p = spawn('7z', ['x', '-y', `-o${extractDir}`, zipPath], { stdio: ['ignore', 'ignore', 'pipe'], shell: process.platform === 'win32' });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`7z exit ${c}`))));
  });
  const entries = await readdir(extractDir);
  const pgns = entries.filter((n) => n.toLowerCase().endsWith('.pgn')).map((n) => resolve(extractDir, n));
  // Sometimes the zip contains nested folders — recurse one level
  if (pgns.length === 0) {
    for (const sub of entries) {
      const subDir = resolve(extractDir, sub);
      try {
        const inner = await readdir(subDir);
        for (const f of inner) {
          if (f.toLowerCase().endsWith('.pgn')) pgns.push(resolve(subDir, f));
        }
      } catch { /* not a dir */ }
    }
  }
  return pgns;
}

async function runIngest(pgn: string, source: string, noStats = true) {
  const args = ['tsx', 'scripts/ingest.ts', '--file', pgn, '--source', source];
  if (noStats) args.push('--no-stats');
  await new Promise<void>((res, rej) => {
    const p = spawn('npx', args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`ingest exit ${c}`))));
  });
}

async function runRebuildStats() {
  await new Promise<void>((res, rej) => {
    const p = spawn('npx', ['tsx', 'scripts/rebuild-stats.ts'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`rebuild-stats exit ${c}`))));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  const onlyArg = get('--only');
  const only = onlyArg ? new Set(onlyArg.split(',').map((s) => s.trim())) : null;
  const skipDownload = args.includes('--skip-download');
  const noStats = args.includes('--no-stats');

  const all = await loadUrls();
  const buckets = only ? all.filter((b) => only.has(b.label)) : all;
  if (buckets.length === 0) {
    console.error('No buckets selected (check --only labels).');
    process.exit(1);
  }
  console.log(`Lumbra OTB ingest · ${buckets.length} bucket(s): ${buckets.map((b) => b.label).join(', ')}`);

  for (const b of buckets) {
    console.log(`\n=== ${b.label} ===`);
    let zip: string | null = null;
    if (!skipDownload) {
      zip = await downloadOne(b).catch((e) => {
        console.warn(`  download failed: ${(e as Error).message}`);
        return null;
      });
    } else {
      zip = resolve(DATA_DIR, `lumbra-otb-${b.label}.zip`);
      if ((await fileSize(zip)) === 0) {
        console.warn(`  --skip-download but ${zip} missing; skipping bucket`);
        continue;
      }
    }
    if (!zip) continue;

    const pgns = await unzip(zip).catch((e) => {
      console.warn(`  unzip failed: ${(e as Error).message}`);
      return [] as string[];
    });
    console.log(`  ${pgns.length} PGN(s) extracted`);

    for (const pgn of pgns) {
      console.log(`  ingesting ${basename(pgn)}…`);
      await runIngest(pgn, `lumbra-otb-${b.label}`, /*noStats*/ true);
    }
  }

  if (!noStats) {
    console.log('\nrebuilding move_stats…');
    await runRebuildStats();
  }
  console.log('\nLumbra ingest done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
