/**
 * Security Headers Utility
 * 
 * Provides standard security headers for API routes to protect against
 * common web vulnerabilities including clickjacking, XSS, and content type sniffing.
 */

import { randomBytes } from "crypto";

// Base Content Security Policy (without nonce)
// Uses 'strict-dynamic' to allow scripts loaded by nonce'd scripts (Next.js compatible)
const baseContentSecurityPolicy = [
	"default-src 'self'",
	"script-src 'self' 'strict-dynamic' https://fonts.googleapis.com https://*.umami.is", // strict-dynamic allows scripts loaded by nonce'd scripts
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com", // Keep unsafe-inline for styles (Next.js requirement)
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

/**
 * Generate a cryptographically secure CSP nonce
 */
export function generateCSPNonce(): string {
	return randomBytes(16).toString('base64');
}

/**
 * Build Content Security Policy with nonce
 */
function buildCSP(nonce?: string): string {
	if (nonce) {
		// Add nonce to script-src
		return baseContentSecurityPolicy.replace(
			"script-src 'self' 'strict-dynamic'",
			`script-src 'self' 'strict-dynamic' 'nonce-${nonce}'`
		);
	}
	return baseContentSecurityPolicy;
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
export const securityHeaders = {
	...getBaseSecurityHeaders(),
	'Content-Security-Policy': baseContentSecurityPolicy,
};

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
