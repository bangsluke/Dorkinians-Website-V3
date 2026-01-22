import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { Record } from "neo4j-driver";

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
		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Fetch unique seasons from WeeklyTOTW nodes
		const seasonsQuery = `
			MATCH (wt:WeeklyTOTW {graphLabel: $graphLabel})
			WHERE wt.season IS NOT NULL AND wt.season <> ''
			RETURN DISTINCT wt.season as season
			ORDER BY wt.season DESC
		`;

		// Check if SeasonTOTW node with season="All Time" exists
		const allTimeQuery = `
			MATCH (st:SeasonTOTW {graphLabel: $graphLabel, season: 'All Time'})
			RETURN st
			LIMIT 1
		`;

		// Fetch current season and latest gameweek from SiteDetail node
		const currentSeasonQuery = `
			MATCH (sd:SiteDetail {graphLabel: $graphLabel})
			RETURN sd.currentSeason as currentSeason,
			       sd.latestGameweek as latestGameweek,
			       sd.latestGameweekDate as latestGameweekDate
			LIMIT 1
		`;

		const [seasonsResult, allTimeResult, currentSeasonResult] = await Promise.all([
			neo4jService.runQuery(seasonsQuery, { graphLabel }),
			neo4jService.runQuery(allTimeQuery, { graphLabel }),
			neo4jService.runQuery(currentSeasonQuery, { graphLabel }),
		]);

		const seasons = seasonsResult.records.map((record: Record) => String(record.get("season") || ""));
		
		// If "All Time" SeasonTOTW exists, add it at the top of the seasons array
		if (allTimeResult.records.length > 0) {
			seasons.unshift("All Time");
		}
		const currentSeasonRecord = currentSeasonResult.records[0];
		const currentSeason = currentSeasonRecord ? String(currentSeasonRecord.get("currentSeason") || "") : null;
		const latestGameweek = currentSeasonRecord ? String(currentSeasonRecord.get("latestGameweek") || "") : null;
		const latestGameweekDate = currentSeasonRecord ? String(currentSeasonRecord.get("latestGameweekDate") || "") : null;

		return NextResponse.json({ seasons, currentSeason, latestGameweek, latestGameweekDate }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching seasons:", error);
		return NextResponse.json({ error: "Failed to fetch seasons" }, { status: 500, headers: corsHeaders });
	}
}

