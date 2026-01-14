/**
 * Security Headers Utility
 * 
 * Provides standard security headers for API routes to protect against
 * common web vulnerabilities including clickjacking, XSS, and content type sniffing.
 */

// Script hashes for Next.js inline hydration scripts
// Note: These hashes change with each Next.js build. Consider using 'unsafe-inline' for script-src-elem
// if this becomes unmanageable, since 'strict-dynamic' in script-src already provides security.
const nextJsScriptHashes = [
	"'sha256-Q+8tPsjVtiDsjF/Cv8FMOpg2Yg91oKFKDAJat1PPb2g='",
	"'sha256-jc7XFOHixnFnymQQ1ejhrBa7Kgoniibf34byilvr3CU='",
	"'sha256-Dz9ipypSU+yio3ylyMbKtogFB8410FFouXf7cElQMQI='",
	"'sha256-IQVKO6xMhtjOM5LYMSq+uj+749m8EEOlJfl0KEMWCK8='",
	"'sha256-zC+saEQgolIrsqR7DoCcFPlvxlVEdb5rSPgk+MzQG0k='",
	"'sha256-icOUPQF1lsCsYH1prE9Pwc2LYzrDY0zUXJ0qZ4jevgU='",
	"'sha256-YCY2bf5bcU2HcKPAnxlCMEjOkOA5LiZaS0pExKQrLGY='",
	"'sha256-hgvJd27o01BU2afAw8APHsK434EDy+cwaRYn0JovZtE='",
	"'sha256-5ydHU1LXj1KKDB5Nx74ydjKfvpPQ9Y5YpcPH0Utbl8g='",
	"'sha256-Rq/c7HsTxjYvtu/HTT8rtUj4jf0OyslseDP3JCQmtOI='",
	"'sha256-gYohaCRZkQk6ahFNUMWKE4PjjTiptCPt6sBP18Wkm4k='",
	"'sha256-thPcge7komhZrsDFrKw/ET6++04qLBk3FeqHBYQ7BhQ='",
	"'sha256-R8M6ajq7sD3c6zPybGiHqhSQNZ6dqfxgSTUetOywwKY='",
].join(' ');

// Build base CSP (without nonce) - includes unsafe-eval in development for React Fast Refresh
function buildBaseCSP(nonce?: string): string {
	const isDevelopment = process.env.NODE_ENV === 'development';
	const unsafeEval = isDevelopment ? " 'unsafe-eval'" : '';
	const noncePart = nonce ? ` 'nonce-${nonce}'` : '';
	
	return [
		"default-src 'self'",
		`script-src 'self' 'strict-dynamic'${noncePart}${unsafeEval} ${nextJsScriptHashes} https://fonts.googleapis.com https://*.umami.is`, // strict-dynamic allows scripts loaded by nonce'd scripts
		`script-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.umami.is`, // Allow Next.js chunks from 'self' and inline scripts (nonce cannot be used with unsafe-inline)
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com", // Keep unsafe-inline for styles (Next.js requirement)
		"font-src 'self' https://fonts.gstatic.com data:",
		"img-src 'self' data: https://docs.google.com https://*.googleusercontent.com blob:",
		"connect-src 'self' https://*.herokuapp.com https://*.netlify.app https://*.umami.is https://api-gateway.umami.dev https://*.databases.neo4j.io",
		"frame-src 'self' https://docs.google.com",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		"upgrade-insecure-requests",
	].join('; ');
}

// Base Content Security Policy (without nonce) - use buildBaseCSP() function for runtime evaluation
// Uses 'strict-dynamic' to allow scripts loaded by nonce'd scripts (Next.js compatible)

/**
 * Generate a cryptographically secure CSP nonce
 * Uses Web Crypto API (available in Edge Runtime) instead of Node.js crypto
 */
export function generateCSPNonce(): string {
	// Use Web Crypto API for Edge Runtime compatibility
	const array = new Uint8Array(16);
	crypto.getRandomValues(array);
	// Convert to base64
	return btoa(String.fromCharCode(...array));
}

/**
 * Build Content Security Policy with nonce
 */
function buildCSP(nonce?: string): string {
	return buildBaseCSP(nonce);
}

/**
 * Get base security headers (without CSP - CSP should be added with nonce)
 */
export function getBaseSecurityHeaders(): Record<string, string> {
	return {
		'X-Frame-Options': 'DENY',
		'X-Content-Type-Options': 'nosniff',
		'X-XSS-Protection': '1; mode=block',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
		'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
		'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
	};
}

/**
 * Get security headers with CSP (for API routes where nonce is not needed)
 */
export function getSecurityHeaders(): Record<string, string> {
	return {
		...getBaseSecurityHeaders(),
		'Content-Security-Policy': buildBaseCSP(),
	};
}

// Legacy export for backwards compatibility
export const securityHeaders = getSecurityHeaders();

/**
 * Get CORS headers with security headers included
 * @param allowedOrigin - The allowed origin for CORS (defaults to production URL)
 * @param nonce - Optional CSP nonce for script-src
 * @returns Headers object with CORS and security headers
 */
export function getCorsHeadersWithSecurity(allowedOrigin?: string, nonce?: string): Record<string, string> {
	const csp = buildCSP(nonce);
	return {
		...getBaseSecurityHeaders(),
		'Content-Security-Policy': csp,
		'Access-Control-Allow-Origin': allowedOrigin || process.env.ALLOWED_ORIGIN || 'https://dorkinians-website-v3.netlify.app',
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	};
}
