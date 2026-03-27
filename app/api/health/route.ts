import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";

const corsHeaders = getCorsHeadersWithSecurity();

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(_request: NextRequest) {
	const noStore = {
		...corsHeaders,
		"Cache-Control": "no-cache, no-store, must-revalidate",
	};

	try {
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json(
				{ status: "unhealthy", error: "Database connection failed" },
				{ status: 503, headers: noStore }
			);
		}

		await neo4jService.runQuery("RETURN 1 AS ok");

		return NextResponse.json(
			{
				status: "healthy",
				neo4j: true,
				timestamp: new Date().toISOString(),
			},
			{ headers: noStore }
		);
	} catch (error) {
		console.error("Health check failed:", error);
		return NextResponse.json(
			{ status: "unhealthy", error: "Health check failed" },
			{ status: 503, headers: noStore }
		);
	}
}
