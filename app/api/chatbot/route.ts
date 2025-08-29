import { NextRequest, NextResponse } from "next/server";
import { chatbotService, QuestionContext } from "@/lib/services/chatbotService";

// CORS headers for production
const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
	try {
		const body: QuestionContext = await request.json();
		const { question } = body;

		if (!question || typeof question !== "string") {
			return NextResponse.json({ error: "Question is required and must be a string" }, { status: 400, headers: corsHeaders });
		}

		console.log(`🤖 Received question: ${question}`);

		// Extract player context from question if it contains "About [Player]:"
		let selectedPlayer: string | undefined;
		const playerContextMatch = question.match(/^About (.*?):\s*(.*)/);
		if (playerContextMatch) {
			selectedPlayer = playerContextMatch[1].trim();
			const actualQuestion = playerContextMatch[2].trim();
			body.question = actualQuestion;
			body.userContext = selectedPlayer;
		}

		console.log(`🤖 Extracted player context: ${selectedPlayer}`);
		console.log(`🤖 Actual question: ${body.question}`);

		// Process the question with enhanced debugging
		const response = await chatbotService.processQuestion(body);

		// Get the detailed processing information that was captured during execution
		const processingDetails = await chatbotService.getProcessingDetails();

		// Add comprehensive debugging information to the response for client-side visibility
		const debugResponse = {
			...response,
			debug: {
				question: body.question,
				userContext: body.userContext,
				timestamp: new Date().toISOString(),
				serverLogs: `Processed question: ${body.question} with context: ${body.userContext || 'None'}`,
				// Add detailed processing information
				processingDetails: {
					questionAnalysis: processingDetails.questionAnalysis,
					cypherQueries: processingDetails.cypherQueries,
					processingSteps: processingDetails.processingSteps,
					queryBreakdown: processingDetails.queryBreakdown
				}
			}
		};

		return NextResponse.json(debugResponse, { headers: corsHeaders });
	} catch (error) {
		console.error("❌ Chatbot API error:", error);

		// Return a user-friendly error response
		const errorResponse = {
			answer: "I'm sorry, I'm having trouble processing your question right now. Please try again in a moment.",
			confidence: 0.1,
			sources: [],
			visualization: undefined,
		};

		return NextResponse.json(errorResponse, { status: 500, headers: corsHeaders });
	}
}
