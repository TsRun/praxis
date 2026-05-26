import type { OpeningNode } from './api';

export interface TreeNode extends OpeningNode {
  children: TreeNode[];
}

/** Build an in-memory tree (parent_id === null are roots). */
export function buildTree(nodes: OpeningNode[]): TreeNode[] {
  const byId = new Map<number, TreeNode>();
  for (const n of nodes) byId.set(n.id, { ...n, children: [] });
  const roots: TreeNode[] = [];
  for (const n of byId.values()) {
    if (n.parent_id == null) roots.push(n);
    else {
      const p = byId.get(n.parent_id);
      if (p) p.children.push(n);
    }
  }
  // Order: main line first, then by created order (id)
  const sort = (arr: TreeNode[]) => {
    arr.sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.id - b.id);
    for (const c of arr) sort(c.children);
  };
  sort(roots);
  return roots;
}

/** Walk from root to the given node, returning the chain of nodes (root … target). */
export function pathToNode(nodes: OpeningNode[], targetId: number | null): OpeningNode[] {
  if (targetId == null) return [];
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const chain: OpeningNode[] = [];
  let cursor: number | null = targetId;
  while (cursor != null) {
    const n = byId.get(cursor);
    if (!n) break;
    chain.unshift(n);
    cursor = n.parent_id;
  }
  return chain;
}

/** Find a child of the given parent (or top-level) with the given SAN. */
export function findChildBySan(
  nodes: OpeningNode[],
  parentId: number | null,
  san: string,
): OpeningNode | undefined {
  return nodes.find((n) => n.parent_id === parentId && n.san === san);
}

/** How many plies have already been played by the time we reach this FEN.
 * Used to turn an opening_node's tree-relative `ply` (1 = first move from
 * root) into an absolute move number when the study starts from a non-
 * standard root. For the standard start position this returns 0.
 *
 * A FEN's 6th field is the fullmove counter (1-based, increments after
 * Black moves); the 2nd field is the side to move. So the number of
 * already-played plies is `(fullmove - 1) * 2` plus one more if it's
 * Black to move. */
export function plyOffsetFromFen(fen: string): number {
  const parts = fen.trim().split(/\s+/);
  const turn = parts[1] === 'b' ? 'b' : 'w';
  const fullmove = Number(parts[5]);
  const fm = Number.isFinite(fullmove) && fullmove >= 1 ? fullmove : 1;
  return (fm - 1) * 2 + (turn === 'b' ? 1 : 0);
}

/** Render a ply number ("12.", "12…") respecting an optional prefix offset.
 * `ply` is 1-based from the study's root; `offset` is how many plies were
 * already on the board at the root. */
export function formatPlyLabel(ply: number, offset = 0): string {
  const abs = ply + offset;
  return abs % 2 === 1 ? `${Math.ceil(abs / 2)}.` : `${Math.ceil(abs / 2)}…`;
}

/** Render "ply.san" or "ply…san" the way SAN notation usually appears in a
 * line. Used by breadcrumbs and chapter summaries. */
export function formatPlySan(
  ply: number,
  san: string,
  offset = 0,
): string {
  const abs = ply + offset;
  return abs % 2 === 1
    ? `${Math.ceil(abs / 2)}.${san}`
    : san;
}
