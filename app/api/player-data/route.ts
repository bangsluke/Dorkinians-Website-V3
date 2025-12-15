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

// Build filter conditions for Cypher query
export function buildFilterConditions(filters: any, params: any): string[] {
	const conditions: string[] = [];

	if (!filters) {
		return conditions;
	}

	// Time Range filters
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

	// Team filters
	if (filters.teams && filters.teams.length > 0) {
		conditions.push(`f.team IN $teams`);
		params.teams = filters.teams;
	}

	// Location filters
	if (filters.location && filters.location.length > 0) {
		const locationConditions = filters.location.map((loc: string) => (loc === "Home" ? 'f.homeOrAway = "Home"' : 'f.homeOrAway = "Away"'));
		conditions.push(`(${locationConditions.join(" OR ")})`);
	}

	// Opposition filters
	if (filters.opposition && !filters.opposition.allOpposition) {
		if (filters.opposition.searchTerm) {
			conditions.push(`toLower(f.opposition) CONTAINS toLower($oppositionSearch)`);
			params.oppositionSearch = filters.opposition.searchTerm;
		}
	}

	// Competition filters
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

	// Result filters
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

	// Position filters
	if (filters.position && filters.position.length > 0) {
		conditions.push(`md.class IN $positions`);
		params.positions = filters.position;
	}

	return conditions;
}

