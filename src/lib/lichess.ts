import { LRU } from './cache';
import type { ColorFilter } from '../store/filterStore';

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
  player_id?: number | null;
  color?: ColorFilter;
  signal?: AbortSignal;
}

function cacheKey(opts: FetchOpts): string {
  return [opts.fen, opts.player_id ?? '', opts.color ?? 'any'].join('|');
}

export async function fetchExplorer(opts: FetchOpts): Promise<ExplorerResult> {
  const k = cacheKey(opts);
  const hit = cache.get(k);
  if (hit) return hit;
  const params = new URLSearchParams({ fen: opts.fen });
  if (opts.player_id) params.set('player_id', String(opts.player_id));
  if (opts.color && opts.color !== 'any') params.set('color', opts.color);
  const url = `/api/explorer?${params.toString()}`;
  const res = await fetch(url, { signal: opts.signal });
  if (!res.ok) throw new Error(`Explorer returned ${res.status}`);
  const data = (await res.json()) as ExplorerResult;
  cache.set(k, data);
  return data;
}

export interface PlayerSuggestion {
  fide_id: number;
  name: string;
  country: string | null;
  title: string | null;
  rating: number | null;
  games: number;
}

export async function searchPlayers(q: string, signal?: AbortSignal): Promise<PlayerSuggestion[]> {
  if (q.length < 2) return [];
  const url = `/api/players?q=${encodeURIComponent(q)}&limit=12`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Player search ${res.status}`);
  const { players } = (await res.json()) as { players: PlayerSuggestion[] };
  return players;
}
