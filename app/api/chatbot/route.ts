import { NextRequest, NextResponse } from "next/server";
import { chatbotService, QuestionContext } from "@/lib/services/chatbotService";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";
import { chatbotRateLimiter } from "@/lib/middleware/rateLimiter";
import { sanitizeError } from "@/lib/utils/errorSanitizer";
import { log, logError, logRequest } from "@/lib/utils/logger";

// CORS headers with security headers - dynamically set origin based on request
function getCorsHeaders(requestOrigin?: string | null) {
	const allowedOrigins = (process.env.ALLOWED_ORIGIN || "https://dorkinians-website-v3.netlify.app")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	
	// Echo back the request origin if it's allowed, otherwise use first allowed origin
	const corsOrigin = requestOrigin && allowedOrigins.includes(requestOrigin) 
		? requestOrigin 
		: allowedOrigins[0];
	
	return {
		...getCorsHeadersWithSecurity(corsOrigin),
		"Access-Control-Allow-Methods": "POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type",
	};
}

export async function OPTIONS(request: NextRequest) {
	const origin = request.headers.get("origin");
	return new NextResponse(null, { status: 200, headers: getCorsHeaders(origin) });
}

export async function POST(request: NextRequest) {
	// Apply rate limiting
	const rateLimitResponse = await chatbotRateLimiter(request);
	if (rateLimitResponse) return rateLimitResponse;

	// Enhanced origin validation for public API (alternative to CSRF for stateless APIs)
	// ALLOWED_ORIGIN may be comma-separated to allow multiple (e.g. custom domain + Netlify URL)
	const origin = request.headers.get("origin");
	const referer = request.headers.get("referer");
	const allowedOrigins = (process.env.ALLOWED_ORIGIN || "https://dorkinians-website-v3.netlify.app")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	const isOriginAllowed = (o: string | null) => o != null && allowedOrigins.includes(o);
	const isRefererAllowed = (r: string | null) =>
		r != null && allowedOrigins.some((a) => r === a || r.startsWith(a + "/"));
	// Allow localhost/127.0.0.1 for local production-build testing (e.g. next start)
	const isLocalhost = (s: string | null) =>
		s != null && (s.startsWith("http://localhost") || s.startsWith("http://127.0.0.1"));
	const isProduction = process.env.NODE_ENV === "production";

	// In production, require origin/referer to match one of the allowed origins or localhost (for next start)
	if (isProduction) {
		if (!origin) {
			if (referer && !isRefererAllowed(referer) && !isLocalhost(referer)) {
				log("warn", "Blocked request with no origin from invalid referer", { referer, allowedOrigins });
				return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers: getCorsHeaders(origin) });
			}
			if (!referer || isRefererAllowed(referer) || isLocalhost(referer)) {
				// Same-origin or localhost, allow
			} else {
				log("warn", "Blocked request with no origin/referer in production", { origin, referer });
				return NextResponse.json({ error: "Origin required" }, { status: 403, headers: getCorsHeaders(origin) });
			}
		} else {
			if (!isOriginAllowed(origin) && !isLocalhost(origin)) {
				log("warn", "Blocked request from invalid origin", { origin, allowedOrigins });
				return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers: getCorsHeaders(origin) });
			}
		}
	} else {
		// Development: Allow localhost and no-origin for testing
		if (origin && !isOriginAllowed(origin) && !origin.startsWith("http://localhost")) {
			log("warn", "Blocked request from invalid origin in development", { origin, allowedOrigins });
			return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers: getCorsHeaders(origin) });
		}
	}

	// Input length validation constants
	const MAX_QUESTION_LENGTH = 1000;
	const MAX_USER_CONTEXT_LENGTH = 200;

	try {
		const body: QuestionContext = await request.json();
		const { question } = body;

		if (!question || typeof question !== "string") {
			return NextResponse.json({ error: "Question is required and must be a string" }, { status: 400, headers: getCorsHeaders(origin) });
		}

		// Validate question length
		if (question.length > MAX_QUESTION_LENGTH) {
			return NextResponse.json(
				{ error: `Question too long. Maximum ${MAX_QUESTION_LENGTH} characters allowed.` },
				{ status: 400, headers: getCorsHeaders(origin) }
			);
		}

		// Validate user context length if provided
		if (body.userContext && typeof body.userContext === "string" && body.userContext.length > MAX_USER_CONTEXT_LENGTH) {
			return NextResponse.json(
				{ error: `User context too long. Maximum ${MAX_USER_CONTEXT_LENGTH} characters allowed.` },
				{ status: 400, headers: getCorsHeaders(origin) }
			);
		}

		// Log request (sanitized in production)
		logRequest("Chatbot question received", {
			questionLength: question.length,
			hasUserContext: !!body.userContext,
		});

		// Process the question
		const response = await chatbotService.processQuestion(body);

		// Security: Only include debug info in development
		const isDevelopment = process.env.NODE_ENV === "development";

		if (isDevelopment) {
			// Get the detailed processing information for development debugging
			const processingDetails = await chatbotService.getProcessingDetails();

			const debugResponse = {
				...response,
				debug: {
					question: body.question,
					userContext: body.userContext,
					timestamp: new Date().toISOString(),
					serverLogs: `Processed question: ${body.question} with context: ${body.userContext || "None"}`,
					processingDetails: {
						questionAnalysis: processingDetails.questionAnalysis,
						cypherQueries: processingDetails.cypherQueries,
						processingSteps: processingDetails.processingSteps,
						queryBreakdown: processingDetails.queryBreakdown,
					},
				},
			};

			return NextResponse.json(debugResponse, { headers: getCorsHeaders(origin) });
		}

		// Production: return response without debug information
		// Add Cache-Control header for BFCache compatibility (no-cache for dynamic content)
		const responseHeaders = {
			...getCorsHeaders(origin),
			"Cache-Control": "no-cache, no-store, must-revalidate",
		};
		return NextResponse.json(response, { headers: responseHeaders });
	} catch (error) {
		logError("Chatbot API error", error);

		// Sanitize error for production
		const sanitized = sanitizeError(error, process.env.NODE_ENV === "production");

		// Return a user-friendly error response
		const errorResponse = {
			answer: "I'm sorry, I'm having trouble processing your question right now. Please try again in a moment.",
			sources: [],
			visualization: undefined,
			...(process.env.NODE_ENV === "development" ? { error: sanitized.message, details: sanitized.details } : {}),
		};

		const errorHeaders = {
			...getCorsHeaders(origin),
			"Cache-Control": "no-cache, no-store, must-revalidate",
		};
		return NextResponse.json(errorResponse, { status: 500, headers: errorHeaders });
	}
}
