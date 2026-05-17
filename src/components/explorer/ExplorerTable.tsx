import { useGameStore } from '../../store/gameStore';
import { useExplorer } from '../../hooks/useExplorer';
import { Icon } from '../ui/Icon';

function pct(n: number, total: number): string {
  return total === 0 ? '–' : `${Math.round((n / total) * 100)}%`;
}

function StatBar({ w, d, b }: { w: number; d: number; b: number }) {
  const total = w + d + b;
  if (total === 0) return null;
  return (
    <div className="flex h-2 w-24 rounded-full overflow-hidden ring-1 ring-zinc-700/60">
      <div className="bg-amber-100" style={{ width: `${(w / total) * 100}%` }} />
      <div className="bg-zinc-500" style={{ width: `${(d / total) * 100}%` }} />
      <div className="bg-zinc-900" style={{ width: `${(b / total) * 100}%` }} />
    </div>
  );
}

export function ExplorerTable() {
  const fen = useGameStore((s) => s.fen);
  const source = useGameStore((s) => s.source);
  const applyMove = useGameStore((s) => s.applyMove);
  const { data, loading, error } = useExplorer(fen, source);

  if (error) {
    return <div className="text-red-400 text-sm">Error: {error}</div>;
  }
  if (loading && !data) {
    return <div className="text-sm text-zinc-500">Loading moves…</div>;
  }
  if (!data) return null;
  if (data.moves.length === 0) {
    return <div className="text-sm text-zinc-500">No games for this position.</div>;
  }

  return (
    <table className="text-sm w-full">
      <thead className="text-[10px] uppercase tracking-wider text-zinc-500 sticky top-0 bg-zinc-900/80 backdrop-blur">
        <tr className="text-left">
          <th className="py-2 font-medium">Move</th>
          <th className="py-2 font-medium text-right">Games</th>
          <th className="py-2 font-medium text-right">W / D / B</th>
          <th className="py-2 font-medium" />
          <th className="py-2 font-medium w-6" />
        </tr>
      </thead>
      <tbody>
        {data.moves.map((m, i) => {
          const total = m.white + m.draws + m.black;
          return (
            <tr
              key={m.uci}
              className="group cursor-pointer border-t border-zinc-800/70 hover:bg-amber-400/5"
              onClick={() => applyMove(m.san)}
            >
              <td className="py-1.5 font-mono text-zinc-100">
                {i === 0 && (
                  <span className="text-amber-400 mr-1.5" aria-hidden>★</span>
                )}
                {m.san}
              </td>
              <td className="py-1.5 text-right font-mono text-zinc-400">
                {total.toLocaleString()}
              </td>
              <td className="py-1.5 text-right whitespace-nowrap font-mono text-zinc-400">
                {pct(m.white, total)} / {pct(m.draws, total)} / {pct(m.black, total)}
              </td>
              <td className="py-1.5 pl-2">
                <StatBar w={m.white} d={m.draws} b={m.black} />
              </td>
              <td className="py-1.5 pr-1 text-right opacity-0 group-hover:opacity-100 text-amber-400 transition-opacity">
                <Icon name="arrow-right" className="w-4 h-4 inline" />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
