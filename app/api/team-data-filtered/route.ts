import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { buildFilterConditions } from "../player-data/route";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";
import { dataApiRateLimiter } from "@/lib/middleware/rateLimiter";
import { sanitizeError } from "@/lib/utils/errorSanitizer";
import { log, logError, logQuery } from "@/lib/utils/logger";
import { csrfProtection } from "@/lib/middleware/csrf";
import { computeTeamStreakPayload, type StreakDateRange, type TeamFixtureStreakRow } from "@/lib/stats/teamStreaksComputation";

const corsHeaders = getCorsHeadersWithSecurity();

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// Build unified Cypher query for team stats with aggregation
function buildTeamStatsQuery(teamName: string, filters: any = null): { query: string; params: any } {
	const graphLabel = neo4jService.getGraphLabel();
	const params: any = {
		graphLabel,
	};

	// Check if team filter is provided via filters.teams
	const hasTeamFilter = filters?.teams && Array.isArray(filters.teams) && filters.teams.length > 0;
	
	// Base query - match fixtures
	let query = `
		MATCH (f:Fixture {graphLabel: $graphLabel})
	`;

	// Build filter conditions
	const filterConditions = buildFilterConditions(filters, params);
	
	// If teamName is provided and not "Whole Club", use it (backward compatibility)
	// Otherwise, rely on filters.teams for team filtering
	if (teamName && teamName !== "Whole Club" && !hasTeamFilter) {
		params.teamName = teamName;
		query += ` WHERE f.team = $teamName`;
	}
	
	// Keep team filter from filterConditions if present (filters.teams)
	// Remove it only if we're using teamName parameter instead
	// Also separate position filters (which reference md) from fixture filters
	const positionConditions = filterConditions.filter((cond) => cond.includes("md.class"));
	const fixtureConditions = filterConditions.filter((cond) => !cond.includes("md.class"));
	
	const conditions = hasTeamFilter || teamName === "Whole Club" || !teamName
		? fixtureConditions // Keep all fixture conditions including team filter if using filters.teams
		: fixtureConditions.filter((cond) => !cond.includes("f.team IN $teams")); // Remove if using teamName
	
	if (conditions.length > 0) {
		const hasWhereClause = query.includes("WHERE");
		query += hasWhereClause ? ` AND ${conditions.join(" AND ")}` : ` WHERE ${conditions.join(" AND ")}`;
	}

	// Aggregate team-level stats from Fixture and player-level stats from MatchDetail
	query += `
		WITH f
		OPTIONAL MATCH (f)-[:HAS_MATCH_DETAILS]->(md:MatchDetail {graphLabel: $graphLabel})
	`;
	
	// Apply position filters after md is matched
	// If position doesn't match, md will be null (filtered out), which is correct for aggregation
	if (positionConditions.length > 0) {
		query += ` WHERE ${positionConditions.join(" AND ")}`;
	}
	
	query += `
		OPTIONAL MATCH (md)<-[:PLAYED_IN]-(p:Player {graphLabel: $graphLabel})
		WITH f, md, p
		// Aggregate team-level stats from fixtures (use collect DISTINCT to avoid counting fixtures multiple times)
		// Always use "Whole Club" as team label when aggregating (either all teams or filtered teams)
		WITH "Whole Club" as team,
			collect(DISTINCT f) as fixtures,
			// Aggregate player-level stats from match details
			count(md) as totalAppearances,
			count(DISTINCT p.playerName) as numberOfPlayers,
			sum(coalesce(md.minutes, 0)) as totalMinutes,
			sum(coalesce(md.mom, 0)) as totalMOM,
			sum(coalesce(md.goals, 0)) as totalGoals,
			sum(coalesce(md.assists, 0)) as totalAssists,
			sum(coalesce(md.yellowCards, 0)) as totalYellowCards,
			sum(coalesce(md.redCards, 0)) as totalRedCards,
			sum(coalesce(md.saves, 0)) as totalSaves,
			sum(coalesce(md.ownGoals, 0)) as totalOwnGoals,
			sum(coalesce(md.cleanSheets, 0)) as totalPlayerCleanSheets,
			sum(coalesce(md.penaltiesScored, 0)) as totalPenaltiesScored,
			sum(coalesce(md.penaltiesMissed, 0)) as totalPenaltiesMissed,
			sum(coalesce(md.penaltiesConceded, 0)) as totalPenaltiesConceded,
			sum(coalesce(md.penaltiesSaved, 0)) as totalPenaltiesSaved,
			sum(coalesce(md.fantasyPoints, 0)) as totalFantasyPoints,
			sum(coalesce(md.distance, 0)) as totalDistance
		// Extract fixture-level stats from distinct fixtures
		WITH team, fixtures, totalAppearances, numberOfPlayers, totalMinutes, totalMOM, totalGoals, totalAssists,
			totalYellowCards, totalRedCards, totalSaves, totalOwnGoals, totalPlayerCleanSheets,
			totalPenaltiesScored, totalPenaltiesMissed, totalPenaltiesConceded, totalPenaltiesSaved,
			totalFantasyPoints, totalDistance,
			size(fixtures) as gamesPlayed,
			size([fx in fixtures WHERE fx.result = "W"]) as wins,
			size([fx in fixtures WHERE fx.result = "D"]) as draws,
			size([fx in fixtures WHERE fx.result = "L"]) as losses,
			reduce(total = 0, fx in fixtures | total + coalesce(fx.dorkiniansGoals, 0)) as goalsScored,
			reduce(total = 0, fx in fixtures | total + coalesce(fx.conceded, 0)) as goalsConceded,
			size([fx in fixtures WHERE coalesce(fx.conceded, 0) = 0]) as cleanSheets,
			size([fx in fixtures WHERE fx.homeOrAway = "Home"]) as homeGames,
			size([fx in fixtures WHERE fx.homeOrAway = "Home" AND fx.result = "W"]) as homeWins,
			size([fx in fixtures WHERE fx.homeOrAway = "Away"]) as awayGames,
			size([fx in fixtures WHERE fx.homeOrAway = "Away" AND fx.result = "W"]) as awayWins,
			[x IN [fx IN fixtures | fx.season] WHERE x IS NOT NULL | x] as allSeasons,
			[x IN [fx IN fixtures | fx.competition] WHERE x IS NOT NULL | x] as allCompetitions
		// Get distinct seasons and competitions
		UNWIND allSeasons as season
		WITH team, gamesPlayed, wins, draws, losses, goalsScored, goalsConceded, cleanSheets,
			homeGames, homeWins, awayGames, awayWins, allCompetitions, totalAppearances, numberOfPlayers, totalMinutes, totalMOM, totalGoals, totalAssists,
			totalYellowCards, totalRedCards, totalSaves, totalOwnGoals, totalPlayerCleanSheets,
			totalPenaltiesScored, totalPenaltiesMissed, totalPenaltiesConceded, totalPenaltiesSaved,
			totalFantasyPoints, totalDistance,
			collect(DISTINCT season) as seasons
		UNWIND allCompetitions as competition
		WITH team, gamesPlayed, wins, draws, losses, goalsScored, goalsConceded, cleanSheets,
			homeGames, homeWins, awayGames, awayWins, seasons, totalAppearances, numberOfPlayers, totalMinutes, totalMOM, totalGoals, totalAssists,
			totalYellowCards, totalRedCards, totalSaves, totalOwnGoals, totalPlayerCleanSheets,
			totalPenaltiesScored, totalPenaltiesMissed, totalPenaltiesConceded, totalPenaltiesSaved,
			totalFantasyPoints, totalDistance,
			collect(DISTINCT competition) as competitions
		// Calculate derived stats
		WITH team, gamesPlayed, wins, draws, losses, goalsScored, goalsConceded, cleanSheets,
			homeGames, homeWins, awayGames, awayWins, seasons, competitions,
			totalAppearances, numberOfPlayers, totalMinutes, totalMOM, totalGoals, totalAssists,
			totalYellowCards, totalRedCards, totalSaves, totalOwnGoals, totalPlayerCleanSheets,
			totalPenaltiesScored, totalPenaltiesMissed, totalPenaltiesConceded, totalPenaltiesSaved,
			totalFantasyPoints, totalDistance,
			goalsScored - goalsConceded as goalDifference,
			CASE WHEN gamesPlayed > 0 THEN toFloat(wins) / gamesPlayed * 100 ELSE 0.0 END as winPercentage,
			CASE WHEN gamesPlayed > 0 THEN toFloat(goalsScored) / gamesPlayed ELSE 0.0 END as goalsPerGame,
			CASE WHEN gamesPlayed > 0 THEN toFloat(goalsConceded) / gamesPlayed ELSE 0.0 END as goalsConcededPerGame,
			CASE WHEN gamesPlayed > 0 THEN toFloat(wins * 3 + draws * 1 + losses * 0) / gamesPlayed ELSE 0.0 END as pointsPerGame,
			CASE WHEN homeGames > 0 THEN toFloat(homeWins) / homeGames * 100 ELSE 0.0 END as homeWinPercentage,
			CASE WHEN awayGames > 0 THEN toFloat(awayWins) / awayGames * 100 ELSE 0.0 END as awayWinPercentage,
			CASE WHEN totalAppearances > 0 THEN toFloat(totalGoals) / totalAppearances ELSE 0.0 END as goalsPerAppearance,
			CASE WHEN totalAppearances > 0 THEN toFloat(totalAssists) / totalAppearances ELSE 0.0 END as assistsPerAppearance,
			CASE WHEN totalAppearances > 0 THEN toFloat(totalMOM) / totalAppearances ELSE 0.0 END as momPerAppearance,
			CASE WHEN totalAppearances > 0 THEN toFloat(totalMinutes) / totalAppearances ELSE 0.0 END as minutesPerAppearance,
			CASE WHEN totalAppearances > 0 THEN toFloat(totalFantasyPoints) / totalAppearances ELSE 0.0 END as fantasyPointsPerAppearance,
			size(seasons) as numberOfSeasons,
			size(competitions) as numberOfCompetitions
		RETURN team,
			coalesce(gamesPlayed, 0) as gamesPlayed,
			coalesce(wins, 0) as wins,
			coalesce(draws, 0) as draws,
			coalesce(losses, 0) as losses,
			coalesce(goalsScored, 0) as goalsScored,
			coalesce(goalsConceded, 0) as goalsConceded,
			coalesce(goalDifference, 0) as goalDifference,
			coalesce(cleanSheets, 0) as cleanSheets,
			coalesce(winPercentage, 0.0) as winPercentage,
			coalesce(goalsPerGame, 0.0) as goalsPerGame,
			coalesce(goalsConcededPerGame, 0.0) as goalsConcededPerGame,
			coalesce(pointsPerGame, 0.0) as pointsPerGame,
			coalesce(homeGames, 0) as homeGames,
			coalesce(homeWins, 0) as homeWins,
			coalesce(homeWinPercentage, 0.0) as homeWinPercentage,
			coalesce(awayGames, 0) as awayGames,
			coalesce(awayWins, 0) as awayWins,
			coalesce(awayWinPercentage, 0.0) as awayWinPercentage,
			coalesce(totalAppearances, 0) as totalAppearances,
			coalesce(numberOfPlayers, 0) as numberOfPlayers,
			coalesce(totalMinutes, 0) as totalMinutes,
			coalesce(totalMOM, 0) as totalMOM,
			coalesce(totalGoals, 0) as totalGoals,
			coalesce(totalAssists, 0) as totalAssists,
			coalesce(totalYellowCards, 0) as totalYellowCards,
			coalesce(totalRedCards, 0) as totalRedCards,
			coalesce(totalSaves, 0) as totalSaves,
			coalesce(totalOwnGoals, 0) as totalOwnGoals,
			coalesce(totalPlayerCleanSheets, 0) as totalPlayerCleanSheets,
			coalesce(totalPenaltiesScored, 0) as totalPenaltiesScored,
			coalesce(totalPenaltiesMissed, 0) as totalPenaltiesMissed,
			coalesce(totalPenaltiesConceded, 0) as totalPenaltiesConceded,
			coalesce(totalPenaltiesSaved, 0) as totalPenaltiesSaved,
			coalesce(totalFantasyPoints, 0) as totalFantasyPoints,
			coalesce(totalDistance, 0) as totalDistance,
			coalesce(goalsPerAppearance, 0.0) as goalsPerAppearance,
			coalesce(assistsPerAppearance, 0.0) as assistsPerAppearance,
			coalesce(momPerAppearance, 0.0) as momPerAppearance,
			coalesce(minutesPerAppearance, 0.0) as minutesPerAppearance,
			coalesce(fantasyPointsPerAppearance, 0.0) as fantasyPointsPerAppearance,
			coalesce(numberOfSeasons, 0) as numberOfSeasons,
			coalesce(numberOfCompetitions, 0) as numberOfCompetitions
	`;

	return { query, params };
}

