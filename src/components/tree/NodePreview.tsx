import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';

interface Props {
  fen: string;
  x: number;
  y: number;
}

const SIZE = 200;

export function NodePreview({ fen, x, y }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const api = Chessground(ref.current, {
      fen,
      viewOnly: true,
      coordinates: false,
      animation: { enabled: false },
    });
    return () => api.destroy();
  }, [fen]);

  // Place to the right + below cursor, but clamp to viewport
  const clampX = Math.min(x + 16, window.innerWidth - SIZE - 8);
  const clampY = Math.min(y + 16, window.innerHeight - SIZE - 8);

  return (
    <div
      className="pointer-events-none fixed z-50 border bg-white shadow-lg rounded p-1"
      style={{ left: clampX, top: clampY, width: SIZE, height: SIZE }}
    >
      <div ref={ref} className="w-full h-full" />
    </div>
  );
}
