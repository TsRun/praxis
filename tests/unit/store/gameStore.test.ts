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
    expect(s.currentPly).toBe(0);
  });

  it('applies a legal move and advances FEN and currentPly', () => {
    const ok = useGameStore.getState().applyMove('e4');
    expect(ok).toBe(true);
    const s = useGameStore.getState();
    expect(s.history).toEqual(['e4']);
    expect(s.currentPly).toBe(1);
    expect(s.fen.split(' ')[1]).toBe('b');
  });

  it('rejects an illegal move and does not mutate state', () => {
    const before = useGameStore.getState().fen;
    const ok = useGameStore.getState().applyMove('Ke2');
    expect(ok).toBe(false);
    expect(useGameStore.getState().fen).toBe(before);
  });

  it('goToPly moves the pointer without truncating history', () => {
    const s = useGameStore.getState();
    s.applyMove('e4');
    s.applyMove('e5');
    s.applyMove('Nf3');
    useGameStore.getState().goToPly(1);
    const after = useGameStore.getState();
    expect(after.history).toEqual(['e4', 'e5', 'Nf3']);
    expect(after.currentPly).toBe(1);
    expect(after.fen.split(' ')[1]).toBe('b');
  });

  it('stepForward / stepBack move along the preserved history', () => {
    const s = useGameStore.getState();
    s.applyMove('e4');
    s.applyMove('e5');
    s.applyMove('Nf3');
    s.goToPly(1);
    s.stepForward();
    expect(useGameStore.getState().currentPly).toBe(2);
    s.stepForward();
    expect(useGameStore.getState().currentPly).toBe(3);
    s.stepForward(); // already at end
    expect(useGameStore.getState().currentPly).toBe(3);
    s.stepBack();
    s.stepBack();
    s.stepBack();
    s.stepBack(); // bounded at 0
    expect(useGameStore.getState().currentPly).toBe(0);
  });

  it('jumpToEnd seeks the latest position', () => {
    const s = useGameStore.getState();
    s.applyMove('e4');
    s.applyMove('e5');
    s.applyMove('Nf3');
    s.goToPly(1);
    s.jumpToEnd();
    expect(useGameStore.getState().currentPly).toBe(3);
  });

  it('playing a new move mid-history replaces the future', () => {
    const s = useGameStore.getState();
    s.applyMove('e4');
    s.applyMove('e5');
    s.applyMove('Nf3');
    s.goToPly(1); // back to after 1.e4
    s.applyMove('c5'); // branch
    const after = useGameStore.getState();
    expect(after.history).toEqual(['e4', 'c5']);
    expect(after.currentPly).toBe(2);
  });

  it('source defaults to otb', () => {
    expect(useGameStore.getState().source).toBe('otb');
  });

  it('setHistoryFromPgn loads valid PGN and parks the pointer at the end', () => {
    const ok = useGameStore.getState().setHistoryFromPgn('1. e4 c6 2. d4 d5');
    expect(ok).toBe(true);
    const s = useGameStore.getState();
    expect(s.history).toEqual(['e4', 'c6', 'd4', 'd5']);
    expect(s.currentPly).toBe(4);
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
    expect(s.currentPly).toBe(0);
  });
});