/** Fixture-level formation counts (excludes position filters - formation is derived from starters). */
function buildFormationBreakdownQuery(teamName: string, filters: any = null): { query: string; params: any } {
	const graphLabel = neo4jService.getGraphLabel();
	const params: any = { graphLabel };
	const hasTeamFilter = filters?.teams && Array.isArray(filters.teams) && filters.teams.length > 0;

	let query = `
		MATCH (f:Fixture {graphLabel: $graphLabel})
	`;

	const filterConditions = buildFilterConditions(filters, params);
	const fixtureConditions = filterConditions.filter((cond) => !cond.includes("md.class"));

	const clauses: string[] = [];

	if (teamName && teamName !== "Whole Club" && !hasTeamFilter) {
		params.teamName = teamName;
		clauses.push(`f.team = $teamName`);
	}

	const useTeamsFromFilters = hasTeamFilter || teamName === "Whole Club" || !teamName;
	const fc = useTeamsFromFilters
		? fixtureConditions
		: fixtureConditions.filter((cond) => !cond.includes("f.team IN $teams"));
	clauses.push(...fc);

	clauses.push(`f.inferredFormation IS NOT NULL AND trim(toString(f.inferredFormation)) <> ""`);

	query += ` WHERE ${clauses.join(" AND ")}
		WITH f.inferredFormation as formation, f.result as res
		WITH formation, count(*) as games,
			sum(CASE WHEN res = "W" THEN 1 ELSE 0 END) as wins
		RETURN formation, games, wins
		ORDER BY games DESC
	`;

	return { query, params };
}

