import { NextRequest, NextResponse } from "next/server";
import type { Record } from "neo4j-driver";
import { neo4jService } from "@/lib/neo4j";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
	return NextResponse.json({}, { headers: corsHeaders });
}

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

function normalizeSeason(season: string): string {
	return season.replace("-", "/");
}

function toNum(value: unknown): number {
	if (value === null || value === undefined) return 0;
	if (typeof value === "number") return Number.isNaN(value) ? 0 : value;
	if (typeof value === "object" && value !== null && "toNumber" in value) {
		return (value as { toNumber: () => number }).toNumber();
	}
	if (typeof value === "object" && value !== null && "low" in value) {
		const v = value as { low?: number; high?: number };
		return (v.low || 0) + (v.high || 0) * 4294967296;
	}
	const n = Number(value);
	return Number.isNaN(n) ? 0 : n;
}

function toRating(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	const n = typeof value === "number" ? value : toNum(value);
	if (Number.isNaN(n)) return null;
	return Math.round(n * 10) / 10;
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const teamKey = searchParams.get("team");
		const season = searchParams.get("season");

		if (!teamKey || !season) {
			return NextResponse.json({ error: "Team and season parameters are required" }, { status: 400, headers: corsHeaders });
		}

		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const fixtureTeam = mapTeamKeyToFixtureTeam(teamKey);
		const normalizedSeason = normalizeSeason(season);

		const fixtureQuery = `
			MATCH (f:Fixture {graphLabel: $graphLabel, team: $team})
			WHERE f.season = $season OR f.season = $normalizedSeason
			WITH f
			ORDER BY f.date DESC
			LIMIT 1
			OPTIONAL MATCH (f)-[:HAS_MATCH_DETAILS]->(md:MatchDetail {graphLabel: $graphLabel})
			WITH f,
			     collect(CASE WHEN md IS NOT NULL AND md.goals > 0 THEN {playerName: md.playerName, goals: md.goals} ELSE null END) as goalscorersRaw,
			     collect(CASE WHEN md IS NOT NULL AND md.mom > 0 THEN md.playerName ELSE null END) as momPlayersRaw
			WITH f,
			     [g IN goalscorersRaw WHERE g IS NOT NULL AND g.playerName IS NOT NULL | g] as goalscorers,
			     [m IN momPlayersRaw WHERE m IS NOT NULL] as momPlayers
			RETURN f.id as fixtureId, f.date as date, f.opposition as opposition, f.homeOrAway as homeOrAway,
			       f.result as result, f.homeScore as homeScore, f.awayScore as awayScore,
			       f.dorkiniansGoals as dorkiniansGoals, f.conceded as conceded,
			       f.compType as compType, f.oppoOwnGoals as oppoOwnGoals, f.veoLink as veoLink, goalscorers, momPlayers
		`;

		const fixtureRes = await neo4jService.runQuery(fixtureQuery, {
			graphLabel,
			team: fixtureTeam,
			season,
			normalizedSeason,
		});

		if (!fixtureRes.records || fixtureRes.records.length === 0) {
			return NextResponse.json({ fixture: null, lineup: [] }, { headers: corsHeaders });
		}

		const fixtureRecord = fixtureRes.records[0];
		const fixtureId = fixtureRecord.get("fixtureId");
		const goalscorersRaw = fixtureRecord.get("goalscorers") || [];
		const momPlayersRaw = fixtureRecord.get("momPlayers") || [];

		const goalscorerMap = new Map<string, number>();
		goalscorersRaw.forEach((g: any) => {
			if (g && g.playerName) {
				const playerName = String(g.playerName);
				const goals = typeof g.goals === "number" ? g.goals : Number(g.goals) || 0;
				goalscorerMap.set(playerName, (goalscorerMap.get(playerName) || 0) + goals);
			}
		});

		const fixture = {
			fixtureId: fixtureId != null ? String(fixtureId) : "",
			date: fixtureRecord.get("date") ? String(fixtureRecord.get("date")) : "",
			opposition: fixtureRecord.get("opposition") ? String(fixtureRecord.get("opposition")) : "",
			homeOrAway: fixtureRecord.get("homeOrAway") ? String(fixtureRecord.get("homeOrAway")) : "",
			result: fixtureRecord.get("result") ? String(fixtureRecord.get("result")) : "",
			homeScore: Number(fixtureRecord.get("homeScore")) || 0,
			awayScore: Number(fixtureRecord.get("awayScore")) || 0,
			dorkiniansGoals: Number(fixtureRecord.get("dorkiniansGoals")) || 0,
			conceded: Number(fixtureRecord.get("conceded")) || 0,
			compType: fixtureRecord.get("compType") ? String(fixtureRecord.get("compType")) : "",
			oppoOwnGoals: Number(fixtureRecord.get("oppoOwnGoals")) || 0,
			veoLink:
				fixtureRecord.get("veoLink") != null && String(fixtureRecord.get("veoLink")).trim() !== ""
					? String(fixtureRecord.get("veoLink"))
					: null,
			goalscorers: Array.from(goalscorerMap.entries()).map(([playerName, goals]) => ({ playerName, goals })),
			momPlayerName: momPlayersRaw.length > 0 ? String(momPlayersRaw[0]) : null,
		};

		const lineupQuery = `
			MATCH (f:Fixture {graphLabel: $graphLabel, id: $fixtureId})-[:HAS_MATCH_DETAILS]->(md:MatchDetail {graphLabel: $graphLabel})
			RETURN md.playerName AS playerName, md.class AS position, md.minutes AS minutes,
			       md.goals AS goals, md.assists AS assists, md.mom AS mom,
			       md.yellowCards AS yellowCards, md.redCards AS redCards,
			       md.saves AS saves, md.cleanSheets AS cleanSheets, md.conceded AS conceded,
			       md.ownGoals AS ownGoals,
			       md.penaltiesScored AS penaltiesScored, md.penaltiesMissed AS penaltiesMissed,
			       md.penaltiesConceded AS penaltiesConceded, md.penaltiesSaved AS penaltiesSaved,
			       md.matchRating AS matchRating, md.started AS started, md.playerOrder AS playerOrder
			ORDER BY coalesce(md.playerOrder, 9999) ASC, md.playerName ASC
		`;
		const lineupRes = await neo4jService.runQuery(lineupQuery, { graphLabel, fixtureId: fixture.fixtureId });
		const lineup = (lineupRes.records || []).map((r: Record) => ({
			playerName: r.get("playerName") != null ? String(r.get("playerName")) : "",
			position: r.get("position") != null ? String(r.get("position")) : "",
			minutes: toNum(r.get("minutes")),
			goals: toNum(r.get("goals")),
			assists: toNum(r.get("assists")),
			mom: toNum(r.get("mom")),
			yellowCards: toNum(r.get("yellowCards")),
			redCards: toNum(r.get("redCards")),
			saves: toNum(r.get("saves")),
			cleanSheets: toNum(r.get("cleanSheets")),
			conceded: toNum(r.get("conceded")),
			ownGoals: toNum(r.get("ownGoals")),
			penaltiesScored: toNum(r.get("penaltiesScored")),
			penaltiesMissed: toNum(r.get("penaltiesMissed")),
			penaltiesConceded: toNum(r.get("penaltiesConceded")),
			penaltiesSaved: toNum(r.get("penaltiesSaved")),
			matchRating: toRating(r.get("matchRating")),
			started: r.get("started") === true,
		}));

		return NextResponse.json({ fixture, lineup }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching league latest result:", error);
		return NextResponse.json({ error: "Failed to fetch league latest result" }, { status: 500, headers: corsHeaders });
	}
}
