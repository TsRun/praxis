import type { OpeningNode, OpeningChapter } from '../../lib/api';

export interface ChapterItem {
  chapter: OpeningChapter;
  node: OpeningNode;
  /** Move chain from the parent-chapter's node (exclusive) down to this node (inclusive). */
  pathFromParent: OpeningNode[];
  children: ChapterItem[];
}

/**
 * Nests chapters under their nearest chapter-ancestor by walking the parent
 * chain of opening nodes. Roots are chapters with no chapter-ancestor.
 */
export function buildChaptersTree(
  nodes: OpeningNode[],
  chapters: OpeningChapter[],
): ChapterItem[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
  const chapterNodeIds = new Set(chapters.map((c) => c.node_id));

  function nearestAncestorChapter(node: OpeningNode): OpeningNode | null {
    let cur: OpeningNode | undefined =
      node.parent_id != null ? nodeById.get(node.parent_id) : undefined;
    while (cur) {
      if (chapterNodeIds.has(cur.id)) return cur;
      cur = cur.parent_id != null ? nodeById.get(cur.parent_id) : undefined;
    }
    return null;
  }

  function pathBetween(
    ancestor: OpeningNode | null,
    descendant: OpeningNode,
  ): OpeningNode[] {
    const chain: OpeningNode[] = [];
    let cur: OpeningNode | undefined = descendant;
    const stopId = ancestor?.id ?? null;
    while (cur && cur.id !== stopId) {
      chain.unshift(cur);
      cur = cur.parent_id != null ? nodeById.get(cur.parent_id) : undefined;
    }
    return chain;
  }

  const parentChapterId = new Map<number, number | null>();
  const items: ChapterItem[] = [];
  for (const c of chapters) {
    const node = nodeById.get(c.node_id);
    if (!node) continue;
    const parentChapterNode = nearestAncestorChapter(node);
    parentChapterId.set(node.id, parentChapterNode?.id ?? null);
    items.push({
      chapter: c,
      node,
      pathFromParent: pathBetween(parentChapterNode, node),
      children: [],
    });
  }

  const byNodeId = new Map(items.map((i) => [i.chapter.node_id, i]));
  const roots: ChapterItem[] = [];
  for (const item of items) {
    const pid = parentChapterId.get(item.chapter.node_id) ?? null;
    if (pid == null) roots.push(item);
    else byNodeId.get(pid)?.children.push(item);
  }

  // Sort siblings by their node's ply, then by id (creation order)
  const sort = (arr: ChapterItem[]) => {
    arr.sort((a, b) => a.node.ply - b.node.ply || a.node.id - b.node.id);
    for (const c of arr) sort(c.children);
  };
  sort(roots);
  return roots;
}

/** Format a chain of nodes as a SAN string with move numbers. */
export function formatPath(chain: OpeningNode[]): string {
  if (chain.length === 0) return '';
  const parts: string[] = [];
  const first = chain[0];
  // If we don't start on a white move, prefix with "<move-num>..." to anchor
  if (first.ply % 2 === 0) {
    parts.push(`${first.ply / 2}…`);
  }
  for (const n of chain) {
    if (n.ply % 2 === 1) parts.push(`${Math.ceil(n.ply / 2)}.${n.san}`);
    else parts.push(n.san);
  }
  return parts.join(' ');
}

export interface ChaptersOutlineProps {
  nodes: OpeningNode[];
  chapters: OpeningChapter[];
  currentNodeId: number | null;
  onSelect: (nodeId: number) => void;
}

export function ChaptersOutline({
  nodes,
  chapters,
  currentNodeId,
  onSelect,
}: ChaptersOutlineProps) {
  const tree = buildChaptersTree(nodes, chapters);
  if (tree.length === 0) {
    return (
      <p className="text-sm text-zinc-500 italic">
        No chapters yet. Annotate a position from the Tree view to see it here.
      </p>
    );
  }
  return <div className="flex flex-col gap-0.5">{renderItems(tree, 0, currentNodeId, onSelect)}</div>;
}

function renderItems(
  items: ChapterItem[],
  depth: number,
  currentNodeId: number | null,
  onSelect: (id: number) => void,
): JSX.Element[] {
  return items.flatMap((item) => {
    const isCur = item.node.id === currentNodeId;
    const hasChildren = item.children.length > 0;
    const pathLabel = formatPath(item.pathFromParent);
    return [
      <button
        key={item.chapter.node_id}
        onClick={() => onSelect(item.node.id)}
        style={{ paddingLeft: depth * 14 + 6 }}
        className={`group flex items-baseline gap-2 text-left py-1 pr-2 rounded ${
          isCur
            ? 'bg-amber-400/15 text-amber-200'
            : 'text-zinc-200 hover:bg-amber-400/10'
        }`}
      >
        <span className="text-zinc-600 text-xs w-3 shrink-0">
          {hasChildren ? '▼' : '•'}
        </span>
        <span className="text-sm">
          {item.chapter.title?.trim() || <em className="text-zinc-500">Untitled</em>}
        </span>
        {pathLabel && (
          <span className="text-xs text-zinc-500 font-mono">({pathLabel})</span>
        )}
      </button>,
      ...renderItems(item.children, depth + 1, currentNodeId, onSelect),
    ];
  });
}