const TEAM_STREAK_SPECS = [
	{ category: "wins", label: "Wins", prop: "currentWinStreak", conditionKey: "wins" },
	{ category: "unbeaten", label: "Unbeaten", prop: "currentUnbeatenStreak", conditionKey: "unbeaten" },
	{ category: "goalsScored", label: "Goals Scored", prop: "currentScoringStreak", conditionKey: "goalsScored" },
	{ category: "cleanSheets", label: "Clean Sheets", prop: "currentCleanSheetStreak", conditionKey: "cleanSheets" },
	{ category: "noCards", label: "No Cards", prop: "currentDisciplineStreak", conditionKey: "noCards" },
] as const;

type TeamStreakLeader = {
	category: (typeof TEAM_STREAK_SPECS)[number]["category"];
	label: (typeof TEAM_STREAK_SPECS)[number]["label"];
	playerName: string;
	value: number;
	startDate: string | null;
	endDate: string | null;
};

function buildTeamNameAliases(teamName: string): string[] {
	const raw = String(teamName || "").trim();
	if (!raw) return [];
	const out = new Set<string>();
	out.add(raw);
	const lower = raw.toLowerCase();

	const addOrdinalAndShort = (n: number) => {
		if (!Number.isFinite(n) || n <= 0 || n > 20) return;
		const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
		out.add(`${n}s`);
		out.add(`${n}${suffix} XI`);
		out.add(`${n}${suffix} xi`);
	};

	const shortMatch = /^(\d+)s$/i.exec(raw);
	if (shortMatch) {
		addOrdinalAndShort(Number(shortMatch[1]));
	}

	const ordinalMatch = /^(\d+)(st|nd|rd|th)\s*xi$/i.exec(raw);
	if (ordinalMatch) {
		addOrdinalAndShort(Number(ordinalMatch[1]));
	}

	// Handle forms like "Dorkinians 3rd XI"
	const embeddedOrdinal = /(?:^|\s)(\d+)(st|nd|rd|th)\s*xi$/i.exec(raw);
	if (embeddedOrdinal) {
		addOrdinalAndShort(Number(embeddedOrdinal[1]));
	}

	// Handle forms like "Dorkinians 3s"
	const embeddedShort = /(?:^|\s)(\d+)s$/i.exec(lower);
	if (embeddedShort) {
		addOrdinalAndShort(Number(embeddedShort[1]));
	}

	return [...out];
}

