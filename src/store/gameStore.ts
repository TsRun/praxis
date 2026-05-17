import { create } from 'zustand';
import { Chess } from 'chess.js';
import type { Source } from '../lib/lichess';

interface GameState {
  fen: string;
  history: string[];
  source: Source;
  minShare: number;
  maxDepth: number;
  applyMove: (san: string) => boolean;
  goToPly: (ply: number) => void;
  setSource: (s: Source) => void;
  setFen: (fen: string) => void;
  setHistoryFromPgn: (pgn: string) => boolean;
  setMinShare: (n: number) => void;
  setMaxDepth: (n: number) => void;
  reset: () => void;
}

const START_FEN = new Chess().fen();

function fenFromHistory(history: string[]): string {
  const c = new Chess();
  for (const m of history) c.move(m);
  return c.fen();
}

export const useGameStore = create<GameState>((set, get) => ({
  fen: START_FEN,
  history: [],
  source: 'masters',
  minShare: 0.005,
  maxDepth: 12,

  applyMove(san) {
    const c = new Chess(get().fen);
    let m;
    try {
      m = c.move(san);
    } catch {
      return false;
    }
    if (!m) return false;
    set({ fen: c.fen(), history: [...get().history, m.san] });
    return true;
  },

  goToPly(ply) {
    const trimmed = get().history.slice(0, ply);
    set({ history: trimmed, fen: fenFromHistory(trimmed) });
  },

  setSource(s) {
    set({ source: s });
  },

  setFen(fen) {
    set({ fen, history: [] });
  },

  setHistoryFromPgn(pgn) {
    const c = new Chess();
    try {
      c.loadPgn(pgn);
    } catch {
      return false;
    }
    if (c.history().length === 0) return false;
    set({ history: c.history(), fen: c.fen() });
    return true;
  },

  setMinShare(n) {
    set({ minShare: n });
  },

  setMaxDepth(n) {
    set({ maxDepth: n });
  },

  reset() {
    set({
      fen: START_FEN,
      history: [],
      source: 'masters',
      minShare: 0.005,
      maxDepth: 12,
    });
  },
}));

export const START_POSITION_FEN = START_FEN;
