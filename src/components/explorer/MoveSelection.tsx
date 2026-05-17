import { useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useExplorer } from '../../hooks/useExplorer';
import type { ExplorerMove } from '../../lib/lichess';
import { Icon } from '../ui/Icon';
import { NodePreview } from '../tree/NodePreview';
import { Chess } from 'chess.js';

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function pct(n: number, total: number): number {
  return total === 0 ? 0 : (n / total) * 100;
}

interface RowProps {
  move: ExplorerMove;
  maxGames: number;
  index: number;
  fenAfter: string;
  onClick: () => void;
  onHover: (fen: string | null, x: number, y: number) => void;
}

function MoveRow({ move, maxGames, index, fenAfter, onClick, onHover }: RowProps) {
  const total = move.white + move.draws + move.black;
  const wPct = pct(move.white, total);
  const dPct = pct(move.draws, total);
  const bPct = pct(move.black, total);
  const popularity = maxGames > 0 ? move.games / maxGames : 0;
  const barFrac = Math.sqrt(popularity);

  return (
    <button
      onClick={onClick}
      onMouseEnter={(e) => onHover(fenAfter, e.clientX, e.clientY)}
      onMouseMove={(e) => onHover(fenAfter, e.clientX, e.clientY)}
      onMouseLeave={() => onHover(null, 0, 0)}
      className="group w-full text-left rounded-lg px-2.5 py-1.5 ring-1 ring-zinc-800/60 hover:ring-amber-400/40 bg-zinc-900/30 hover:bg-amber-400/[0.04] transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-5 text-right text-[10px] font-mono text-zinc-600 tabular-nums shrink-0">
          {index + 1}
        </div>
        <div className="font-mono text-zinc-100 tabular-nums w-12 text-sm shrink-0">
          {move.san}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 tabular-nums">
            <span className="font-mono text-zinc-200 w-12">{fmt(move.games)}</span>
            {move.avg_elo != null && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="font-mono text-zinc-400 w-9">{move.avg_elo}</span>
              </>
            )}
            <span className="ml-auto flex items-center gap-2 font-mono">
              <span className="text-amber-200">{wPct.toFixed(0)}</span>
              <span className="text-zinc-600">{dPct.toFixed(0)}</span>
              <span className="text-zinc-500">{bPct.toFixed(0)}</span>
            </span>
          </div>
          <div className="flex h-[5px] w-full rounded-full overflow-hidden ring-1 ring-zinc-800/40">
            <div className="bg-amber-200" style={{ width: `${wPct}%` }} />
            <div className="bg-zinc-500" style={{ width: `${dPct}%` }} />
            <div className="bg-zinc-900" style={{ width: `${bPct}%` }} />
          </div>
        </div>
        <div className="w-12 shrink-0 hidden md:block">
          <div className="h-1 rounded-full bg-zinc-800/40 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400/70 to-amber-500/70"
              style={{ width: `${barFrac * 100}%` }}
            />
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 text-amber-400 transition-opacity shrink-0">
          <Icon name="arrow-right" className="w-3.5 h-3.5" />
        </div>
      </div>
    </button>
  );
}

export function MoveSelection() {
  const fen = useGameStore((s) => s.fen);
  const source = useGameStore((s) => s.source);
  const applyMove = useGameStore((s) => s.applyMove);
  const setFen = useGameStore((s) => s.setFen);
  const { data, loading, error } = useExplorer(fen, source);

  const [hover, setHover] = useState<{ fen: string; x: number; y: number } | null>(null);

  const sideToMove = useMemo(() => {
    try {
      return new Chess(fen).turn() === 'w' ? 'White' : 'Black';
    } catch {
      return 'White';
    }
  }, [fen]);

  if (error) {
    return (
      <div className="p-6 text-sm text-red-300 rounded-xl bg-red-500/10 ring-1 ring-red-500/30">
        Error fetching positions: {error}
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="grid place-items-center h-full text-zinc-500">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 rounded-full border-2 border-zinc-700 border-t-amber-400 animate-spin" />
          <span className="text-sm">Loading moves…</span>
        </div>
      </div>
    );
  }

  if (!data || data.moves.length === 0) {
    return (
      <div className="p-6 text-sm text-zinc-400">
        No master games for this position in the indexed database. Try going
        back a few moves or refining the player filter.
      </div>
    );
  }

  const maxGames = data.moves[0]?.games ?? 0;
  const totalGames = data.games;
  const whitePct = pct(data.white, data.white + data.draws + data.black);

  return (
    <div className="h-full overflow-auto scroll-thin">
      <div className="sticky top-0 z-10 bg-zinc-950/85 backdrop-blur px-4 py-3 border-b border-zinc-800/70">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold tracking-tight">
              <span className={sideToMove === 'White' ? 'text-amber-200' : 'text-zinc-100'}>
                {sideToMove}
              </span>
              <span className="text-zinc-400 font-normal"> to play</span>
            </h2>
            <span className="text-[11px] text-zinc-500">
              {data.moves.length} candidate{data.moves.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-zinc-400">
            <span className="font-mono text-zinc-200 tabular-nums">{fmt(totalGames)}</span>
            <span className="text-zinc-600">games</span>
            <span className="text-zinc-700">·</span>
            <span className="font-mono tabular-nums">{whitePct.toFixed(0)}%</span>
            <span className="text-zinc-600">W</span>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 flex flex-col gap-1">
        {data.moves.map((m, i) => (
          <MoveRow
            key={m.uci}
            move={m}
            maxGames={maxGames}
            index={i}
            fenAfter={m.child_fen}
            onClick={() => applyMove(m.san) || setFen(m.child_fen)}
            onHover={(f, x, y) => (f ? setHover({ fen: f, x, y }) : setHover(null))}
          />
        ))}
      </div>

      {hover && <NodePreview fen={hover.fen} x={hover.x} y={hover.y} />}
    </div>
  );
}
