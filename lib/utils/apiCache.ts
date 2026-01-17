// In-memory API response cache with TTL support
interface CachedResponse<T> {
	data: T;
	timestamp: number;
	ttl: number;
}

class APICache {
	private cache: Map<string, CachedResponse<any>>;
	private readonly defaultTTL: number;

	constructor(defaultTTL: number = 5 * 60 * 1000) {
		// 5 minutes default TTL
		this.cache = new Map();
		this.defaultTTL = defaultTTL;
	}

	// Generate cache key from endpoint and params
	generateKey(endpoint: string, params?: Record<string, any>): string {
		const paramsStr = params ? JSON.stringify(params) : "";
		return `${endpoint}:${paramsStr}`;
	}

	// Get cached response if not expired
	get<T>(key: string): T | null {
		const cached = this.cache.get(key);
		if (!cached) return null;

		// Check if expired
		if (Date.now() - cached.timestamp > cached.ttl) {
			this.cache.delete(key);
			return null;
		}

		return cached.data as T;
	}

	// Set cache with optional custom TTL
	set<T>(key: string, data: T, ttl?: number): void {
		this.cache.set(key, {
			data,
			timestamp: Date.now(),
			ttl: ttl || this.defaultTTL,
		});
	}

	// Clear expired entries (should be called periodically)
	clearExpired(): void {
		const now = Date.now();
		for (const [key, cached] of this.cache.entries()) {
			if (now - cached.timestamp > cached.ttl) {
				this.cache.delete(key);
			}
		}
	}

	// Clear all cache
	clear(): void {
		this.cache.clear();
	}

	// Get cache size
	get size(): number {
		return this.cache.size;
	}
}

// Export singleton instance
export const apiCache = new APICache();

// Cache TTLs by endpoint pattern
export const CACHE_TTLS: Record<string, number> = {
	// Static data - long TTL
	"/api/totw/seasons": 24 * 60 * 60 * 1000, // 24 hours
	"/api/totw/weeks": 60 * 60 * 1000, // 1 hour
	"/api/club-achievements": 24 * 60 * 60 * 1000, // 24 hours
	"/api/milestones": 60 * 60 * 1000, // 1 hour
	"/api/players": 60 * 60 * 1000, // 1 hour
	
	// Dynamic data - shorter TTL
	"/api/player-seasonal-stats": 5 * 60 * 1000, // 5 minutes
	"/api/player-team-stats": 5 * 60 * 1000, // 5 minutes
	"/api/player-monthly-stats": 5 * 60 * 1000, // 5 minutes
	"/api/player-fantasy-breakdown": 5 * 60 * 1000, // 5 minutes
	"/api/totw/week-data": 60 * 60 * 1000, // 1 hour
};

// Get TTL for endpoint
export function getCacheTTL(endpoint: string): number {
	// Check exact match first
	if (CACHE_TTLS[endpoint]) {
		return CACHE_TTLS[endpoint];
	}
	
	// Check pattern matches
	for (const [pattern, ttl] of Object.entries(CACHE_TTLS)) {
		if (endpoint.startsWith(pattern)) {
			return ttl;
		}
	}
	
	// Default TTL
	return 5 * 60 * 1000; // 5 minutes
}
