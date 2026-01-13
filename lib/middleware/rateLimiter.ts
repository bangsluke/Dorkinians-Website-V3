import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
	windowMs: number;
	maxRequests: number;
}

// Redis-based rate limiting (Upstash) for production
// Falls back to in-memory for development if Redis is not configured
let redisRateLimiter: any = null;
let useRedis = false;

// Initialize Redis rate limiter if configured
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
	try {
		// Dynamic import to avoid requiring Redis in development
		const { Ratelimit } = require("@upstash/ratelimit");
		const { Redis } = require("@upstash/redis");

		const redis = new Redis({
			url: process.env.UPSTASH_REDIS_REST_URL,
			token: process.env.UPSTASH_REDIS_REST_TOKEN,
		});

		useRedis = true;
		console.log("✅ Rate limiting: Using Redis (Upstash)");
	} catch (error) {
		console.warn("⚠️ Rate limiting: Redis not available, falling back to in-memory", error);
		useRedis = false;
	}
} else {
	console.warn("⚠️ Rate limiting: Redis not configured, using in-memory (not suitable for production with multiple instances)");
}

// In-memory rate limit store (fallback for development)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Cleanup old entries periodically to prevent memory leaks
setInterval(() => {
	const now = Date.now();
	for (const [ip, data] of rateLimitStore.entries()) {
		if (now > data.resetTime) {
			rateLimitStore.delete(ip);
		}
	}
}, 60 * 1000); // Cleanup every minute

// In-memory rate limiter (fallback)
function createInMemoryRateLimiter(config: RateLimitConfig) {
	return async (request: NextRequest): Promise<NextResponse | null> => {
		const forwarded = request.headers.get("x-forwarded-for");
		const ip = forwarded ? forwarded.split(",")[0].trim() : request.ip || "unknown";
		const now = Date.now();

		const userLimit = rateLimitStore.get(ip);

		if (!userLimit || now > userLimit.resetTime) {
			rateLimitStore.set(ip, {
				count: 1,
				resetTime: now + config.windowMs,
			});
			return null; // Allow request
		}

		if (userLimit.count >= config.maxRequests) {
			const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
			return NextResponse.json(
				{ error: "Too many requests. Please try again later." },
				{
					status: 429,
					headers: {
						"Retry-After": String(retryAfter),
						"X-RateLimit-Limit": String(config.maxRequests),
						"X-RateLimit-Remaining": "0",
						"X-RateLimit-Reset": String(userLimit.resetTime),
					},
				},
			);
		}

		userLimit.count++;
		return null; // Allow request
	};
}

// Redis-based rate limiter (production)
function createRedisRateLimiter(config: RateLimitConfig) {
	const { Ratelimit } = require("@upstash/ratelimit");
	const { Redis } = require("@upstash/redis");

	const redis = new Redis({
		url: process.env.UPSTASH_REDIS_REST_URL!,
		token: process.env.UPSTASH_REDIS_REST_TOKEN!,
	});

	const ratelimit = new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(config.maxRequests, `${config.windowMs}ms`),
		analytics: true,
	});

	return async (request: NextRequest): Promise<NextResponse | null> => {
		const forwarded = request.headers.get("x-forwarded-for");
		const ip = forwarded ? forwarded.split(",")[0].trim() : request.ip || "unknown";

		try {
			const { success, limit, remaining, reset } = await ratelimit.limit(ip);

			if (!success) {
				const retryAfter = Math.ceil((reset - Date.now()) / 1000);
				return NextResponse.json(
					{ error: "Too many requests. Please try again later." },
					{
						status: 429,
						headers: {
							"Retry-After": String(retryAfter),
							"X-RateLimit-Limit": String(limit),
							"X-RateLimit-Remaining": String(remaining),
							"X-RateLimit-Reset": String(reset),
						},
					},
				);
			}

			return null; // Allow request
		} catch (error) {
			// If Redis fails, log error but allow request (fail open)
			console.error("Rate limiting error (allowing request):", error);
			return null;
		}
	};
}

export function createRateLimiter(config: RateLimitConfig) {
	if (useRedis) {
		return createRedisRateLimiter(config);
	}
	return createInMemoryRateLimiter(config);
}

// Pre-configured limiters for different endpoint types
export const chatbotRateLimiter = createRateLimiter({
	windowMs: 60 * 1000, // 1 minute
	maxRequests: 20, // 20 requests per minute
});

export const dataApiRateLimiter = createRateLimiter({
	windowMs: 60 * 1000, // 1 minute
	maxRequests: 60, // 60 requests per minute
});

export const seedApiRateLimiter = createRateLimiter({
	windowMs: 60 * 1000, // 1 minute
	maxRequests: 5, // 5 requests per minute (strict)
});
