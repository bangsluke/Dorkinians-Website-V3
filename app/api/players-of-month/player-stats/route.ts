import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { MatchDetail } from "@/types";
import { Record } from "neo4j-driver";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const monthNames = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December"
];

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const season = searchParams.get("season");
		const month = searchParams.get("month");
		const playerName = searchParams.get("playerName");

		if (!season || !month || !playerName) {
			return NextResponse.json(
				{ error: "Season, month, and playerName parameters are required" },
				{ status: 400, headers: corsHeaders },
			);
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Find month index
		const monthIndex = monthNames.findIndex((m) => m.toLowerCase() === month.toLowerCase());
		if (monthIndex === -1) {
			return NextResponse.json({ error: "Invalid month name" }, { status: 400, headers: corsHeaders });
		}

		// Fetch all matches for the player in the season, then filter by month
		// Use seasonMonth property as primary filter (format: "2023/24-January")
		const seasonMonthPattern = `${season}-${month}`;
		const query = `
			MATCH (md:MatchDetail {graphLabel: $graphLabel, playerName: $playerName, season: $season})
			WHERE md.date IS NOT NULL
			OPTIONAL MATCH (f:Fixture {graphLabel: $graphLabel})-[r:HAS_MATCH_DETAILS]->(md)
			RETURN md, f.fullResult as matchSummary, f.opposition as opposition, f.result as result
			ORDER BY md.date ASC
		`;

		const queryResult = await neo4jService.runQuery(query, {
			graphLabel,
			playerName,
			season,
		});

		// Map records
		const allMatchDetails = queryResult.records.map((record: Record) => {
			const mdNode = record.get("md");
			const properties = mdNode.properties;
			const matchSummary = record.get("matchSummary");
			const opposition = record.get("opposition");
			const result = record.get("result");

			return {
				team: String(properties.team || ""),
				playerName: String(properties.playerName || ""),
				date: String(properties.date || ""),
				seasonMonth: String(properties.seasonMonth || ""),
				min: Number(properties.min || properties.minutes || 0),
				class: String(properties.class || ""),
				mom: Boolean(properties.mom || false),
				goals: Number(properties.goals || 0),
				assists: Number(properties.assists || 0),
				yellowCards: Number(properties.yellowCards || 0),
				redCards: Number(properties.redCards || 0),
				saves: Number(properties.saves || 0),
				ownGoals: Number(properties.ownGoals || 0),
				conceded: Number(properties.conceded || 0),
				cleanSheets: Number(properties.cleanSheets || 0),
				penaltiesScored: Number(properties.penaltiesScored || 0),
				penaltiesMissed: Number(properties.penaltiesMissed || 0),
				penaltiesConceded: Number(properties.penaltiesConceded || 0),
				penaltiesSaved: Number(properties.penaltiesSaved || 0),
				matchSummary: matchSummary ? String(matchSummary) : null,
				opposition: opposition ? String(opposition) : null,
				result: result ? String(result) : null,
			};
		});

		// Filter by month - use seasonMonth if available, otherwise parse date as fallback
		const matchDetails = allMatchDetails.filter((md: any) => {
			// Primary: use seasonMonth property if available and it matches
			if (md.seasonMonth && md.seasonMonth === seasonMonthPattern) {
				return true;
			}
			
			// Fallback: parse date if seasonMonth doesn't match or is not set
			if (!md.date) return false;
			
			const dateStr = String(md.date);
			let date: Date | null = null;
			
			// Try to parse the date string
			if (dateStr.includes("T")) {
				date = new Date(dateStr);
			} else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
				// YYYY-MM-DD format
				date = new Date(dateStr + "T00:00:00");
			} else if (dateStr.includes("/")) {
				// Handle DD/MM/YY or DD/MM/YYYY format
				const parts = dateStr.split("/");
				if (parts.length === 3) {
					const first = parseInt(parts[0], 10);
					const second = parseInt(parts[1], 10);
					let year = parseInt(parts[2], 10);
					// Handle 2-digit years
					if (year < 100) {
						year = year + 2000; // Assume 2000s
					}
					// Determine format: if first part > 12, it's definitely DD/MM
					// Otherwise, assume DD/MM format (as per user's data)
					if (first > 12) {
						// DD/MM format: first is day, second is month
						date = new Date(year, second - 1, first);
					} else {
						// Assume DD/MM format (first could be day or month, but data suggests DD/MM)
						date = new Date(year, second - 1, first);
					}
				}
			} else {
				date = new Date(dateStr);
			}
			
			if (!date || isNaN(date.getTime())) {
				return false;
			}
			
			// Check if the month matches (JavaScript months are 0-indexed)
			return date.getMonth() === monthIndex;
		});

		// Calculate aggregated stats
		const appearances = matchDetails.length;
		const goals = matchDetails.reduce((sum: number, md: MatchDetail) => sum + md.goals, 0);
		const assists = matchDetails.reduce((sum: number, md: MatchDetail) => sum + md.assists, 0);
		const cleanSheets = matchDetails.reduce((sum: number, md: MatchDetail) => sum + md.cleanSheets, 0);
		const mom = matchDetails.reduce((sum: number, md: MatchDetail) => sum + (md.mom ? 1 : 0), 0);
		const yellowCards = matchDetails.reduce((sum: number, md: MatchDetail) => sum + md.yellowCards, 0);
		const redCards = matchDetails.reduce((sum: number, md: MatchDetail) => sum + md.redCards, 0);
		const saves = matchDetails.reduce((sum: number, md: MatchDetail) => sum + md.saves, 0);
		const ownGoals = matchDetails.reduce((sum: number, md: MatchDetail) => sum + md.ownGoals, 0);
		const conceded = matchDetails.reduce((sum: number, md: MatchDetail) => sum + md.conceded, 0);
		const penaltiesScored = matchDetails.reduce((sum: number, md: MatchDetail) => sum + md.penaltiesScored, 0);
		const penaltiesMissed = matchDetails.reduce((sum: number, md: MatchDetail) => sum + md.penaltiesMissed, 0);
		const penaltiesSaved = matchDetails.reduce((sum: number, md: MatchDetail) => sum + md.penaltiesSaved, 0);

		return NextResponse.json(
			{
				matchDetails,
				appearances,
				goals,
				assists,
				cleanSheets,
				mom,
				yellowCards,
				redCards,
				saves,
				ownGoals,
				conceded,
				penaltiesScored,
				penaltiesMissed,
				penaltiesSaved,
			},
			{ headers: corsHeaders },
		);
	} catch (error) {
		console.error("Error fetching player stats:", error);
		return NextResponse.json({ error: "Failed to fetch player stats" }, { status: 500, headers: corsHeaders });
	}
}

