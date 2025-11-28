import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
	return NextResponse.json({}, { headers: corsHeaders });
}

// Map team keys to fixture team names
function mapTeamKeyToFixtureTeam(teamKey: string): string {
	const mapping: { [key: string]: string } = {
		"1s": "1st XI",
		"2s": "2nd XI",
		"3s": "3rd XI",
		"4s": "4th XI",
		"5s": "5th XI",
		"6s": "6th XI",
		"7s": "7th XI",
		"8s": "8th XI",
	};
	return mapping[teamKey] || teamKey;
}

// Normalize season format (2019-20 -> 2019/20)
function normalizeSeason(season: string): string {
	return season.replace("-", "/");
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const teamKey = searchParams.get("team");
		const season = searchParams.get("season");

		if (!teamKey || !season) {
			return NextResponse.json(
				{ error: "Team and season parameters are required" },
				{ status: 400, headers: corsHeaders }
			);
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		// Map team key to fixture team name
		const fixtureTeam = mapTeamKeyToFixtureTeam(teamKey);
		const normalizedSeason = normalizeSeason(season);

		const graphLabel = neo4jService.getGraphLabel();

		// Query fixtures with goalscorers
		const query = `
			MATCH (f:Fixture {graphLabel: $graphLabel, team: $team})
			WHERE f.season = $season OR f.season = $normalizedSeason
			OPTIONAL MATCH (f)-[:HAS_MATCH_DETAILS]->(md:MatchDetail {graphLabel: $graphLabel})
			WITH f, collect(CASE WHEN md IS NOT NULL AND md.goals > 0 THEN {playerName: md.playerName, goals: md.goals} ELSE null END) as goalscorersRaw
			WITH f, [g IN goalscorersRaw WHERE g IS NOT NULL AND g.playerName IS NOT NULL | g] as goalscorers
			RETURN f.date as date, f.opposition as opposition, f.homeOrAway as homeOrAway,
			       f.result as result, f.homeScore as homeScore, f.awayScore as awayScore,
			       f.dorkiniansGoals as dorkiniansGoals, f.conceded as conceded,
			       f.compType as compType, f.oppoOwnGoals as oppoOwnGoals, goalscorers
			ORDER BY f.date ASC
		`;

		const params = {
			graphLabel,
			team: fixtureTeam,
			season: season,
			normalizedSeason: normalizedSeason,
		};

		const result = await neo4jService.runQuery(query, params);

		// Process results
		const fixtures = result.records.map((record) => {
			const date = record.get("date");
			const opposition = record.get("opposition");
			const homeOrAway = record.get("homeOrAway");
			const resultValue = record.get("result");
			const homeScore = record.get("homeScore");
			const awayScore = record.get("awayScore");
			const dorkiniansGoals = record.get("dorkiniansGoals");
			const conceded = record.get("conceded");
			const compType = record.get("compType");
			const oppoOwnGoals = record.get("oppoOwnGoals");
			const goalscorersRaw = record.get("goalscorers") || [];

			// Process goalscorers - aggregate by player
			const goalscorerMap = new Map<string, number>();
			goalscorersRaw.forEach((g: any) => {
				if (g && g.playerName) {
					const playerName = String(g.playerName);
					const goals = typeof g.goals === "number" ? g.goals : Number(g.goals) || 0;
					goalscorerMap.set(playerName, (goalscorerMap.get(playerName) || 0) + goals);
				}
			});

			// Convert to array
			const goalscorers = Array.from(goalscorerMap.entries()).map(([playerName, goals]) => ({
				playerName,
				goals,
			}));

			return {
				date: date ? String(date) : "",
				opposition: opposition ? String(opposition) : "",
				homeOrAway: homeOrAway ? String(homeOrAway) : "",
				result: resultValue ? String(resultValue) : "",
				homeScore: typeof homeScore === "number" ? homeScore : Number(homeScore) || 0,
				awayScore: typeof awayScore === "number" ? awayScore : Number(awayScore) || 0,
				dorkiniansGoals: typeof dorkiniansGoals === "number" ? dorkiniansGoals : Number(dorkiniansGoals) || 0,
				conceded: typeof conceded === "number" ? conceded : Number(conceded) || 0,
				compType: compType ? String(compType) : "",
				oppoOwnGoals: typeof oppoOwnGoals === "number" ? oppoOwnGoals : Number(oppoOwnGoals) || 0,
				goalscorers,
			};
		});

		return NextResponse.json({ fixtures }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching league fixtures:", error);
		return NextResponse.json({ error: "Failed to fetch league fixtures" }, { status: 500, headers: corsHeaders });
	}
}

