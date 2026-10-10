import type { Redis } from "@upstash/redis";

let redis: Redis | null | undefined;

/**
 * Shared Upstash Redis client for cross-instance caching.
 * Returns null when env is missing or init fails (callers must fail open).
 */
export function getRedisClient(): Redis | null {
	if (redis !== undefined) {
		return redis;
	}

	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;
	if (!url || !token) {
		redis = null;
		return redis;
	}

	try {
		const { Redis: RedisCtor } = require("@upstash/redis") as typeof import("@upstash/redis");
		redis = new RedisCtor({ url, token });
		return redis;
	} catch {
		redis = null;
		return redis;
	}
}

/** Test helper — reset memoized client between cases. */
export function resetRedisClientForTests(): void {
	redis = undefined;
}
