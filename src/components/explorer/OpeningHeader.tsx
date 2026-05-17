import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { ecoFor, type EcoEntry } from '../../lib/eco';

export function OpeningHeader() {
  const fen = useGameStore((s) => s.fen);
  const [entry, setEntry] = useState<EcoEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    ecoFor(fen).then((e) => {
      if (!cancelled) setEntry(e);
    });
    return () => {
      cancelled = true;
    };
  }, [fen]);

  if (!entry) {
    return <span className="text-xs text-neutral-400">no opening match</span>;
  }
  return (
    <span className="text-xs">
      <span className="font-mono text-amber-700 mr-2">{entry.eco}</span>
      <span className="text-neutral-700">{entry.name}</span>
    </span>
  );
}
