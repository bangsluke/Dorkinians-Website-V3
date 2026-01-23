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

		// Fetch all players with their matches in a single aggregated query (fixes N+1 problem)
		const playersWithMatchesQuery = `
			MATCH (wt:WeeklyTOTW {graphLabel: $graphLabel, season: $season})-[r:IN_WEEKLY_TOTW]-(p:Player {graphLabel: $graphLabel})
			WHERE (wt.week = $weekNumber OR wt.week = $weekString)
			OPTIONAL MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel, seasonWeek: $seasonWeek})
			RETURN p.playerName as playerName, 
			       r.position as position,
			       collect({
			         minutes: md.minutes, 
			         min: md.min, 
			         mom: md.mom, 
			         goals: md.goals, 
			         assists: md.assists, 
			         conceded: md.conceded, 
			         cleanSheets: md.cleanSheets,
			         yellowCards: md.yellowCards, 
			         redCards: md.redCards, 
			         saves: md.saves,
			         ownGoals: md.ownGoals, 
			         penaltiesScored: md.penaltiesScored,
			         penaltiesMissed: md.penaltiesMissed, 
			         penaltiesConceded: md.penaltiesConceded,
			         penaltiesSaved: md.penaltiesSaved, 
			         class: md.class
			       }) as matches
		`;

		const playersWithMatchesResult = await neo4jService.runQuery(playersWithMatchesQuery, { 
			graphLabel, 
			season, 
			weekNumber, 
			weekString, 
			seasonWeek 
		});

		console.log(`[API] Found ${totwResult.records.length} TOTW records, ${playersWithMatchesResult.records.length} player records`);

		// Calculate FTP scores on-the-fly for each player to ensure MoM points are included
		const players: Array<{ playerName: string; ftpScore: number; position: string }> = [];
		for (const record of playersWithMatchesResult.records) {
			const playerName = String(record.get("playerName") || "");
			const position = String(record.get("position") || "");
			const matches = record.get("matches") as Array<any> || [];

			// Calculate FTP score by summing points from each match
			let ftpScore = 0;
			matches.forEach((matchData: any) => {
				// Skip null matches (from OPTIONAL MATCH when player has no matches)
				if (!matchData || matchData.class === null) return;

				const matchDataProcessed = {
					class: String(matchData.class || ""),
					min: Number(matchData.minutes || matchData.min || 0),
					mom: matchData.mom === 1 || matchData.mom === true,
					goals: Number(matchData.goals || 0),
					assists: Number(matchData.assists || 0),
					conceded: Number(matchData.conceded || 0),
					cleanSheets: Number(matchData.cleanSheets || 0),
					yellowCards: Number(matchData.yellowCards || 0),
					redCards: Number(matchData.redCards || 0),
					saves: Number(matchData.saves || 0),
					ownGoals: Number(matchData.ownGoals || 0),
					penaltiesScored: Number(matchData.penaltiesScored || 0),
					penaltiesMissed: Number(matchData.penaltiesMissed || 0),
					penaltiesConceded: Number(matchData.penaltiesConceded || 0),
					penaltiesSaved: Number(matchData.penaltiesSaved || 0),
				};

				const breakdown = calculateFTPBreakdown(matchDataProcessed);
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

