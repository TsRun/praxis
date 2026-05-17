import { useEffect, useRef, useState } from 'react';
import { searchPlayers, type PlayerSuggestion } from '../../lib/lichess';
import { useFilterStore, type ColorFilter } from '../../store/filterStore';
import { Icon } from './Icon';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

const COLORS: { value: ColorFilter; label: string }[] = [
  { value: 'any', label: 'any' },
  { value: 'white', label: 'white' },
  { value: 'black', label: 'black' },
];

export function PlayerFilter() {
  const player = useFilterStore((s) => s.player);
  const color = useFilterStore((s) => s.color);
  const setPlayer = useFilterStore((s) => s.setPlayer);
  const setColor = useFilterStore((s) => s.setColor);
  const clear = useFilterStore((s) => s.clear);

  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<PlayerSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounced(q, 120);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (debounced.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    searchPlayers(debounced, ctrl.signal)
      .then((p) => setSuggestions(p))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [debounced]);

  // True between "user typed something" and "fetch settled" — avoids briefly
  // showing "No players match" while the debounce is still pending.
  const stale = q.length >= 2 && q !== debounced;
  const showDropdown = focused && q.length >= 2;

  function pick(s: PlayerSuggestion) {
    setPlayer({
      fide_id: s.fide_id,
      name: s.name,
      country: s.country,
      title: s.title,
      rating: s.rating,
    });
    setQ('');
    setSuggestions([]);
    inputRef.current?.blur();
  }

  if (player) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-amber-400/10 ring-1 ring-amber-400/30 text-sm">
          {player.title && (
            <span className="text-[10px] font-mono text-amber-300 font-semibold">
              {player.title}
            </span>
          )}
          <span className="text-zinc-100 font-medium">{player.name}</span>
          {player.country && (
            <span className="text-[10px] font-mono text-zinc-400 uppercase">
              {player.country}
            </span>
          )}
          {player.rating != null && (
            <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
              {player.rating}
            </span>
          )}
          <button
            onClick={clear}
            className="ml-1 text-zinc-500 hover:text-red-400 transition-colors"
            aria-label="Clear player filter"
          >
            <Icon name="reset" className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="inline-flex bg-zinc-900/60 ring-1 ring-zinc-800 rounded-lg overflow-hidden text-[11px]">
          {COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              className={
                'px-2 py-1 transition-colors ' +
                (color === c.value
                  ? 'bg-amber-400/15 text-amber-200'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60')
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Icon
          name="search"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500"
        />
        <input
          ref={inputRef}
          className="border border-zinc-700/80 bg-zinc-900/60 backdrop-blur rounded-lg pl-8 pr-3 py-1.5 text-sm w-72 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400/40 transition"
          placeholder="Search player (FIDE)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && suggestions[0]) {
              e.preventDefault();
              pick(suggestions[0]);
            } else if (e.key === 'Escape') {
              setQ('');
              inputRef.current?.blur();
            }
          }}
        />
      </div>
      {showDropdown && (
        <div className="absolute z-30 top-full mt-1.5 left-0 w-[26rem] max-h-80 overflow-auto scroll-thin rounded-xl panel p-1">
          {(loading || stale) && suggestions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-500">Searching FIDE…</div>
          ) : suggestions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-500">
              No players match "{q}".
            </div>
          ) : (
            suggestions.map((s) => (
              <button
                key={s.fide_id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                className="group w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-amber-400/[0.06] text-left transition-colors"
              >
                {s.title && (
                  <span className="text-[10px] font-mono text-amber-300 font-semibold w-7 shrink-0">
                    {s.title}
                  </span>
                )}
                <span className="text-zinc-100 text-sm flex-1 truncate">{s.name}</span>
                {s.country && (
                  <span className="text-[10px] font-mono text-zinc-500 uppercase w-8">
                    {s.country}
                  </span>
                )}
                {s.rating != null && (
                  <span className="text-[10px] font-mono text-zinc-400 tabular-nums w-10 text-right">
                    {s.rating}
                  </span>
                )}
                <span className="text-[10px] font-mono text-zinc-500 tabular-nums w-12 text-right">
                  {s.games > 0 ? `${s.games}g` : '—'}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
