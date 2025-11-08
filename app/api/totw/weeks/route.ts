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
		const weeksQuery = `
			MATCH (wt:WeeklyTOTW {graphLabel: $graphLabel, season: $season})
			WHERE wt.week IS NOT NULL
			RETURN wt.week as week, 
			       COALESCE(wt.dateLookup, '') as dateLookup, 
			       COALESCE(wt.weekAdjusted, toString(wt.week)) as weekAdjusted
			ORDER BY wt.week ASC
		`;

		// Fetch latest gameweek from SiteDetail node
		const siteDetailQuery = `
			MATCH (sd:SiteDetail {graphLabel: $graphLabel})
			RETURN sd.latestGameweek as latestGameweek,
			       sd.latestGameweekDate as latestGameweekDate
			LIMIT 1
		`;

		const [weeksResult, siteDetailResult] = await Promise.all([
			neo4jService.runQuery(weeksQuery, { graphLabel, season }),
			neo4jService.runQuery(siteDetailQuery, { graphLabel }),
		]);

		console.log(`[API] Fetched ${weeksResult.records.length} weeks for season: ${season}`);

		const weeks = weeksResult.records.map((record) => {
			const week = Number(record.get("week") || 0);
			const dateLookup = String(record.get("dateLookup") || "");
			const weekAdjusted = String(record.get("weekAdjusted") || String(week));
			
			return {
				week,
				dateLookup,
				weekAdjusted,
			};
		});

		// Get latest gameweek from SiteDetail if available
		const siteDetailRecord = siteDetailResult.records[0];
		const latestGameweek = siteDetailRecord ? String(siteDetailRecord.get("latestGameweek") || "") : null;
		const latestGameweekDate = siteDetailRecord ? String(siteDetailRecord.get("latestGameweekDate") || "") : null;

		// Use latestGameweek as currentWeek if available, otherwise fall back to last week in list
		let currentWeek: number | null = null;
		if (latestGameweek && latestGameweek !== "") {
			const latestWeekNum = Number(latestGameweek);
			if (!isNaN(latestWeekNum)) {
				currentWeek = latestWeekNum;
				console.log(`[API] Current week (from SiteDetail latestGameweek): ${currentWeek}`);
			} else {
				// Fall back to last week if latestGameweek is not a valid number
				if (weeks.length > 0) {
					currentWeek = weeks[weeks.length - 1].week;
					console.log(`[API] Current week (fallback to last in list): ${currentWeek}`);
				}
			}
		} else if (weeks.length > 0) {
			currentWeek = weeks[weeks.length - 1].week;
			console.log(`[API] Current week (last in list): ${currentWeek}`);
		} else {
			console.log(`[API] No weeks found for season: ${season}`);
		}

		return NextResponse.json({ weeks, currentWeek, latestGameweek, latestGameweekDate }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching weeks:", error);
		return NextResponse.json({ error: "Failed to fetch weeks" }, { status: 500, headers: corsHeaders });
	}
}

