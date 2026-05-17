import type { TreeNode, TreeBuildOpts } from '../components/tree/treeTypes';

export function plays(n: TreeNode): number {
  return n.white + n.draws + n.black;
}

export function pruneChildren(parent: TreeNode, opts: TreeBuildOpts): TreeNode[] {
  if (parent.depth >= opts.maxDepth) return [];
  const total = plays(parent);
  if (total === 0) return parent.children;
  return parent.children.filter((c) => plays(c) / total >= opts.minShare);
}

export function findNode(root: TreeNode, id: string): TreeNode | null {
  if (root.id === id) return root;
  for (const c of root.children) {
    const r = findNode(c, id);
    if (r) return r;
  }
  return null;
}

export function whiteAdvantage(n: TreeNode): number {
  const total = plays(n);
  if (total === 0) return 0;
  return (n.white - n.black) / total;
}
