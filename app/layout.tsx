// CRITICAL: Import console override FIRST before any other imports that might use console
import "@/lib/utils/consoleOverride";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { headers } from "next/headers";
import "./globals.css";
import PWAUpdateNotification from "../components/PWAUpdateNotification";
import UmamiAnalytics from "../components/UmamiAnalytics";
import ErrorBoundaryWrapper from "../components/ErrorBoundaryWrapper";
import SessionProvider from "../components/SessionProvider";
import { validateEnv } from "@/lib/config/envValidation";
import { logError } from "@/lib/utils/logger";

// Validate environment variables at app startup
if (process.env.NODE_ENV !== "development") {
	const envResult = validateEnv();
	if (!envResult.success) {
		logError("Environment variable validation failed", new Error(envResult.errors.join(", ")));
		// In production, we should throw to prevent the app from starting with invalid config
		// In development, we just warn to allow for easier local development
		if (process.env.NODE_ENV === "production") {
			throw new Error(`Environment variable validation failed: ${envResult.errors.join(", ")}`);
		}
	}
}

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "Dorkinians FC Stats",
	description: "Dorkinians FC Statistics and Chatbot - Mobile-first PWA",
	manifest: "/manifest.json",
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "Dorkinians Stats",
		startupImage: [
			{
				url: "/apple-touch-startup-image-1290x2796.png",
				media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
			},
			{
				url: "/apple-touch-startup-image-2796x1290.png",
				media: "(device-width: 932px) and (device-height: 430px) and (-webkit-device-pixel-ratio: 3)",
			},
			{
				url: "/apple-touch-startup-image-1170x2532.png",
				media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
			},
			{
				url: "/apple-touch-startup-image-2532x1170.png",
				media: "(device-width: 844px) and (device-height: 390px) and (-webkit-device-pixel-ratio: 3)",
			},
			{
				url: "/apple-touch-startup-image-1242x2208.png",
				media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)",
			},
			{
				url: "/apple-touch-startup-image-2208x1242.png",
				media: "(device-width: 736px) and (device-height: 414px) and (-webkit-device-pixel-ratio: 3)",
			},
		],
	},
	formatDetection: {
		telephone: false,
	},
};

