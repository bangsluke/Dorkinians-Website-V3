import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { WeeklyTOTW } from "@/types";
import { Record } from "neo4j-driver";
import { calculateFTPBreakdown } from "@/lib/utils/fantasyPoints";

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

		const totwResult = await neo4jService.runQuery(totwQuery, { graphLabel, season, weekNumber, weekString });

		if (totwResult.records.length === 0) {
			console.log(`[API] No TOTW data found for season: ${season}, week: ${weekNumber}`);
			// Return empty data instead of 404 to allow the UI to render
			return NextResponse.json({ totwData: null, players: [] }, { headers: corsHeaders });
		}

		const wtNode = totwResult.records[0].get("wt");
		const properties = wtNode.properties;

		// Construct seasonWeek string from WeeklyTOTW season and week properties
		const totwSeason = String(properties.season || season);
		const totwWeek = Number(properties.week || weekNumber);
		const seasonWeek = `${totwSeason}-${totwWeek}`;

		console.log(`[API] Constructed seasonWeek: ${seasonWeek}`);

		// Fetch player relationships
		const playersQuery = `
			MATCH (wt:WeeklyTOTW {graphLabel: $graphLabel, season: $season})-[r:IN_WEEKLY_TOTW]-(p:Player {graphLabel: $graphLabel})
			WHERE (wt.week = $weekNumber OR wt.week = $weekString)
			RETURN p.playerName as playerName, r.position as position
		`;

		const playersResult = await neo4jService.runQuery(playersQuery, { graphLabel, season, weekNumber, weekString });

		console.log(`[API] Found ${totwResult.records.length} TOTW records, ${playersResult.records.length} player records`);

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

		// Calculate FTP scores on-the-fly for each player to ensure MoM points are included
		const players: Array<{ playerName: string; ftpScore: number; position: string }> = [];
		for (const record of playersResult.records) {
			const playerName = String(record.get("playerName") || "");
			const position = String(record.get("position") || "");

			// Fetch all matches for this player in this week
			const matchesQuery = `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
				MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel, seasonWeek: $seasonWeek})
				RETURN md.minutes as minutes, md.min as min, md.mom as mom, md.goals as goals, 
					md.assists as assists, md.conceded as conceded, md.cleanSheets as cleanSheets,
					md.yellowCards as yellowCards, md.redCards as redCards, md.saves as saves,
					md.ownGoals as ownGoals, md.penaltiesScored as penaltiesScored,
					md.penaltiesMissed as penaltiesMissed, md.penaltiesConceded as penaltiesConceded,
					md.penaltiesSaved as penaltiesSaved, md.class as class
			`;

			const matchesResult = await neo4jService.runQuery(matchesQuery, { graphLabel, playerName, seasonWeek });

			// Calculate FTP score by summing points from each match
			let ftpScore = 0;
			matchesResult.records.forEach((matchRecord: Record) => {
				const matchData = {
					class: String(matchRecord.get("class") || ""),
					min: Number(matchRecord.get("minutes") || matchRecord.get("min") || 0),
					mom: matchRecord.get("mom") === 1 || matchRecord.get("mom") === true,
					goals: Number(matchRecord.get("goals") || 0),
					assists: Number(matchRecord.get("assists") || 0),
					conceded: Number(matchRecord.get("conceded") || 0),
					cleanSheets: Number(matchRecord.get("cleanSheets") || 0),
					yellowCards: Number(matchRecord.get("yellowCards") || 0),
					redCards: Number(matchRecord.get("redCards") || 0),
					saves: Number(matchRecord.get("saves") || 0),
					ownGoals: Number(matchRecord.get("ownGoals") || 0),
					penaltiesScored: Number(matchRecord.get("penaltiesScored") || 0),
					penaltiesMissed: Number(matchRecord.get("penaltiesMissed") || 0),
					penaltiesConceded: Number(matchRecord.get("penaltiesConceded") || 0),
					penaltiesSaved: Number(matchRecord.get("penaltiesSaved") || 0),
				};

				const breakdown = calculateFTPBreakdown(matchData);
				const matchPoints = breakdown.reduce((sum, stat) => sum + stat.points, 0);
				ftpScore += matchPoints;
			});

			players.push({
				playerName,
				ftpScore: Math.round(ftpScore),
				position,
			});
		}

		console.log(`[API] Players with FTP scores:`, players.map((p: { playerName: string; ftpScore: number }) => `${p.playerName}: ${p.ftpScore}`));

		return NextResponse.json({ totwData, players }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching week data:", error);
		return NextResponse.json({ error: "Failed to fetch week data" }, { status: 500, headers: corsHeaders });
	}
}

