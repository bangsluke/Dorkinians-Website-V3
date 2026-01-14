/**
 * CSRF Protection Utility
 * 
 * Provides CSRF token generation and validation for state-changing operations
 * Note: For Next.js API routes, CSRF protection may be less critical if using
 * SameSite cookies, but this provides additional defense in depth.
 */

import { NextRequest, NextResponse } from "next/server";

const CSRF_TOKEN_HEADER = "X-CSRF-Token";
const CSRF_TOKEN_COOKIE = "csrf-token";

/**
 * Generate a cryptographically secure CSRF token
 * Uses Web Crypto API (available in Edge Runtime) instead of Node.js crypto
 */
export function generateCsrfToken(): string {
	// Use Web Crypto API for Edge Runtime compatibility
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	// Convert to hex string
	return Array.from(array)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Validate CSRF token from request
 * Uses constant-time comparison to prevent timing attacks
 */
export function validateCsrfToken(request: NextRequest): boolean {
	const tokenHeader = request.headers.get(CSRF_TOKEN_HEADER);
	const tokenCookie = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;

	if (!tokenHeader || !tokenCookie) {
		return false;
	}

	// Constant-time comparison to prevent timing attacks
	if (tokenHeader.length !== tokenCookie.length) {
		return false;
	}

	let result = 0;
	for (let i = 0; i < tokenHeader.length; i++) {
		result |= tokenHeader.charCodeAt(i) ^ tokenCookie.charCodeAt(i);
	}

	return result === 0;
}

/**
 * CSRF protection middleware for state-changing HTTP methods
 * Returns null if request is valid, or a 403 response if CSRF validation fails
 */
export function csrfProtection(request: NextRequest): NextResponse | null {
	// Only protect state-changing methods
	const protectedMethods = ["POST", "PUT", "DELETE", "PATCH"];
	if (!protectedMethods.includes(request.method)) {
		return null; // GET, OPTIONS, etc. don't need CSRF protection
	}

	if (!validateCsrfToken(request)) {
		return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
	}

	return null; // Request is valid
}

/**
 * Get CSRF token from cookie (client-side only)
 */
export function getCsrfToken(): string | null {
	if (typeof document === 'undefined') {
		return null;
	}
	
	const cookies = document.cookie.split(';');
	for (const cookie of cookies) {
		const [name, value] = cookie.trim().split('=');
		if (name === CSRF_TOKEN_COOKIE) {
			return value;
		}
	}
	return null;
}

/**
 * Get headers with CSRF token for fetch requests (client-side only)
 */
export function getCsrfHeaders(): Record<string, string> {
	const token = getCsrfToken();
	if (!token) {
		return {};
	}
	return {
		[CSRF_TOKEN_HEADER]: token,
	};
}
