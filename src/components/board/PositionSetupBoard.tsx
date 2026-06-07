import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Chessground } from 'chessground';
import type { Api as CGApi } from 'chessground/api';
import type { Key } from 'chessground/types';
import { Chess } from 'chess.js';
import { Btn } from '../ui/atoms';
import { BoardToolbar } from '../BoardToolbar';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const START_FEN = new Chess().fen();

type FileChar = (typeof FILES)[number];
type RankChar = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
type Square = `${FileChar}${RankChar}`;
type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
type Color = 'w' | 'b';
interface Piece { type: PieceType; color: Color }
type Brush = Piece | 'erase';

const GLYPH: Record<PieceType, string> = {
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};
const PIECE_NAME: Record<PieceType, string> = {
  k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn',
};
const PALETTE_ORDER: PieceType[] = ['k', 'q', 'r', 'b', 'n', 'p'];

export function fenToPieces(fen: string): { pieces: Map<Square, Piece>; turn: Color } {
  const parts = fen.split(/\s+/);
  const placement = parts[0] ?? '';
  const turn: Color = parts[1] === 'b' ? 'b' : 'w';
  const pieces = new Map<Square, Piece>();
  const ranks = placement.split('/');
  for (let r = 0; r < 8; r++) {
    const rankStr = ranks[r] ?? '';
    let file = 0;
    for (const ch of rankStr) {
      if (/\d/.test(ch)) { file += Number(ch); continue; }
      const color: Color = ch === ch.toUpperCase() ? 'w' : 'b';
      const type = ch.toLowerCase() as PieceType;
      pieces.set(`${FILES[file]}${(8 - r) as unknown as RankChar}` as Square, { type, color });
      file++;
    }
  }
  return { pieces, turn };
}

export function piecesToFen(pieces: Map<Square, Piece>, turn: Color): string {
  const ranks: string[] = [];
  for (let r = 8; r >= 1; r--) {
    let row = '';
    let empty = 0;
    for (const f of FILES) {
      const p = pieces.get(`${f}${r as unknown as RankChar}` as Square);
      if (!p) { empty++; continue; }
      if (empty > 0) { row += empty; empty = 0; }
      row += p.color === 'w' ? p.type.toUpperCase() : p.type;
    }
    if (empty > 0) row += empty;
    ranks.push(row);
  }
  return `${ranks.join('/')} ${turn} - - 0 1`;
}

/**
 * Shared visual position builder: click-piece palette + setup board + side-
 * to-move radio. Used by the tactic puzzle editor and the import-games page.
 * The internal piece map is the source of truth; the parent receives a
 * normalized FEN via `onChange`.
 */
export function PositionSetupBoard({
  fen,
  onChange,
  showPaste = true,
  maxBoardWidth = 460,
}: {
  fen: string;
  onChange: (fen: string) => void;
  showPaste?: boolean;
  maxBoardWidth?: number;
}) {
  const { pieces: initialPieces, turn: initialTurn } = useMemo(
    () => fenToPieces(fen),
    // Only seed on first render — internal edits push out via onChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [pieces, setPieces] = useState<Map<Square, Piece>>(initialPieces);
  const [turn, setTurn] = useState<Color>(initialTurn);
  const [brush, setBrush] = useState<Brush>({ type: 'p', color: 'w' });
  const sideName = useId();
  const sideLabelId = useId();

  useEffect(() => {
    const next = piecesToFen(pieces, turn);
    onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieces, turn]);

  function applyBrush(square: Square) {
    setPieces((prev) => {
      const next = new Map(prev);
      const here = next.get(square);
      if (brush === 'erase') {
        next.delete(square);
        return next;
      }
      // Clicking the same piece again clears it — saves trips to the eraser.
      if (here && here.type === brush.type && here.color === brush.color) {
        next.delete(square);
        return next;
      }
      next.set(square, brush);
      return next;
    });
  }

  const currentFen = piecesToFen(pieces, turn);

  function pasteFenIntoEditor(pasted: string) {
    const parsed = fenToPieces(pasted);
    setPieces(parsed.pieces);
    setTurn(parsed.turn);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PalettePanel brush={brush} onPick={setBrush} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', minWidth: 0, maxWidth: maxBoardWidth }}>
          <SetupBoard
            fen={currentFen}
            maxWidth={maxBoardWidth}
            onSquareClick={(sq) => applyBrush(sq as Square)}
          />
        </div>
        <BoardToolbar
          fen={currentFen}
          orientation={turn === 'w' ? 'white' : 'black'}
          onPasteFen={showPaste ? pasteFenIntoEditor : undefined}
        />
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div
          role="radiogroup"
          aria-labelledby={sideLabelId}
          style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}
        >
          <span id={sideLabelId} style={{ fontSize: 13, color: 'var(--text-dim)' }}>Side to move</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" name={sideName} checked={turn === 'w'} onChange={() => setTurn('w')} />
            White
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" name={sideName} checked={turn === 'b'} onChange={() => setTurn('b')} />
            Black
          </label>
        </div>
        <div style={{ flex: 1 }} />
        <Btn
          variant="ghost"
          size="sm"
          onClick={() => { setPieces(fenToPieces(START_FEN).pieces); setTurn('w'); }}
        >
          Starting position
        </Btn>
        <Btn
          variant="ghost"
          size="sm"
          onClick={() => setPieces(new Map())}
        >
          Empty board
        </Btn>
      </div>
    </div>
  );
}

