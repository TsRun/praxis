import type { TreeNode } from '../../lib/opening-tree';

export interface TreeGraphProps {
  tree: TreeNode[];
  currentNodeId: number | null;
  chaptersSet: Set<number>;
  onSelect: (id: number) => void;
  /** Trainer-only actions; omit for read-only viewing. */
  onDelete?: (n: TreeNode) => void;
  onToggleMain?: (n: TreeNode) => void;
}

/**
 * Vertical opening-tree outline.
 * Mainline flows top-to-bottom at the same depth. Variations (non-mainline
 * children) appear as indented sub-trees, interleaved at the position where
 * they branch off — the same convention used in PGN notation.
 */
export function TreeGraph(props: TreeGraphProps) {
  if (props.tree.length === 0) {
    return (
      <div className="text-xs text-zinc-500 italic">
        Empty tree — drag a piece on the board to start building it.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {props.tree.map((root) => (
        <Subtree key={root.id} root={root} depth={0} {...props} />
      ))}
    </div>
  );
}

interface SubtreeProps extends Omit<TreeGraphProps, 'tree'> {
  root: TreeNode;
  depth: number;
}

/**
 * Emit `root` and walk the mainline (children[0]) downward at the same depth.
 * Variation children (children[1..]) emit as indented sub-trees interleaved
 * right after their parent move.
 */
function Subtree({ root, depth, currentNodeId, chaptersSet, onSelect, onDelete, onToggleMain }: SubtreeProps) {
  const rows: JSX.Element[] = [];
  let cur: TreeNode | undefined = root;
  while (cur) {
    rows.push(
      <NodeRow
        key={cur.id}
        node={cur}
        depth={depth}
        isCurrent={cur.id === currentNodeId}
        hasChapter={chaptersSet.has(cur.id)}
        onSelect={onSelect}
        onDelete={onDelete}
        onToggleMain={onToggleMain}
      />,
    );
    // Emit variation children (index 1+) BEFORE walking to the mainline child.
    if (cur.children.length > 1) {
      for (let i = 1; i < cur.children.length; i++) {
        rows.push(
          <Subtree
            key={`var-${cur.children[i].id}`}
            root={cur.children[i]}
            depth={depth + 1}
            currentNodeId={currentNodeId}
            chaptersSet={chaptersSet}
            onSelect={onSelect}
            onDelete={onDelete}
            onToggleMain={onToggleMain}
          />,
        );
      }
    }
    cur = cur.children[0];
  }
  return <>{rows}</>;
}

function NodeRow({
  node,
  depth,
  isCurrent,
  hasChapter,
  onSelect,
  onDelete,
  onToggleMain,
}: {
  node: TreeNode;
  depth: number;
  isCurrent: boolean;
  hasChapter: boolean;
  onSelect: (id: number) => void;
  onDelete?: (n: TreeNode) => void;
  onToggleMain?: (n: TreeNode) => void;
}) {
  const moveNum = node.ply % 2 === 1 ? `${Math.ceil(node.ply / 2)}.` : '';
  const trainer = onDelete != null || onToggleMain != null;
  return (
    <div
      className="group flex items-center gap-1"
      style={{ paddingLeft: depth * 14 }}
    >
      {depth > 0 && (
        <span className="text-zinc-700 text-[10px] select-none -ml-2.5 w-2.5">└</span>
      )}
      <button
        onClick={() => onSelect(node.id)}
        className={`flex-1 text-left text-xs font-mono px-1.5 py-0.5 rounded border ${
          isCurrent
            ? 'bg-amber-400/20 text-amber-200 border-amber-400/40'
            : 'bg-zinc-900/60 border-zinc-700/60 text-zinc-200 hover:bg-amber-400/10 hover:border-amber-400/30'
        }`}
      >
        {moveNum}
        {node.san}
        {node.is_main && <span className="ml-1 text-amber-400">★</span>}
        {hasChapter && <span className="ml-1 text-emerald-400">●</span>}
      </button>
      {trainer && (
        <span className="hidden group-hover:inline-flex gap-0.5 shrink-0">
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
    </div>
  );
}
