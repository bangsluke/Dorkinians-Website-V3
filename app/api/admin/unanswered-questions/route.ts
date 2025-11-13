import { NextRequest, NextResponse } from "next/server";
import { unansweredQuestionLogger } from "../../../../lib/services/unansweredQuestionLogger";

export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;
		const handled = searchParams.get("handled");
		const confidenceMin = searchParams.get("confidenceMin");
		const confidenceMax = searchParams.get("confidenceMax");
		const dateFrom = searchParams.get("dateFrom");
		const dateTo = searchParams.get("dateTo");
		const limit = searchParams.get("limit");
		const offset = searchParams.get("offset");

		const filters: any = {};

		if (handled !== null) {
			filters.handled = handled === "true";
		}

		if (confidenceMin !== null) {
			filters.confidenceMin = parseFloat(confidenceMin);
		}

		if (confidenceMax !== null) {
			filters.confidenceMax = parseFloat(confidenceMax);
		}

		if (dateFrom !== null) {
			filters.dateFrom = new Date(dateFrom);
		}

		if (dateTo !== null) {
			filters.dateTo = new Date(dateTo);
		}

		if (limit !== null) {
			filters.limit = parseInt(limit);
		}

		if (offset !== null) {
			filters.offset = parseInt(offset);
		}

		const questions = await unansweredQuestionLogger.getUnansweredQuestions(filters);

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

export async function PATCH(request: NextRequest) {
	try {
		const body = await request.json();
		const { questionHash, handled } = body;

		if (!questionHash) {
			return NextResponse.json(
				{
					success: false,
					error: "questionHash is required",
				},
				{ status: 400 },
			);
		}

		if (handled === true) {
			await unansweredQuestionLogger.markAsHandled(questionHash);
		}

		return NextResponse.json({
			success: true,
			message: "Question updated successfully",
		});
	} catch (error) {
		console.error("❌ Error updating unanswered question:", error);
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
		const searchParams = request.nextUrl.searchParams;
		const olderThanDays = searchParams.get("olderThanDays");

		const days = olderThanDays ? parseInt(olderThanDays) : 30;
		const deletedCount = await unansweredQuestionLogger.deleteHandledQuestions(days);

		return NextResponse.json({
			success: true,
			message: `Deleted ${deletedCount} handled questions older than ${days} days`,
			deletedCount,
		});
	} catch (error) {
		console.error("❌ Error deleting unanswered questions:", error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}

