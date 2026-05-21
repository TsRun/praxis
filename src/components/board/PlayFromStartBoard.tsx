import { useEffect, useMemo, useRef, useState } from 'react';
import { Chessground } from 'chessground';
import type { Api as CGApi } from 'chessground/api';
import type { Key } from 'chessground/types';
import { Chess } from 'chess.js';
import { Btn } from '../ui/atoms';
import { BoardToolbar } from '../BoardToolbar';

const START_FEN = new Chess().fen();

/**
 * Board where the user plays moves freely from the starting position.
 * The current FEN (after every played move) is reported via `onFen`.
 * Used by the import-games page to let a trainer "play into" the position
 * they want to filter for.
 */
export function PlayFromStartBoard({
  onFen,
  maxBoardWidth = 460,
}: {
  onFen: (fen: string) => void;
  maxBoardWidth?: number;
}) {
  const [moves, setMoves] = useState<string[]>([]);

  const liveChess = useMemo(() => {
    const c = new Chess(START_FEN);
    for (const san of moves) {
      try { c.move(san); } catch { /* ignore — keeps board sane */ }
    }
    return c;
  }, [moves]);

  const currentFen = liveChess.fen();

  useEffect(() => {
    onFen(currentFen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFen]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <FreePlayBoard
          fen={currentFen}
          onMove={(san) => setMoves((prev) => [...prev, san])}
          maxWidth={maxBoardWidth}
        />
        <BoardToolbar fen={currentFen} orientation="white" />
      </div>
      <div
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          padding: '8px 10px',
          borderRadius: 10,
          background: 'var(--inset-bg)',
          border: '1px solid var(--inset-border)',
          minHeight: 32,
          fontSize: 12.5,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {moves.length === 0 ? (
          <span className="meta" style={{ fontSize: 12 }}>
            Play moves on the board to define the filter position.
          </span>
        ) : (
          moves.map((san, i) => {
            const isWhite = i % 2 === 0;
            const num = isWhite ? `${Math.floor(i / 2) + 1}.` : '';
            return (
              <span key={i}>
                {num}
                {san}
              </span>
            );
          })
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn
          variant="ghost"
          size="sm"
          onClick={() => setMoves((prev) => prev.slice(0, -1))}
          disabled={moves.length === 0}
        >
          Undo
        </Btn>
        <Btn
          variant="ghost"
          size="sm"
          onClick={() => setMoves([])}
          disabled={moves.length === 0}
        >
          Reset to start
        </Btn>
      </div>
    </div>
  );
}

function FreePlayBoard({
  fen,
  onMove,
  maxWidth,
}: {
  fen: string;
  onMove: (san: string) => void;
  maxWidth: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cgRef = useRef<CGApi | null>(null);

  function destsFrom(f: string): Map<Key, Key[]> {
    const dests = new Map<Key, Key[]>();
    try {
      const c = new Chess(f);
      for (const m of c.moves({ verbose: true })) {
        const from = m.from as Key;
        if (!dests.has(from)) dests.set(from, []);
        dests.get(from)!.push(m.to as Key);
      }
    } catch { /* bad FEN */ }
    return dests;
  }

  function turnFromFen(f: string): 'white' | 'black' {
    return (f.split(' ')[1] ?? 'w') === 'w' ? 'white' : 'black';
  }

  function handleAfter(from: Key, to: Key) {
    try {
      const c = new Chess(fen);
      const m = c.move({ from, to, promotion: 'q' });
      if (m) onMove(m.san);
    } catch { /* illegal — chessground will animate back */ }
  }

  useEffect(() => {
    if (!ref.current) return;
    const turnColor = turnFromFen(fen);
    cgRef.current = Chessground(ref.current, {
      fen,
      turnColor,
      orientation: 'white',
      movable: {
        free: false,
        color: 'both',
        dests: destsFrom(fen),
        events: { after: handleAfter },
      },
      draggable: { showGhost: true },
      animation: { duration: 150 },
    });
    return () => {
      cgRef.current?.destroy();
      cgRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cgRef.current) return;
    const turnColor = turnFromFen(fen);
    cgRef.current.set({
      fen,
      turnColor,
      movable: {
        color: 'both',
        dests: destsFrom(fen),
        events: { after: handleAfter },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen]);

  return (
    <div ref={ref} style={{ width: '100%', maxWidth, aspectRatio: '1 / 1' }} />
  );
}
