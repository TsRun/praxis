import { Chess } from 'chess.js';

export interface EcoEntry {
  eco: string;
  name: string;
}

let cache: Map<string, EcoEntry> | null = null;
let loading: Promise<Map<string, EcoEntry>> | null = null;

const FILES = ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv'];

export function epdFromFen(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

function epdFromPgn(pgn: string): string | null {
  const c = new Chess();
  try {
    c.loadPgn(pgn);
  } catch {
    return null;
  }
  return epdFromFen(c.fen());
}

async function loadOnce(): Promise<Map<string, EcoEntry>> {
  const m = new Map<string, EcoEntry>();
  const texts = await Promise.all(
    FILES.map((f) =>
      fetch(`/api/openings/${f}`)
        .then((r) => (r.ok ? r.text() : ''))
        .catch(() => ''),
    ),
  );
  for (const text of texts) {
    if (!text) continue;
    const lines = text.split('\n');
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t');
      if (cols.length < 3) continue;
      const [eco, name, pgn] = cols;
      const epd = epdFromPgn(pgn);
      if (!epd) continue;
      // Last entry wins → deeper named line for the same EPD.
      m.set(epd, { eco: eco.trim(), name: name.trim() });
    }
  }
  return m;
}

export async function ecoFor(fen: string): Promise<EcoEntry | null> {
  if (!cache) {
    if (!loading) loading = loadOnce();
    cache = await loading;
  }
  return cache.get(epdFromFen(fen)) ?? null;
}
