import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Color, Key } from 'chessground/types';
import { BoardToolbar } from '../BoardToolbar';

interface FenBoardProps {
  fen: string;
  /** UCI string like 'e2e4' — highlights from/to squares. */
  lastMove?: string | null;
  /** Show board from black's perspective. */
  flip?: boolean;
  /**
   * Cap width in pixels (board is square). The board fills the parent up to
   * this cap, so the parent's width controls actual rendered size on small
   * viewports. Use a fixed-size wrapper if you need a strict square.
   */
  size?: number;
  className?: string;
  /** When false, hides chessground coordinate labels (used by mini thumbnails). */
  coordinates?: boolean;
  /** Show the floating board toolbar (copy / optional flip). Opt-in
   * because tiny preview thumbnails don't need it. */
  toolbar?: boolean;
  /** Called when the user clicks the flip button in the toolbar — the
   * parent owns the flip state. Only rendered if `toolbar` is true and
   * a handler is provided. */
  onFlip?: () => void;
}

function parseLast(uci: string | null | undefined): [Key, Key] | undefined {
  if (!uci || uci.length < 4) return undefined;
  return [uci.slice(0, 2) as Key, uci.slice(2, 4) as Key];
}

/**
 * View-only chessground board driven entirely by a FEN. No move handling.
 */
export function FenBoard({
  fen,
  lastMove,
  flip = false,
  size = 480,
  className = '',
  coordinates = true,
  toolbar = false,
  onFlip,
}: FenBoardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<Api | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const orientation: Color = flip ? 'black' : 'white';
    apiRef.current = Chessground(ref.current, {
      fen,
      orientation,
      coordinates,
      viewOnly: true,
      lastMove: parseLast(lastMove),
      animation: { enabled: false },
      drawable: { enabled: false },
    });
    return () => {
      apiRef.current?.destroy();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!apiRef.current) return;
    apiRef.current.set({
      fen,
      orientation: flip ? 'black' : 'white',
      lastMove: parseLast(lastMove),
    });
  }, [fen, lastMove, flip]);

  if (!toolbar) {
    return (
      <div
        ref={ref}
        className={className}
        style={{ width: '100%', maxWidth: size, aspectRatio: '1 / 1' }}
      />
    );
  }
  return (
    <div
      className={className}
      style={{ width: '100%', maxWidth: size, position: 'relative' }}
    >
      <div ref={ref} style={{ width: '100%', aspectRatio: '1 / 1' }} />
      <BoardToolbar
        fen={fen}
        orientation={flip ? 'black' : 'white'}
        onFlip={onFlip}
      />
    </div>
  );
}