/** Longest active streak per category for players whose primary XI matches the selected team. */
async function fetchTeamStreakLeaders(
	teamName: string,
	graphLabel: string,
	toNumber: (value: unknown) => number,
): Promise<TeamStreakLeader[]> {
	const isWholeClub = teamName === "Whole Club";
	const teamAliases = buildTeamNameAliases(teamName);
	const results = await Promise.all(
		TEAM_STREAK_SPECS.map(async ({ category, label, prop, conditionKey }) => {
			const query = `
				MATCH (p:Player {graphLabel: $graphLabel})
				WHERE coalesce(p.allowOnSite, true) = true
				  AND ($isWholeClub = true OR p.mostPlayedForTeam IN $teamAliases)
				RETURN p.playerName as playerName, p.${prop} as value
				ORDER BY value DESC, playerName ASC
				LIMIT 1
			`;
			const r = await neo4jService.runQuery(query, { graphLabel, teamAliases, isWholeClub });
			if (!r.records.length) return null;
			const rec = r.records[0];
			const playerName = String(rec.get("playerName") ?? "");
			if (!playerName) return null;
			const value = toNumber(rec.get("value"));
			const range = await fetchPlayerCurrentStreakRange(playerName, graphLabel, conditionKey, value);
			return { category, label, playerName, value, startDate: range.startDate, endDate: range.endDate };
		}),
	);
	return results.filter((x): x is TeamStreakLeader => x != null);
}

