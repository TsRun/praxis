/**
 * Rasterise a chess position to a PNG and copy/download it. The output
 * is a self-contained image: an 8×8 board (light/dark squares from the
 * Brown theme) with the cburnett piece SVGs that ship with chessground,
 * so a copied diagram looks identical to the one on screen.
 *
 * The piece data URLs are scraped from the chessground stylesheet at
 * call-time; that avoids hard-coding the SVGs in this file (so they
 * track whatever chessground theme is loaded). All sheets are
 * same-origin so the read is safe.
 */
import { Chess } from 'chess.js';

const LIGHT = '#f0d9b5';
const DARK = '#b58863';

type Color = 'w' | 'b';
type Type = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

const TYPE_LONG: Record<Type, string> = {
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
};

let pieceCache: Map<string, string> | null = null;

/** Read piece data URLs out of chessground's loaded CSS. */
function readPieceDataUrls(): Map<string, string> {
  if (pieceCache) return pieceCache;
  const map = new Map<string, string>();
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    if (!rules) continue;
    for (const rule of Array.from(rules)) {
      const r = rule as CSSStyleRule;
      const selector = r.selectorText;
      if (!selector || !selector.includes('piece.')) continue;
      const m = /piece\.(king|queen|rook|bishop|knight|pawn)\.(white|black)/.exec(selector);
      if (!m) continue;
      const bg = r.style?.backgroundImage;
      if (!bg) continue;
      const u = /url\(["']?(data:image\/svg\+xml[^"')]+)["']?\)/.exec(bg);
      if (!u) continue;
      const color: Color = m[2] === 'white' ? 'w' : 'b';
      const type = Object.entries(TYPE_LONG).find(([, v]) => v === m[1])![0] as Type;
      map.set(`${color}${type}`, u[1]);
    }
  }
  pieceCache = map;
  return map;
}

async function loadPieceImage(url: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('failed to decode piece SVG'));
    img.src = url;
  });
}

export interface BoardImageOptions {
  /** Output PNG side length in pixels. Default 480 (60px per square). */
  size?: number;
  /** Which side is at the bottom of the rendered image. Default 'white'. */
  orientation?: 'white' | 'black';
}

/** Render the position in `fen` to a PNG Blob at the given size. */
export async function renderBoardPng(
  fen: string,
  opts: BoardImageOptions = {},
): Promise<Blob> {
  const size = opts.size ?? 480;
  const orientation = opts.orientation ?? 'white';
  const sq = size / 8;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  // Squares first.
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const lightSquare = (r + f) % 2 === 0;
      ctx.fillStyle = lightSquare ? LIGHT : DARK;
      ctx.fillRect(f * sq, r * sq, sq, sq);
    }
  }

  // Then pieces. chess.js parses + validates the FEN for us; if it
  // throws we propagate so the caller can surface a clean error.
  const board = new Chess(fen).board();
  const urls = readPieceDataUrls();
  const flipped = orientation === 'black';
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const cell = board[rank][file];
      if (!cell) continue;
      const key = `${cell.color}${cell.type}`;
      const url = urls.get(key);
      if (!url) continue;
      const img = await loadPieceImage(url);
      const drawFile = flipped ? 7 - file : file;
      const drawRank = flipped ? 7 - rank : rank;
      ctx.drawImage(img, drawFile * sq, drawRank * sq, sq, sq);
    }
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('canvas.toBlob returned null'));
    }, 'image/png');
  });
}

/** Copy the rendered diagram to the clipboard. Resolves on success. */
export async function copyBoardImage(
  fen: string,
  opts?: BoardImageOptions,
): Promise<void> {
  const blob = await renderBoardPng(fen, opts);
  if (!navigator.clipboard || !window.ClipboardItem) {
    throw new Error('clipboard image write not supported in this browser');
  }
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blob }),
  ]);
}

/** Trigger a PNG download of the diagram. */
export async function downloadBoardImage(
  fen: string,
  filename: string,
  opts?: BoardImageOptions,
): Promise<void> {
  const blob = await renderBoardPng(fen, opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