export const viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
	themeColor: "#F9ED32",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	const umamiScriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL;
	const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
	
	// Read nonce from request headers set by middleware
	const headersList = headers();
	const nonce = headersList.get('x-csp-nonce') || '';

	return (
		<html lang='en' nonce={nonce} suppressHydrationWarning>
			<head>
				<meta name='apple-mobile-web-app-capable' content='yes' />
				<meta name='apple-mobile-web-app-status-bar-style' content='default' />
				<meta name='apple-mobile-web-app-title' content='Dorkinians Stats' />
				<meta name='mobile-web-app-capable' content='yes' />
				<link rel='apple-touch-icon' href='/icons/icon-iOS-192x192.png' />
				<link rel='icon' type='image/png' sizes='32x32' href='/icons/icon-32x32.png' />
				<link rel='icon' type='image/png' sizes='16x16' href='/icons/icon-16x16.png' />
				<link rel='icon' type='image/png' sizes='192x192' href='/icons/icon-192x192.png' />
				<link rel='icon' type='image/png' sizes='512x512' href='/icons/icon-512x512.png' />
				<script
					dangerouslySetInnerHTML={{
						__html: `
							(function() {
								if (typeof window === 'undefined') return;
								const isProduction = window.__NEXT_DATA__?.env?.NODE_ENV === 'production';
								const logLevel = window.__NEXT_DATA__?.env?.NEXT_PUBLIC_CONSOLE_LOG_LEVEL;
								const disableLogs = window.__NEXT_DATA__?.env?.NEXT_PUBLIC_DISABLE_CONSOLE_LOGS === 'true';
								
								// Determine effective log level
								let effectiveLevel = 'error';
								if (disableLogs) {
									effectiveLevel = 'error'; // Backward compatibility
								} else if (logLevel === 'error' || logLevel === 'info' || logLevel === 'debug') {
									effectiveLevel = logLevel;
								} else if (isProduction) {
									effectiveLevel = 'error';
								} else {
									effectiveLevel = 'info';
								}
								
								const originalConsole = {
									log: console.log,
									info: console.info,
									debug: console.debug,
									warn: console.warn,
									error: console.error,
								};
								
								function sanitizeString(str) {
									if (typeof str !== 'string') return str;
									return str
										.replace(/api[_-]?key['":\\s]*[=:]\\s*['"]?[\\w-]+['"]?/gi, 'api_key=***')
										.replace(/password['":\\s]*[=:]\\s*['"]?[^'"]+['"]?/gi, 'password=***')
										.replace(/secret['":\\s]*[=:]\\s*['"]?[^'"]+['"]?/gi, 'secret=***')
										.replace(/token['":\\s]*[=:]\\s*['"]?[^'"]+['"]?/gi, 'token=***')
										.replace(/https?:\\/\\/[^\\/]+@[^\\s]+/gi, function(match) {
											return match.replace(/\\/\\/[^\\/]+@/, '//***@');
										})
										.substring(0, 1000);
								}
								
								function sanitizeError(err) {
									if (err instanceof Error) {
										const sanitized = {
											name: err.name,
											message: sanitizeString(err.message),
										};
										// Only include stack trace if log level is 'info' or 'debug'
										if ((effectiveLevel === 'info' || effectiveLevel === 'debug') && err.stack) {
											sanitized.stack = err.stack;
										}
										return sanitized;
									}
									return err;
								}
								
								function sanitizeArgs(args) {
									// Ensure args is always an array - handle all edge cases
									if (args == null) {
										return [];
									}
									// Always create a fresh array to ensure it's a true array
									var argsArray;
									try {
										if (Array.isArray(args)) {
											argsArray = Array.from(args);
										} else if (args && typeof args[Symbol.iterator] === 'function') {
											argsArray = Array.from(args);
										} else {
											argsArray = [args];
										}
									} catch (e) {
										try {
											argsArray = Array.isArray(args) ? [].slice.call(args) : [args];
										} catch (e2) {
											argsArray = [];
										}
									}
									// Use manual loop instead of .map() to avoid any potential issues
									var result = [];
									var length = argsArray != null && typeof argsArray.length === 'number' ? argsArray.length : 0;
									for (var i = 0; i < length; i++) {
										try {
											var arg = argsArray[i];
											if (arg instanceof Error) {
												result.push(sanitizeError(arg));
											} else if (typeof arg === 'string') {
												if (isProduction && arg.includes('at ') && (arg.includes('.ts:') || arg.includes('.js:'))) {
													result.push('[Stack trace removed in production]');
												} else {
													result.push(sanitizeString(arg));
												}
											} else if (typeof arg === 'object' && arg !== null) {
												if (Array.isArray(arg)) {
													// Use manual loop for nested arrays too
													var nestedResult = [];
													var nestedLength = arg != null && typeof arg.length === 'number' ? Math.min(arg.length, 10) : 0;
													for (var j = 0; j < nestedLength; j++) {
														try {
															nestedResult.push(sanitizeArgs([arg[j]])[0]);
														} catch (e) {
															// Skip this item
														}
													}
													result.push(nestedResult);
												} else {
													var sanitized = {};
													var sensitiveKeys = ['password', 'secret', 'apiKey', 'api_key', 'token', 'authorization', 'x-api-key', 'credentials'];
													for (var key in arg) {
														var lowerKey = key.toLowerCase();
														if (sensitiveKeys.some(function(sk) { return lowerKey.includes(sk); })) {
															sanitized[key] = '***';
														} else {
															sanitized[key] = sanitizeArgs([arg[key]])[0];
														}
													}
													result.push(sanitized);
												}
											} else {
												result.push(arg);
											}
										} catch (e) {
											// Skip this arg if sanitization fails
										}
									}
									return result;
								}
								
								console.log = function() {
									if (effectiveLevel !== 'debug') return;
									originalConsole.log.apply(console, sanitizeArgs(Array.from(arguments)));
								};
								
								console.debug = function() {
									if (effectiveLevel !== 'debug') return;
									originalConsole.debug.apply(console, sanitizeArgs(Array.from(arguments)));
								};
								
								console.info = function() {
									if (effectiveLevel !== 'info' && effectiveLevel !== 'debug') return;
									originalConsole.info.apply(console, sanitizeArgs(Array.from(arguments)));
								};
								
								console.warn = function() {
									if (effectiveLevel !== 'info' && effectiveLevel !== 'debug') return;
									originalConsole.warn.apply(console, sanitizeArgs(Array.from(arguments)));
								};
								
								console.error = function() {
									originalConsole.error.apply(console, sanitizeArgs(Array.from(arguments)));
								};
							})();
						`,
					}}
				/>
			</head>
			<body className={inter.className} suppressHydrationWarning={true}>
				<ErrorBoundaryWrapper>
					<SessionProvider>
						{children}
						<PWAUpdateNotification />
						{umamiScriptUrl && umamiWebsiteId && (
							<Script
								async
								defer
								data-website-id={umamiWebsiteId}
								src={umamiScriptUrl}
								strategy='lazyOnload'
								nonce={nonce}
							/>
						)}
						<UmamiAnalytics />
					</SessionProvider>
				</ErrorBoundaryWrapper>
			</body>
		</html>
	);
}
