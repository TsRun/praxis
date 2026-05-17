import { LRU } from './cache';

export type Source = 'chessdb';

export interface ExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  score?: number;
  rank?: number;
}

export interface ExplorerResult {
  white: number;
  draws: number;
  black: number;
  moves: ExplorerMove[];
  opening?: { eco: string; name: string };
}

interface ChessdbMove {
  uci: string;
  san: string;
  score: number;
  rank: number;
  note?: string;
  winrate?: string;
}

interface ChessdbResponse {
  status: string;
  moves?: ChessdbMove[];
}

const cache = new LRU<string, ExplorerResult>(500);

export function clearExplorerCache(): void {
  cache.clear();
}

function rankWeight(rank: number): number {
  // Rank ~2 = ! (best), ~1 = * (equal), 0 = ? (dubious), negative = bad.
  // Strongly amplify differences so mainline moves dominate the tree's
  // visual shape.
  if (rank >= 2) return 50000;
  if (rank === 1) return 5000;
  if (rank === 0) return 500;
  return 50;
}

function chessdbMoveToExplorer(m: ChessdbMove): ExplorerMove {
  const total = rankWeight(m.rank);
  const winratePct = m.winrate ? parseFloat(m.winrate) : 50;
  // winrate is W/(W+L+D) for white; we approximate draws as 25% and split the rest.
  const drawFrac = 0.25;
  const whiteFrac = (winratePct / 100) - drawFrac / 2;
  const blackFrac = 1 - whiteFrac - drawFrac;
  const white = Math.max(0, Math.round(total * whiteFrac));
  const draws = Math.round(total * drawFrac);
  const black = Math.max(0, total - white - draws);
  return {
    uci: m.uci,
    san: m.san,
    white,
    draws,
    black,
    score: m.score,
    rank: m.rank,
  };
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

  const params = new URLSearchParams({
    action: 'queryall',
    board: fen,
    json: '1',
  });
  const url = `/api/chessdb?${params.toString()}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`chessdb returned ${res.status}`);
  const json = (await res.json()) as ChessdbResponse;
  if (json.status !== 'ok' || !json.moves) {
    const empty: ExplorerResult = { white: 0, draws: 0, black: 0, moves: [] };
    cache.set(key, empty);
    return empty;
  }
  // Keep only the top dozen moves sorted by rank then score: chessdb returns
  // every legal continuation, but for a clean opening tree we want sound
  // candidates only (rank >= 0) with a hard cap to prevent visual noise.
  const trimmed = [...json.moves]
    .filter((m) => m.rank >= 0)
    .sort((a, b) => (b.rank - a.rank) || (b.score - a.score))
    .slice(0, 12);
  const moves = trimmed.map(chessdbMoveToExplorer);
  const agg = moves.reduce(
    (acc, m) => ({
      white: acc.white + m.white,
      draws: acc.draws + m.draws,
      black: acc.black + m.black,
    }),
    { white: 0, draws: 0, black: 0 },
  );
  const result: ExplorerResult = {
    ...agg,
    moves,
  };
  cache.set(key, result);
  return result;
}
