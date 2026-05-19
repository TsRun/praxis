import { Chess } from 'chess.js';

export type Token =
  | { kind: 'san'; value: string }
  | { kind: 'comment'; value: string }
  | { kind: 'open' }
  | { kind: 'close' };

const RESULT = new Set(['1-0', '0-1', '1/2-1/2', '*']);
const MOVE_NUM = /^\d+\.{1,3}$/;
const NAG = /^\$\d+$/;

export function tokenizeMovetext(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }
    if (c === '(') { tokens.push({ kind: 'open' }); i++; continue; }
    if (c === ')') { tokens.push({ kind: 'close' }); i++; continue; }
    if (c === '{') {
      const end = text.indexOf('}', i + 1);
      const raw = end === -1 ? text.slice(i + 1) : text.slice(i + 1, end);
      tokens.push({ kind: 'comment', value: raw.trim() });
      i = end === -1 ? n : end + 1;
      continue;
    }
    let j = i;
    while (j < n && !' \t\n\r(){}'.includes(text[j])) j++;
    let word = text.slice(i, j);
    i = j;
    // Strip a leading move-number prefix glued to the SAN (e.g. "1...c5").
    const numPrefix = word.match(/^\d+\.{1,3}/);
    if (numPrefix) word = word.slice(numPrefix[0].length);
    if (RESULT.has(word) || MOVE_NUM.test(word) || NAG.test(word) || word === '') continue;
    tokens.push({ kind: 'san', value: word });
  }
  return tokens;
}

// ─── Tree parser (Task 2 will add this) ─────────────────────────────────────

export interface PgnNode {
  san: string;
  uci: string;
  fen: string;
  ply: number;
  is_main: boolean;
  comment: string | null;
  children: PgnNode[];
}

export interface PgnChapter {
  index: number;
  headers: Record<string, string>;
  root_fen: string;
  root: PgnNode | null;
}

const STD_START = new Chess().fen().split(' ').slice(0, 4).join(' ');

function splitGames(pgn: string): string[] {
  const lines = pgn.replace(/\r\n/g, '\n').split('\n');
  const games: string[][] = [];
  let cur: string[] = [];
  let prevBlank = true;
  for (const line of lines) {
    if (line.startsWith('[Event ') && prevBlank && cur.length > 0) {
      games.push(cur);
      cur = [];
    }
    cur.push(line);
    prevBlank = line.trim() === '';
  }
  if (cur.length > 0) games.push(cur);
  return games.map((g) => g.join('\n')).filter((g) => g.trim().length > 0);
}

function parseHeaders(block: string): { headers: Record<string, string>; movetext: string } {
  const headers: Record<string, string> = {};
  const lines = block.split('\n');
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') { i++; break; }
    const m = line.match(/^\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]$/);
    if (m) {
      headers[m[1]] = m[2];
    } else {
      // first non-header line is the start of movetext
      break;
    }
  }
  return { headers, movetext: lines.slice(i).join('\n') };
}

interface Cursor {
  tokens: Token[];
  i: number;
}

function fenWithCounters(epd: string): string {
  return epd.split(' ').length >= 6 ? epd : `${epd} 0 1`;
}

function parseVariation(
  cur: Cursor,
  startFen: string,
  startPly: number,
  isMainLine: boolean,
): PgnNode | null {
  let firstNode: PgnNode | null = null;
  let prev: PgnNode | null = null;
  // `prevParent` = the node whose children contains `prev`. When we open a
  // variation, the variation's first move is a sibling of `prev`, so it gets
  // attached to `prevParent`. If `prev` is `firstNode` at this level there is
  // no parent we can see — fall back to attaching the variation under `prev`
  // (rare path: a variation of the very first move of a chapter).
  let prevParent: PgnNode | null = null;
  let lineFen = startFen;
  let linePly = startPly;
  let preFen = startFen;
  let prePly = startPly;

  while (cur.i < cur.tokens.length) {
    const t = cur.tokens[cur.i];
    if (t.kind === 'close') { cur.i++; return firstNode; }

    if (t.kind === 'open') {
      cur.i++;
      const branch = parseVariation(cur, preFen, prePly, false);
      if (branch && prev) {
        if (prevParent) prevParent.children.push(branch);
        else prev.children.push(branch);
      }
      continue;
    }

    if (t.kind === 'comment') {
      cur.i++;
      if (prev) prev.comment = (prev.comment ? prev.comment + ' ' : '') + t.value;
      continue;
    }

    // SAN token
    cur.i++;
    const chess = new Chess(fenWithCounters(lineFen));
    let mv;
    try { mv = chess.move(t.value); } catch { mv = null; }
    if (!mv) {
      return firstNode;
    }
    const node: PgnNode = {
      san: mv.san,
      uci: `${mv.from}${mv.to}${mv.promotion ?? ''}`,
      fen: chess.fen().split(' ').slice(0, 4).join(' '),
      ply: linePly + 1,
      is_main: isMainLine,
      comment: null,
      children: [],
    };
    if (firstNode === null) firstNode = node;
    if (prev) prev.children.unshift(node);
    preFen = lineFen;
    prePly = linePly;
    prevParent = prev;
    lineFen = node.fen;
    linePly = node.ply;
    prev = node;
  }
  return firstNode;
}

export function parsePgnWithVariations(pgn: string): PgnChapter[] {
  const games = splitGames(pgn);
  const out: PgnChapter[] = [];
  games.forEach((g, idx) => {
    const { headers, movetext } = parseHeaders(g);
    const rootFen = headers.FEN ? headers.FEN.split(' ').slice(0, 4).join(' ') : STD_START;
    const rootPly = headers.FEN
      ? (() => {
          const parts = headers.FEN.split(' ');
          const stm = parts[1];
          const fullmove = Number(parts[5] ?? '1');
          return (fullmove - 1) * 2 + (stm === 'b' ? 1 : 0);
        })()
      : 0;
    const tokens = tokenizeMovetext(movetext);
    const cursor: Cursor = { tokens, i: 0 };
    const root = parseVariation(cursor, rootFen, rootPly, true);
    out.push({ index: idx, headers, root_fen: rootFen, root });
  });
  return out;
}
