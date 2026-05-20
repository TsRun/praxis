import { create } from 'zustand';
import { Chess } from 'chess.js';

interface GameState {
  fen: string;
  history: string[];   // every move ever played in this line (preserved across rewinds)
  currentPly: number;  // 0..history.length — how many of those moves are "currently played"
  applyMove: (san: string) => boolean;
  goToPly: (ply: number) => void;
  stepForward: () => void;
  stepBack: () => void;
  jumpToEnd: () => void;
  setFen: (fen: string) => void;
  setHistoryFromPgn: (pgn: string) => boolean;
  loadLine: (sanMoves: string[], ply?: number) => boolean;
  reset: () => void;
}

const START_FEN = new Chess().fen();

function fenAtPly(history: string[], ply: number): string {
  const c = new Chess();
  for (let i = 0; i < ply; i++) c.move(history[i]);
  return c.fen();
}

export const useGameStore = create<GameState>((set, get) => ({
  fen: START_FEN,
  history: [],
  currentPly: 0,

  applyMove(san) {
    const state = get();
    // Branching: if we're navigating in the middle of history and play a new
    // move, the "future" part of history is replaced (standard editor redo
    // behavior).
    const base = state.history.slice(0, state.currentPly);
    const c = new Chess(state.fen);
    let m;
    try {
      m = c.move(san);
    } catch {
      return false;
    }
    if (!m) return false;
    const newHistory = [...base, m.san];
    set({ fen: c.fen(), history: newHistory, currentPly: newHistory.length });
    return true;
  },

  goToPly(ply) {
    const state = get();
    const clamped = Math.max(0, Math.min(ply, state.history.length));
    if (clamped === state.currentPly) return;
    set({ currentPly: clamped, fen: fenAtPly(state.history, clamped) });
  },

  stepForward() {
    const state = get();
    if (state.currentPly >= state.history.length) return;
    const next = state.currentPly + 1;
    set({ currentPly: next, fen: fenAtPly(state.history, next) });
  },

  stepBack() {
    const state = get();
    if (state.currentPly <= 0) return;
    const next = state.currentPly - 1;
    set({ currentPly: next, fen: fenAtPly(state.history, next) });
  },

  jumpToEnd() {
    const state = get();
    if (state.currentPly === state.history.length) return;
    set({ currentPly: state.history.length, fen: fenAtPly(state.history, state.history.length) });
  },

  setFen(fen) {
    // Jumping to an arbitrary FEN abandons any known move sequence.
    set({ fen, history: [], currentPly: 0 });
  },

  setHistoryFromPgn(pgn) {
    const c = new Chess();
    try {
      c.loadPgn(pgn);
    } catch {
      return false;
    }
    const h = c.history();
    if (h.length === 0) return false;
    set({ history: h, currentPly: h.length, fen: c.fen() });
    return true;
  },

  loadLine(sanMoves, ply) {
    // Replay each SAN against a fresh board, stopping at the first invalid
    // move (graceful degradation on corrupt URLs).
    const c = new Chess();
    const valid: string[] = [];
    for (const san of sanMoves) {
      try {
        const mv = c.move(san);
        if (!mv) break;
        valid.push(mv.san);
      } catch {
        break;
      }
    }
    const clampedPly = ply == null ? valid.length : Math.max(0, Math.min(ply, valid.length));
    const view = new Chess();
    for (let i = 0; i < clampedPly; i++) view.move(valid[i]);
    set({ history: valid, currentPly: clampedPly, fen: view.fen() });
    return valid.length > 0;
  },

  reset() {
    set({
      fen: START_FEN,
      history: [],
      currentPly: 0,
    });
  },
}));

export const START_POSITION_FEN = START_FEN;
