import { Chess } from 'chess.js';

export interface ParsedPgn {
  headers: Record<string, string>;
  sanMoves: string[];
}

export function parsePgn(pgn: string): ParsedPgn | null {
  const c = new Chess();
  try {
    c.loadPgn(pgn);
  } catch {
    return null;
  }
  const sanMoves = c.history();
  if (sanMoves.length === 0) return null;
  const rawHeaders = c.header();
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawHeaders)) {
    if (typeof v === 'string') headers[k] = v;
  }
  return { headers, sanMoves };
}

/** Return the SAN played at ply `ply` (1-indexed). */
export function moveAtPly(pgn: string, ply: number): string | null {
  const parsed = parsePgn(pgn);
  if (!parsed) return null;
  return parsed.sanMoves[ply - 1] ?? null;
}
