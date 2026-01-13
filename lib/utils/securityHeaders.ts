/**
 * Security Headers Utility
 * 
 * Provides standard security headers for API routes to protect against
 * common web vulnerabilities including clickjacking, XSS, and content type sniffing.
 */

// Comprehensive Content Security Policy
// Allows necessary external resources while maintaining security
const contentSecurityPolicy = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://*.umami.is", // unsafe-inline/eval needed for Next.js
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
	"font-src 'self' https://fonts.gstatic.com data:",
	"img-src 'self' data: https://docs.google.com https://*.googleusercontent.com blob:",
	"connect-src 'self' https://*.herokuapp.com https://*.netlify.app https://*.umami.is https://*.databases.neo4j.io",
	"frame-src 'self' https://docs.google.com",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'none'",
	"upgrade-insecure-requests",
].join('; ');

export const securityHeaders = {
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'X-XSS-Protection': '1; mode=block',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Content-Security-Policy': contentSecurityPolicy,
	'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
};

/**
 * Get CORS headers with security headers included
 * @param allowedOrigin - The allowed origin for CORS (defaults to production URL)
 * @returns Headers object with CORS and security headers
 */
export function getCorsHeadersWithSecurity(allowedOrigin?: string): Record<string, string> {
	return {
		...securityHeaders,
		'Access-Control-Allow-Origin': allowedOrigin || process.env.ALLOWED_ORIGIN || 'https://dorkinians-website-v3.netlify.app',
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	};
}
