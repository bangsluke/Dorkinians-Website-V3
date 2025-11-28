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

// Helper function to get team priority (lower number = higher team)
// 1s = 1, 2s = 2, etc. Lower number means higher team
function getTeamPriority(team: string): number {
	const teamLower = team.toLowerCase().trim();
	const priorityMap: { [key: string]: number } = {
		"1s": 1,
		"2s": 2,
		"3s": 3,
		"4s": 4,
		"5s": 5,
		"6s": 6,
		"7s": 7,
		"8s": 8,
	};
	return priorityMap[teamLower] || 999; // Unknown teams get lowest priority
}

// Helper function to normalize season format (2019/20 -> 2019-20)
function normalizeSeason(season: string): string {
	return season.replace("/", "-");
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { playerName } = body;

		if (!playerName) {
			return NextResponse.json({ error: "Player name is required" }, { status: 400, headers: corsHeaders });
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const params: any = {
			graphLabel,
			playerName,
		};

		// Query to get player appearances grouped by season and team
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			WHERE md.team IS NOT NULL AND f.season IS NOT NULL
			WITH f.season as season, md.team as team, count(md) as appearances
			RETURN season, team, appearances
			ORDER BY season DESC, appearances DESC, team ASC
		`;

		const result = await neo4jService.runQuery(query, params);

		// Process results and apply tie-breaking logic
		// Group by season, find team with max appearances, break ties by team priority
		const seasonTeamMap = new Map<string, { team: string; appearances: number }>();

		for (const record of result.records) {
			const season = record.get("season");
			const team = record.get("team");
			const appearances = record.get("appearances");

			if (!season || !team) continue;

			// Convert appearances to number
			const appearancesNum = typeof appearances === "number" 
				? appearances 
				: appearances?.toNumber ? appearances.toNumber() : Number(appearances) || 0;

			const normalizedSeason = normalizeSeason(season);
			const current = seasonTeamMap.get(normalizedSeason);

			if (!current) {
				// First team for this season
				seasonTeamMap.set(normalizedSeason, { team, appearances: appearancesNum });
			} else {
				// Check if this team has more appearances
				if (appearancesNum > current.appearances) {
					// More appearances, use this team
					seasonTeamMap.set(normalizedSeason, { team, appearances: appearancesNum });
				} else if (appearancesNum === current.appearances) {
					// Tie: prefer higher team (lower priority number)
					const currentPriority = getTeamPriority(current.team);
					const newPriority = getTeamPriority(team);

					if (newPriority < currentPriority) {
						// New team is higher (lower number), use it
						seasonTeamMap.set(normalizedSeason, { team, appearances: appearancesNum });
					}
					// Otherwise keep current team
				}
				// If fewer appearances, ignore this team
			}
		}

		// Convert to array and sort by season (latest first)
		const playerSeasons = Array.from(seasonTeamMap.entries())
			.map(([season, data]) => ({
				season,
				team: data.team,
			}))
			.sort((a, b) => {
				// Sort by season descending (latest first)
				// Compare years: "2024-25" vs "2023-24"
				const aYear = parseInt(a.season.split("-")[0]);
				const bYear = parseInt(b.season.split("-")[0]);
				return bYear - aYear;
			});

		return NextResponse.json({ playerSeasons }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching player seasons/teams:", error);
		return NextResponse.json({ error: "Failed to fetch player seasons/teams" }, { status: 500, headers: corsHeaders });
	}
}

