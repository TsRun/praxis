import { useEffect, useState } from 'react';
import { fetchExplorer, type ExplorerResult, type Source } from '../lib/lichess';
import { useFilterStore } from '../store/filterStore';

export function useExplorer(
  fen: string,
  source: Source,
): { data?: ExplorerResult; loading: boolean; error?: string } {
  const player = useFilterStore((s) => s.player);
  const color = useFilterStore((s) => s.color);
  const [data, setData] = useState<ExplorerResult | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(undefined);
    fetchExplorer({
      source,
      fen,
      player_id: player?.fide_id ?? null,
      color,
      signal: ctrl.signal,
    })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if ((e as { name?: string }).name === 'AbortError') return;
        setError(String(e));
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [fen, source, player?.fide_id, color]);

  return { data, loading, error };
}
