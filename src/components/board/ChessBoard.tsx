import { useEffect, useRef } from 'react';
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

export function ChessBoard() {
  const ref = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<Api | null>(null);
  const fen = useGameStore((s) => s.fen);
  const applyMove = useGameStore((s) => s.applyMove);

  useEffect(() => {
    if (!ref.current) return;
    const c = new Chess(fen);
    const turnColor = c.turn() === 'w' ? 'white' : 'black';
    apiRef.current = Chessground(ref.current, {
      fen,
      turnColor,
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
      movable: {
        color: turnColor,
        dests: toDestsMap(c),
      },
    });
  }, [fen]);

  return <div ref={ref} className="w-[480px] h-[480px]" />;
}
