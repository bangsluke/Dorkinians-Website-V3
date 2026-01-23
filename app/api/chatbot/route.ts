import { NextRequest, NextResponse } from "next/server";
import { chatbotService, QuestionContext } from "@/lib/services/chatbotService";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";
import { chatbotRateLimiter } from "@/lib/middleware/rateLimiter";
import { sanitizeError } from "@/lib/utils/errorSanitizer";
import { log, logError, logRequest } from "@/lib/utils/logger";

// CORS headers with security headers
const corsHeaders = {
	...getCorsHeadersWithSecurity(),
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
	// Apply rate limiting
	const rateLimitResponse = await chatbotRateLimiter(request);
	if (rateLimitResponse) {
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/chatbot/route.ts:rateLimit',message:'Rate limit triggered',data:{status:rateLimitResponse?.status},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
		// #endregion
		return rateLimitResponse;
	}

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
	const isProduction = process.env.NODE_ENV === "production";

	// #region agent log
	fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/chatbot/route.ts:originCheck',message:'Origin validation start',data:{origin,referer,allowedOrigins,isProduction},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H1_H2_H4_H5'})}).catch(()=>{});
	// #endregion

	// In production, require origin/referer to match one of the allowed origins
	if (isProduction) {
		if (!origin) {
			if (referer && !isRefererAllowed(referer)) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/chatbot/route.ts:403',message:'403: Invalid origin (referer fallback)',data:{referer,allowedOrigins},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H2'})}).catch(()=>{});
				// #endregion
				log("warn", "Blocked request with no origin from invalid referer", { referer, allowedOrigins });
				return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers: corsHeaders });
			}
			if (!referer || isRefererAllowed(referer)) {
				// Same-origin request, allow
			} else {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/chatbot/route.ts:403',message:'403: Origin required',data:{origin,referer},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H4'})}).catch(()=>{});
				// #endregion
				log("warn", "Blocked request with no origin/referer in production", { origin, referer });
				return NextResponse.json({ error: "Origin required" }, { status: 403, headers: corsHeaders });
			}
		} else {
			if (!isOriginAllowed(origin)) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/chatbot/route.ts:403',message:'403: Invalid origin (origin mismatch)',data:{origin,allowedOrigins},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H1'})}).catch(()=>{});
				// #endregion
				log("warn", "Blocked request from invalid origin", { origin, allowedOrigins });
				return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers: corsHeaders });
			}
		}
	} else {
		// Development: Allow localhost and no-origin for testing
		if (origin && !isOriginAllowed(origin) && !origin.startsWith("http://localhost")) {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/chatbot/route.ts:403',message:'403: Invalid origin (dev)',data:{origin,allowedOrigins},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H5'})}).catch(()=>{});
			// #endregion
			log("warn", "Blocked request from invalid origin in development", { origin, allowedOrigins });
			return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers: corsHeaders });
		}
	}

	// Input length validation constants
	const MAX_QUESTION_LENGTH = 1000;
	const MAX_USER_CONTEXT_LENGTH = 200;

	try {
		const body: QuestionContext = await request.json();
		const { question } = body;

		if (!question || typeof question !== "string") {
			return NextResponse.json({ error: "Question is required and must be a string" }, { status: 400, headers: corsHeaders });
		}

		// Validate question length
		if (question.length > MAX_QUESTION_LENGTH) {
			return NextResponse.json(
				{ error: `Question too long. Maximum ${MAX_QUESTION_LENGTH} characters allowed.` },
				{ status: 400, headers: corsHeaders }
			);
		}

		// Validate user context length if provided
		if (body.userContext && typeof body.userContext === "string" && body.userContext.length > MAX_USER_CONTEXT_LENGTH) {
			return NextResponse.json(
				{ error: `User context too long. Maximum ${MAX_USER_CONTEXT_LENGTH} characters allowed.` },
				{ status: 400, headers: corsHeaders }
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

			return NextResponse.json(debugResponse, { headers: corsHeaders });
		}

		// Production: return response without debug information
		// Add Cache-Control header for BFCache compatibility (no-cache for dynamic content)
		const responseHeaders = {
			...corsHeaders,
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
			...corsHeaders,
			"Cache-Control": "no-cache, no-store, must-revalidate",
		};
		return NextResponse.json(errorResponse, { status: 500, headers: errorHeaders });
	}
}
