import { describe, it, expect } from 'vitest';
import { buildSubtreeScope } from '../../../src/components/opening/ChapterWalker';
import type { OpeningNode, OpeningChapter } from '../../../src/lib/api';

function n(
  id: number,
  parent_id: number | null,
  san: string,
  is_main = true,
  ply = 1,
): OpeningNode {
  return {
    id,
    parent_id,
    parent_fen: '',
    san,
    uci: '',
    fen: `f${id}`,
    ply,
    is_main,
  };
}

function ch(node_id: number, title: string | null): OpeningChapter {
  return { node_id, title, body_md: '' };
}

describe('buildSubtreeScope', () => {
  it('includes the anchor with parent_id rewritten to null', () => {
    // tree: 1(e4) → 2(e5)
    const nodes = [n(1, null, 'e4', true, 1), n(2, 1, 'e5', true, 2)];
    const chapters = [ch(1, 'Opening')];
    const { subtree, childChapterStops } = buildSubtreeScope(nodes, chapters, 1);
    expect(subtree.map((s) => s.id).sort()).toEqual([1, 2]);
    expect(subtree.find((s) => s.id === 1)?.parent_id).toBeNull();
    expect(subtree.find((s) => s.id === 2)?.parent_id).toBe(1);
    expect(childChapterStops).toEqual([]);
  });

  it('stops at deeper titled chapters and records them as stops', () => {
    // 1(e4) → 2(e5) → 3(Nf3) → 4(Nc6) → 5(Bc4 = "Italian")
    const nodes = [
      n(1, null, 'e4', true, 1),
      n(2, 1, 'e5', true, 2),
      n(3, 2, 'Nf3', true, 3),
      n(4, 3, 'Nc6', true, 4),
      n(5, 4, 'Bc4', true, 5),
    ];
    const chapters = [ch(1, 'Open Game'), ch(5, 'Italian')];
    const { subtree, childChapterStops } = buildSubtreeScope(nodes, chapters, 1);
    // Italian sub-chapter cuts off the walk at node 5
    expect(subtree.map((s) => s.id).sort()).toEqual([1, 2, 3, 4]);
    expect(childChapterStops).toHaveLength(1);
    expect(childChapterStops[0].chapter.title).toBe('Italian');
    expect(childChapterStops[0].attachedTo).toBe(4); // hangs off 4.Nc6
  });

  it('ignores untitled chapter rows (treated as no chapter)', () => {
    const nodes = [n(1, null, 'e4', true, 1), n(2, 1, 'e5', true, 2)];
    const chapters = [ch(1, 'Open'), ch(2, '   ')]; // 2 is untitled-effective
    const { subtree, childChapterStops } = buildSubtreeScope(nodes, chapters, 1);
    expect(subtree.map((s) => s.id).sort()).toEqual([1, 2]);
    expect(childChapterStops).toEqual([]);
  });

  it('returns empty subtree when anchor is missing', () => {
    const nodes = [n(1, null, 'e4', true, 1)];
    const { subtree, childChapterStops } = buildSubtreeScope(nodes, [], 999);
    expect(subtree).toEqual([]);
    expect(childChapterStops).toEqual([]);
  });

  it('handles branching: a sibling becomes a stop, the other recurses', () => {
    // 1(e4) → 2(e5)[main] → 3(Nf3)
    //               → 4(c5)[deeper chapter]
    const nodes = [
      n(1, null, 'e4', true, 1),
      n(2, 1, 'e5', true, 2),
      n(3, 2, 'Nf3', true, 3),
      n(4, 1, 'c5', false, 2),
    ];
    const chapters = [ch(1, 'Open'), ch(4, 'Sicilian')];
    const { subtree, childChapterStops } = buildSubtreeScope(nodes, chapters, 1);
    expect(subtree.map((s) => s.id).sort()).toEqual([1, 2, 3]);
    expect(childChapterStops).toHaveLength(1);
    expect(childChapterStops[0].chapter.title).toBe('Sicilian');
    expect(childChapterStops[0].attachedTo).toBe(1);
  });
});
