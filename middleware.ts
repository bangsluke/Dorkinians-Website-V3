import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateCSPNonce, getBaseSecurityHeaders } from "@/lib/utils/securityHeaders";
import { generateCsrfToken } from "@/lib/middleware/csrf";

export function middleware(request: NextRequest) {
	// Generate nonce for this request
	const nonce = generateCSPNonce();
	
	// Script hashes for Next.js inline hydration scripts
	const scriptHashes = [
		"'sha256-Q+8tPsjVtiDsjF/Cv8FMOpg2Yg91oKFKDAJat1PPb2g='",
		"'sha256-jc7XFOHixnFnymQQ1ejhrBa7Kgoniibf34byilvr3CU='",
		"'sha256-Dz9ipypSU+yio3ylyMbKtogFB8410FFouXf7cElQMQI='",
		"'sha256-IQVKO6xMhtjOM5LYMSq+uj+749m8EEOlJfl0KEMWCK8='",
		"'sha256-zC+saEQgolIrsqR7DoCcFPlvxlVEdb5rSPgk+MzQG0k='",
		"'sha256-icOUPQF1lsCsYH1prE9Pwc2LYzrDY0zUXJ0qZ4jevgU='",
		"'sha256-YCY2bf5bcU2HcKPAnxlCMEjOkOA5LiZaS0pExKQrLGY='",
		"'sha256-hgvJd27o01BU2afAw8APHsK434EDy+cwaRYn0JovZtE='",
	].join(' ');
	
	// In development, allow unsafe-eval for React Fast Refresh
	const isDevelopment = process.env.NODE_ENV === 'development';
	const unsafeEval = isDevelopment ? " 'unsafe-eval'" : '';
	
	// Build CSP with nonce and script hashes
	const csp = [
		"default-src 'self'",
		`script-src 'self' 'strict-dynamic' 'nonce-${nonce}'${unsafeEval} ${scriptHashes} https://fonts.googleapis.com https://*.umami.is`,
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
		"font-src 'self' https://fonts.gstatic.com data:",
		"img-src 'self' data: https://docs.google.com https://*.googleusercontent.com blob:",
		"connect-src 'self' https://*.herokuapp.com https://*.netlify.app https://*.umami.is https://api-gateway.umami.dev https://*.databases.neo4j.io",
		"frame-src 'self' https://docs.google.com",
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
