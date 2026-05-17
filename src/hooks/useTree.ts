import { useCallback, useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { fetchExplorer, type Source } from '../lib/lichess';
import { useGameStore, START_POSITION_FEN } from '../store/gameStore';
import { findNode, pruneChildren } from '../lib/tree';
import type { TreeNode, TreeBuildOpts } from '../components/tree/treeTypes';

async function fetchAsNode(fen: string, source: Source, depth: number): Promise<TreeNode> {
  const r = await fetchExplorer({ source, fen });
  const children: TreeNode[] = r.moves.map((m) => {
    const c = new Chess(fen);
    c.move(m.san);
    return {
      id: c.fen(),
      san: m.san,
      white: m.white,
      draws: m.draws,
      black: m.black,
      children: [],
      expanded: false,
      depth: depth + 1,
    };
  });
  return {
    id: fen,
    white: r.white,
    draws: r.draws,
    black: r.black,
    children,
    expanded: true,
    depth,
  };
}

function pathFens(history: string[]): string[] {
  const c = new Chess();
  const out = [c.fen()];
  for (const m of history) {
    c.move(m);
    out.push(c.fen());
  }
  return out;
}

function applyPrune(root: TreeNode, opts: TreeBuildOpts): void {
  root.children = pruneChildren(root, opts);
  for (const child of root.children) applyPrune(child, opts);
}

export function useTree() {
  const history = useGameStore((s) => s.history);
  const source = useGameStore((s) => s.source);
  const minShare = useGameStore((s) => s.minShare);
  const maxDepth = useGameStore((s) => s.maxDepth);

  const [root, setRoot] = useState<TreeNode | null>(null);
  const [activePath, setActivePath] = useState<Set<string>>(new Set([START_POSITION_FEN]));
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    setError(undefined);
    (async () => {
      try {
        const fens = pathFens(history);
        const top = await fetchAsNode(fens[0], source, 0);
        let cursor = top;
        for (let i = 1; i < fens.length; i++) {
          const child = cursor.children.find((c) => c.id === fens[i]);
          if (!child) break;
          const expanded = await fetchAsNode(fens[i], source, i);
          child.children = expanded.children;
          child.expanded = true;
          cursor = child;
        }
        applyPrune(top, { minShare, maxDepth });
        if (!cancelled) {
          setRoot(top);
          setActivePath(new Set(fens));
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [history.join('|'), source, minShare, maxDepth]);

  const expand = useCallback(
    async (fen: string) => {
      if (!root) return;
      const node = findNode(root, fen);
      if (!node || node.expanded) return;
      node.loading = true;
      setRoot({ ...root });
      try {
        const fetched = await fetchAsNode(fen, source, node.depth);
        node.children = fetched.children;
        node.expanded = true;
        node.loading = false;
        applyPrune(root, { minShare, maxDepth });
        setRoot({ ...root });
      } catch (e) {
        node.loading = false;
        setError(String(e));
        setRoot({ ...root });
      }
    },
    [root, source, minShare, maxDepth],
  );

  return { root, activePath, expand, error };
}
