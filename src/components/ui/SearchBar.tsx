import { useState } from 'react';
import { Chess } from 'chess.js';
import { useGameStore } from '../../store/gameStore';
import { Icon } from './Icon';

export function SearchBar() {
  const [val, setVal] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const setFen = useGameStore((s) => s.setFen);
  const setHistoryFromPgn = useGameStore((s) => s.setHistoryFromPgn);

  function submit() {
    setErr(null);
    const trimmed = val.trim();
    if (!trimmed) return;
    try {
      const c = new Chess();
      c.load(trimmed);
      setFen(trimmed);
      setVal('');
      return;
    } catch {
      // fall through
    }
    if (setHistoryFromPgn(trimmed)) {
      setVal('');
      return;
    }
    setErr('Not a valid FEN or PGN');
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Icon
          name="search"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500"
        />
        <input
          className="border border-zinc-700/80 bg-zinc-900/60 backdrop-blur rounded-lg pl-8 pr-3 py-1.5 text-sm w-80 font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400/40 transition"
          placeholder="Paste FEN or PGN…"
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            if (err) setErr(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
  );
}
