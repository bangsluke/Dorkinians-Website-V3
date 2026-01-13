/**
 * CSRF Protection Utility
 * 
 * Provides CSRF token generation and validation for state-changing operations
 * Note: For Next.js API routes, CSRF protection may be less critical if using
 * SameSite cookies, but this provides additional defense in depth.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

const CSRF_TOKEN_HEADER = "X-CSRF-Token";
const CSRF_TOKEN_COOKIE = "csrf-token";

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
	return randomBytes(32).toString("hex");
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
