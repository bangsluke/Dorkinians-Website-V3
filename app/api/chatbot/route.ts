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
	const rateLimitResponse = chatbotRateLimiter(request);
	if (rateLimitResponse) {
		return rateLimitResponse;
	}

	// Origin validation for public API (alternative to CSRF for stateless APIs)
	const origin = request.headers.get("origin");
	const referer = request.headers.get("referer");
	const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://dorkinians-website-v3.netlify.app";
	
	// Allow requests from allowed origin or same-origin requests (no origin header)
	if (origin && origin !== allowedOrigin) {
		log("warn", "Blocked request from invalid origin", { origin, allowedOrigin });
		return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers: corsHeaders });
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
		return NextResponse.json(response, { headers: corsHeaders });
	} catch (error) {
		logError("Chatbot API error", error);

		// Sanitize error for production
		const sanitized = sanitizeError(error, process.env.NODE_ENV === "production");

		// Return a user-friendly error response
		const errorResponse = {
			answer: "I'm sorry, I'm having trouble processing your question right now. Please try again in a moment.",
			sources: [],
			visualization: undefined,
			...(process.env.NODE_ENV === "development" ? { error: sanitized.message } : {}),
		};

		return NextResponse.json(errorResponse, { status: 500, headers: corsHeaders });
	}
}
