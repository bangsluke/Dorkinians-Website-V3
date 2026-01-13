import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateCSPNonce, getBaseSecurityHeaders } from "@/lib/utils/securityHeaders";

export function middleware(request: NextRequest) {
	// Generate nonce for this request
	const nonce = generateCSPNonce();
	
	// Build CSP with nonce
	const csp = [
		"default-src 'self'",
		`script-src 'self' 'strict-dynamic' 'nonce-${nonce}' https://fonts.googleapis.com https://*.umami.is`,
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
		"font-src 'self' https://fonts.gstatic.com data:",
		"img-src 'self' data: https://docs.google.com https://*.googleusercontent.com blob:",
		"connect-src 'self' https://*.herokuapp.com https://*.netlify.app https://*.umami.is https://*.databases.neo4j.io",
		"frame-src 'self' https://docs.google.com",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		"upgrade-insecure-requests",
	].join('; ');

	// Create response
	const response = NextResponse.next();

	// Set security headers
	Object.entries(getBaseSecurityHeaders()).forEach(([key, value]) => {
		response.headers.set(key, value);
	});
	
	// Set CSP with nonce
	response.headers.set('Content-Security-Policy', csp);
	
	// Store nonce in request header for use in layout
	response.headers.set('x-csp-nonce', nonce);

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
