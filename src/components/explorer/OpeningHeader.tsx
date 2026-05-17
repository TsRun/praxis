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
    return (
      <span className="text-xs text-zinc-500 italic">unnamed position</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="font-mono text-[11px] tracking-wider px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30">
        {entry.eco}
      </span>
      <span className="text-zinc-200">{entry.name}</span>
    </span>
  );
}
