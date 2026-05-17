import { useGameStore } from '../../store/gameStore';
import { useExplorer } from '../../hooks/useExplorer';

function pct(n: number, total: number): string {
  return total === 0 ? '–' : `${Math.round((n / total) * 100)}%`;
}

function StatBar({ w, d, b }: { w: number; d: number; b: number }) {
  const total = w + d + b;
  if (total === 0) return null;
  return (
    <div className="flex h-3 w-24 rounded overflow-hidden border border-neutral-300">
      <div className="bg-amber-50" style={{ width: `${(w / total) * 100}%` }} />
      <div className="bg-neutral-400" style={{ width: `${(d / total) * 100}%` }} />
      <div className="bg-neutral-800" style={{ width: `${(b / total) * 100}%` }} />
    </div>
  );
}

export function ExplorerTable() {
  const fen = useGameStore((s) => s.fen);
  const source = useGameStore((s) => s.source);
  const applyMove = useGameStore((s) => s.applyMove);
  const { data, loading, error } = useExplorer(fen, source);

  if (error) {
    return <div className="text-red-700 text-sm">Error: {error}</div>;
  }
  if (loading && !data) {
    return <div className="text-sm text-neutral-500">Loading…</div>;
  }
  if (!data) return null;
  if (data.moves.length === 0) {
    return <div className="text-sm text-neutral-500">No games for this position</div>;
  }

  return (
    <table className="text-sm font-mono w-full">
      <thead className="text-xs text-neutral-500 sticky top-0 bg-white">
        <tr className="text-left">
          <th className="py-1">Move</th>
          <th className="py-1 text-right">Games</th>
          <th className="py-1 text-right">W / D / B</th>
          <th className="py-1" />
        </tr>
      </thead>
      <tbody>
        {data.moves.map((m) => {
          const total = m.white + m.draws + m.black;
          return (
            <tr
              key={m.uci}
              className="hover:bg-amber-50 cursor-pointer border-t border-neutral-100"
              onClick={() => applyMove(m.san)}
            >
              <td className="py-1">{m.san}</td>
              <td className="py-1 text-right">{total.toLocaleString()}</td>
              <td className="py-1 text-right whitespace-nowrap">
                {pct(m.white, total)} / {pct(m.draws, total)} / {pct(m.black, total)}
              </td>
              <td className="py-1 pl-2">
                <StatBar w={m.white} d={m.draws} b={m.black} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
