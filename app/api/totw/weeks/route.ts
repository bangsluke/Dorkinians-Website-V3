import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const season = searchParams.get("season");

		if (!season) {
			return NextResponse.json({ error: "Season parameter is required" }, { status: 400, headers: corsHeaders });
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Fetch weeks for the selected season
		const query = `
			MATCH (wt:WeeklyTOTW {graphLabel: $graphLabel, season: $season})
			WHERE wt.week IS NOT NULL
			RETURN wt.week as week, 
			       COALESCE(wt.dateLookup, '') as dateLookup, 
			       COALESCE(wt.weekAdjusted, toString(wt.week)) as weekAdjusted
			ORDER BY wt.week ASC
		`;

		const result = await neo4jService.runQuery(query, { graphLabel, season });

		console.log(`[API] Fetched ${result.records.length} weeks for season: ${season}`);

		const weeks = result.records.map((record) => {
			const week = Number(record.get("week") || 0);
			const dateLookup = String(record.get("dateLookup") || "");
			const weekAdjusted = String(record.get("weekAdjusted") || String(week));
			
			return {
				week,
				dateLookup,
				weekAdjusted,
			};
		});

		// Current week is simply the last week in the list (matching old website logic)
		let currentWeek: number | null = null;
		if (weeks.length > 0) {
			currentWeek = weeks[weeks.length - 1].week;
			console.log(`[API] Current week (last in list): ${currentWeek}`);
		} else {
			console.log(`[API] No weeks found for season: ${season}`);
		}

		return NextResponse.json({ weeks, currentWeek }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching weeks:", error);
		return NextResponse.json({ error: "Failed to fetch weeks" }, { status: 500, headers: corsHeaders });
	}
}

