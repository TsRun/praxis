import { useEffect, useState } from 'react';
import { fetchExplorer, type ExplorerResult, type Source } from '../lib/lichess';

export function useExplorer(
  fen: string,
  source: Source,
): { data?: ExplorerResult; loading: boolean; error?: string } {
  const [data, setData] = useState<ExplorerResult | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(undefined);
    fetchExplorer({ source, fen, signal: ctrl.signal })
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
  }, [fen, source]);

  return { data, loading, error };
}
