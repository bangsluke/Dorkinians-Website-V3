import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { buildFilterConditions } from "@/app/api/player-data/route";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { teamName, filters } = body;

		if (!teamName) {
			return NextResponse.json({ error: "Team name is required" }, { status: 400, headers: corsHeaders });
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const params: any = {
			graphLabel,
			teamName: teamName === "Whole Club" ? null : teamName,
		};

		// Base query - match fixtures and match details
		let query = `
			MATCH (f:Fixture {graphLabel: $graphLabel})
		`;

		// Filter by team if not "Whole Club"
		if (teamName !== "Whole Club") {
			query += ` WHERE f.team = $teamName`;
		}

		query += `
			MATCH (f)-[:HAS_MATCH_DETAILS]->(md:MatchDetail {graphLabel: $graphLabel})
		`;

		// Build filter conditions (excluding season filter since we're grouping by season)
		const filterConditions = filters ? buildFilterConditions(filters, params) : [];
		const conditionsWithoutSeason = filterConditions.filter(cond => !cond.includes("f.season") && !cond.includes("seasons"));
		if (conditionsWithoutSeason.length > 0) {
			query += ` WHERE ${conditionsWithoutSeason.join(" AND ")}`;
		}

		// Group by season and aggregate stats
		query += `
			WITH f.season as season, f, md
			WHERE season IS NOT NULL
			WITH season,
				collect(DISTINCT f) as fixtures,
				// Aggregate team-level stats from fixtures
				size(collect(DISTINCT f)) as gamesPlayed,
				size([fx in collect(DISTINCT f) WHERE fx.result = "W"]) as wins,
				size([fx in collect(DISTINCT f) WHERE fx.result = "D"]) as draws,
				size([fx in collect(DISTINCT f) WHERE fx.result = "L"]) as losses,
				reduce(total = 0, fx in collect(DISTINCT f) | total + coalesce(fx.dorkiniansGoals, 0)) as goalsScored,
				reduce(total = 0, fx in collect(DISTINCT f) | total + coalesce(fx.conceded, 0)) as goalsConceded,
				size([fx in collect(DISTINCT f) WHERE coalesce(fx.conceded, 0) = 0]) as cleanSheets,
				// Aggregate player-level stats from match details
				count(md) as appearances,
				sum(coalesce(md.minutes, 0)) as minutes,
				sum(coalesce(md.mom, 0)) as mom,
				sum(coalesce(md.goals, 0)) as goals,
				sum(coalesce(md.assists, 0)) as assists,
				sum(coalesce(md.yellowCards, 0)) as yellowCards,
				sum(coalesce(md.redCards, 0)) as redCards,
				sum(coalesce(md.saves, 0)) as saves,
				sum(coalesce(md.cleanSheets, 0)) as playerCleanSheets,
				sum(coalesce(md.conceded, 0)) as conceded,
				sum(coalesce(md.ownGoals, 0)) as ownGoals,
				sum(coalesce(md.penaltiesScored, 0)) as penaltiesScored,
				sum(coalesce(md.penaltiesMissed, 0)) as penaltiesMissed,
				sum(coalesce(md.penaltiesConceded, 0)) as penaltiesConceded,
				sum(coalesce(md.penaltiesSaved, 0)) as penaltiesSaved,
				sum(coalesce(md.fantasyPoints, 0)) as fantasyPoints,
				sum(coalesce(md.distance, 0)) as distance
			RETURN season,
				coalesce(gamesPlayed, 0) as gamesPlayed,
				coalesce(wins, 0) as wins,
				coalesce(draws, 0) as draws,
				coalesce(losses, 0) as losses,
				coalesce(goalsScored, 0) as goalsScored,
				coalesce(goalsConceded, 0) as goalsConceded,
				coalesce(cleanSheets, 0) as cleanSheets,
				coalesce(appearances, 0) as appearances,
				coalesce(minutes, 0) as minutes,
				coalesce(mom, 0) as mom,
				coalesce(goals, 0) as goals,
				coalesce(assists, 0) as assists,
				coalesce(yellowCards, 0) as yellowCards,
				coalesce(redCards, 0) as redCards,
				coalesce(saves, 0) as saves,
				coalesce(playerCleanSheets, 0) as playerCleanSheets,
				coalesce(conceded, 0) as conceded,
				coalesce(ownGoals, 0) as ownGoals,
				coalesce(penaltiesScored, 0) as penaltiesScored,
				coalesce(penaltiesMissed, 0) as penaltiesMissed,
				coalesce(penaltiesConceded, 0) as penaltiesConceded,
				coalesce(penaltiesSaved, 0) as penaltiesSaved,
				coalesce(fantasyPoints, 0) as fantasyPoints,
				coalesce(distance, 0) as distance
			ORDER BY season ASC
		`;

		const result = await neo4jService.runQuery(query, params);

		// Helper function to convert Neo4j Integer/Float to JavaScript number
		const toNumber = (value: any): number => {
			if (value === null || value === undefined) return 0;
			if (typeof value === "number") {
				if (isNaN(value)) return 0;
				return value;
			}
			if (typeof value === "object") {
				if ("toNumber" in value && typeof value.toNumber === "function") {
					return value.toNumber();
				}
				if ("low" in value && "high" in value) {
					const low = value.low || 0;
					const high = value.high || 0;
					return low + high * 4294967296;
				}
				if ("toString" in value) {
					const num = Number(value.toString());
					return isNaN(num) ? 0 : num;
				}
			}
			const num = Number(value);
			return isNaN(num) ? 0 : num;
		};

		const seasonalStats = result.records.map((record) => ({
			season: record.get("season"),
			gamesPlayed: toNumber(record.get("gamesPlayed")),
			wins: toNumber(record.get("wins")),
			draws: toNumber(record.get("draws")),
			losses: toNumber(record.get("losses")),
			goalsScored: toNumber(record.get("goalsScored")),
			goalsConceded: toNumber(record.get("goalsConceded")),
			teamCleanSheets: toNumber(record.get("cleanSheets")),
			appearances: toNumber(record.get("appearances")),
			playerCleanSheets: toNumber(record.get("playerCleanSheets")),
			minutes: toNumber(record.get("minutes")),
			mom: toNumber(record.get("mom")),
			goals: toNumber(record.get("goals")),
			assists: toNumber(record.get("assists")),
			fantasyPoints: toNumber(record.get("fantasyPoints")),
			yellowCards: toNumber(record.get("yellowCards")),
			redCards: toNumber(record.get("redCards")),
			saves: toNumber(record.get("saves")),
			conceded: toNumber(record.get("conceded")),
			ownGoals: toNumber(record.get("ownGoals")),
			penaltiesScored: toNumber(record.get("penaltiesScored")),
			penaltiesMissed: toNumber(record.get("penaltiesMissed")),
			penaltiesConceded: toNumber(record.get("penaltiesConceded")),
			penaltiesSaved: toNumber(record.get("penaltiesSaved")),
			distance: toNumber(record.get("distance")),
		}));

		return NextResponse.json({ seasonalStats }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching team seasonal stats:", error);
		return NextResponse.json({ error: "Failed to fetch team seasonal stats" }, { status: 500, headers: corsHeaders });
	}
}