function toIsoDateString(dateVal: unknown): string | null {
	if (dateVal == null) return null;
	if (typeof dateVal === "string") {
		const ms = Date.parse(dateVal);
		return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
	}
	if (typeof dateVal === "object" && dateVal !== null && "year" in dateVal && "month" in dateVal && "day" in dateVal) {
		const o = dateVal as { year: unknown; month: unknown; day: unknown };
		const y = toNumberLike(o.year);
		const m = toNumberLike(o.month);
		const d = toNumberLike(o.day);
		if (y <= 0 || m <= 0 || d <= 0) return null;
		return new Date(y, m - 1, d).toISOString().slice(0, 10);
	}
	if (dateVal instanceof Date) return dateVal.toISOString().slice(0, 10);
	return null;
}

function toNumberLike(value: unknown): number {
	if (value === null || value === undefined) return 0;
	const num = Number(value);
	return Number.isFinite(num) ? num : 0;
}

type LeaderConditionKey = (typeof TEAM_STREAK_SPECS)[number]["conditionKey"];

async function fetchPlayerCurrentStreakRange(
	playerName: string,
	graphLabel: string,
	conditionKey: LeaderConditionKey,
	currentValue: number,
): Promise<StreakDateRange> {
	if (currentValue <= 0) return { startDate: null, endDate: null };
	const query = `
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})<-[:HAS_MATCH_DETAILS]-(f:Fixture {graphLabel: $graphLabel})
		WHERE f.date IS NOT NULL AND coalesce(f.status, '') NOT IN ['Void', 'Postponed', 'Abandoned']
		RETURN f.date AS date, f.result AS result, f.dorkiniansGoals AS goalsScored, f.conceded AS goalsConceded,
		       md.yellowCards AS yellowCards, md.redCards AS redCards
		ORDER BY f.date ASC
	`;
	const result = await neo4jService.runQuery(query, { graphLabel, playerName });
	if (!result.records.length) return { startDate: null, endDate: null };

	let current = 0;
	let startDate: string | null = null;
	let endDate: string | null = null;

	for (const rec of result.records) {
		const date = toIsoDateString(rec.get("date"));
		const resultCode = String(rec.get("result") ?? "").toUpperCase();
		const goalsScored = toNumberLike(rec.get("goalsScored"));
		const goalsConceded = toNumberLike(rec.get("goalsConceded"));
		const totalCards = toNumberLike(rec.get("yellowCards")) + toNumberLike(rec.get("redCards"));
		let pass = false;

		if (conditionKey === "wins") pass = resultCode === "W";
		if (conditionKey === "unbeaten") pass = resultCode !== "L";
		if (conditionKey === "goalsScored") pass = goalsScored >= 1;
		if (conditionKey === "cleanSheets") pass = goalsConceded === 0;
		if (conditionKey === "noCards") pass = totalCards === 0;

		if (pass) {
			if (current === 0) startDate = date;
			current += 1;
			endDate = date;
			continue;
		}

		current = 0;
		startDate = null;
		endDate = null;
	}

	return current > 0 ? { startDate, endDate } : { startDate: null, endDate: null };
}

