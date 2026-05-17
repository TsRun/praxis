import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';

interface Props {
  fen: string;
  x: number;
  y: number;
}

const SIZE = 220;

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

  const clampX = Math.min(x + 18, window.innerWidth - SIZE - 12);
  const clampY = Math.min(y + 18, window.innerHeight - SIZE - 12);

  return (
    <div
      className="pointer-events-none fixed z-50 rounded-xl p-1.5 panel"
      style={{ left: clampX, top: clampY, width: SIZE, height: SIZE }}
    >
      <div ref={ref} className="w-full h-full" />
    </div>
  );
}
