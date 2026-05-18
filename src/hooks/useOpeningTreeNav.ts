import { useEffect } from 'react';
import type { OpeningNode } from '../lib/api';

/**
 * Keyboard navigation through an opening tree.
 *
 *   ← : jump to parent (root if at depth 1)
 *   → : enter first child — prefer the main-line child, else the oldest
 *   Home : jump to root
 *   End  : walk forward along the main line until no more children
 *
 * Listens at the capture phase and stopImmediatePropagation so the
 * layout-level (game-store) handler doesn't also fire.
 */
export function useOpeningTreeNav(
  nodes: OpeningNode[],
  currentNodeId: number | null,
  onSelect: (id: number | null) => void,
  /** disable when this view isn't active (e.g. user is in Quiz or Chapters tab) */
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    function firstChild(parentId: number | null): OpeningNode | undefined {
      const kids = nodes.filter((n) => n.parent_id === parentId);
      if (kids.length === 0) return undefined;
      kids.sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.id - b.id);
      return kids[0];
    }

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      const cur = currentNodeId != null ? nodes.find((n) => n.id === currentNodeId) : null;

      switch (e.key) {
        case 'ArrowLeft': {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (!cur) return; // at root, nothing to do
          onSelect(cur.parent_id);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          e.stopImmediatePropagation();
          const child = firstChild(currentNodeId);
          if (child) onSelect(child.id);
          break;
        }
        case 'Home': {
          e.preventDefault();
          e.stopImmediatePropagation();
          onSelect(null);
          break;
        }
        case 'End': {
          e.preventDefault();
          e.stopImmediatePropagation();
          let cursor: number | null = currentNodeId;
          // walk forward picking main-line child
          while (true) {
            const child = firstChild(cursor);
            if (!child) break;
            cursor = child.id;
          }
          onSelect(cursor);
          break;
        }
      }
    }

    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [nodes, currentNodeId, onSelect, enabled]);
}
