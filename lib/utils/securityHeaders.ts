/**
 * Security Headers Utility
 * 
 * Provides standard security headers for API routes to protect against
 * common web vulnerabilities including clickjacking, XSS, and content type sniffing.
 */

export const securityHeaders = {
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'X-XSS-Protection': '1; mode=block',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Content-Security-Policy': "default-src 'self'",
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
