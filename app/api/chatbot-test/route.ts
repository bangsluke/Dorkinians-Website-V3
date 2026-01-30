import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	// This endpoint spawns local test scripts and only works in development
	// In production, use the Netlify function or run tests locally
	if (process.env.NODE_ENV === "production") {
		return NextResponse.json(
			{ 
				success: false, 
				message: "This endpoint is only available in development mode. Run tests locally with: npm run test:chatbot-players-report" 
			},
			{ status: 403 }
		);
	}

	// Dynamic import to prevent Turbopack from analyzing spawn paths at build time
	const { runChatbotTest } = await import("./dev-handler");
	return runChatbotTest(request);
}
