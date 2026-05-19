import { useEffect, useMemo, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import { Chess } from 'chess.js';
import { useGameStore } from '../../store/gameStore';

function toDestsMap(c: Chess): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();
  for (const m of c.moves({ verbose: true })) {
    const from = m.from as Key;
    if (!dests.has(from)) dests.set(from, []);
    dests.get(from)!.push(m.to as Key);
  }
  return dests;
}

/**
 * Replay history up to currentPly and return the from/to squares of the
 * move that produced the position currently shown. Used to drive
 * chessground's lastMove highlight so the squares always match the
 * displayed position — even when the user jumps via the move list or
 * arrow keys.
 */
function computeLastMove(history: string[], currentPly: number): [Key, Key] | undefined {
  if (currentPly <= 0) return undefined;
  const c = new Chess();
  let last: { from: string; to: string } | undefined;
  for (let i = 0; i < currentPly; i++) {
    try {
      const m = c.move(history[i]);
      if (m) last = { from: m.from, to: m.to };
    } catch {
      return last ? [last.from as Key, last.to as Key] : undefined;
    }
  }
  return last ? [last.from as Key, last.to as Key] : undefined;
}

export function ChessBoard() {
  const ref = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<Api | null>(null);
  const fen = useGameStore((s) => s.fen);
  const history = useGameStore((s) => s.history);
  const currentPly = useGameStore((s) => s.currentPly);
  const applyMove = useGameStore((s) => s.applyMove);

  const lastMove = useMemo(
    () => computeLastMove(history, currentPly),
    [history, currentPly],
  );

  useEffect(() => {
    if (!ref.current) return;
    const c = new Chess(fen);
    const turnColor = c.turn() === 'w' ? 'white' : 'black';
    apiRef.current = Chessground(ref.current, {
      fen,
      turnColor,
      lastMove,
      movable: {
        free: false,
        color: turnColor,
        dests: toDestsMap(c),
        events: {
          after: (from, to) => {
            const chess = new Chess(useGameStore.getState().fen);
            let m;
            try {
              m = chess.move({ from, to, promotion: 'q' });
            } catch {
              m = null;
            }
            if (m) applyMove(m.san);
          },
        },
      },
      draggable: { showGhost: true },
      animation: { duration: 150 },
    });
    return () => {
      apiRef.current?.destroy();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!apiRef.current) return;
    const c = new Chess(fen);
    const turnColor = c.turn() === 'w' ? 'white' : 'black';
    apiRef.current.set({
      fen,
      turnColor,
      lastMove,
      movable: {
        color: turnColor,
        dests: toDestsMap(c),
      },
    });
  }, [fen, lastMove]);

  return (
    <div
      ref={ref}
      style={{ width: '100%', maxWidth: 480, aspectRatio: '1 / 1' }}
    />
  );
}
