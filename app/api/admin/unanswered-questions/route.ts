import { NextRequest, NextResponse } from "next/server";
import { unansweredQuestionLogger } from "../../../../lib/services/unansweredQuestionLogger";

export async function GET(request: NextRequest) {
	try {
		const questions = await unansweredQuestionLogger.getUnansweredQuestions();

		return NextResponse.json({
			success: true,
			data: questions,
			count: questions.length,
		});
	} catch (error) {
		console.error("❌ Error fetching unanswered questions:", error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}

export async function DELETE(request: NextRequest) {
	try {
		await unansweredQuestionLogger.clearAllQuestions();

		return NextResponse.json({
			success: true,
			message: "All unanswered questions cleared successfully",
		});
	} catch (error) {
		console.error("❌ Error clearing unanswered questions:", error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}

