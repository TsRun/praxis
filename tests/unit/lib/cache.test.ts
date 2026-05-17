import { describe, it, expect } from 'vitest';
import { LRU } from '../../../src/lib/cache';

describe('LRU', () => {
  it('returns set values', () => {
    const c = new LRU<string, number>(3);
    c.set('a', 1);
    expect(c.get('a')).toBe(1);
  });

  it('returns undefined for missing keys', () => {
    const c = new LRU<string, number>(3);
    expect(c.get('missing')).toBeUndefined();
  });

  it('evicts the least recently used entry when at capacity', () => {
    const c = new LRU<string, number>(2);
    c.set('a', 1);
    c.set('b', 2);
    c.get('a'); // 'a' is now most-recently used
    c.set('c', 3); // should evict 'b'
    expect(c.get('a')).toBe(1);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('c')).toBe(3);
  });

  it('refreshes recency on set of existing key', () => {
    const c = new LRU<string, number>(2);
    c.set('a', 1);
    c.set('b', 2);
    c.set('a', 11); // reinsert 'a' → 'b' becomes LRU
    c.set('c', 3); // should evict 'b'
    expect(c.get('a')).toBe(11);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('c')).toBe(3);
  });
});