function PalettePanel({
  brush,
  onPick,
}: {
  brush: Brush;
  onPick: (b: Brush) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <PaletteRow color="w" brush={brush} onPick={onPick} />
      <PaletteRow color="b" brush={brush} onPick={onPick} />
      <div style={{ display: 'flex', gap: 6 }}>
        <PaletteButton
          active={brush === 'erase'}
          label="Erase"
          glyph="⌫"
          onClick={() => onPick('erase')}
          wide
        />
      </div>
    </div>
  );
}

function PaletteRow({
  color,
  brush,
  onPick,
}: {
  color: Color;
  brush: Brush;
  onPick: (b: Brush) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {PALETTE_ORDER.map((type) => {
        const active =
          brush !== 'erase' && brush.type === type && brush.color === color;
        return (
          <PaletteButton
            key={`${color}${type}`}
            active={active}
            label={`${color === 'w' ? 'White' : 'Black'} ${PIECE_NAME[type]}`}
            glyph={GLYPH[type]}
            pieceColor={color}
            onClick={() => onPick({ type, color })}
          />
        );
      })}
    </div>
  );
}

function PaletteButton({
  active,
  label,
  glyph,
  onClick,
  wide,
  pieceColor,
}: {
  active: boolean;
  label: string;
  glyph: string;
  onClick: () => void;
  wide?: boolean;
  pieceColor?: Color;
}) {
  const isWhite = pieceColor === 'w';
  const isBlack = pieceColor === 'b';
  // Color the glyph itself so the two rows are visually distinct as
  // white vs. black regardless of theme.
  const glyphStyle = isWhite
    ? { color: '#f7f3e3', WebkitTextStroke: '1px #1a1a1a' as const }
    : isBlack
      ? { color: '#1a1a1a', WebkitTextStroke: '1px #f7f3e3' as const }
      : { color: 'var(--text)' };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      style={{
        flex: 1,
        height: 44,
        fontSize: wide ? 16 : 28,
        lineHeight: 1,
        background: active ? 'var(--accent-soft)' : 'var(--inset-bg)',
        border: `1px solid ${active ? 'var(--accent-ring)' : 'var(--inset-border)'}`,
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'background 120ms ease, border-color 120ms ease',
        ...glyphStyle,
      }}
    >
      {glyph}
    </button>
  );
}

function SetupBoard({
  fen,
  onSquareClick,
  maxWidth,
}: {
  fen: string;
  onSquareClick: (key: Key) => void;
  maxWidth: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cgRef = useRef<CGApi | null>(null);
  // Latest click handler — chessground's events.select can't be reassigned
  // post-construction, so we route through a ref.
  const clickRef = useRef(onSquareClick);
  clickRef.current = onSquareClick;

  useEffect(() => {
    if (!ref.current) return;
    cgRef.current = Chessground(ref.current, {
      fen,
      coordinates: true,
      viewOnly: false,
      draggable: { enabled: false },
      selectable: { enabled: true },
      movable: { free: false, color: undefined, dests: new Map() },
      drawable: { enabled: false },
      events: {
        select: (k) => clickRef.current(k),
      },
    });
    return () => {
      cgRef.current?.destroy();
      cgRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cgRef.current?.set({ fen, lastMove: undefined });
  }, [fen]);

  return (
    <div ref={ref} style={{ width: '100%', maxWidth, aspectRatio: '1 / 1' }} />
  );
}
