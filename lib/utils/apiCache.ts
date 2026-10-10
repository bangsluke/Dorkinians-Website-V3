import { getRedisClient } from "@/lib/utils/redisClient";

// In-memory API response cache with TTL support (+ optional Upstash L2)
interface CachedResponse<T> {
	data: T;
	timestamp: number;
	ttl: number;
}

const REDIS_KEY_PREFIX = "apiCache:v1:";

/**
 * Upstash may return: bare payload, legacy {data,timestamp,ttl} envelope, or a JSON string.
 */
export function normalizeRedisCacheValue<T>(remote: unknown): T | null {
	let value: unknown = remote;
	if (typeof remote === "string") {
		try {
			value = JSON.parse(remote) as unknown;
		} catch {
			return null;
		}
	}
	if (value === null || value === undefined) {
		return null;
	}
	if (typeof value === "object" && value !== null && "data" in value && "timestamp" in value && "ttl" in value) {
		const env = value as CachedResponse<T>;
		if (typeof env.timestamp !== "number" || typeof env.ttl !== "number") {
			return null;
		}
		if (Date.now() - env.timestamp > env.ttl) {
			return null;
		}
		return env.data;
	}
	return value as T;
}

class APICache {
	private cache: Map<string, CachedResponse<unknown>>;
	private readonly defaultTTL: number;

	constructor(defaultTTL: number = 5 * 60 * 1000) {
		// 5 minutes default TTL
		this.cache = new Map();
		this.defaultTTL = defaultTTL;
	}

	// Generate cache key from endpoint and params
	generateKey(endpoint: string, params?: Record<string, unknown>): string {
		const paramsStr = params ? JSON.stringify(params) : "";
		return `${endpoint}:${paramsStr}`;
	}

	// Get cached response if not expired (in-process only)
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

	// Set cache with optional custom TTL (in-process only)
	set<T>(key: string, data: T, ttl?: number): void {
		this.cache.set(key, {
			data,
			timestamp: Date.now(),
			ttl: ttl || this.defaultTTL,
		});
	}

	/**
	 * L1 memory then L2 Upstash. Fail-open if Redis is unavailable.
	 */
	async getAsync<T>(key: string): Promise<T | null> {
		const local = this.get<T>(key);
		if (local !== null) {
			return local;
		}

		const redis = getRedisClient();
		if (!redis) {
			return null;
		}

		try {
			const remote = await redis.get(REDIS_KEY_PREFIX + key);
			const data = normalizeRedisCacheValue<T>(remote);
			if (data === null) {
				return null;
			}
			// L1 uses configured default; Redis EX is the cross-instance expiry source of truth
			this.set(key, data, this.defaultTTL);
			return data;
		} catch {
			return null;
		}
	}

	/**
	 * Write L1 + L2. Stores bare payload in Redis (EX = TTL). Fail-open if Redis is unavailable.
	 */
	async setAsync<T>(key: string, data: T, ttl?: number): Promise<void> {
		const resolvedTtl = ttl || this.defaultTTL;
		this.set(key, data, resolvedTtl);

		const redis = getRedisClient();
		if (!redis) {
			return;
		}

		const exSeconds = Math.max(1, Math.ceil(resolvedTtl / 1000));
		try {
			// Bare payload — avoids envelope parse failures; large lists (e.g. players) serialize cleanly
			await redis.set(REDIS_KEY_PREFIX + key, data, { ex: exSeconds });
		} catch {
			// fail open — memory cache still holds the value
		}
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
	"/api/teams": 60 * 60 * 1000, // 1 hour
	"/api/opposition": 60 * 60 * 1000, // 1 hour
	"/api/opposition-clubs": 60 * 60 * 1000, // 1 hour
	"/api/competitions": 60 * 60 * 1000, // 1 hour
	"/api/seasons": 60 * 60 * 1000, // 1 hour
	"/api/league-tables": 5 * 60 * 1000, // 5 minutes (current season can move)
	"/api/filter-bootstrap": 5 * 60 * 1000, // 5 minutes
	"/api/league-latest-results": 5 * 60 * 1000, // 5 minutes
	"/api/player-stats-bootstrap": 5 * 60 * 1000, // 5 minutes
	"/api/captains/data": 60 * 60 * 1000, // 1 hour (season roster changes rarely)
	"/api/club-badge-leaderboard": 60 * 60 * 1000, // 1 hour

	// Dynamic data - shorter TTL
	"/api/player-seasonal-stats": 5 * 60 * 1000, // 5 minutes
	"/api/player-team-stats": 5 * 60 * 1000, // 5 minutes
	"/api/player-monthly-stats": 5 * 60 * 1000, // 5 minutes
	"/api/player-fantasy-breakdown": 5 * 60 * 1000, // 5 minutes
	"/api/totw/week-data": 60 * 60 * 1000, // 1 hour
	"/api/totw/current-week": 60 * 60 * 1000, // 1 hour
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
