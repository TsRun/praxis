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
