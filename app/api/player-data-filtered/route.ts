import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { buildPlayerStatsQuery } from "../player-data/route";

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

		// Build query with filters using shared query builder
		const { query, params } = buildPlayerStatsQuery(playerName, filters);

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

		let result;
		try {
			result = await neo4jService.runQuery(query, params);
		} catch (queryError: any) {
			console.error("Cypher query error:", queryError);
			console.error("Query:", query);
			console.error("Params:", JSON.stringify(params, null, 2));
			return NextResponse.json(
				{ error: "Query execution failed", details: queryError.message },
				{ status: 500, headers: corsHeaders }
			);
		}

		if (result.records.length === 0) {
			return NextResponse.json({ error: "Player not found or no matches for filters" }, { status: 404, headers: corsHeaders });
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
		
		// Debug: log the appearances value to see what we're getting
		const appearancesRaw = record.get("appearances");
		const appearancesConverted = toNumber(appearancesRaw);
		console.log("[DEBUG] appearances - raw:", appearancesRaw, "type:", typeof appearancesRaw, "converted:", appearancesConverted);
		
		// Debug: Log position counts
		const gkRaw = record.get("gk");
		const defRaw = record.get("def");
		const midRaw = record.get("mid");
		const fwdRaw = record.get("fwd");
		console.log("[DEBUG Filtered Position Counts] Raw values:", {
			gk: gkRaw,
			def: defRaw,
			mid: midRaw,
			fwd: fwdRaw
		});
		
		const playerData = {
			id: record.get("id"),
			playerName: record.get("playerName"),
			allowOnSite: record.get("allowOnSite"),
			gk: toNumber(gkRaw),
			def: toNumber(defRaw),
			mid: toNumber(midRaw),
			fwd: toNumber(fwdRaw),
			appearances: appearancesConverted,
			minutes: toNumber(record.get("minutes")),
			mom: toNumber(record.get("mom")),
			goals: toNumber(record.get("goals")),
			assists: toNumber(record.get("assists")),
			yellowCards: toNumber(record.get("yellowCards")),
			redCards: toNumber(record.get("redCards")),
			saves: toNumber(record.get("saves")),
			ownGoals: toNumber(record.get("ownGoals")),
			conceded: toNumber(record.get("conceded")),
			cleanSheets: toNumber(record.get("cleanSheets")),
			penaltiesScored: toNumber(record.get("penaltiesScored")),
			penaltiesMissed: toNumber(record.get("penaltiesMissed")),
			penaltiesConceded: toNumber(record.get("penaltiesConceded")),
			penaltiesSaved: toNumber(record.get("penaltiesSaved")),
			fantasyPoints: Math.round(toNumber(record.get("fantasyPoints"))),
			allGoalsScored: toNumber(record.get("allGoalsScored")),
			openPlayGoalsScored: toNumber(record.get("openPlayGoalsScored")),
			goalInvolvements: toNumber(record.get("goalInvolvements")),
			goalsPerApp: toNumber(record.get("goalsPerApp")),
			concededPerApp: toNumber(record.get("concededPerApp")),
			minutesPerGoal: toNumber(record.get("minutesPerGoal")),
			minutesPerCleanSheet: toNumber(record.get("minutesPerCleanSheet")),
			fantasyPointsPerApp: toNumber(record.get("fantasyPointsPerApp")),
			distance: toNumber(record.get("distance")),
			homeGames: toNumber(record.get("homeGames")),
			homeWins: toNumber(record.get("homeWins")),
			homeGamesPercentWon: toNumber(record.get("homeGamesPercentWon")),
			awayGames: toNumber(record.get("awayGames")),
			awayWins: toNumber(record.get("awayWins")),
			awayGamesPercentWon: toNumber(record.get("awayGamesPercentWon")),
			gamesPercentWon: toNumber(record.get("gamesPercentWon")),
			pointsPerGame: toNumber(record.get("pointsPerGame")),
			mostPlayedForTeam: record.get("mostPlayedForTeam") || "",
			numberTeamsPlayedFor: toNumber(record.get("numberTeamsPlayedFor")),
			mostScoredForTeam: record.get("mostScoredForTeam") || "",
			numberSeasonsPlayedFor: toNumber(record.get("numberSeasonsPlayedFor")),
			graphLabel: record.get("graphLabel"),
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
