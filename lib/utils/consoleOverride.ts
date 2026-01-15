/**
 * Server-Side Console Override Utility
 * 
 * Intercepts all console methods and applies sanitization and filtering.
 * Auto-initializes on module import to ensure it's active before any console usage.
 */

// Import sanitization function from logger
import { sanitizeLogData } from './logger';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

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

// Store original console methods
const originalConsole = {
	log: console.log,
	info: console.info,
	debug: console.debug,
	warn: console.warn,
	error: console.error,
};

/**
 * Sanitize error data, removing stack traces in production
 */
function sanitizeErrorData(data: any): any {
	if (data === null || data === undefined) {
		return data;
	}

	// If it's an Error object, sanitize it
	if (data instanceof Error) {
		const sanitized: any = {
			name: data.name,
			message: sanitizeLogData(data.message),
		};
		
		// Only include stack trace if log level is 'info' or 'debug'
		if (consoleLogLevel === 'info' || consoleLogLevel === 'debug') {
			sanitized.stack = data.stack;
		}
		
		return sanitized;
	}

	// If it's a string that looks like a stack trace, remove it in production
	if (typeof data === 'string' && isProduction) {
		// Remove stack trace patterns
		if (data.includes('at ') && (data.includes('.ts:') || data.includes('.js:'))) {
			return '[Stack trace removed in production]';
		}
	}

	// Use existing sanitization
	return sanitizeLogData(data);
}

/**
 * Sanitize all arguments before logging
 */
function sanitizeArgs(args: any[]): any[] {
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
					result.push(sanitizeErrorData(arg));
				} else if (typeof arg === 'string' && isProduction) {
					if (arg.includes('at ') && (arg.includes('.ts:') || arg.includes('.js:'))) {
						result.push('[Stack trace removed in production]');
					} else {
						result.push(sanitizeLogData(arg));
					}
				} else {
					result.push(sanitizeLogData(arg));
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
 * Initialize console override
 * This function is called automatically when the module is imported
 */
function initializeConsoleOverride(): void {
	// Don't override in test environment
	if (isTest) {
		return;
	}

	// Override console.log - Only if level is 'debug'
	console.log = (...args: any[]) => {
		if (consoleLogLevel !== 'debug') {
			return; // Silently ignore unless debug level
		}
		// Force args to be a true array using spread operator
		const safeArgs = Array.isArray(args) ? [...args] : (args != null ? [args] : []);
		originalConsole.log(...sanitizeArgs(safeArgs));
	};

	// Override console.debug - Only if level is 'debug'
	console.debug = (...args: any[]) => {
		if (consoleLogLevel !== 'debug') {
			return; // Silently ignore unless debug level
		}
		// Force args to be a true array using spread operator
		const safeArgs = Array.isArray(args) ? [...args] : (args != null ? [args] : []);
		originalConsole.debug(...sanitizeArgs(safeArgs));
	};

	// Override console.info - If level is 'info' or 'debug'
	console.info = (...args: any[]) => {
		if (consoleLogLevel !== 'info' && consoleLogLevel !== 'debug') {
			return; // Silently ignore unless info or debug level
		}
		// Force args to be a true array using spread operator
		const safeArgs = Array.isArray(args) ? [...args] : (args != null ? [args] : []);
		originalConsole.info(...sanitizeArgs(safeArgs));
	};

	// Override console.warn - If level is 'info' or 'debug'
	console.warn = (...args: any[]) => {
		if (consoleLogLevel !== 'info' && consoleLogLevel !== 'debug') {
			return; // Silently ignore unless info or debug level
		}
		// Force args to be a true array using spread operator
		const safeArgs = Array.isArray(args) ? [...args] : (args != null ? [args] : []);
		originalConsole.warn(...sanitizeArgs(safeArgs));
	};

	// Override console.error - ALWAYS allow but sanitize
	console.error = (...args: any[]) => {
		// Always log errors, but sanitize them
		// Force args to be a true array using spread operator
		const safeArgs = Array.isArray(args) ? [...args] : (args != null ? [args] : []);
		originalConsole.error(...sanitizeArgs(safeArgs));
	};
}

// Auto-initialize on module import
initializeConsoleOverride();

// Export function for explicit re-initialization if needed
export { initializeConsoleOverride };
