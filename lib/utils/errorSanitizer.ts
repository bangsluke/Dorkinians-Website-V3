/**
 * Error Sanitization Utility
 * 
 * Prevents information disclosure by sanitizing error messages
 * based on environment (production vs development)
 */

import { logError } from './logger';

export function sanitizeError(error: unknown, isProduction: boolean): {
	message: string;
	details?: string;
} {
	if (isProduction) {
		// In production, never expose error details
		if (error instanceof Error) {
			// Log full error server-side but return generic message
			logError("Error details (server-side only)", error);
			
			// Return generic user-friendly message
			return {
				message: "An error occurred processing your request. Please try again later.",
			};
		}
		return {
			message: "An error occurred processing your request. Please try again later.",
		};
	}
	
	// Development: show full error details
	if (error instanceof Error) {
		return {
			message: error.message,
			details: error.stack,
		};
	}
	
	return {
		message: String(error),
	};
}

/**
 * Sensitive patterns that should not appear in error responses
 */
const SENSITIVE_PATTERNS = [
	/password/i,
	/secret/i,
	/api[_-]?key/i,
	/token/i,
	/credential/i,
	/neo4j/i,
	/database/i,
	/connection/i,
	/\.env/i,
	/\/app\//i,
	/\/home\//i,
	/file:\/\//i,
	/uri/i,
	/url/i,
];

/**
 * Validate error response to ensure no sensitive data leaks
 * Returns true if response is safe, false if sensitive data detected
 */
export function validateErrorResponse(response: any): boolean {
	try {
		const responseStr = JSON.stringify(response).toLowerCase();
		return !SENSITIVE_PATTERNS.some(pattern => pattern.test(responseStr));
	} catch {
		// If stringification fails, assume unsafe
		return false;
	}
}