function buildTeamStreakFixturesQuery(teamName: string, filters: any = null): { query: string; params: any } {
	const graphLabel = neo4jService.getGraphLabel();
	const params: any = { graphLabel };
	const hasTeamFilter = filters?.teams && Array.isArray(filters.teams) && filters.teams.length > 0;
	const filterConditions = buildFilterConditions(filters, params);
	const fixtureConditions = filterConditions.filter((cond) => !cond.includes("md.class"));
	let query = `MATCH (f:Fixture {graphLabel: $graphLabel})`;

	if (teamName && teamName !== "Whole Club" && !hasTeamFilter) {
		params.teamName = teamName;
		query += ` WHERE f.team = $teamName`;
	}

	const useTeamsFromFilters = hasTeamFilter || teamName === "Whole Club" || !teamName;
	const conditions = useTeamsFromFilters
		? fixtureConditions
		: fixtureConditions.filter((cond) => !cond.includes("f.team IN $teams"));
	if (conditions.length > 0) {
		const hasWhereClause = query.includes("WHERE");
		query += hasWhereClause ? ` AND ${conditions.join(" AND ")}` : ` WHERE ${conditions.join(" AND ")}`;
	}

	query += `
		OPTIONAL MATCH (f)-[:HAS_MATCH_DETAILS]->(md:MatchDetail {graphLabel: $graphLabel})
		WITH f, sum(coalesce(md.yellowCards, 0) + coalesce(md.redCards, 0)) AS totalCards
		RETURN f.season AS season,
		       f.date AS date,
		       f.result AS result,
		       coalesce(f.dorkiniansGoals, 0) AS goalsScored,
		       coalesce(f.conceded, 0) AS goalsConceded,
		       coalesce(totalCards, 0) AS totalCards
		ORDER BY f.date ASC
	`;

	return { query, params };
}

// Validation function for filter structure (reused from player-data-filtered)
function validateFilters(filters: any): string | null {
	// Validate timeRange
	if (filters.timeRange) {
		const { type, seasons, beforeDate, afterDate, startDate, endDate } = filters.timeRange;

		if (!type || !["season", "beforeDate", "afterDate", "betweenDates", "allTime"].includes(type)) {
			return "Invalid timeRange type";
		}

		if (type === "season" && (!seasons || !Array.isArray(seasons) || seasons.length === 0)) {
			return "Seasons array is required for season filter";
		}

		if (type === "beforeDate" && !beforeDate) {
			return "beforeDate is required for beforeDate filter";
		}

		if (type === "afterDate" && !afterDate) {
			return "afterDate is required for afterDate filter";
		}

		if (type === "betweenDates" && (!startDate || !endDate)) {
			return "startDate and endDate are required for betweenDates filter";
		}
	}

	// Validate location
	if (filters.location && (!Array.isArray(filters.location) || filters.location.some((loc: any) => !["Home", "Away"].includes(loc)))) {
		return "Location must be an array containing 'Home' and/or 'Away'";
	}

	// Validate opposition
	if (filters.opposition) {
		if (
			typeof filters.opposition !== "object" ||
			!["all", "club", "team"].includes(filters.opposition.mode ?? "all") ||
			(typeof filters.opposition.searchTerm !== "string" && filters.opposition.searchTerm !== undefined)
		) {
			return "Invalid opposition filter structure";
		}
	}

	// Validate competition
	if (filters.competition) {
		if (typeof filters.competition !== "object") {
			return "Competition filter must be an object";
		}

		if (
			filters.competition.types &&
			(!Array.isArray(filters.competition.types) ||
				filters.competition.types.some((type: any) => !["League", "Cup", "Friendly"].includes(type)))
		) {
			return "Competition types must be an array containing 'League', 'Cup', and/or 'Friendly'";
		}

		if (filters.competition.searchTerm && typeof filters.competition.searchTerm !== "string") {
			return "Competition search term must be a string";
		}
	}

	// Validate result
	if (
		filters.result &&
		(!Array.isArray(filters.result) || filters.result.some((result: any) => !["Win", "Draw", "Loss"].includes(result)))
	) {
		return "Result must be an array containing 'Win', 'Draw', and/or 'Loss'";
	}

	return null;
}

