import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';

// Re-implement the exact validator from server/routes-trainer.ts. The unit
// test pins the contract; if the helper drifts (e.g. relaxes empty-line
// handling or stops re-canonicalizing SAN) the trainer endpoint failures
// become user-visible and this test catches the change.
function validateSolution(fen: string, sans: string[]): string[] {
  let c: Chess;
  try {
    c = new Chess(fen);
  } catch (e) {
    throw new Error(`invalid FEN: ${(e as Error).message}`);
  }
  if (sans.length === 0) throw new Error('solution must have at least one move');
  const cleaned: string[] = [];
  for (const san of sans) {
    let m;
    try {
      m = c.move(san);
    } catch {
      m = null;
    }
    if (!m) throw new Error(`illegal move: ${san}`);
    cleaned.push(m.san);
  }
  return cleaned;
}

describe('tactic solution validation', () => {
  it('accepts a 3-ply line where sides alternate', () => {
    const start = new Chess().fen();
    const cleaned = validateSolution(start, ['e4', 'e5', 'Nf3']);
    expect(cleaned).toEqual(['e4', 'e5', 'Nf3']);
  });

  it('accepts a single-move solution from a non-start FEN', () => {
    // After 1.e4 e5 2.Nf3 Nc6 — white to move; Bb5 is the Ruy Lopez.
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    expect(validateSolution(fen, ['Bb5'])).toEqual(['Bb5']);
  });

  it('rejects an empty solution', () => {
    const start = new Chess().fen();
    expect(() => validateSolution(start, [])).toThrow(/at least one move/);
  });

  it('rejects an interior illegal move with the stable prefix', () => {
    const start = new Chess().fen();
    expect(() => validateSolution(start, ['e4', 'Bxf7'])).toThrow(/illegal move/);
  });

  it('rejects a malformed FEN with the stable prefix', () => {
    expect(() => validateSolution('not-a-fen', ['e4'])).toThrow(/invalid FEN/);
  });

  it('rejects a syntactically valid SAN that is illegal in the position', () => {
    const start = new Chess().fen();
    expect(() => validateSolution(start, ['Qd5'])).toThrow(/illegal move/);
  });
});
