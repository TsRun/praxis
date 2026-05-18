import { Fragment } from 'react';
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
 * Horizontal opening-tree diagram.
 * Renders linear chains on one row and stacks branching children to the right,
 * connected by left borders. Scrolls horizontally for deep trees.
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
    <div className="overflow-auto">
      <div className="flex flex-col gap-2 min-w-max py-1">
        {props.tree.map((root) => (
          <Chain key={root.id} root={root} {...props} />
        ))}
      </div>
    </div>
  );
}

interface ChainProps extends Omit<TreeGraphProps, 'tree'> {
  root: TreeNode;
}

function Chain({ root, currentNodeId, chaptersSet, onSelect, onDelete, onToggleMain }: ChainProps) {
  // Walk down through single-child nodes to collapse linear chains onto one row.
  const chain: TreeNode[] = [];
  let cur: TreeNode | undefined = root;
  while (cur && cur.children.length === 1) {
    chain.push(cur);
    cur = cur.children[0];
  }
  if (cur) chain.push(cur);
  const branches = cur ? cur.children : [];

  return (
    <div className="flex items-start gap-1">
      <div className="flex items-center gap-0.5 shrink-0">
        {chain.map((n, i) => (
          <Fragment key={n.id}>
            {i > 0 && <span className="text-zinc-700 select-none">·</span>}
            <NodeChip
              node={n}
              isCurrent={n.id === currentNodeId}
              hasChapter={chaptersSet.has(n.id)}
              onSelect={onSelect}
              onDelete={onDelete}
              onToggleMain={onToggleMain}
            />
          </Fragment>
        ))}
      </div>
      {branches.length > 1 && (
        <div className="flex flex-col gap-1 pl-2 border-l border-zinc-700 shrink-0">
          {branches.map((c) => (
            <div key={c.id} className="flex items-start">
              <span className="text-zinc-700 mr-1 select-none">─</span>
              <Chain
                root={c}
                currentNodeId={currentNodeId}
                chaptersSet={chaptersSet}
                onSelect={onSelect}
                onDelete={onDelete}
                onToggleMain={onToggleMain}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NodeChip({
  node,
  isCurrent,
  hasChapter,
  onSelect,
  onDelete,
  onToggleMain,
}: {
  node: TreeNode;
  isCurrent: boolean;
  hasChapter: boolean;
  onSelect: (id: number) => void;
  onDelete?: (n: TreeNode) => void;
  onToggleMain?: (n: TreeNode) => void;
}) {
  const moveNum = node.ply % 2 === 1 ? `${Math.ceil(node.ply / 2)}.` : '';
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
        {moveNum}
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
