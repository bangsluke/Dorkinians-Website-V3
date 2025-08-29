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
			return NextResponse.json(
				{ error: "Question is required and must be a string" }, 
				{ status: 400, headers: corsHeaders }
			);
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

		// Process the question
		const response = await chatbotService.processQuestion(body);

		return NextResponse.json(response, { headers: corsHeaders });
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
