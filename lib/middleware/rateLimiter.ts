import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
	windowMs: number;
	maxRequests: number;
}

// In-memory rate limit store
// Note: For production with multiple instances, consider using Redis (e.g., Upstash)
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

export function createRateLimiter(config: RateLimitConfig) {
	return (request: NextRequest): NextResponse | null => {
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
