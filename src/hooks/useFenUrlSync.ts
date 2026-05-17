import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';

export function useFenUrlSync(): void {
  const [params, setParams] = useSearchParams();
  const fen = useGameStore((s) => s.fen);
  const setFen = useGameStore((s) => s.setFen);
  const initialised = useRef(false);

  // On mount: if the URL has ?fen=, load it.
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    const urlFen = params.get('fen');
    if (urlFen && urlFen !== fen) {
      setFen(urlFen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On FEN change: replace the URL parameter.
  useEffect(() => {
    if (!initialised.current) return;
    const current = params.get('fen');
    if (current === fen) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('fen', fen);
        return next;
      },
      { replace: true },
    );
  }, [fen, params, setParams]);
}
