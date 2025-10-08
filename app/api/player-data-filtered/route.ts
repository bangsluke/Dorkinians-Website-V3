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

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { playerName, filters } = body;

		// Enhanced validation
		if (!playerName || typeof playerName !== "string" || playerName.trim() === "") {
			return NextResponse.json({ error: "Valid player name is required" }, { status: 400, headers: corsHeaders });
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

		// Performance monitoring
		const startTime = Date.now();

		// Build the optimized filtered query - corrected to match actual schema
		let query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		`;

		const params: any = {
			graphLabel: neo4jService.getGraphLabel(),
			playerName: playerName,
		};

		// Build filter conditions efficiently
		const conditions: string[] = [];

		// Time Range filters - optimized for performance
		if (filters.timeRange) {
			const { type, seasons, beforeDate, afterDate, startDate, endDate } = filters.timeRange;

			if (type === "season" && seasons && seasons.length > 0) {
				conditions.push(`f.season IN $seasons`);
				params.seasons = seasons;
			} else if (type === "beforeDate" && beforeDate) {
				conditions.push(`f.date <= $beforeDate`);
				params.beforeDate = beforeDate;
			} else if (type === "afterDate" && afterDate) {
				conditions.push(`f.date >= $afterDate`);
				params.afterDate = afterDate;
			} else if (type === "betweenDates" && startDate && endDate) {
				conditions.push(`f.date >= $startDate AND f.date <= $endDate`);
				params.startDate = startDate;
				params.endDate = endDate;
			}
		}

		// Team filters - use index-friendly IN clause
		if (filters.teams && filters.teams.length > 0) {
			conditions.push(`f.team IN $teams`);
			params.teams = filters.teams;
		}

		// Location filters - corrected field name from schema
		if (filters.location && filters.location.length > 0) {
			const locationConditions = filters.location.map((loc: string) => (loc === "Home" ? 'f.homeOrAway = "Home"' : 'f.homeOrAway = "Away"'));
			conditions.push(`(${locationConditions.join(" OR ")})`);
		}

		// Opposition filters - case-insensitive search
		if (filters.opposition && !filters.opposition.allOpposition) {
			if (filters.opposition.searchTerm) {
				conditions.push(`toLower(f.opposition) CONTAINS toLower($oppositionSearch)`);
				params.oppositionSearch = filters.opposition.searchTerm;
			}
		}

		// Competition filters - separate type and name filters
		if (filters.competition) {
			if (filters.competition.types && filters.competition.types.length > 0) {
				conditions.push(`f.compType IN $compTypes`);
				params.compTypes = filters.competition.types;
			}
			if (filters.competition.searchTerm) {
				conditions.push(`toLower(f.competition) CONTAINS toLower($competitionSearch)`);
				params.competitionSearch = filters.competition.searchTerm;
			}
		}

		// Result filters - optimized mapping
		if (filters.result && filters.result.length > 0) {
			const resultMapping: { [key: string]: string } = {
				Win: "W",
				Draw: "D",
				Loss: "L",
			};
			const resultValues = filters.result.map((r: string) => resultMapping[r]).filter(Boolean);
			if (resultValues.length > 0) {
				conditions.push(`f.result IN $results`);
				params.results = resultValues;
			}
		}

		// Position filters - filter by player position/class
		if (filters.position && filters.position.length > 0) {
			conditions.push(`md.class IN $positions`);
			params.positions = filters.position;
		}

		// Apply all conditions at once for better performance
		if (conditions.length > 0) {
			query += ` WHERE ${conditions.join(" AND ")}`;
		}

		// Optimized return with early aggregation - corrected to use MatchDetail data
		query += `
			WITH p, collect(md) as filteredMatchDetails
			RETURN p, filteredMatchDetails
		`;

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
		console.log(`[Filter API] COPY-PASTE QUERY FOR MANUAL TESTING:`);
		console.log(copyPasteQuery);

		const result = await neo4jService.runQuery(query, params);

		if (result.records.length === 0) {
			return NextResponse.json({ error: "Player not found or no matches for filters" }, { status: 404, headers: corsHeaders });
		}

		// Extract player data and calculate filtered stats
		const playerNode = result.records[0].get("p");
		const filteredMatchDetails = result.records[0].get("filteredMatchDetails");

		// Convert Neo4j node objects to plain objects for calculateFilteredStats
		const plainMatchDetails = filteredMatchDetails.map((node: any) => ({
			properties: node.properties,
		}));

		// Calculate filtered stats from the match details
		const filteredStats = calculateFilteredStats(plainMatchDetails);

		// Combine with base player data
		const playerData = {
			id: playerNode.properties.id,
			playerName: playerNode.properties.playerName,
			allowOnSite: playerNode.properties.allowOnSite,
			...filteredStats,
			graphLabel: playerNode.properties.graphLabel,
		};

		// Include copyable query in response for debugging
		const response = {
			playerData,
			debug: {
				copyPasteQuery,
			},
		};

		return NextResponse.json(response, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching filtered player data:", error);
		return NextResponse.json({ error: "Failed to fetch filtered player data" }, { status: 500, headers: corsHeaders });
	}
}

// Validation function for filter structure
function validateFilters(filters: any): string | null {
	// Validate timeRange
	if (filters.timeRange) {
		const { type, seasons, beforeDate, afterDate, startDate, endDate } = filters.timeRange;

		if (!type || !["season", "beforeDate", "afterDate", "betweenDates"].includes(type)) {
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

	// Validate teams
	if (filters.teams && (!Array.isArray(filters.teams) || filters.teams.some((team: any) => typeof team !== "string"))) {
		return "Teams must be an array of strings";
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

function calculateFilteredStats(matchDetails: any[]): any {
	if (!matchDetails || matchDetails.length === 0) {
		// Return zero stats if no match details match
		return {
			// Basic stats
			appearances: 0,
			minutes: 0,
			mom: 0,
			goals: 0,
			assists: 0,
			yellowCards: 0,
			redCards: 0,
			saves: 0,
			ownGoals: 0,
			conceded: 0,
			cleanSheets: 0,
			penaltiesScored: 0,
			penaltiesMissed: 0,
			penaltiesConceded: 0,
			penaltiesSaved: 0,
			fantasyPoints: 0,
			distance: 0,

			// Derived stats
			allGoalsScored: 0,
			openPlayGoalsScored: 0,
			goalInvolvements: 0,
			goalsPerApp: 0,
			concededPerApp: 0,
			minutesPerGoal: 0,
			minutesPerCleanSheet: 0,
			fantasyPointsPerApp: 0,
			minutesPerApp: 0,
			momPerApp: 0,
			yellowCardsPerApp: 0,
			redCardsPerApp: 0,
			savesPerApp: 0,
			ownGoalsPerApp: 0,
			cleanSheetsPerApp: 0,
			penaltiesScoredPerApp: 0,
			penaltiesMissedPerApp: 0,
			penaltiesConcededPerApp: 0,
			penaltiesSavedPerApp: 0,

			// Team and season tracking
			mostPlayedForTeam: "",
			numberTeamsPlayedFor: 0,
			mostScoredForTeam: "",
			numberSeasonsPlayedFor: 0,
		};
	}

	// Calculate stats from filtered fixtures
	let appearances = 0;
	let minutes = 0;
	let mom = 0;
	let goals = 0;
	let assists = 0;
	let yellowCards = 0;
	let redCards = 0;
	let saves = 0;
	let ownGoals = 0;
	let conceded = 0;
	let cleanSheets = 0;
	let penaltiesScored = 0;
	let penaltiesMissed = 0;
	let penaltiesConceded = 0;
	let penaltiesSaved = 0;
	let fantasyPoints = 0;
	let distance = 0;
	let homeGames = 0;
	let homeWins = 0;
	let awayGames = 0;
	let awayWins = 0;

	// Team and season tracking
	const teamCounts: { [key: string]: number } = {};
	const seasonCounts: { [key: string]: number } = {};
	const teamGoals: { [key: string]: number } = {};

	matchDetails.forEach((matchDetail: any) => {
		const props = matchDetail.properties;

		appearances++;
		minutes += Number(props.minutes) || 0;
		mom += Number(props.mom) || 0;
		goals += Number(props.goals) || 0;
		assists += Number(props.assists) || 0;
		yellowCards += Number(props.yellowCards) || 0;
		redCards += Number(props.redCards) || 0;
		saves += Number(props.saves) || 0;
		ownGoals += Number(props.ownGoals) || 0;
		conceded += Number(props.conceded) || 0;
		cleanSheets += Number(props.cleanSheets) || 0;
		penaltiesScored += Number(props.penaltiesScored) || 0;
		penaltiesMissed += Number(props.penaltiesMissed) || 0;
		penaltiesConceded += Number(props.penaltiesConceded) || 0;
		penaltiesSaved += Number(props.penaltiesSaved) || 0;
		fantasyPoints += Number(props.fantasyPoints) || 0;
		distance += Number(props.distance) || 0;

		// Track teams and seasons for derived stats
		if (props.team) {
			teamCounts[props.team] = (teamCounts[props.team] || 0) + 1;
			teamGoals[props.team] = (teamGoals[props.team] || 0) + (Number(props.goals) || 0);
		}
		if (props.season) {
			seasonCounts[props.season] = (seasonCounts[props.season] || 0) + 1;
		}
	});

	// Calculate derived stats based on statObject definitions
	const allGoalsScored = goals;
	const openPlayGoalsScored = goals - penaltiesScored; // Goals minus penalties
	const goalInvolvements = goals + assists;
	const goalsPerApp = appearances > 0 ? goals / appearances : 0;
	const concededPerApp = appearances > 0 ? conceded / appearances : 0;
	const minutesPerGoal = goals > 0 ? minutes / goals : 0;
	const minutesPerCleanSheet = cleanSheets > 0 ? minutes / cleanSheets : 0;
	const fantasyPointsPerApp = appearances > 0 ? fantasyPoints / appearances : 0;
	const minutesPerApp = appearances > 0 ? minutes / appearances : 0;
	const momPerApp = appearances > 0 ? mom / appearances : 0;
	const yellowCardsPerApp = appearances > 0 ? yellowCards / appearances : 0;
	const redCardsPerApp = appearances > 0 ? redCards / appearances : 0;
	const savesPerApp = appearances > 0 ? saves / appearances : 0;
	const ownGoalsPerApp = appearances > 0 ? ownGoals / appearances : 0;
	const cleanSheetsPerApp = appearances > 0 ? cleanSheets / appearances : 0;
	const penaltiesScoredPerApp = appearances > 0 ? penaltiesScored / appearances : 0;
	const penaltiesMissedPerApp = appearances > 0 ? penaltiesMissed / appearances : 0;
	const penaltiesConcededPerApp = appearances > 0 ? penaltiesConceded / appearances : 0;
	const penaltiesSavedPerApp = appearances > 0 ? penaltiesSaved / appearances : 0;

	// Find most played for team and most scored for team
	const mostPlayedForTeam = Object.keys(teamCounts).reduce((a, b) => (teamCounts[a] > teamCounts[b] ? a : b), "");
	const mostScoredForTeam = Object.keys(teamGoals).reduce((a, b) => (teamGoals[a] > teamGoals[b] ? a : b), "");

	return {
		// Basic stats from statObject
		appearances,
		minutes,
		mom,
		goals,
		assists,
		yellowCards,
		redCards,
		saves,
		ownGoals,
		conceded,
		cleanSheets,
		penaltiesScored,
		penaltiesMissed,
		penaltiesConceded,
		penaltiesSaved,
		fantasyPoints,
		distance,

		// Derived stats from statObject
		allGoalsScored,
		openPlayGoalsScored,
		goalInvolvements,
		goalsPerApp,
		concededPerApp,
		minutesPerGoal,
		minutesPerCleanSheet,
		fantasyPointsPerApp,
		minutesPerApp,
		momPerApp,
		yellowCardsPerApp,
		redCardsPerApp,
		savesPerApp,
		ownGoalsPerApp,
		cleanSheetsPerApp,
		penaltiesScoredPerApp,
		penaltiesMissedPerApp,
		penaltiesConcededPerApp,
		penaltiesSavedPerApp,

		// Team and season tracking (for derived stats)
		mostPlayedForTeam,
		numberTeamsPlayedFor: Object.keys(teamCounts).length,
		mostScoredForTeam,
		numberSeasonsPlayedFor: Object.keys(seasonCounts).length,
	};
}
