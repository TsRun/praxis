import { LRU } from './cache';

export type Source = 'otb';

export interface ExplorerMove {
  uci: string;
  san: string;
  child_fen: string;
  games: number;
  white: number;
  draws: number;
  black: number;
  avg_elo: number | null;
}

export interface ExplorerResult {
  fen: string;
  epd: string;
  games: number;
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

export async function fetchExplorer({ fen, signal }: FetchOpts): Promise<ExplorerResult> {
  const hit = cache.get(fen);
  if (hit) return hit;
  const url = `/api/explorer?fen=${encodeURIComponent(fen)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Explorer returned ${res.status}`);
  const data = (await res.json()) as ExplorerResult;
  cache.set(fen, data);
  return data;
}
