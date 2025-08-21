import { NextRequest, NextResponse } from "next/server";
import { chatbotService, QuestionContext } from "@/lib/services/chatbotService";

export async function POST(request: NextRequest) {
	try {
		const body: QuestionContext = await request.json();
		const { question } = body;

		if (!question || typeof question !== "string") {
			return NextResponse.json({ error: "Question is required and must be a string" }, { status: 400 });
		}

		console.log(`🤖 Received question: ${question}`);

		// Process the question
		const response = await chatbotService.processQuestion(body);

		return NextResponse.json(response);
	} catch (error) {
		console.error("❌ Chatbot API error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
