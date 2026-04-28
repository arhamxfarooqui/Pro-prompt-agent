/**
 * LRU Cache — O(1) Map-based implementation
 * Uses JavaScript Map's insertion-order guarantee for efficient eviction.
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private readonly maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value === undefined) return undefined;
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) this.cache.delete(key);
    else if (this.cache.size >= this.maxSize) {
      // Evict least recently used (first key in Map)
      const lruKey = this.cache.keys().next().value;
      if (lruKey !== undefined) this.cache.delete(lruKey);
    }
    this.cache.set(key, value);
  }

  delete(key: K): boolean { return this.cache.delete(key); }
  has(key: K): boolean { return this.cache.has(key); }
  clear(): void { this.cache.clear(); }
  get size(): number { return this.cache.size; }
  keys(): IterableIterator<K> { return this.cache.keys(); }
  values(): IterableIterator<V> { return this.cache.values(); }
}
