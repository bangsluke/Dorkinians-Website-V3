import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { Record } from "neo4j-driver";
import { buildFilterConditions } from "../player-data/route";

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
		const { filters, statType } = body;

		const validStatTypes = ["appearances", "goals", "assists", "cleanSheets", "mom", "saves", "yellowCards", "redCards", "penaltiesScored", "fantasyPoints", "goalInvolvements", "minutes", "ownGoals", "conceded", "penaltiesMissed", "penaltiesConceded", "penaltiesSaved", "distance", "starts", "avgMatchRating", "matchesRated8Plus", "goalsPer90", "assistsPer90", "goalInvolvementsPer90", "ftpPer90", "cleanSheetsPer90", "concededPer90", "savesPer90", "cardsPer90", "momPer90", "bestCurrentForm"];
		if (!statType || !validStatTypes.includes(statType)) {
			return NextResponse.json({ error: `Valid statType is required. Options: ${validStatTypes.join(", ")}` }, { status: 400, headers: corsHeaders });
		}

		if (!filters || typeof filters !== "object") {
			return NextResponse.json({ error: "Filters object is required" }, { status: 400, headers: corsHeaders });
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const params: any = {
			graphLabel,
		};

		// Base query - match all players with allowOnSite = true
		let query = `
			MATCH (p:Player {graphLabel: $graphLabel})
			WHERE p.allowOnSite = true
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		`;

		// Build filter conditions
		const conditions = buildFilterConditions(filters, params);
		if (conditions.length > 0) {
			query += ` WHERE ${conditions.join(" AND ")}`;
		}

		// Determine which stat to aggregate and sort by
		const statFieldMap: { [key: string]: string } = {
			appearances: "appearances",
			goals: "goals",
			assists: "assists",
			cleanSheets: "cleanSheets",
			mom: "mom",
			saves: "saves",
			yellowCards: "yellowCards",
			redCards: "redCards",
			penaltiesScored: "penaltiesScored",
			fantasyPoints: "fantasyPoints",
			goalInvolvements: "goalInvolvements",
			minutes: "minutes",
			ownGoals: "ownGoals",
			conceded: "conceded",
			penaltiesMissed: "penaltiesMissed",
			penaltiesConceded: "penaltiesConceded",
			penaltiesSaved: "penaltiesSaved",
			distance: "distance",
			starts: "starts",
			avgMatchRating: "averageMatchRating",
			matchesRated8Plus: "matchesRated8Plus",
			goalsPer90: "goalsPer90",
			assistsPer90: "assistsPer90",
			goalInvolvementsPer90: "goalInvolvementsPer90",
			ftpPer90: "ftpPer90",
			cleanSheetsPer90: "cleanSheetsPer90",
			concededPer90: "concededPer90",
			savesPer90: "savesPer90",
			cardsPer90: "cardsPer90",
			momPer90: "momPer90",
			bestCurrentForm: "currentFormEwma",
		};

		const statField = statFieldMap[statType];
		const sortField = statType === "goals" ? "totalGoals" : statField;
		const sortDirection = ["concededPer90", "cardsPer90"].includes(statType) ? "ASC" : "DESC";

		// Aggregate stats per player
		// cleanSheets is stored as integer on MatchDetail, sum it directly like goals/assists
		// For goals stat type, we need to use total goals (goals + penaltiesScored) for sorting
		query += `
			WITH p, md, f
			WITH p,
				count(md) as appearances,
				sum(coalesce(md.goals, 0)) as goals,
				sum(coalesce(md.assists, 0)) as assists,
				sum(coalesce(md.cleanSheets, 0)) as cleanSheets,
				sum(coalesce(md.mom, 0)) as mom,
				sum(coalesce(md.penaltiesScored, 0)) as penaltiesScored,
				sum(coalesce(md.saves, 0)) as saves,
				sum(coalesce(md.yellowCards, 0)) as yellowCards,
				sum(coalesce(md.redCards, 0)) as redCards,
				sum(coalesce(md.fantasyPoints, 0)) as fantasyPoints,
				sum(coalesce(md.goals, 0)) + sum(coalesce(md.penaltiesScored, 0)) + sum(coalesce(md.assists, 0)) as goalInvolvements,
				sum(coalesce(md.goals, 0)) + sum(coalesce(md.penaltiesScored, 0)) as totalGoals,
				sum(coalesce(md.minutes, 0)) as minutes,
				sum(coalesce(md.ownGoals, 0)) as ownGoals,
				sum(coalesce(md.conceded, 0)) as conceded,
				sum(coalesce(md.penaltiesMissed, 0)) as penaltiesMissed,
				sum(coalesce(md.penaltiesConceded, 0)) as penaltiesConceded,
				sum(coalesce(md.penaltiesSaved, 0)) as penaltiesSaved,
				sum(coalesce(md.distance, 0)) as distance,
				sum(CASE WHEN f.homeOrAway = "Home" THEN 1 ELSE 0 END) as homeGames,
				sum(CASE WHEN f.homeOrAway = "Away" THEN 1 ELSE 0 END) as awayGames,
				sum(CASE WHEN md.started = true THEN 1 ELSE 0 END) as starts,
				avg(md.matchRating) as averageMatchRating,
				sum(CASE WHEN coalesce(md.matchRating, 0) >= 8.0 THEN 1 ELSE 0 END) as matchesRated8Plus,
				CASE WHEN sum(coalesce(md.minutes, 0)) >= 360 THEN round((toFloat(sum(coalesce(md.goals, 0)) + sum(coalesce(md.penaltiesScored, 0))) / sum(coalesce(md.minutes, 0))) * 90 * 100) / 100 ELSE null END as goalsPer90,
				CASE WHEN sum(coalesce(md.minutes, 0)) >= 360 THEN round((toFloat(sum(coalesce(md.assists, 0))) / sum(coalesce(md.minutes, 0))) * 90 * 100) / 100 ELSE null END as assistsPer90,
				CASE WHEN sum(coalesce(md.minutes, 0)) >= 360 THEN round((toFloat((sum(coalesce(md.goals, 0)) + sum(coalesce(md.penaltiesScored, 0))) + sum(coalesce(md.assists, 0))) / sum(coalesce(md.minutes, 0))) * 90 * 100) / 100 ELSE null END as goalInvolvementsPer90,
				CASE WHEN sum(coalesce(md.minutes, 0)) >= 360 THEN round((toFloat(sum(coalesce(md.fantasyPoints, 0))) / sum(coalesce(md.minutes, 0))) * 90 * 100) / 100 ELSE null END as ftpPer90,
				CASE WHEN sum(coalesce(md.minutes, 0)) >= 360 THEN round((toFloat(sum(coalesce(md.cleanSheets, 0))) / sum(coalesce(md.minutes, 0))) * 90 * 100) / 100 ELSE null END as cleanSheetsPer90,
				CASE WHEN sum(coalesce(md.minutes, 0)) >= 360 THEN round((toFloat(sum(coalesce(md.conceded, 0))) / sum(coalesce(md.minutes, 0))) * 90 * 100) / 100 ELSE null END as concededPer90,
				CASE WHEN sum(coalesce(md.minutes, 0)) >= 360 THEN round((toFloat(sum(coalesce(md.saves, 0))) / sum(coalesce(md.minutes, 0))) * 90 * 100) / 100 ELSE null END as savesPer90,
				CASE WHEN sum(coalesce(md.minutes, 0)) >= 360 THEN round((toFloat(sum(coalesce(md.yellowCards, 0)) + sum(coalesce(md.redCards, 0))) / sum(coalesce(md.minutes, 0))) * 90 * 100) / 100 ELSE null END as cardsPer90,
				CASE WHEN sum(coalesce(md.minutes, 0)) >= 360 THEN round((toFloat(sum(coalesce(md.mom, 0))) / sum(coalesce(md.minutes, 0))) * 90 * 100) / 100 ELSE null END as momPer90,
				p.formCurrent as currentFormEwma
		`;
		
		// Handle WHERE clause based on stat type
		// For appearances, filter by appearances > 0
		// For other stats, filter by the stat value > 0 (except cleanSheets which should show players with 0 too if they have appearances)
		if (statType === "appearances" || statType === "starts") {
			query += ` WHERE appearances > 0`;
		} else if (statType === "cleanSheets") {
			// For clean sheets, show players with appearances even if they have 0 clean sheets
			query += ` WHERE appearances > 0`;
		} else if (statType === "avgMatchRating") {
			query += ` WHERE appearances > 0 AND averageMatchRating IS NOT NULL`;
		} else if (statType === "matchesRated8Plus") {
			query += ` WHERE matchesRated8Plus > 0`;
		} else if (["goalsPer90", "assistsPer90", "goalInvolvementsPer90", "ftpPer90", "cleanSheetsPer90", "concededPer90", "savesPer90", "cardsPer90", "momPer90", "bestCurrentForm"].includes(statType)) {
			query += ` WHERE ${sortField} IS NOT NULL`;
		} else {
			query += ` WHERE ${sortField} > 0`;
		}
		
		query += `
			RETURN p.playerName as playerName,
				coalesce(appearances, 0) as appearances,
				coalesce(goals, 0) as goals,
				coalesce(assists, 0) as assists,
				coalesce(cleanSheets, 0) as cleanSheets,
				coalesce(mom, 0) as mom,
				coalesce(penaltiesScored, 0) as penaltiesScored,
				coalesce(saves, 0) as saves,
				coalesce(yellowCards, 0) as yellowCards,
				coalesce(redCards, 0) as redCards,
				coalesce(fantasyPoints, 0) as fantasyPoints,
				coalesce(goalInvolvements, 0) as goalInvolvements,
				coalesce(minutes, 0) as minutes,
				coalesce(ownGoals, 0) as ownGoals,
				coalesce(conceded, 0) as conceded,
				coalesce(penaltiesMissed, 0) as penaltiesMissed,
				coalesce(penaltiesConceded, 0) as penaltiesConceded,
				coalesce(penaltiesSaved, 0) as penaltiesSaved,
				coalesce(distance, 0) as distance,
				coalesce(homeGames, 0) as homeGames,
				coalesce(awayGames, 0) as awayGames,
				coalesce(starts, 0) as starts,
				averageMatchRating as averageMatchRating,
				coalesce(matchesRated8Plus, 0) as matchesRated8Plus,
				goalsPer90 as goalsPer90,
				assistsPer90 as assistsPer90,
				goalInvolvementsPer90 as goalInvolvementsPer90,
				ftpPer90 as ftpPer90,
				cleanSheetsPer90 as cleanSheetsPer90,
				concededPer90 as concededPer90,
				savesPer90 as savesPer90,
				cardsPer90 as cardsPer90,
				momPer90 as momPer90,
				currentFormEwma as currentFormEwma
			ORDER BY ${sortField} ${sortDirection}, appearances ASC
			LIMIT 5
		`;

		// Log query for debugging
		console.log(`[TopPlayersStats] StatType: ${statType}, Query:`, query);
		console.log(`[TopPlayersStats] Params:`, JSON.stringify(params, null, 2));

		let result;
		try {
			result = await neo4jService.runQuery(query, params);
			console.log(`[TopPlayersStats] Query executed successfully, records: ${result.records.length}`);
		} catch (queryError: any) {
			console.error("[TopPlayersStats] Cypher query error:", queryError);
			console.error("[TopPlayersStats] Query:", query);
			console.error("[TopPlayersStats] Params:", JSON.stringify(params, null, 2));
			return NextResponse.json(
				{ error: "Query execution failed", details: queryError.message },
				{ status: 500, headers: corsHeaders }
			);
		}

		// Helper function to convert Neo4j Integer to JavaScript number
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

		// Extract player stats from results
		const players = result.records.map((record: Record) => {
			const player = {
				playerName: String(record.get("playerName") || ""),
				appearances: toNumber(record.get("appearances")),
				goals: toNumber(record.get("goals")),
				assists: toNumber(record.get("assists")),
				cleanSheets: toNumber(record.get("cleanSheets")),
				mom: toNumber(record.get("mom")),
				penaltiesScored: toNumber(record.get("penaltiesScored")),
				saves: toNumber(record.get("saves")),
				yellowCards: toNumber(record.get("yellowCards")),
				redCards: toNumber(record.get("redCards")),
				fantasyPoints: toNumber(record.get("fantasyPoints")),
				goalInvolvements: toNumber(record.get("goalInvolvements")),
				homeGames: toNumber(record.get("homeGames")),
				awayGames: toNumber(record.get("awayGames")),
				minutes: toNumber(record.get("minutes")),
				ownGoals: toNumber(record.get("ownGoals")),
				conceded: toNumber(record.get("conceded")),
				penaltiesMissed: toNumber(record.get("penaltiesMissed")),
				penaltiesConceded: toNumber(record.get("penaltiesConceded")),
				penaltiesSaved: toNumber(record.get("penaltiesSaved")),
				distance: toNumber(record.get("distance")),
				starts: toNumber(record.get("starts")),
				goalsPer90: (() => {
					const v = record.get("goalsPer90");
					if (v === null || v === undefined) return null;
					return Math.round(toNumber(v) * 100) / 100;
				})(),
				assistsPer90: (() => {
					const v = record.get("assistsPer90");
					if (v === null || v === undefined) return null;
					return Math.round(toNumber(v) * 100) / 100;
				})(),
				goalInvolvementsPer90: (() => {
					const v = record.get("goalInvolvementsPer90");
					if (v === null || v === undefined) return null;
					return Math.round(toNumber(v) * 100) / 100;
				})(),
				ftpPer90: (() => {
					const v = record.get("ftpPer90");
					if (v === null || v === undefined) return null;
					return Math.round(toNumber(v) * 100) / 100;
				})(),
				cleanSheetsPer90: (() => {
					const v = record.get("cleanSheetsPer90");
					if (v === null || v === undefined) return null;
					return Math.round(toNumber(v) * 100) / 100;
				})(),
				concededPer90: (() => {
					const v = record.get("concededPer90");
					if (v === null || v === undefined) return null;
					return Math.round(toNumber(v) * 100) / 100;
				})(),
				savesPer90: (() => {
					const v = record.get("savesPer90");
					if (v === null || v === undefined) return null;
					return Math.round(toNumber(v) * 100) / 100;
				})(),
				cardsPer90: (() => {
					const v = record.get("cardsPer90");
					if (v === null || v === undefined) return null;
					return Math.round(toNumber(v) * 100) / 100;
				})(),
				momPer90: (() => {
					const v = record.get("momPer90");
					if (v === null || v === undefined) return null;
					return Math.round(toNumber(v) * 100) / 100;
				})(),
				currentFormEwma: (() => {
					const v = record.get("currentFormEwma");
					if (v === null || v === undefined) return null;
					return Math.round(toNumber(v) * 10) / 10;
				})(),
				averageMatchRating: (() => {
					const v = record.get("averageMatchRating");
					if (v === null || v === undefined) return null as number | null;
					const n = typeof v === "number" ? v : toNumber(v);
					return Math.round(n * 10) / 10;
				})(),
				matchesRated8Plus: toNumber(record.get("matchesRated8Plus")),
			};
			console.log(`[TopPlayersStats] Player: ${player.playerName}, ${statType}: ${player[statField as keyof typeof player]}, statType: ${statType}`);
			return player;
		});

		console.log(`[TopPlayersStats] Returning ${players.length} players for statType: ${statType}`);
		return NextResponse.json({ players }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching top players stats:", error);
		return NextResponse.json({ error: "Failed to fetch top players stats" }, { status: 500, headers: corsHeaders });
	}
}

