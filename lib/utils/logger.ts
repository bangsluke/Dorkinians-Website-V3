/**
 * Production-Safe Logging Utility
 * 
 * Provides secure logging that sanitizes sensitive data and respects environment settings.
 * Prevents information disclosure in production logs.
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Get console log level from environment variable
// Defaults: development -> 'info', production -> 'error'
// Backward compatibility: DISABLE_CONSOLE_LOGS=true -> 'error'
const getConsoleLogLevel = (): 'error' | 'info' | 'debug' => {
	const disableConsoleLogs = process.env.DISABLE_CONSOLE_LOGS === 'true';
	if (disableConsoleLogs) {
		return 'error'; // Backward compatibility
	}
	
	const level = process.env.CONSOLE_LOG_LEVEL;
	if (level === 'error' || level === 'info' || level === 'debug') {
		return level;
	}
	
	// Default behavior
	if (isProduction) {
		return 'error';
	}
	return 'info';
};

const consoleLogLevel = getConsoleLogLevel();

/**
 * Sanitize sensitive data from log output
 */
export function sanitizeLogData(data: any): any {
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
			// Always create a fresh array
			let safeArray: any[];
			try {
				safeArray = Array.from(data);
			} catch {
				safeArray = [];
			}
			// Use manual loop instead of .map() to avoid any potential issues
			const result: any[] = [];
			const length = safeArray != null && typeof safeArray.length === 'number' ? Math.min(safeArray.length, 10) : 0;
			for (let i = 0; i < length; i++) {
				try {
					result.push(sanitizeLogData(safeArray[i]));
				} catch {
					// Skip this item if sanitization fails
				}
			}
			return result;
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
	// Check log level permissions
	// error: Always allowed
	// warn: Allowed if level is 'info' or 'debug'
	// info: Allowed if level is 'info' or 'debug'
	// debug: Allowed only if level is 'debug'
	
	if (level === 'error') {
		// Always allow errors
	} else if (level === 'warn') {
		// Allow if level is 'info' or 'debug'
		if (consoleLogLevel !== 'info' && consoleLogLevel !== 'debug') {
			return;
		}
	} else if (level === 'info') {
		// Allow if level is 'info' or 'debug'
		if (consoleLogLevel !== 'info' && consoleLogLevel !== 'debug') {
			return;
		}
	} else if (level === 'debug') {
		// Only allow if level is 'debug'
		if (consoleLogLevel !== 'debug') {
			return;
		}
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
			console.log(`[DEBUG ${new Date().toISOString()}] ${message}`, sanitized);
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
			// Only include stack traces if log level is 'info' or 'debug'
			stack: (consoleLogLevel === 'info' || consoleLogLevel === 'debug') ? error.stack : undefined,
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
