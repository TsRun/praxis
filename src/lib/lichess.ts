import { LRU } from './cache';

export type Source = 'masters' | 'lichess';

export interface ExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating?: number;
}

export interface ExplorerResult {
  white: number;
  draws: number;
  black: number;
  moves: ExplorerMove[];
  opening?: { eco: string; name: string };
}

const cache = new LRU<string, ExplorerResult>(500);

export function clearExplorerCache(): void {
  cache.clear();
}

export interface FetchOpts {
  source: Source;
  fen: string;
  signal?: AbortSignal;
}

export async function fetchExplorer({ source, fen, signal }: FetchOpts): Promise<ExplorerResult> {
  const key = `${source}|${fen}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const base = `https://explorer.lichess.ovh/${source}`;
  const params = new URLSearchParams({
    fen,
    topGames: '0',
    moves: '20',
  });
  if (source === 'lichess') {
    params.set('speeds', 'blitz,rapid,classical');
    params.set('ratings', '2000,2200,2500');
  }
  const url = `${base}?${params.toString()}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Explorer ${source} returned ${res.status}`);
  const data = (await res.json()) as ExplorerResult;
  cache.set(key, data);
  return data;
}
