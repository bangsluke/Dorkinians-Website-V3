import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { Record } from "neo4j-driver";
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
		const { playerName, filters } = body;

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

		// Base query - match player and join to MatchDetail and Fixture
		let query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		`;

		// Build filter conditions (excluding season filter since we're grouping by season)
		const filterConditions = filters ? buildFilterConditions(filters, params) : [];
		const conditionsWithoutSeason = filterConditions.filter(cond => !cond.includes("f.season") && !cond.includes("seasons"));
		if (conditionsWithoutSeason.length > 0) {
			query += ` WHERE ${conditionsWithoutSeason.join(" AND ")}`;
		}

		// Group by season and aggregate stats
		query += `
			WITH f.season as season, md
			WHERE season IS NOT NULL
			WITH season,
				count(md) as appearances,
				sum(coalesce(md.minutes, 0)) as minutes,
				sum(coalesce(md.mom, 0)) as mom,
				sum(coalesce(md.goals, 0)) as goals,
				sum(coalesce(md.assists, 0)) as assists,
				sum(coalesce(md.yellowCards, 0)) as yellowCards,
				sum(coalesce(md.redCards, 0)) as redCards,
				sum(coalesce(md.saves, 0)) as saves,
				sum(coalesce(md.cleanSheets, 0)) as cleanSheets,
				sum(coalesce(md.conceded, 0)) as conceded,
				sum(coalesce(md.ownGoals, 0)) as ownGoals,
				sum(coalesce(md.penaltiesScored, 0)) as penaltiesScored,
				sum(coalesce(md.penaltiesMissed, 0)) as penaltiesMissed,
				sum(coalesce(md.penaltiesConceded, 0)) as penaltiesConceded,
				sum(coalesce(md.penaltiesSaved, 0)) as penaltiesSaved,
				sum(coalesce(md.fantasyPoints, 0)) as fantasyPoints,
				sum(coalesce(md.distance, 0)) as distance
			RETURN season,
				coalesce(appearances, 0) as appearances,
				coalesce(minutes, 0) as minutes,
				coalesce(mom, 0) as mom,
				coalesce(goals, 0) as goals,
				coalesce(assists, 0) as assists,
				coalesce(yellowCards, 0) as yellowCards,
				coalesce(redCards, 0) as redCards,
				coalesce(saves, 0) as saves,
				coalesce(cleanSheets, 0) as cleanSheets,
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

		const seasonalStats = result.records.map((record: Record) => ({
			season: record.get("season"),
			appearances: toNumber(record.get("appearances")),
			minutes: toNumber(record.get("minutes")),
			mom: toNumber(record.get("mom")),
			goals: toNumber(record.get("goals")),
			assists: toNumber(record.get("assists")),
			fantasyPoints: toNumber(record.get("fantasyPoints")),
			yellowCards: toNumber(record.get("yellowCards")),
			redCards: toNumber(record.get("redCards")),
			saves: toNumber(record.get("saves")),
			cleanSheets: toNumber(record.get("cleanSheets")),
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
		console.error("Error fetching player seasonal stats:", error);
		return NextResponse.json({ error: "Failed to fetch player seasonal stats" }, { status: 500, headers: corsHeaders });
	}
}

