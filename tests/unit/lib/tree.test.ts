import { describe, it, expect } from 'vitest';
import { pruneChildren, findNode, whiteAdvantage } from '../../../src/lib/tree';
import type { TreeNode } from '../../../src/components/tree/treeTypes';

const make = (
  id: string,
  w: number,
  d: number,
  b: number,
  depth = 0,
  children: TreeNode[] = [],
): TreeNode => ({
  id,
  san: id,
  white: w,
  draws: d,
  black: b,
  children,
  expanded: false,
  depth,
});

describe('pruneChildren', () => {
  it('keeps only children whose share >= minShare', () => {
    const parent = make('p', 100, 0, 0);
    parent.children = [make('a', 90, 0, 0, 1), make('b', 5, 0, 0, 1), make('c', 5, 0, 0, 1)];
    const kept = pruneChildren(parent, { minShare: 0.1, maxDepth: 10 });
    expect(kept.map((n) => n.id)).toEqual(['a']);
  });

  it('returns all children when parent has zero plays (no basis for pruning)', () => {
    const parent = make('p', 0, 0, 0);
    parent.children = [make('a', 0, 0, 0, 1), make('b', 0, 0, 0, 1)];
    const kept = pruneChildren(parent, { minShare: 0.1, maxDepth: 10 });
    expect(kept.length).toBe(2);
  });

  it('returns empty when parent depth >= maxDepth', () => {
    const parent = make('p', 100, 0, 0, 10);
    parent.children = [make('a', 100, 0, 0, 11)];
    const kept = pruneChildren(parent, { minShare: 0, maxDepth: 10 });
    expect(kept).toEqual([]);
  });
});

describe('findNode', () => {
  it('finds nested node by id', () => {
    const root = make('root', 0, 0, 0, 0, [
      make('a', 1, 0, 0, 1, [make('a1', 1, 0, 0, 2)]),
      make('b', 1, 0, 0, 1),
    ]);
    expect(findNode(root, 'a1')?.id).toBe('a1');
  });

  it('returns null when not found', () => {
    const root = make('root', 0, 0, 0);
    expect(findNode(root, 'missing')).toBeNull();
  });
});

describe('whiteAdvantage', () => {
  it('returns 0 for zero plays', () => {
    expect(whiteAdvantage(make('x', 0, 0, 0))).toBe(0);
  });

  it('returns positive for white-favored positions', () => {
    expect(whiteAdvantage(make('x', 80, 10, 10))).toBeCloseTo(0.7);
  });

  it('returns negative for black-favored positions', () => {
    expect(whiteAdvantage(make('x', 10, 10, 80))).toBeCloseTo(-0.7);
  });
});
