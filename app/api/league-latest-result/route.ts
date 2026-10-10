import { NextRequest, NextResponse } from "next/server";
import { fetchLeagueLatestResult } from "@/lib/league/latestResult";
import { neo4jService } from "@/lib/neo4j";
import { withNoStore, withPublicCache, PUBLIC_CACHE_MEDIUM } from "@/lib/utils/publicCacheHeaders";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
	return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const teamKey = searchParams.get("team");
		const season = searchParams.get("season");

		if (!teamKey || !season) {
			return NextResponse.json(
				{ error: "Team and season parameters are required" },
				{ status: 400, headers: withNoStore(corsHeaders) },
			);
		}

		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json(
				{ error: "Database connection failed" },
				{ status: 500, headers: withNoStore(corsHeaders) },
			);
		}

		const payload = await fetchLeagueLatestResult(teamKey, season);
		return NextResponse.json(payload, { headers: withPublicCache(corsHeaders, PUBLIC_CACHE_MEDIUM) });
	} catch (error) {
		console.error("Error fetching league latest result:", error);
		return NextResponse.json(
			{ error: "Failed to fetch league latest result" },
			{ status: 500, headers: withNoStore(corsHeaders) },
		);
	}
}
