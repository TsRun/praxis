#!/usr/bin/env tsx
/**
 * Bulk-load the FIDE rating list into the `player` table.
 *
 * Usage:
 *   npx tsx scripts/load-fide.ts                # downloads the latest XML
 *   npx tsx scripts/load-fide.ts <local.xml>    # uses a local XML file
 *
 * Source: https://ratings.fide.com/download.phtml — `players_list_xml.zip`.
 * The XML is ~600MB unzipped; we stream-parse it with sax-js so memory stays
 * bounded.
 */

import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { unlink } from 'node:fs/promises';
import sax from 'sax';
import { spawn } from 'node:child_process';
import { makePool, ensureSchema } from '../server/db.js';

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(here, '../data');
const XML_PATH = resolve(DATA_DIR, 'fide-players.xml');
const ZIP_PATH = resolve(DATA_DIR, 'fide-players.zip');

const SOURCE_URL = 'https://ratings.fide.com/download/players_list_xml.zip';

async function downloadAndUnzip() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (existsSync(XML_PATH)) {
    console.log(`reusing ${XML_PATH}`);
    return;
  }
  console.log(`downloading ${SOURCE_URL}…`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok || !res.body) throw new Error(`download failed: ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(ZIP_PATH));
  console.log(`unzipping…`);
  await new Promise<void>((res2, rej) => {
    const proc = spawn('unzip', ['-o', ZIP_PATH, '-d', DATA_DIR], { stdio: 'inherit' });
    proc.on('exit', (code) => (code === 0 ? res2() : rej(new Error(`unzip exit ${code}`))));
  });
  // FIDE has renamed this file multiple times (players_list.xml,
  // players_list_xml.xml, players_list_xml_foa.xml). Pick any .xml in DATA_DIR
  // that's not our stable target.
  const fs = await import('node:fs/promises');
  const entries = await fs.readdir(DATA_DIR);
  const candidate = entries.find(
    (n) => n.startsWith('players_list') && n.endsWith('.xml'),
  );
  if (!candidate) throw new Error('FIDE XML file not found after unzip');
  await fs.rename(resolve(DATA_DIR, candidate), XML_PATH);
  await unlink(ZIP_PATH).catch(() => {});
  console.log(`saved ${XML_PATH}`);
}

interface PlayerRow {
  fide_id: number;
  name: string;
  country: string | null;
  title: string | null;
  sex: string | null;
  rating: number | null;
  rapid_rating: number | null;
  blitz_rating: number | null;
  birth_year: number | null;
}

async function flush(pool: ReturnType<typeof makePool>, rows: PlayerRow[]) {
  if (rows.length === 0) return;
  const params: unknown[] = [];
  const placeholders: string[] = [];
  rows.forEach((p, i) => {
    const off = i * 9;
    placeholders.push(
      `($${off + 1},$${off + 2},$${off + 3},$${off + 4},$${off + 5},$${off + 6},$${off + 7},$${off + 8},$${off + 9})`,
    );
    params.push(
      p.fide_id,
      p.name,
      p.country,
      p.title,
      p.sex,
      p.rating,
      p.rapid_rating,
      p.blitz_rating,
      p.birth_year,
    );
  });
  await pool.query(
    `INSERT INTO player
       (fide_id, name, country, title, sex, rating, rapid_rating, blitz_rating, birth_year)
     VALUES ${placeholders.join(',')}
     ON CONFLICT (fide_id) DO UPDATE SET
       name = EXCLUDED.name,
       country = COALESCE(EXCLUDED.country, player.country),
       title = COALESCE(EXCLUDED.title, player.title),
       sex = COALESCE(EXCLUDED.sex, player.sex),
       rating = COALESCE(EXCLUDED.rating, player.rating),
       rapid_rating = COALESCE(EXCLUDED.rapid_rating, player.rapid_rating),
       blitz_rating = COALESCE(EXCLUDED.blitz_rating, player.blitz_rating),
       birth_year = COALESCE(EXCLUDED.birth_year, player.birth_year),
       origin = 'fide'`,
    params,
  );
}

function parseIntSafe(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function main() {
  const arg = process.argv[2];
  const xmlPath = arg ? resolve(arg) : XML_PATH;
  if (!arg) await downloadAndUnzip();
  if (!existsSync(xmlPath)) throw new Error(`XML not found: ${xmlPath}`);

  const pool = makePool();
  await ensureSchema(pool);

  const parser = sax.createStream(true, { trim: true, normalize: true });
  let current: Partial<PlayerRow> & { _tag?: string } = {};
  let buf: PlayerRow[] = [];
  let parsed = 0;
  let flushed = 0;
  const BATCH = 1000;
  const start = Date.now();
  let lastPrint = 0;

  // We pause/resume the underlying file stream around async flushes to avoid
  // unbounded buffer growth.
  const fileStream = createReadStream(xmlPath, { encoding: 'utf8' });

  parser.on('opentag', (node: sax.Tag) => {
    if (node.name === 'player') {
      current = {};
    } else {
      current._tag = node.name;
    }
  });

  parser.on('text', (text: string) => {
    if (!current._tag || text.trim() === '') return;
    switch (current._tag) {
      case 'fideid':
        current.fide_id = parseInt(text, 10);
        break;
      case 'name':
        current.name = text;
        break;
      case 'country':
        current.country = text;
        break;
      case 'title':
        current.title = text;
        break;
      case 'sex':
        current.sex = text.charAt(0);
        break;
      case 'rating':
        current.rating = parseIntSafe(text);
        break;
      case 'rapid_rating':
        current.rapid_rating = parseIntSafe(text);
        break;
      case 'blitz_rating':
        current.blitz_rating = parseIntSafe(text);
        break;
      case 'birthday':
        current.birth_year = parseIntSafe(text);
        break;
    }
  });

  parser.on('closetag', (name: string) => {
    if (name === 'player') {
      if (current.fide_id != null && current.name) {
        buf.push({
          fide_id: current.fide_id,
          name: current.name,
          country: current.country ?? null,
          title: current.title ?? null,
          sex: current.sex ?? null,
          rating: current.rating ?? null,
          rapid_rating: current.rapid_rating ?? null,
          blitz_rating: current.blitz_rating ?? null,
          birth_year: current.birth_year ?? null,
        });
        parsed++;
      }
      if (buf.length >= BATCH) {
        const toFlush = buf;
        buf = [];
        fileStream.pause();
        flush(pool, toFlush)
          .then(() => {
            flushed += toFlush.length;
            const now = Date.now();
            if (now - lastPrint > 1000) {
              const rate = parsed / Math.max(1, (now - start) / 1000);
              process.stdout.write(
                `\r parsed=${parsed.toLocaleString()} (${rate.toFixed(0)}/s) flushed=${flushed.toLocaleString()}    `,
              );
              lastPrint = now;
            }
            fileStream.resume();
          })
          .catch((err) => {
            console.error('flush error', err);
            process.exit(1);
          });
      }
    }
    current._tag = undefined;
  });

  parser.on('error', (err) => {
    console.error('xml parse error', err);
    parser._parser.error = null as never;
    parser._parser.resume();
  });

  await new Promise<void>((res, rej) => {
    parser.on('end', res);
    parser.on('error', rej);
    fileStream.pipe(parser);
  });

  if (buf.length > 0) await flush(pool, buf);
  console.log(`\n loaded ${parsed.toLocaleString()} players`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
