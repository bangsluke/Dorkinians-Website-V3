import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateCSPNonce, getBaseSecurityHeaders } from "@/lib/utils/securityHeaders";
import { generateCsrfToken } from "@/lib/middleware/csrf";

export function middleware(request: NextRequest) {
	// Skip middleware for WebSocket upgrade requests (Next.js HMR)
	// This prevents errors when Next.js DevServer handles upgrade requests
	if (request.headers.get('upgrade') === 'websocket') {
		return NextResponse.next();
	}
	
	// Protect /admin route - require authentication
	if (request.nextUrl.pathname.startsWith("/admin")) {
		const sessionToken = request.cookies.get(
			process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token"
		);

		if (!sessionToken) {
			// Redirect to sign-in page
			const signInUrl = new URL("/api/auth/signin", request.url);
			signInUrl.searchParams.set("callbackUrl", request.url);
			return NextResponse.redirect(signInUrl);
		}
	}
	// Generate nonce for this request
	const nonce = generateCSPNonce();
	
	// Script hashes for Next.js inline hydration scripts
	// Note: These hashes change with each Next.js build. Consider using 'unsafe-inline' for script-src-elem
	// if this becomes unmanageable, since 'strict-dynamic' in script-src already provides security.
	const scriptHashes = [
		"'sha256-Q+8tPsjVtiDsjF/Cv8FMOpg2Yg91oKFKDAJat1PPb2g='",
		"'sha256-jc7XFOHixnFnymQQ1ejhrBa7Kgoniibf34byilvr3CU='",
		"'sha256-Dz9ipypSU+yio3ylyMbKtogFB8410FFouXf7cElQMQI='",
		"'sha256-IQVKO6xMhtjOM5LYMSq+uj+749m8EEOlJfl0KEMWCK8='",
		"'sha256-zC+saEQgolIrsqR7DoCcFPlvxlVEdb5rSPgk+MzQG0k='",
		"'sha256-icOUPQF1lsCsYH1prE9Pwc2LYzrDY0zUXJ0qZ4jevgU='",
		"'sha256-YCY2bf5bcU2HcKPAnxlCMEjOkOA5LiZaS0pExKQrLGY='",
		"'sha256-hgvJd27o01BU2afAw8APHsK434EDy+cwaRYn0JovZtE='",
		"'sha256-5ydHU1LXj1KKDB5Nx74ydjKfvpPQ9Y5YpcPH0Utbl8g='",
		"'sha256-Rq/c7HsTxjYvtu/HTT8rtUj4jf0OyslseDP3JCQmtOI='",
		"'sha256-gYohaCRZkQk6ahFNUMWKE4PjjTiptCPt6sBP18Wkm4k='",
		"'sha256-thPcge7komhZrsDFrKw/ET6++04qLBk3FeqHBYQ7BhQ='",
		"'sha256-R8M6ajq7sD3c6zPybGiHqhSQNZ6dqfxgSTUetOywwKY='",
	].join(' ');
	
	// In development, allow unsafe-eval for React Fast Refresh
	const isDevelopment = process.env.NODE_ENV === 'development';
	const unsafeEval = isDevelopment ? " 'unsafe-eval'" : '';
	
	// Build CSP with nonce and script hashes
	// Use script-src-elem to allow Next.js chunks from 'self' while keeping strict-dynamic for scripts loaded by nonce'd scripts
	// Use 'unsafe-inline' for script-src-elem since Next.js generates different inline scripts on each build
	// Note: nonce cannot be used with 'unsafe-inline' in the same directive (unsafe-inline is ignored)
	// Security is maintained via 'strict-dynamic' in script-src which prevents XSS from user content
	const csp = [
		"default-src 'self'",
		`script-src 'self' 'strict-dynamic' 'nonce-${nonce}'${unsafeEval} ${scriptHashes} https://fonts.googleapis.com https://*.umami.is`,
		`script-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.googleapis.com https://*.umami.is`,
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
		"font-src 'self' https://fonts.gstatic.com data:",
		"img-src 'self' data: https://docs.google.com https://*.googleusercontent.com https://maps.googleapis.com https://maps.gstatic.com blob:",
		"connect-src 'self' https://*.herokuapp.com https://*.netlify.app https://*.umami.is https://api-gateway.umami.dev https://*.databases.neo4j.io https://accounts.google.com https://oauth2.googleapis.com https://*.googleapis.com",
		"frame-src 'self' https://docs.google.com https://accounts.google.com",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		"upgrade-insecure-requests",
	].join('; ');

	// Create response with cloned request headers to include nonce
	const requestHeaders = new Headers(request.headers);
	requestHeaders.set('x-csp-nonce', nonce);
	
	const response = NextResponse.next({
		request: {
			headers: requestHeaders,
		},
	});

	// Set security headers
	Object.entries(getBaseSecurityHeaders()).forEach(([key, value]) => {
		response.headers.set(key, value);
	});
	
	// Set CSP with nonce
	response.headers.set('Content-Security-Policy', csp);
	
	// Also store nonce in response header for client-side access if needed
	response.headers.set('x-csp-nonce', nonce);
	
	// Set CSRF token cookie if not already present
	const csrfToken = request.cookies.get('csrf-token')?.value || generateCsrfToken();
	if (!request.cookies.get('csrf-token')) {
		response.cookies.set('csrf-token', csrfToken, {
			httpOnly: false, // Must be readable by JavaScript to send in header
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'strict',
			path: '/',
			maxAge: 60 * 60 * 24, // 24 hours
		});
	}

	return response;
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 */
		'/((?!api|_next/static|_next/image|favicon.ico).*)',
	],
};
