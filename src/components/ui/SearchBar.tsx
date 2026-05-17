import { useState } from 'react';
import { Chess } from 'chess.js';
import { useGameStore } from '../../store/gameStore';

export function SearchBar() {
  const [val, setVal] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const setFen = useGameStore((s) => s.setFen);
  const setHistoryFromPgn = useGameStore((s) => s.setHistoryFromPgn);

  function submit() {
    setErr(null);
    const trimmed = val.trim();
    if (!trimmed) return;
    // Try FEN first
    try {
      // chess.js throws on invalid FEN; if it accepts, it's a FEN.
      const c = new Chess();
      c.load(trimmed);
      setFen(trimmed);
      setVal('');
      return;
    } catch {
      // not a FEN, fall through to PGN
    }
    if (setHistoryFromPgn(trimmed)) {
      setVal('');
      return;
    }
    setErr('Not a valid FEN or PGN');
  }

  return (
    <div className="flex items-center gap-2">
      <input
        className="border rounded px-2 py-1 text-sm w-80 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
        placeholder="Paste FEN or PGN…"
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          if (err) setErr(null);
        }}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
