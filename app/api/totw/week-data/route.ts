import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { WeeklyTOTW } from "@/types";

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
		const week = searchParams.get("week");

		if (!season || !week) {
			return NextResponse.json({ error: "Season and week parameters are required" }, { status: 400, headers: corsHeaders });
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const weekNumber = parseInt(week, 10);
		const weekString = week.toString();

		console.log(`[API] Fetching week-data for season: ${season}, week (number): ${weekNumber}, week (string): ${weekString}`);

		// Fetch WeeklyTOTW node - try both string and number for week
		// Check what type week is stored as in the database
		const totwQuery = `
			MATCH (wt:WeeklyTOTW {graphLabel: $graphLabel, season: $season})
			WHERE (wt.week = $weekNumber OR wt.week = $weekString)
			RETURN wt
		`;

		// Fetch player relationships with FTP scores
		// Try to get ftpScore from IN_WEEKLY_TOTW relationship first, fallback to MatchDetail fantasyPoints
		const playersQuery = `
			MATCH (wt:WeeklyTOTW {graphLabel: $graphLabel, season: $season})-[r:IN_WEEKLY_TOTW]-(p:Player {graphLabel: $graphLabel})
			WHERE (wt.week = $weekNumber OR wt.week = $weekString)
			OPTIONAL MATCH (wt)-[:TOTW_HAS_DETAILS]->(md:MatchDetail {graphLabel: $graphLabel, playerName: p.playerName})
			WITH p, r, COALESCE(r.ftpScore, md.fantasyPoints, 0) as ftpScore, r.position as position
			RETURN p.playerName as playerName, ftpScore, position
		`;

		const [totwResult, playersResult] = await Promise.all([
			neo4jService.runQuery(totwQuery, { graphLabel, season, weekNumber, weekString }),
			neo4jService.runQuery(playersQuery, { graphLabel, season, weekNumber, weekString }),
		]);

		console.log(`[API] Found ${totwResult.records.length} TOTW records, ${playersResult.records.length} player records`);

		if (totwResult.records.length === 0) {
			console.log(`[API] No TOTW data found for season: ${season}, week: ${weekNumber}`);
			// Return empty data instead of 404 to allow the UI to render
			return NextResponse.json({ totwData: null, players: [] }, { headers: corsHeaders });
		}

		const wtNode = totwResult.records[0].get("wt");
		const properties = wtNode.properties;

		// Build WeeklyTOTW object
		const totwData: WeeklyTOTW = {
			season: String(properties.season || ""),
			week: Number(properties.week || 0),
			seasonWeekNumRef: String(properties.seasonWeekNumRef || ""),
			dateLookup: String(properties.dateLookup || ""),
			seasonMonthRef: String(properties.seasonMonthRef || ""),
			weekAdjusted: String(properties.weekAdjusted || ""),
			bestFormation: String(properties.bestFormation || ""),
			totwScore: Number(properties.totwScore || 0),
			playerCount: Number(properties.playerCount || 0),
			starMan: String(properties.starMan || ""),
			starManScore: Number(properties.starManScore || 0),
			playerLookups: String(properties.playerLookups || ""),
			gk1: String(properties.gk1 || ""),
			def1: String(properties.def1 || ""),
			def2: String(properties.def2 || ""),
			def3: String(properties.def3 || ""),
			def4: String(properties.def4 || ""),
			def5: String(properties.def5 || ""),
			mid1: String(properties.mid1 || ""),
			mid2: String(properties.mid2 || ""),
			mid3: String(properties.mid3 || ""),
			mid4: String(properties.mid4 || ""),
			mid5: String(properties.mid5 || ""),
			fwd1: String(properties.fwd1 || ""),
			fwd2: String(properties.fwd2 || ""),
			fwd3: String(properties.fwd3 || ""),
		};

		// Build players map with FTP scores
		const players = playersResult.records.map((record) => {
			const ftpScore = record.get("ftpScore");
			const ftpValue = ftpScore !== null && ftpScore !== undefined 
				? (typeof ftpScore.toNumber === 'function' ? ftpScore.toNumber() : Number(ftpScore))
				: 0;
			
			return {
				playerName: String(record.get("playerName") || ""),
				ftpScore: ftpValue,
				position: String(record.get("position") || ""),
			};
		});

		console.log(`[API] Players with FTP scores:`, players.map(p => `${p.playerName}: ${p.ftpScore}`));

		return NextResponse.json({ totwData, players }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching week data:", error);
		return NextResponse.json({ error: "Failed to fetch week data" }, { status: 500, headers: corsHeaders });
	}
}

