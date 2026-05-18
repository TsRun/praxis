import { describe, it, expect } from 'vitest';
import { parsePgn, moveAtPly } from '../../../server/pgn';

const pgn = '[White "A"]\n[Black "B"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 1-0';

describe('parsePgn', () => {
  it('extracts headers and SAN moves', () => {
    const p = parsePgn(pgn);
    expect(p).not.toBeNull();
    expect(p!.headers.White).toBe('A');
    expect(p!.sanMoves).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']);
  });

  it('returns null for garbage', () => {
    expect(parsePgn('not a real pgn 1. xx99')).toBeNull();
  });
});

describe('moveAtPly', () => {
  it('returns SAN at 1-indexed ply', () => {
    expect(moveAtPly(pgn, 1)).toBe('e4');
    expect(moveAtPly(pgn, 5)).toBe('Bb5');
  });
  it('returns null past end', () => {
    expect(moveAtPly(pgn, 99)).toBeNull();
  });
});
