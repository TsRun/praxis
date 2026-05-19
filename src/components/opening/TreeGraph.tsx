import type { OpeningNode } from '../../lib/api';
import { pathToNode } from '../../lib/opening-tree';

export interface TreeGraphProps {
  nodes: OpeningNode[];
  currentNodeId: number | null;
  chaptersSet: Set<number>;
  onSelect: (id: number) => void;
  /** Trainer-only actions; omit for read-only viewing. */
  onDelete?: (n: OpeningNode) => void;
  onToggleMain?: (n: OpeningNode) => void;
}

/**
 * Vertical tree, one row per ply along the currently-selected line.
 * Each row shows every move at that ply (the children of the previous step's
 * selected node), so variations sit side-by-side with the mainline choice.
 * Click any chip to switch focus to that line.
 */
export function TreeGraph({
  nodes,
  currentNodeId,
  chaptersSet,
  onSelect,
  onDelete,
  onToggleMain,
}: TreeGraphProps) {
  if (nodes.length === 0) {
    return (
      <div className="text-xs text-zinc-500 italic">
        Empty tree — drag a piece on the board to start building it.
      </div>
    );
  }

  const path = pathToNode(nodes, currentNodeId); // [root … current], empty when currentNodeId is null
  const rows: {
    parentId: number | null;
    siblings: OpeningNode[];
    selectedId: number | null;
    ply: number;
  }[] = [];

  for (let i = 0; i <= path.length; i++) {
    const parentId = i === 0 ? null : path[i - 1].id;
    const selectedId = i < path.length ? path[i].id : null;
    const siblings = nodes
      .filter((n) => n.parent_id === parentId)
      .sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.id - b.id);
    if (siblings.length === 0) continue;
    rows.push({ parentId, siblings, selectedId, ply: siblings[0].ply });
  }

  return (
    <div className="flex flex-col gap-1">
      {rows.map((row) => (
        <PlyRow
          key={`${row.parentId ?? 'root'}-${row.ply}`}
          siblings={row.siblings}
          selectedId={row.selectedId}
          ply={row.ply}
          chaptersSet={chaptersSet}
          onSelect={onSelect}
          onDelete={onDelete}
          onToggleMain={onToggleMain}
        />
      ))}
    </div>
  );
}

function PlyRow({
  siblings,
  selectedId,
  ply,
  chaptersSet,
  onSelect,
  onDelete,
  onToggleMain,
}: {
  siblings: OpeningNode[];
  selectedId: number | null;
  ply: number;
  chaptersSet: Set<number>;
  onSelect: (id: number) => void;
  onDelete?: (n: OpeningNode) => void;
  onToggleMain?: (n: OpeningNode) => void;
}) {
  const moveNum = ply % 2 === 1 ? `${Math.ceil(ply / 2)}.` : `${Math.ceil(ply / 2)}…`;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-[10px] text-zinc-600 font-mono w-9 shrink-0 text-right pr-1">
        {moveNum}
      </span>
      {siblings.map((n) => (
        <NodeChip
          key={n.id}
          node={n}
          isCurrent={n.id === selectedId}
          hasChapter={chaptersSet.has(n.id)}
          onSelect={onSelect}
          onDelete={onDelete}
          onToggleMain={onToggleMain}
        />
      ))}
    </div>
  );
}

export function NodeChip({
  node,
  isCurrent,
  hasChapter,
  onSelect,
  onDelete,
  onToggleMain,
}: {
  node: OpeningNode;
  isCurrent: boolean;
  hasChapter: boolean;
  onSelect: (id: number) => void;
  onDelete?: (n: OpeningNode) => void;
  onToggleMain?: (n: OpeningNode) => void;
}) {
  const trainer = onDelete != null || onToggleMain != null;
  return (
    <span className="group relative inline-flex items-center">
      <button
        onClick={() => onSelect(node.id)}
        className={`text-xs font-mono px-1.5 py-0.5 rounded border ${
          isCurrent
            ? 'bg-amber-400/20 text-amber-200 border-amber-400/40'
            : 'bg-zinc-900/60 border-zinc-700/60 text-zinc-200 hover:bg-amber-400/10 hover:border-amber-400/30'
        }`}
      >
        {node.san}
        {node.is_main && <span className="ml-1 text-amber-400">★</span>}
        {hasChapter && <span className="ml-1 text-emerald-400">●</span>}
      </button>
      {trainer && (
        <span className="ml-0.5 hidden group-hover:inline-flex gap-0.5">
          {onToggleMain && (
            <button
              onClick={() => onToggleMain(node)}
              title={node.is_main ? 'Unmark main line' : 'Mark as main line'}
              className="text-[10px] text-zinc-500 hover:text-amber-400 px-0.5"
            >
              {node.is_main ? '☆' : '★'}
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(node)}
              title="Delete sub-tree"
              className="text-[10px] text-zinc-500 hover:text-red-400 px-0.5"
            >
              ✕
            </button>
          )}
        </span>
      )}
    </span>
  );
}
