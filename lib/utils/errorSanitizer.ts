/**
 * Error Sanitization Utility
 * 
 * Prevents information disclosure by sanitizing error messages
 * based on environment (production vs development)
 */

export function sanitizeError(error: unknown, isProduction: boolean): {
	message: string;
	code?: string;
} {
	if (isProduction) {
		// Generic error messages in production
		if (error instanceof Error) {
			// Map known errors to safe messages
			if (error.message.includes("Neo4j") || error.message.includes("database")) {
				return { message: "Database operation failed. Please try again later." };
			}
			if (error.message.includes("timeout")) {
				return { message: "Request timed out. Please try again." };
			}
			if (error.message.includes("connection")) {
				return { message: "Connection error. Please try again later." };
			}
			if (error.message.includes("validation") || error.message.includes("invalid")) {
				return { message: "Invalid request. Please check your input." };
			}
		}
		return { message: "An error occurred. Please try again later." };
	}

	// Development: show actual errors for debugging
	return {
		message: error instanceof Error ? error.message : String(error),
		code: error instanceof Error && "code" in error ? String(error.code) : undefined,
	};
}
