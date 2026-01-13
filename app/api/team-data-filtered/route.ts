import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { buildFilterConditions } from "../player-data/route";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";

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
			typeof filters.opposition.allOpposition !== "boolean" ||
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
	try {
		const body = await request.json();
		const { teamName, filters } = body;

		// Enhanced validation
		if (!teamName || typeof teamName !== "string" || teamName.trim() === "") {
			return NextResponse.json({ error: "Valid team name is required" }, { status: 400, headers: corsHeaders });
		}

		if (!filters || typeof filters !== "object") {
			return NextResponse.json({ error: "Filters object is required" }, { status: 400, headers: corsHeaders });
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

		// Build query with filters using shared query builder
		const { query, params } = buildTeamStatsQuery(teamName, filters);

		// Create a copy-pasteable query for manual testing
		const copyPasteQuery = query.replace(/\$(\w+)/g, (match, paramName) => {
			const value = params[paramName];
			if (Array.isArray(value)) {
				return `[${value.map((v) => `"${v}"`).join(", ")}]`;
			} else if (typeof value === "string") {
				return `"${value}"`;
			}
			return value;
		});
		console.log(`[Team Filter API] COPY-PASTE QUERY FOR MANUAL TESTING:`);
		console.log(copyPasteQuery);

		let result;
		try {
			result = await neo4jService.runQuery(query, params);
		} catch (queryError: any) {
			console.error("Cypher query error:", queryError);
			console.error("Query:", query);
			console.error("Params:", JSON.stringify(params, null, 2));
			// Security: Don't expose error details to client
			return NextResponse.json(
				{ error: "Query execution failed. Please try again later." },
				{ status: 500, headers: corsHeaders }
			);
		}

		if (result.records.length === 0) {
			return NextResponse.json({ error: "Team not found or no matches for filters" }, { status: 404, headers: corsHeaders });
		}

		// Helper function to convert Neo4j Integer/Float to JavaScript number
		const toNumber = (value: any): number => {
			if (value === null || value === undefined) return 0;
			if (typeof value === "number") {
				if (isNaN(value)) return 0;
				return value;
			}
			// Handle Neo4j Integer objects
			if (typeof value === "object") {
				if ("toNumber" in value && typeof value.toNumber === "function") {
					return value.toNumber();
				}
				if ("low" in value && "high" in value) {
					// Neo4j Integer format: low + high * 2^32
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
		console.error("Error fetching filtered team data:", error);
		return NextResponse.json({ error: "Failed to fetch filtered team data" }, { status: 500, headers: corsHeaders });
	}
}

