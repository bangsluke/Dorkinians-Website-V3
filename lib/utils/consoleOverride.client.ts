/**
 * Client-Side Console Override Utility
 * 
 * Browser-side console override that must be initialized via inline script
 * before React hydration. This file provides the initialization function.
 */

/**
 * Sanitize sensitive data from log output (client-side version)
 */
function sanitizeLogDataClient(data: any): any {
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
					result.push(sanitizeLogDataClient(safeArray[i]));
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
				sanitized[key] = sanitizeLogDataClient(value);
			}
		}
		return sanitized;
	}

	return data;
}

/**
 * Sanitize error data, removing stack traces in production
 */
function sanitizeErrorDataClient(data: any): any {
	if (data === null || data === undefined) {
		return data;
	}

	// If it's an Error object, sanitize it
	if (data instanceof Error) {
		const logLevel = typeof window !== 'undefined' && 
			(window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_CONSOLE_LOG_LEVEL;
		const isProduction = typeof window !== 'undefined' && 
			(window as any).__NEXT_DATA__?.env?.NODE_ENV === 'production';
		
		// Determine effective log level
		let effectiveLevel: 'error' | 'info' | 'debug' = 'error';
		if (logLevel === 'error' || logLevel === 'info' || logLevel === 'debug') {
			effectiveLevel = logLevel;
		} else if (isProduction) {
			effectiveLevel = 'error';
		} else {
			effectiveLevel = 'info';
		}

		const sanitized: any = {
			name: data.name,
			message: sanitizeLogDataClient(data.message),
		};
		
		// Only include stack trace if log level is 'info' or 'debug'
		if (effectiveLevel === 'info' || effectiveLevel === 'debug') {
			sanitized.stack = data.stack;
		}
		
		return sanitized;
	}

	// If it's a string that looks like a stack trace, remove it in production
	if (typeof data === 'string') {
		const isProduction = typeof window !== 'undefined' && 
			(window as any).__NEXT_DATA__?.env?.NODE_ENV === 'production';
		if (isProduction && data.includes('at ') && (data.includes('.ts:') || data.includes('.js:'))) {
			return '[Stack trace removed in production]';
		}
	}

	return sanitizeLogDataClient(data);
}

/**
 * Sanitize all arguments before logging
 */
function sanitizeArgsClient(args: any[]): any[] {
	// Ensure args is always an array - handle all edge cases
	// Convert array-like objects to true arrays, handle null/undefined
	try {
		if (args == null) {
			return [];
		}
		
		// ALWAYS create a fresh array - never trust the input, even if it's already an array
		// This ensures we have a true array with all methods intact
		let argsArray: any[];
		try {
			// Try to create a fresh array using Array.from (works for arrays and iterables)
			if (Array.isArray(args)) {
				argsArray = Array.from(args);
			} else if (args && typeof args[Symbol.iterator] === 'function') {
				argsArray = Array.from(args);
			} else {
				argsArray = [args];
			}
		} catch {
			// If Array.from fails, try spread operator
			try {
				argsArray = Array.isArray(args) ? [...args] : [args];
			} catch {
				argsArray = [];
			}
		}
		
		// Verify we have a true array with .map() method
		if (!Array.isArray(argsArray) || typeof argsArray.map !== 'function') {
			// Last resort: create empty array
			return [];
		}
		
		// Use manual loop instead of .map() to avoid any potential issues
		// This is more defensive and doesn't rely on .map() existing
		const result: any[] = [];
		const length = argsArray != null && typeof argsArray.length === 'number' ? argsArray.length : 0;
		for (let i = 0; i < length; i++) {
			try {
				const arg = argsArray[i];
				if (arg instanceof Error) {
					result.push(sanitizeErrorDataClient(arg));
				} else if (typeof arg === 'string') {
					const isProduction = typeof window !== 'undefined' && 
						(window as any).__NEXT_DATA__?.env?.NODE_ENV === 'production';
					if (isProduction && arg.includes('at ') && (arg.includes('.ts:') || arg.includes('.js:'))) {
						result.push('[Stack trace removed in production]');
					} else {
						result.push(sanitizeLogDataClient(arg));
					}
				} else {
					result.push(sanitizeLogDataClient(arg));
				}
			} catch {
				// Skip this arg if sanitization fails
			}
		}
		return result;
	} catch (error) {
		// Fallback: if anything goes wrong, return empty array to prevent crashes
		return [];
	}
}

/**
 * Initialize client-side console override
 * This function is called from an inline script in the HTML head
 */
export function initializeClientConsoleOverride(): void {
	if (typeof window === 'undefined') {
		return; // Server-side, do nothing
	}

	// Get console log level from environment
	const logLevel = (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_CONSOLE_LOG_LEVEL;
	const isProduction = (window as any).__NEXT_DATA__?.env?.NODE_ENV === 'production';
	
	// Determine effective log level
	// Backward compatibility: Check for DISABLE_CONSOLE_LOGS
	const disableLogs = (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_DISABLE_CONSOLE_LOGS === 'true';
	let effectiveLevel: 'error' | 'info' | 'debug' = 'error';
	
	if (disableLogs) {
		effectiveLevel = 'error'; // Backward compatibility
	} else if (logLevel === 'error' || logLevel === 'info' || logLevel === 'debug') {
		effectiveLevel = logLevel;
	} else if (isProduction) {
		effectiveLevel = 'error';
	} else {
		effectiveLevel = 'info';
	}

	// Store original console methods
	const originalConsole = {
		log: console.log,
		info: console.info,
		debug: console.debug,
		warn: console.warn,
		error: console.error,
	};

	// Override console.log - Only if level is 'debug'
	console.log = (...args: any[]) => {
		if (effectiveLevel !== 'debug') {
			return; // Silently ignore unless debug level
		}
		// Force args to be a true array using spread operator
		const safeArgs = Array.isArray(args) ? [...args] : (args != null ? [args] : []);
		originalConsole.log(...sanitizeArgsClient(safeArgs));
	};

	// Override console.debug - Only if level is 'debug'
	console.debug = (...args: any[]) => {
		if (effectiveLevel !== 'debug') {
			return; // Silently ignore unless debug level
		}
		// Force args to be a true array using spread operator
		const safeArgs = Array.isArray(args) ? [...args] : (args != null ? [args] : []);
		originalConsole.debug(...sanitizeArgsClient(safeArgs));
	};

	// Override console.info - If level is 'info' or 'debug'
	console.info = (...args: any[]) => {
		if (effectiveLevel !== 'info' && effectiveLevel !== 'debug') {
			return; // Silently ignore unless info or debug level
		}
		// Force args to be a true array using spread operator
		const safeArgs = Array.isArray(args) ? [...args] : (args != null ? [args] : []);
		originalConsole.info(...sanitizeArgsClient(safeArgs));
	};

	// Override console.warn - If level is 'info' or 'debug'
	console.warn = (...args: any[]) => {
		if (effectiveLevel !== 'info' && effectiveLevel !== 'debug') {
			return; // Silently ignore unless info or debug level
		}
		// Force args to be a true array using spread operator
		const safeArgs = Array.isArray(args) ? [...args] : (args != null ? [args] : []);
		originalConsole.warn(...sanitizeArgsClient(safeArgs));
	};

	// Override console.error - ALWAYS allow but sanitize
	console.error = (...args: any[]) => {
		// Always log errors, but sanitize them
		// Force args to be a true array using spread operator
		const safeArgs = Array.isArray(args) ? [...args] : (args != null ? [args] : []);
		originalConsole.error(...sanitizeArgsClient(safeArgs));
	};
}
