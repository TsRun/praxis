export class LRU<K, V> {
  private m = new Map<K, V>();
  constructor(private capacity: number) {}

  get(k: K): V | undefined {
    if (!this.m.has(k)) return undefined;
    const v = this.m.get(k)!;
    this.m.delete(k);
    this.m.set(k, v);
    return v;
  }

  set(k: K, v: V): void {
    if (this.m.has(k)) this.m.delete(k);
    else if (this.m.size >= this.capacity) {
      const first = this.m.keys().next().value as K;
      this.m.delete(first);
    }
    this.m.set(k, v);
  }

  clear(): void {
    this.m.clear();
  }

  get size(): number {
    return this.m.size;
  }
}
