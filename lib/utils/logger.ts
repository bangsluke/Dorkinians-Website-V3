/**
 * Production-Safe Logging Utility
 * 
 * Provides secure logging that sanitizes sensitive data and respects environment settings.
 * Prevents information disclosure in production logs.
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Sanitize sensitive data from log output
 */
function sanitizeLogData(data: any): any {
	if (data === null || data === undefined) {
		return data;
	}

	if (typeof data === 'string') {
		// Remove potential API keys, passwords, and sensitive URLs
		return data
			.replace(/api[_-]?key['":\s]*[=:]\s*['"]?[\w-]+['"]?/gi, 'api_key=***')
			.replace(/password['":\s]*[=:]\s*['"]?[^'"]+['"]?/gi, 'password=***')
			.replace(/secret['":\s]*[=:]\s*['"]?[^'"]+['"]?/gi, 'secret=***')
			.replace(/token['":\s]*[=:]\s*['"]?[^'"]+['"]?/gi, 'token=***')
			.replace(/https?:\/\/[^\/]+@[^\s]+/gi, (match) => {
				// Remove credentials from URLs
				return match.replace(/\/\/[^\/]+@/, '//***@');
			})
			.substring(0, 1000); // Limit string length
	}

	if (typeof data === 'object') {
		if (Array.isArray(data)) {
			return data.map(sanitizeLogData).slice(0, 10); // Limit array size
		}

		// Create sanitized copy of object
		const sanitized: Record<string, any> = {};
		const sensitiveKeys = ['password', 'secret', 'apiKey', 'api_key', 'token', 'authorization', 'x-api-key', 'credentials'];
		
		for (const [key, value] of Object.entries(data)) {
			const lowerKey = key.toLowerCase();
			if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
				sanitized[key] = '***';
			} else if (typeof value === 'string' && value.length > 500) {
				// Truncate long strings
				sanitized[key] = value.substring(0, 500) + '... (truncated)';
			} else {
				sanitized[key] = sanitizeLogData(value);
			}
		}
		return sanitized;
	}

	return data;
}

/**
 * Sanitize database queries - remove parameters that might contain sensitive data
 */
function sanitizeQuery(query: string): string {
	if (!query || typeof query !== 'string') return query;
	
	// Limit query length
	if (query.length > 500) {
		return query.substring(0, 500) + '... (truncated)';
	}
	
	return query;
}

/**
 * Production-safe logging function
 */
export function log(level: LogLevel, message: string, data?: any): void {
	// Never log debug in production
	if (isProduction && level === 'debug') {
		return;
	}

	// In production, only log errors and warnings
	if (isProduction && level === 'info') {
		return;
	}

	const sanitized = data ? sanitizeLogData(data) : undefined;
	
	switch (level) {
		case 'error':
			console.error(`[${new Date().toISOString()}] ${message}`, sanitized);
			break;
		case 'warn':
			console.warn(`[${new Date().toISOString()}] ${message}`, sanitized);
			break;
		case 'info':
			console.log(`[${new Date().toISOString()}] ${message}`, sanitized);
			break;
		case 'debug':
			if (isDevelopment) {
				console.log(`[DEBUG ${new Date().toISOString()}] ${message}`, sanitized);
			}
			break;
	}
}

/**
 * Log error with sanitization
 */
export function logError(message: string, error: unknown): void {
	if (error instanceof Error) {
		log('error', message, {
			name: error.name,
			message: error.message,
			// Don't log stack traces in production
			stack: isDevelopment ? error.stack : undefined,
		});
	} else {
		log('error', message, sanitizeLogData(error));
	}
}

/**
 * Log database query (sanitized)
 */
export function logQuery(message: string, query: string, params?: any): void {
	if (isProduction) {
		// In production, only log that a query was executed, not the details
		log('info', message);
		return;
	}

	log('debug', message, {
		query: sanitizeQuery(query),
		params: params ? sanitizeLogData(params) : undefined,
	});
}

/**
 * Log API request (sanitized)
 */
export function logRequest(message: string, requestData?: any): void {
	if (isProduction) {
		// In production, only log minimal info
		log('info', message);
		return;
	}

	log('debug', message, requestData ? sanitizeLogData(requestData) : undefined);
}
