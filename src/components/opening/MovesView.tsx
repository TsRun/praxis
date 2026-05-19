import { useMemo } from 'react';
import type { OpeningNode } from '../../lib/api';

export interface MovesViewProps {
  nodes: OpeningNode[];
  currentNodeId: number | null;
  chaptersSet: Set<number>;
  onSelect: (id: number) => void;
}

interface SubtreeStats {
  nodes: number;
  chapters: number;
}

function computeSubtreeStats(
  nodes: OpeningNode[],
  chaptersSet: Set<number>,
): Map<number, SubtreeStats> {
  const childrenByParent = new Map<number | null, OpeningNode[]>();
  for (const n of nodes) {
    const arr = childrenByParent.get(n.parent_id) ?? [];
    arr.push(n);
    childrenByParent.set(n.parent_id, arr);
  }
  const stats = new Map<number, SubtreeStats>();
  function dfs(node: OpeningNode): SubtreeStats {
    let nodeCount = 1;
    let chapterCount = chaptersSet.has(node.id) ? 1 : 0;
    for (const c of childrenByParent.get(node.id) ?? []) {
      const sub = dfs(c);
      nodeCount += sub.nodes;
      chapterCount += sub.chapters;
    }
    const s = { nodes: nodeCount, chapters: chapterCount };
    stats.set(node.id, s);
    return s;
  }
  for (const n of nodes) {
    if (!stats.has(n.id)) dfs(n);
  }
  return stats;
}

/**
 * "Next moves" panel — one row per candidate move with stats on the subtree
 * that move opens up (positions count, chapter count).
 */
export function MovesView({ nodes, currentNodeId, chaptersSet, onSelect }: MovesViewProps) {
  const stats = useMemo(
    () => computeSubtreeStats(nodes, chaptersSet),
    [nodes, chaptersSet],
  );

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

  const totalSubChapters = children.reduce(
    (sum, c) => sum + (stats.get(c.id)?.chapters ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wider text-zinc-500">
          Next move ({moveNum})
        </span>
        <span className="text-[10px] text-zinc-500 tabular-nums">
          {children.length} option{children.length > 1 ? 's' : ''}
          {totalSubChapters > 0 && ` · ${totalSubChapters} chapter${totalSubChapters > 1 ? 's' : ''} below`}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {children.map((n) => {
          const sub = stats.get(n.id) ?? { nodes: 1, chapters: 0 };
          const share = totalSubChapters > 0
            ? Math.round((sub.chapters / totalSubChapters) * 100)
            : 0;
          return (
            <button
              key={n.id}
              onClick={() => onSelect(n.id)}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded border text-left ${
                n.is_main
                  ? 'bg-amber-400/10 border-amber-400/30 hover:bg-amber-400/15'
                  : 'bg-zinc-900/40 border-zinc-700/40 hover:bg-amber-400/10 hover:border-amber-400/30'
              }`}
            >
              <span className="font-mono text-sm w-16 truncate">
                {moveNum}
                {n.san}
              </span>
              <span className="text-amber-400 text-xs w-3 shrink-0">
                {n.is_main ? '★' : ''}
              </span>
              <span className="text-emerald-400 text-xs w-3 shrink-0">
                {chaptersSet.has(n.id) ? '●' : ''}
              </span>
              <span className="ml-auto text-xs text-zinc-400 tabular-nums shrink-0">
                {sub.chapters} ch · {sub.nodes - 1} sub
              </span>
              {totalSubChapters > 0 && (
                <span className="w-10 h-1.5 bg-zinc-800 rounded overflow-hidden shrink-0">
                  <span
                    className="block h-full bg-amber-400/60"
                    style={{ width: `${share}%` }}
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