// Build unified Cypher query with aggregation
export function buildPlayerStatsQuery(playerName: string, filters: any = null): { query: string; params: any } {
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

	// Build filter conditions
	const conditions = buildFilterConditions(filters, params);
	if (conditions.length > 0) {
		query += ` WHERE ${conditions.join(" AND ")}`;
	}

	// Aggregation query with all stats calculated in Cypher
	query += `
		WITH p, md, f
		// Aggregate all stats in a single pass
		WITH p,
			count(md) as appearances,
			sum(coalesce(md.minutes, 0)) as minutes,
			sum(coalesce(md.mom, 0)) as mom,
			sum(coalesce(md.goals, 0)) as goals,
			sum(coalesce(md.assists, 0)) as assists,
			sum(coalesce(md.yellowCards, 0)) as yellowCards,
			sum(coalesce(md.redCards, 0)) as redCards,
			sum(coalesce(md.saves, 0)) as saves,
			sum(coalesce(md.ownGoals, 0)) as ownGoals,
			sum(coalesce(md.conceded, 0)) as conceded,
			sum(coalesce(md.cleanSheets, 0)) as cleanSheets,
			sum(CASE 
				WHEN toUpper(coalesce(md.class, "")) = "GK" 
				AND (coalesce(f.conceded, 0) = 0 OR coalesce(f.cleanSheet, 0) = 1)
				THEN 1 
				ELSE 0 
			END) as gkCleanSheets,
			sum(coalesce(md.penaltiesScored, 0)) as penaltiesScored,
			sum(coalesce(md.penaltiesMissed, 0)) as penaltiesMissed,
			sum(coalesce(md.penaltiesConceded, 0)) as penaltiesConceded,
			sum(coalesce(md.penaltiesSaved, 0)) as penaltiesSaved,
			sum(coalesce(md.penaltyShootoutPenaltiesScored, 0)) as penaltyShootoutPenaltiesScored,
			sum(coalesce(md.penaltyShootoutPenaltiesMissed, 0)) as penaltyShootoutPenaltiesMissed,
			sum(coalesce(md.penaltyShootoutPenaltiesSaved, 0)) as penaltyShootoutPenaltiesSaved,
			sum(coalesce(md.fantasyPoints, 0)) as fantasyPoints,
			sum(coalesce(md.distance, 0)) as distance,
			sum(CASE WHEN toUpper(coalesce(md.class, "")) = "GK" THEN 1 ELSE 0 END) as gk,
			sum(CASE WHEN toUpper(coalesce(md.class, "")) = "DEF" THEN 1 ELSE 0 END) as def,
			sum(CASE WHEN toUpper(coalesce(md.class, "")) = "MID" THEN 1 ELSE 0 END) as mid,
			sum(CASE WHEN toUpper(coalesce(md.class, "")) = "FWD" THEN 1 ELSE 0 END) as fwd,
			sum(CASE WHEN toUpper(coalesce(md.class, "")) = "GK" THEN coalesce(md.minutes, 0) ELSE 0 END) as gkMinutes,
			sum(CASE WHEN toUpper(coalesce(md.class, "")) = "DEF" THEN coalesce(md.minutes, 0) ELSE 0 END) as defMinutes,
			sum(CASE WHEN toUpper(coalesce(md.class, "")) = "MID" THEN coalesce(md.minutes, 0) ELSE 0 END) as midMinutes,
			sum(CASE WHEN toUpper(coalesce(md.class, "")) = "FWD" THEN coalesce(md.minutes, 0) ELSE 0 END) as fwdMinutes,
			collect(DISTINCT md.team) as teams,
			collect(DISTINCT md.season) as seasons,
			count(DISTINCT f.opposition) as oppositionPlayed,
			count(DISTINCT f.competition) as competitionsCompeted,
			sum(CASE WHEN f.homeOrAway = "Home" THEN 1 ELSE 0 END) as homeGames,
			sum(CASE WHEN f.homeOrAway = "Home" AND f.result = "W" THEN 1 ELSE 0 END) as homeWins,
			sum(CASE WHEN f.homeOrAway = "Away" THEN 1 ELSE 0 END) as awayGames,
			sum(CASE WHEN f.homeOrAway = "Away" AND f.result = "W" THEN 1 ELSE 0 END) as awayWins,
			sum(CASE WHEN f.result = "W" THEN 1 ELSE 0 END) as wins,
			sum(CASE WHEN f.result = "D" THEN 1 ELSE 0 END) as draws,
			sum(CASE WHEN f.result = "L" THEN 1 ELSE 0 END) as losses,
			sum(CASE WHEN md.goals > 0 AND f.result = "W" THEN 1 ELSE 0 END) as winsWhenScoring,
			sum(CASE WHEN md.goals > 0 THEN 1 ELSE 0 END) as gamesWithGoals
		// Calculate team aggregations separately - re-match with filters
		WITH p, appearances, minutes, mom, goals, assists, yellowCards, redCards, saves, ownGoals, conceded, cleanSheets, gkCleanSheets,
			penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, penaltyShootoutPenaltiesScored, penaltyShootoutPenaltiesMissed, penaltyShootoutPenaltiesSaved, fantasyPoints, distance,
			gk, def, mid, fwd, gkMinutes, defMinutes, midMinutes, fwdMinutes,
			teams, seasons, oppositionPlayed, competitionsCompeted, homeGames, homeWins, awayGames, awayWins, wins, draws, losses, winsWhenScoring, gamesWithGoals
		MATCH (p)-[:PLAYED_IN]->(md2:MatchDetail {graphLabel: $graphLabel})
		MATCH (f2:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md2)
	`;
	
	// Re-apply same filter conditions for team aggregation (replace f with f2 and md with md2)
	if (conditions.length > 0) {
		const teamConditions = conditions.map((cond) => cond.replace(/\bf\./g, "f2.").replace(/\bmd\./g, "md2."));
		query += ` WHERE ${teamConditions.join(" AND ")}`;
	}
	
	query += `
		WITH p, appearances, minutes, mom, goals, assists, yellowCards, redCards, saves, ownGoals, conceded, cleanSheets, gkCleanSheets,
			penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, penaltyShootoutPenaltiesScored, penaltyShootoutPenaltiesMissed, penaltyShootoutPenaltiesSaved, fantasyPoints, distance,
			gk, def, mid, fwd, gkMinutes, defMinutes, midMinutes, fwdMinutes,
			teams, seasons, oppositionPlayed, competitionsCompeted, homeGames, homeWins, awayGames, awayWins, wins, draws, losses, winsWhenScoring, gamesWithGoals,
			md2.team as team,
			md2.goals as teamGoal
		WITH p, appearances, minutes, mom, goals, assists, yellowCards, redCards, saves, ownGoals, conceded, cleanSheets, gkCleanSheets,
			penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, penaltyShootoutPenaltiesScored, penaltyShootoutPenaltiesMissed, penaltyShootoutPenaltiesSaved, fantasyPoints, distance,
			gk, def, mid, fwd, gkMinutes, defMinutes, midMinutes, fwdMinutes,
			teams, seasons, oppositionPlayed, competitionsCompeted, homeGames, homeWins, awayGames, awayWins, wins, draws, losses, winsWhenScoring, gamesWithGoals,
			team,
			count(*) as teamAppearances,
			sum(coalesce(teamGoal, 0)) as teamGoals
		WITH p, appearances, minutes, mom, goals, assists, yellowCards, redCards, saves, ownGoals, conceded, cleanSheets, gkCleanSheets,
			penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, penaltyShootoutPenaltiesScored, penaltyShootoutPenaltiesMissed, penaltyShootoutPenaltiesSaved, fantasyPoints, distance,
			gk, def, mid, fwd, gkMinutes, defMinutes, midMinutes, fwdMinutes,
			teams, seasons, oppositionPlayed, competitionsCompeted, homeGames, homeWins, awayGames, awayWins, wins, draws, losses, winsWhenScoring, gamesWithGoals,
			collect({team: team, appearances: teamAppearances, goals: teamGoals}) as teamStats
		WITH p, appearances, minutes, mom, goals, assists, yellowCards, redCards, saves, ownGoals, conceded, cleanSheets, gkCleanSheets,
			penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, penaltyShootoutPenaltiesScored, penaltyShootoutPenaltiesMissed, penaltyShootoutPenaltiesSaved, fantasyPoints, distance,
			gk, def, mid, fwd, gkMinutes, defMinutes, midMinutes, fwdMinutes,
			teams, seasons, oppositionPlayed, competitionsCompeted, homeGames, homeWins, awayGames, awayWins, wins, draws, losses, winsWhenScoring, gamesWithGoals, teamStats
		// Handle team stats - find most played and most scored teams
		// Use reduce to find max, handling empty teamStats
		WITH p, appearances, minutes, mom, goals, assists, yellowCards, redCards, saves, ownGoals, conceded, cleanSheets, gkCleanSheets,
			penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, penaltyShootoutPenaltiesScored, penaltyShootoutPenaltiesMissed, penaltyShootoutPenaltiesSaved, fantasyPoints, distance,
			gk, def, mid, fwd, gkMinutes, defMinutes, midMinutes, fwdMinutes,
			teams, seasons, oppositionPlayed, competitionsCompeted, homeGames, homeWins, awayGames, awayWins, wins, draws, losses, winsWhenScoring, gamesWithGoals,
			CASE WHEN size(teamStats) = 0 THEN {team: "", appearances: 0, goals: 0}
			ELSE reduce(maxTeam = teamStats[0], ts in teamStats | CASE WHEN ts.appearances > maxTeam.appearances THEN ts ELSE maxTeam END)
			END as mostPlayedTeam,
			CASE WHEN size(teamStats) = 0 THEN {team: "", appearances: 0, goals: 0}
			ELSE reduce(maxTeam = teamStats[0], ts in teamStats | CASE WHEN ts.goals > maxTeam.goals THEN ts ELSE maxTeam END)
			END as mostScoredTeam
		// Calculate teammates - need to query separately
		MATCH (p)-[:PLAYED_IN]->(md3:MatchDetail {graphLabel: $graphLabel})
		MATCH (f3:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md3)
	`;
	
	// Re-apply same filter conditions for teammates query
	if (conditions.length > 0) {
		const teammateConditions = conditions.map((cond) => cond.replace(/\bf\./g, "f3.").replace(/\bmd\./g, "md3."));
		query += ` WHERE ${teammateConditions.join(" AND ")}`;
	}
	
	query += `
		WITH p, appearances, minutes, mom, goals, assists, yellowCards, redCards, saves, ownGoals, conceded, cleanSheets, gkCleanSheets,
			penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, penaltyShootoutPenaltiesScored, penaltyShootoutPenaltiesMissed, penaltyShootoutPenaltiesSaved, fantasyPoints, distance,
			gk, def, mid, fwd, gkMinutes, defMinutes, midMinutes, fwdMinutes,
			coalesce(mostPlayedTeam.team, "") as mostPlayedForTeam,
			coalesce(mostScoredTeam.team, "") as mostScoredForTeam,
			size(teams) as numberTeamsPlayedFor,
			size(seasons) as numberSeasonsPlayedFor,
			oppositionPlayed, competitionsCompeted,
			homeGames, homeWins, awayGames, awayWins, wins, draws, losses, winsWhenScoring, gamesWithGoals,
			f3
		MATCH (f3)-[:HAS_MATCH_DETAILS]->(md4:MatchDetail {graphLabel: $graphLabel})
		MATCH (md4)<-[:PLAYED_IN]-(p2:Player {graphLabel: $graphLabel})
		WHERE p2.playerName <> $playerName
		WITH p, appearances, minutes, mom, goals, assists, yellowCards, redCards, saves, ownGoals, conceded, cleanSheets, gkCleanSheets,
			penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, penaltyShootoutPenaltiesScored, penaltyShootoutPenaltiesMissed, penaltyShootoutPenaltiesSaved, fantasyPoints, distance,
			gk, def, mid, fwd, gkMinutes, defMinutes, midMinutes, fwdMinutes,
			mostPlayedForTeam, mostScoredForTeam, numberTeamsPlayedFor, numberSeasonsPlayedFor,
			oppositionPlayed, competitionsCompeted,
			homeGames, homeWins, awayGames, awayWins, wins, draws, losses, winsWhenScoring, gamesWithGoals,
			count(DISTINCT p2.playerName) as teammatesPlayedWith
		// Calculate derived stats
		WITH p, appearances, minutes, mom, goals, assists, yellowCards, redCards, saves, ownGoals, conceded, cleanSheets, gkCleanSheets,
			penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, penaltyShootoutPenaltiesScored, penaltyShootoutPenaltiesMissed, penaltyShootoutPenaltiesSaved, fantasyPoints, distance,
			gk, def, mid, fwd, gkMinutes, defMinutes, midMinutes, fwdMinutes,
			mostPlayedForTeam, mostScoredForTeam, numberTeamsPlayedFor, numberSeasonsPlayedFor,
			oppositionPlayed, competitionsCompeted, teammatesPlayedWith,
			homeGames, homeWins, awayGames, awayWins, wins, draws, losses, winsWhenScoring, gamesWithGoals,
			goals as allGoalsScored,
			goals - penaltiesScored as openPlayGoalsScored,
			goals + assists as goalInvolvements,
			CASE WHEN appearances > 0 THEN toFloat(goals) / appearances ELSE 0.0 END as goalsPerApp,
			CASE WHEN appearances > 0 THEN toFloat(assists) / appearances ELSE 0.0 END as assistsPerApp,
			CASE WHEN appearances > 0 THEN toFloat(goals + assists) / appearances ELSE 0.0 END as goalInvolvementsPerApp,
			CASE WHEN appearances > 0 THEN toFloat(conceded) / appearances ELSE 0.0 END as concededPerApp,
			CASE WHEN goals > 0 THEN toFloat(minutes) / goals ELSE 0.0 END as minutesPerGoal,
			CASE WHEN cleanSheets > 0 THEN toFloat(minutes) / cleanSheets ELSE 0.0 END as minutesPerCleanSheet,
			CASE WHEN appearances > 0 THEN toFloat(fantasyPoints) / appearances ELSE 0.0 END as fantasyPointsPerApp,
			CASE WHEN appearances > 0 THEN toFloat(minutes) / appearances ELSE 0.0 END as minutesPerApp,
			CASE WHEN appearances > 0 THEN toFloat(mom) / appearances ELSE 0.0 END as momPerApp,
			CASE WHEN appearances > 0 THEN toFloat(yellowCards) / appearances ELSE 0.0 END as yellowCardsPerApp,
			CASE WHEN appearances > 0 THEN toFloat(redCards) / appearances ELSE 0.0 END as redCardsPerApp,
			CASE WHEN appearances > 0 THEN toFloat(saves) / appearances ELSE 0.0 END as savesPerApp,
			CASE WHEN appearances > 0 THEN toFloat(ownGoals) / appearances ELSE 0.0 END as ownGoalsPerApp,
			CASE WHEN appearances > 0 THEN toFloat(cleanSheets) / appearances ELSE 0.0 END as cleanSheetsPerApp,
			CASE WHEN appearances > 0 THEN toFloat(penaltiesScored) / appearances ELSE 0.0 END as penaltiesScoredPerApp,
			CASE WHEN appearances > 0 THEN toFloat(penaltiesMissed) / appearances ELSE 0.0 END as penaltiesMissedPerApp,
			CASE WHEN appearances > 0 THEN toFloat(penaltiesConceded) / appearances ELSE 0.0 END as penaltiesConcededPerApp,
			CASE WHEN appearances > 0 THEN toFloat(penaltiesSaved) / appearances ELSE 0.0 END as penaltiesSavedPerApp,
			CASE WHEN (penaltiesScored + penaltiesMissed) > 0 THEN toFloat(penaltiesScored) / (penaltiesScored + penaltiesMissed) * 100 ELSE 0.0 END as penaltyConversionRate,
			CASE WHEN gamesWithGoals > 0 THEN toFloat(winsWhenScoring) / gamesWithGoals * 100 ELSE 0.0 END as winRateWhenScoring,
			CASE WHEN homeGames + awayGames > 0 THEN toFloat(homeWins + awayWins) / (homeGames + awayGames) * 100 ELSE 0.0 END as gamesPercentWon,
			CASE WHEN homeGames > 0 THEN toFloat(homeWins) / homeGames * 100 ELSE 0.0 END as homeGamesPercentWon,
			CASE WHEN awayGames > 0 THEN toFloat(awayWins) / awayGames * 100 ELSE 0.0 END as awayGamesPercentWon,
			CASE WHEN homeGames + awayGames > 0 THEN toFloat(wins * 3 + draws * 1 + losses * 0) / (homeGames + awayGames) ELSE 0.0 END as pointsPerGame
		RETURN p.id as id,
			p.playerName as playerName,
			p.allowOnSite as allowOnSite,
			p.graphLabel as graphLabel,
			coalesce(gk, 0) as gk,
			coalesce(def, 0) as def,
			coalesce(mid, 0) as mid,
			coalesce(fwd, 0) as fwd,
			coalesce(gkMinutes, 0) as gkMinutes,
			coalesce(defMinutes, 0) as defMinutes,
			coalesce(midMinutes, 0) as midMinutes,
			coalesce(fwdMinutes, 0) as fwdMinutes,
			coalesce(appearances, 0) as appearances,
			coalesce(minutes, 0) as minutes,
			coalesce(mom, 0) as mom,
			coalesce(goals, 0) as goals,
			coalesce(assists, 0) as assists,
			coalesce(yellowCards, 0) as yellowCards,
			coalesce(redCards, 0) as redCards,
			coalesce(saves, 0) as saves,
			coalesce(ownGoals, 0) as ownGoals,
			coalesce(conceded, 0) as conceded,
			coalesce(cleanSheets, 0) as cleanSheets,
			coalesce(gkCleanSheets, 0) as gkCleanSheets,
			coalesce(penaltiesScored, 0) as penaltiesScored,
			coalesce(penaltiesMissed, 0) as penaltiesMissed,
			coalesce(penaltiesConceded, 0) as penaltiesConceded,
			coalesce(penaltiesSaved, 0) as penaltiesSaved,
			coalesce(penaltyShootoutPenaltiesScored, 0) as penaltyShootoutPenaltiesScored,
			coalesce(penaltyShootoutPenaltiesMissed, 0) as penaltyShootoutPenaltiesMissed,
			coalesce(penaltyShootoutPenaltiesSaved, 0) as penaltyShootoutPenaltiesSaved,
			coalesce(fantasyPoints, 0) as fantasyPoints,
			coalesce(distance, 0) as distance,
			coalesce(allGoalsScored, 0) as allGoalsScored,
			coalesce(openPlayGoalsScored, 0) as openPlayGoalsScored,
			coalesce(goalInvolvements, 0) as goalInvolvements,
			coalesce(goalsPerApp, 0.0) as goalsPerApp,
			coalesce(concededPerApp, 0.0) as concededPerApp,
			coalesce(minutesPerGoal, 0.0) as minutesPerGoal,
			coalesce(minutesPerCleanSheet, 0.0) as minutesPerCleanSheet,
			coalesce(fantasyPointsPerApp, 0.0) as fantasyPointsPerApp,
			coalesce(minutesPerApp, 0.0) as minutesPerApp,
			coalesce(momPerApp, 0.0) as momPerApp,
			coalesce(yellowCardsPerApp, 0.0) as yellowCardsPerApp,
			coalesce(redCardsPerApp, 0.0) as redCardsPerApp,
			coalesce(savesPerApp, 0.0) as savesPerApp,
			coalesce(ownGoalsPerApp, 0.0) as ownGoalsPerApp,
			coalesce(cleanSheetsPerApp, 0.0) as cleanSheetsPerApp,
			coalesce(penaltiesScoredPerApp, 0.0) as penaltiesScoredPerApp,
			coalesce(penaltiesMissedPerApp, 0.0) as penaltiesMissedPerApp,
			coalesce(penaltiesConcededPerApp, 0.0) as penaltiesConcededPerApp,
			coalesce(penaltiesSavedPerApp, 0.0) as penaltiesSavedPerApp,
			coalesce(assistsPerApp, 0.0) as assistsPerApp,
			coalesce(goalInvolvementsPerApp, 0.0) as goalInvolvementsPerApp,
			coalesce(penaltyConversionRate, 0.0) as penaltyConversionRate,
			coalesce(winRateWhenScoring, 0.0) as winRateWhenScoring,
			coalesce(homeGames, 0) as homeGames,
			coalesce(homeWins, 0) as homeWins,
			coalesce(homeGamesPercentWon, 0.0) as homeGamesPercentWon,
			coalesce(awayGames, 0) as awayGames,
			coalesce(awayWins, 0) as awayWins,
			coalesce(awayGamesPercentWon, 0.0) as awayGamesPercentWon,
			coalesce(gamesPercentWon, 0.0) as gamesPercentWon,
			coalesce(pointsPerGame, 0.0) as pointsPerGame,
			coalesce(wins, 0) as wins,
			coalesce(draws, 0) as draws,
			coalesce(losses, 0) as losses,
			coalesce(mostPlayedForTeam, "") as mostPlayedForTeam,
			coalesce(numberTeamsPlayedFor, 0) as numberTeamsPlayedFor,
			coalesce(mostScoredForTeam, "") as mostScoredForTeam,
			coalesce(numberSeasonsPlayedFor, 0) as numberSeasonsPlayedFor,
			coalesce(oppositionPlayed, 0) as oppositionPlayed,
			coalesce(competitionsCompeted, 0) as competitionsCompeted,
			coalesce(teammatesPlayedWith, 0) as teammatesPlayedWith
	`;

	return { query, params };
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const playerName = searchParams.get("playerName");

		if (!playerName) {
			return NextResponse.json({ error: "Player name is required" }, { status: 400, headers: corsHeaders });
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Build query with no filters
		const { query, params } = buildPlayerStatsQuery(playerName, null);

		const result = await neo4jService.runQuery(query, params);

		if (result.records.length === 0) {
			return NextResponse.json({ error: "Player not found" }, { status: 404, headers: corsHeaders });
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
		
		// Debug: Log position counts and sample class values
		const gkRaw = record.get("gk");
		const defRaw = record.get("def");
		const midRaw = record.get("mid");
		const fwdRaw = record.get("fwd");
		console.log("[DEBUG Position Counts] Raw values from query:", {
			gk: gkRaw,
			def: defRaw,
			mid: midRaw,
			fwd: fwdRaw,
			gkType: typeof gkRaw,
			defType: typeof defRaw
		});
		
		// Debug: Query sample MatchDetail class values
		const debugQuery = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			RETURN md.class as class, count(*) as count, collect(md.class)[0..5] as sampleValues
			ORDER BY count DESC
			LIMIT 10
		`;
		try {
			const debugResult = await neo4jService.runQuery(debugQuery, { graphLabel, playerName });
			const classDistribution = debugResult.records.map(r => ({
				class: r.get("class"),
				classType: typeof r.get("class"),
				classUpper: r.get("class") ? r.get("class").toUpperCase() : null,
				count: r.get("count").toNumber ? r.get("count").toNumber() : r.get("count"),
				sampleValues: r.get("sampleValues")
			}));
			console.log("[DEBUG] MatchDetail class distribution for player:", playerName, classDistribution);
			
			// Also check if class values match our expectations
			const testQuery = `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
				MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				WITH md.class as class, count(*) as count
				WHERE class IS NOT NULL
				RETURN class, count
				ORDER BY count DESC
			`;
			const testResult = await neo4jService.runQuery(testQuery, { graphLabel, playerName });
			const nonNullClasses = testResult.records.map(r => ({
				class: r.get("class"),
				count: r.get("count").toNumber ? r.get("count").toNumber() : r.get("count")
			}));
			console.log("[DEBUG] Non-null class values:", nonNullClasses);
		} catch (debugError) {
			console.error("[DEBUG] Error fetching class distribution:", debugError);
		}
		
		const playerData = {
			id: record.get("id"),
			playerName: record.get("playerName"),
			allowOnSite: record.get("allowOnSite"),
			gk: toNumber(gkRaw),
			def: toNumber(defRaw),
			mid: toNumber(midRaw),
			fwd: toNumber(fwdRaw),
			gkMinutes: toNumber(record.get("gkMinutes")),
			defMinutes: toNumber(record.get("defMinutes")),
			midMinutes: toNumber(record.get("midMinutes")),
			fwdMinutes: toNumber(record.get("fwdMinutes")),
			appearances: toNumber(record.get("appearances")),
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
			gkCleanSheets: toNumber(record.get("gkCleanSheets")),
			penaltiesScored: toNumber(record.get("penaltiesScored")),
			penaltiesMissed: toNumber(record.get("penaltiesMissed")),
			penaltiesConceded: toNumber(record.get("penaltiesConceded")),
			penaltiesSaved: toNumber(record.get("penaltiesSaved")),
			penaltyShootoutPenaltiesScored: toNumber(record.get("penaltyShootoutPenaltiesScored")),
			penaltyShootoutPenaltiesMissed: toNumber(record.get("penaltyShootoutPenaltiesMissed")),
			penaltyShootoutPenaltiesSaved: toNumber(record.get("penaltyShootoutPenaltiesSaved")),
			fantasyPoints: Math.round(toNumber(record.get("fantasyPoints"))),
			allGoalsScored: toNumber(record.get("allGoalsScored")),
			openPlayGoalsScored: toNumber(record.get("openPlayGoalsScored")),
			goalInvolvements: toNumber(record.get("goalInvolvements")),
			goalsPerApp: toNumber(record.get("goalsPerApp")),
			concededPerApp: toNumber(record.get("concededPerApp")),
			minutesPerGoal: toNumber(record.get("minutesPerGoal")),
			minutesPerCleanSheet: toNumber(record.get("minutesPerCleanSheet")),
			fantasyPointsPerApp: toNumber(record.get("fantasyPointsPerApp")),
			assistsPerApp: toNumber(record.get("assistsPerApp")),
			goalInvolvementsPerApp: toNumber(record.get("goalInvolvementsPerApp")),
			penaltyConversionRate: toNumber(record.get("penaltyConversionRate")),
			winRateWhenScoring: toNumber(record.get("winRateWhenScoring")),
			distance: toNumber(record.get("distance")),
			homeGames: toNumber(record.get("homeGames")),
			homeWins: toNumber(record.get("homeWins")),
			homeGamesPercentWon: toNumber(record.get("homeGamesPercentWon")),
			awayGames: toNumber(record.get("awayGames")),
			awayWins: toNumber(record.get("awayWins")),
			awayGamesPercentWon: toNumber(record.get("awayGamesPercentWon")),
			gamesPercentWon: toNumber(record.get("gamesPercentWon")),
			pointsPerGame: toNumber(record.get("pointsPerGame")),
			wins: toNumber(record.get("wins")),
			draws: toNumber(record.get("draws")),
			losses: toNumber(record.get("losses")),
			mostPlayedForTeam: record.get("mostPlayedForTeam") || "",
			numberTeamsPlayedFor: toNumber(record.get("numberTeamsPlayedFor")),
			mostScoredForTeam: record.get("mostScoredForTeam") || "",
			numberSeasonsPlayedFor: toNumber(record.get("numberSeasonsPlayedFor")),
			oppositionPlayed: toNumber(record.get("oppositionPlayed")),
			competitionsCompeted: toNumber(record.get("competitionsCompeted")),
			teammatesPlayedWith: toNumber(record.get("teammatesPlayedWith")),
			graphLabel: record.get("graphLabel"),
		};

		return NextResponse.json({ playerData }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching player data:", error);
		return NextResponse.json({ error: "Failed to fetch player data" }, { status: 500, headers: corsHeaders });
	}
}
