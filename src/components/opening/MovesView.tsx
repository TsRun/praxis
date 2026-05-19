import type { OpeningNode } from '../../lib/api';

export interface MovesViewProps {
  nodes: OpeningNode[];
  currentNodeId: number | null;
  chaptersSet: Set<number>;
  onSelect: (id: number) => void;
}

/**
 * "Next moves" panel — shows the children of the current node as big chips.
 * Click a chip to advance into that line. Useful as a Chessbook-style review
 * UI when the trainer wants the player to consider what to play next.
 */
export function MovesView({ nodes, currentNodeId, chaptersSet, onSelect }: MovesViewProps) {
  const children = nodes
    .filter((n) => n.parent_id === currentNodeId)
    .sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.id - b.id);

  if (children.length === 0) {
    return (
      <p className="text-sm text-zinc-500 italic">
        End of this line — no further moves recorded.
      </p>
    );
  }

  const ply = children[0].ply;
  const moveNum = ply % 2 === 1 ? `${Math.ceil(ply / 2)}.` : `${Math.ceil(ply / 2)}…`;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs uppercase tracking-wider text-zinc-500">
        Next move ({moveNum})
      </div>
      <div className="flex flex-wrap gap-2">
        {children.map((n) => (
          <button
            key={n.id}
            onClick={() => onSelect(n.id)}
            className={`flex items-center gap-1.5 font-mono text-sm px-3 py-2 rounded-lg border ${
              n.is_main
                ? 'bg-amber-400/15 text-amber-100 border-amber-400/40 hover:bg-amber-400/25'
                : 'bg-zinc-900/60 text-zinc-200 border-zinc-700/60 hover:bg-amber-400/10 hover:border-amber-400/30'
            }`}
          >
            <span>{n.san}</span>
            {n.is_main && <span className="text-amber-400 text-xs">★</span>}
            {chaptersSet.has(n.id) && <span className="text-emerald-400 text-xs">●</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
