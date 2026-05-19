import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  tokenizeMovetext,
  parsePgnWithVariations,
} from '../../../server/pgn-tree.js';

const START_FEN = new Chess().fen().split(' ').slice(0, 4).join(' ');

describe('tokenizeMovetext', () => {
  it('emits SAN tokens and skips move numbers', () => {
    expect(tokenizeMovetext('1. e4 e5 2. Nf3 Nc6')).toEqual([
      { kind: 'san', value: 'e4' },
      { kind: 'san', value: 'e5' },
      { kind: 'san', value: 'Nf3' },
      { kind: 'san', value: 'Nc6' },
    ]);
  });

  it('emits open/close paren for variations', () => {
    expect(tokenizeMovetext('1. e4 (1. d4) e5')).toEqual([
      { kind: 'san', value: 'e4' },
      { kind: 'open' },
      { kind: 'san', value: 'd4' },
      { kind: 'close' },
      { kind: 'san', value: 'e5' },
    ]);
  });

  it('captures braced comments as a single token', () => {
    expect(tokenizeMovetext('1. e4 { king pawn } e5')).toEqual([
      { kind: 'san', value: 'e4' },
      { kind: 'comment', value: 'king pawn' },
      { kind: 'san', value: 'e5' },
    ]);
  });

  it('drops NAGs and the result token', () => {
    expect(tokenizeMovetext('1. e4! $5 e5 1-0')).toEqual([
      { kind: 'san', value: 'e4!' },
      { kind: 'san', value: 'e5' },
    ]);
  });
});

describe('parsePgnWithVariations', () => {
  it('parses a single-chapter mainline', () => {
    const [ch] = parsePgnWithVariations('[Event "Test"]\n\n1. e4 e5 2. Nf3 *');
    expect(ch.headers.Event).toBe('Test');
    expect(ch.root_fen).toBe(START_FEN);
    expect(ch.root?.san).toBe('e4');
    expect(ch.root?.is_main).toBe(true);
    expect(ch.root?.children[0].san).toBe('e5');
    expect(ch.root?.children[0].children[0].san).toBe('Nf3');
  });

  it('attaches a variation as a sibling under the parent', () => {
    const [ch] = parsePgnWithVariations('1. e4 e5 (1...c5 2. Nf3) 2. Nf3 *');
    const e4 = ch.root!;
    expect(e4.children.map((c) => c.san)).toEqual(['e5', 'c5']);
    expect(e4.children[0].is_main).toBe(true);
    expect(e4.children[1].is_main).toBe(false);
    expect(e4.children[1].children[0].san).toBe('Nf3');
  });

  it('attaches a comment to the move it follows', () => {
    const [ch] = parsePgnWithVariations('1. e4 { king pawn } e5 *');
    expect(ch.root!.comment).toBe('king pawn');
    expect(ch.root!.children[0].comment).toBeNull();
  });

  it('reads the FEN header for the chapter root', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -';
    const pgn = `[Event "Mid"]\n[FEN "${fen} 0 2"]\n\n2. Nf3 Nc6 *`;
    const [ch] = parsePgnWithVariations(pgn);
    expect(ch.root_fen).toBe(fen);
    expect(ch.root?.san).toBe('Nf3');
    expect(ch.root?.ply).toBe(3);
  });

  it('returns one entry per chapter in a multi-game PGN', () => {
    const pgn = `[Event "A"]\n\n1. e4 *\n\n[Event "B"]\n\n1. d4 *`;
    const chapters = parsePgnWithVariations(pgn);
    expect(chapters.map((c) => c.headers.Event)).toEqual(['A', 'B']);
    expect(chapters.map((c) => c.index)).toEqual([0, 1]);
  });

  it('returns an empty array for empty input', () => {
    expect(parsePgnWithVariations('')).toEqual([]);
  });
});
