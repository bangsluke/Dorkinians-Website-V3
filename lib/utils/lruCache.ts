// LRU Cache implementation for efficient caching with size limits
export class LRUCache<K, V> {
	private cache: Map<K, V>;
	private readonly maxSize: number;

	constructor(maxSize: number = 1000) {
		this.maxSize = maxSize;
		this.cache = new Map();
	}

	get(key: K): V | undefined {
		if (!this.cache.has(key)) {
			return undefined;
		}

		// Move to end (most recently used)
		const value = this.cache.get(key)!;
		this.cache.delete(key);
		this.cache.set(key, value);
		return value;
	}

	set(key: K, value: V): void {
		if (this.cache.has(key)) {
			// Update existing: move to end
			this.cache.delete(key);
		} else if (this.cache.size >= this.maxSize) {
			// Remove least recently used (first item)
			const firstKey = this.cache.keys().next().value;
			this.cache.delete(firstKey);
		}

		this.cache.set(key, value);
	}

	has(key: K): boolean {
		return this.cache.has(key);
	}

	delete(key: K): boolean {
		return this.cache.delete(key);
	}

	clear(): void {
		this.cache.clear();
	}

	get size(): number {
		return this.cache.size;
	}

	// Clear entries for keys matching a prefix
	clearByPrefix(prefix: string): void {
		const keysToDelete: K[] = [];
		for (const key of this.cache.keys()) {
			if (typeof key === "string" && key.startsWith(prefix)) {
				keysToDelete.push(key);
			}
		}
		keysToDelete.forEach((key) => this.cache.delete(key));
	}
}

