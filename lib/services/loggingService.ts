/**
 * Centralized Logging Service
 * Provides different log levels for chatbot testing
 */

export enum LogLevel {
	MINIMAL = "minimal",
	DEBUG = "debug",
}

class LoggingService {
	private static instance: LoggingService;
	private logLevel: LogLevel = LogLevel.MINIMAL;

	private constructor() {
		// Check for debug mode from environment variable
		if (process.env.DEBUG_MODE === "true") {
			this.logLevel = LogLevel.DEBUG;
		}
	}

	public static getInstance(): LoggingService {
		if (!LoggingService.instance) {
			LoggingService.instance = new LoggingService();
		}
		return LoggingService.instance;
	}

	public setLogLevel(level: LogLevel): void {
		this.logLevel = level;
	}

	public isDebugMode(): boolean {
		return this.logLevel === LogLevel.DEBUG;
	}

	public log(message: string, data?: any, level: "log" | "warn" | "error" = "log"): void {
		// Always log errors and warnings
		if (level === "error" || level === "warn") {
			this.output(message, data, level);
			return;
		}

		// For regular logs, check if we're in debug mode
		if (this.isDebugMode()) {
			this.output(message, data, level);
		}
	}

	public logMinimal(message: string, data?: any, level: "log" | "warn" | "error" = "log"): void {
		// Always show minimal logs regardless of debug mode
		this.output(message, data, level);
	}

	private output(message: string, data?: any, level: "log" | "warn" | "error" = "log"): void {
		// Server-side logging
		if (level === "log") {
			console.log(message, data);
		} else if (level === "warn") {
			console.warn(message, data);
		} else {
			console.error(message, data);
		}

		// Client-side logging (will show in browser console)
		if (level === "log") {
			console.log(`🤖 [CLIENT] ${message}`, data);
		} else if (level === "warn") {
			console.warn(`🤖 [CLIENT] ${message}`, data);
		} else {
			console.error(`🤖 [CLIENT] ${message}`, data);
		}
	}
}

export const loggingService = LoggingService.getInstance();