export async function POST(request: NextRequest) {
	// Apply rate limiting
	const rateLimitResponse = await dataApiRateLimiter(request);
	if (rateLimitResponse) {
		return rateLimitResponse;
	}

	// CSRF protection for state-changing endpoint
	const csrfResponse = csrfProtection(request);
	if (csrfResponse) {
		return csrfResponse;
	}

	// Input length validation constants
	const MAX_TEAM_NAME_LENGTH = 200;
	const MAX_FILTER_ARRAY_LENGTH = 100;

	try {
		const body = await request.json();
		const { teamName, filters } = body;

		// Enhanced validation
		if (!teamName || typeof teamName !== "string" || teamName.trim() === "") {
			return NextResponse.json({ error: "Valid team name is required" }, { status: 400, headers: corsHeaders });
		}

		// Validate team name length
		if (teamName.length > MAX_TEAM_NAME_LENGTH) {
			return NextResponse.json(
				{ error: `Team name too long. Maximum ${MAX_TEAM_NAME_LENGTH} characters allowed.` },
				{ status: 400, headers: corsHeaders }
			);
		}

		if (!filters || typeof filters !== "object") {
			return NextResponse.json({ error: "Filters object is required" }, { status: 400, headers: corsHeaders });
		}

		// Validate filter array lengths to prevent DoS
		if (filters.teams && Array.isArray(filters.teams) && filters.teams.length > MAX_FILTER_ARRAY_LENGTH) {
			return NextResponse.json(
				{ error: `Too many teams in filter. Maximum ${MAX_FILTER_ARRAY_LENGTH} teams allowed.` },
				{ status: 400, headers: corsHeaders }
			);
		}
		if (filters.seasons && Array.isArray(filters.seasons) && filters.seasons.length > MAX_FILTER_ARRAY_LENGTH) {
			return NextResponse.json(
				{ error: `Too many seasons in filter. Maximum ${MAX_FILTER_ARRAY_LENGTH} seasons allowed.` },
				{ status: 400, headers: corsHeaders }
			);
		}

		// Validate filter structure
		const validationError = validateFilters(filters);
		if (validationError) {
			return NextResponse.json({ error: validationError }, { status: 400, headers: corsHeaders });
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const toNumber = (value: unknown): number => {
			if (value === null || value === undefined) return 0;
			if (typeof value === "number") {
				if (isNaN(value)) return 0;
				return value;
			}
			if (typeof value === "object") {
				if ("toNumber" in value && typeof (value as { toNumber?: () => number }).toNumber === "function") {
					return (value as { toNumber: () => number }).toNumber();
				}
				if ("low" in value && "high" in value) {
					const v = value as { low?: number; high?: number };
					const low = v.low || 0;
					const high = v.high || 0;
					return low + high * 4294967296;
				}
				if ("toString" in value && typeof (value as { toString: () => string }).toString === "function") {
					const num = Number((value as { toString: () => string }).toString());
					return isNaN(num) ? 0 : num;
				}
			}
			const num = Number(value);
			return isNaN(num) ? 0 : num;
		};

		// Build query with filters using shared query builder
		const { query, params } = buildTeamStatsQuery(teamName, filters);

		// Log query (sanitized in production)
		logQuery("Team data filtered query", query, params);

		// Create a copy-pasteable query for manual testing (only in development)
		let copyPasteQuery: string | undefined;
		if (process.env.NODE_ENV === "development") {
			copyPasteQuery = query.replace(/\$(\w+)/g, (match, paramName) => {
				const value = params[paramName];
				if (Array.isArray(value)) {
					return `[${value.map((v) => `"${v}"`).join(", ")}]`;
				} else if (typeof value === "string") {
					return `"${value}"`;
				}
				return value;
			});
		}

		let result;
		let formationResult;
		let streakLeaders: TeamStreakLeader[] = [];
		let teamStreaks = null;
		try {
			result = await neo4jService.runQuery(query, params);
			const { query: formQuery, params: formParams } = buildFormationBreakdownQuery(teamName, filters);
			formationResult = await neo4jService.runQuery(formQuery, formParams);
			const { query: streakFixturesQuery, params: streakFixturesParams } = buildTeamStreakFixturesQuery(teamName, filters);
			const streakFixturesResult = await neo4jService.runQuery(streakFixturesQuery, streakFixturesParams);
			const streakRows = (streakFixturesResult.records || []).map((r: { get: (key: string) => unknown }) => ({
				season: String(r.get("season") ?? ""),
				date: r.get("date"),
				result: String(r.get("result") ?? ""),
				goalsScored: toNumber(r.get("goalsScored")),
				goalsConceded: toNumber(r.get("goalsConceded")),
				totalCards: toNumber(r.get("totalCards")),
			})) as TeamFixtureStreakRow[];
			teamStreaks = computeTeamStreakPayload(streakRows);
			try {
				streakLeaders = await fetchTeamStreakLeaders(teamName, neo4jService.getGraphLabel(), toNumber);
			} catch (streakErr) {
				logError("Team streak leaders query error", streakErr);
				streakLeaders = [];
			}
		} catch (queryError: any) {
			logError("Cypher query error", queryError);
			// Security: Don't expose error details to client
			return NextResponse.json(
				{ error: "Query execution failed. Please try again later." },
				{ status: 500, headers: corsHeaders }
			);
		}

		if (result.records.length === 0) {
			return NextResponse.json({ error: "Team not found or no matches for filters" }, { status: 404, headers: corsHeaders });
		}

		// Extract aggregated stats from result
		const record = result.records[0];
		// Always use "Whole Club" as team name since we're aggregating stats
		const teamData = {
			team: "Whole Club",
			gamesPlayed: toNumber(record.get("gamesPlayed")),
			wins: toNumber(record.get("wins")),
			draws: toNumber(record.get("draws")),
			losses: toNumber(record.get("losses")),
			goalsScored: toNumber(record.get("goalsScored")),
			goalsConceded: toNumber(record.get("goalsConceded")),
			goalDifference: toNumber(record.get("goalDifference")),
			cleanSheets: toNumber(record.get("cleanSheets")),
			winPercentage: toNumber(record.get("winPercentage")),
			goalsPerGame: toNumber(record.get("goalsPerGame")),
			goalsConcededPerGame: toNumber(record.get("goalsConcededPerGame")),
			pointsPerGame: toNumber(record.get("pointsPerGame")),
			homeGames: toNumber(record.get("homeGames")),
			homeWins: toNumber(record.get("homeWins")),
			homeWinPercentage: toNumber(record.get("homeWinPercentage")),
			awayGames: toNumber(record.get("awayGames")),
			awayWins: toNumber(record.get("awayWins")),
			awayWinPercentage: toNumber(record.get("awayWinPercentage")),
			totalAppearances: toNumber(record.get("totalAppearances")),
			numberOfPlayers: toNumber(record.get("numberOfPlayers")),
			totalMinutes: toNumber(record.get("totalMinutes")),
			totalMOM: toNumber(record.get("totalMOM")),
			totalGoals: toNumber(record.get("totalGoals")),
			totalAssists: toNumber(record.get("totalAssists")),
			totalYellowCards: toNumber(record.get("totalYellowCards")),
			totalRedCards: toNumber(record.get("totalRedCards")),
			totalSaves: toNumber(record.get("totalSaves")),
			totalOwnGoals: toNumber(record.get("totalOwnGoals")),
			totalPlayerCleanSheets: toNumber(record.get("totalPlayerCleanSheets")),
			totalPenaltiesScored: toNumber(record.get("totalPenaltiesScored")),
			totalPenaltiesMissed: toNumber(record.get("totalPenaltiesMissed")),
			totalPenaltiesConceded: toNumber(record.get("totalPenaltiesConceded")),
			totalPenaltiesSaved: toNumber(record.get("totalPenaltiesSaved")),
			totalFantasyPoints: Math.round(toNumber(record.get("totalFantasyPoints"))),
			totalDistance: toNumber(record.get("totalDistance")),
			goalsPerAppearance: toNumber(record.get("goalsPerAppearance")),
			assistsPerAppearance: toNumber(record.get("assistsPerAppearance")),
			momPerAppearance: toNumber(record.get("momPerAppearance")),
			minutesPerAppearance: toNumber(record.get("minutesPerAppearance")),
			fantasyPointsPerAppearance: toNumber(record.get("fantasyPointsPerAppearance")),
			numberOfSeasons: toNumber(record.get("numberOfSeasons")),
			numberOfCompetitions: toNumber(record.get("numberOfCompetitions")),
			formationBreakdown: (formationResult?.records || []).map((r: { get: (key: string) => unknown }) => {
				const games = toNumber(r.get("games"));
				const wins = toNumber(r.get("wins"));
				return {
					formation: String(r.get("formation") || ""),
					games,
					wins,
					winPercentage: games > 0 ? Math.round((wins / games) * 1000) / 10 : 0,
				};
			}),
			...(teamStreaks ? { teamStreaks } : {}),
			...(streakLeaders.length > 0 ? { streakLeaders } : {}),
		};

		// Include copyable query in response for debugging
		const response = {
			teamData,
			debug: {
				copyPasteQuery,
			},
		};

		return NextResponse.json(response, { headers: corsHeaders });
	} catch (error) {
		logError("Error fetching filtered team data", error);
		// Sanitize error for production
		const sanitized = sanitizeError(error, process.env.NODE_ENV === "production");
		return NextResponse.json({ error: sanitized.message }, { status: 500, headers: corsHeaders });
	}
}

