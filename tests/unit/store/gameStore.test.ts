import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../../../src/store/gameStore';

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('starts at the standard chess starting position', () => {
    const s = useGameStore.getState();
    expect(s.fen).toContain('rnbqkbnr/pppppppp');
    expect(s.history).toEqual([]);
  });

  it('applies a legal move and advances FEN', () => {
    const ok = useGameStore.getState().applyMove('e4');
    expect(ok).toBe(true);
    const s = useGameStore.getState();
    expect(s.history).toEqual(['e4']);
    // After 1.e4 it is Black's turn
    expect(s.fen.split(' ')[1]).toBe('b');
  });

  it('rejects an illegal move and does not mutate state', () => {
    const before = useGameStore.getState().fen;
    const ok = useGameStore.getState().applyMove('Ke2');
    expect(ok).toBe(false);
    expect(useGameStore.getState().fen).toBe(before);
  });

  it('goToPly truncates history and resyncs FEN', () => {
    const s = useGameStore.getState();
    s.applyMove('e4');
    s.applyMove('e5');
    s.applyMove('Nf3');
    useGameStore.getState().goToPly(1);
    const after = useGameStore.getState();
    expect(after.history).toEqual(['e4']);
    expect(after.fen.split(' ')[1]).toBe('b');
  });

  it('source defaults to otb', () => {
    expect(useGameStore.getState().source).toBe('otb');
  });

  it('setHistoryFromPgn loads valid PGN', () => {
    const ok = useGameStore.getState().setHistoryFromPgn('1. e4 c6 2. d4 d5');
    expect(ok).toBe(true);
    expect(useGameStore.getState().history).toEqual(['e4', 'c6', 'd4', 'd5']);
  });

  it('setHistoryFromPgn returns false for empty input', () => {
    const ok = useGameStore.getState().setHistoryFromPgn('');
    expect(ok).toBe(false);
  });

  it('setFen replaces position and clears history', () => {
    useGameStore.getState().applyMove('e4');
    useGameStore.getState().setFen('8/8/8/8/8/8/8/4K2k w - - 0 1');
    const s = useGameStore.getState();
    expect(s.fen).toBe('8/8/8/8/8/8/8/4K2k w - - 0 1');
    expect(s.history).toEqual([]);
  });
});
