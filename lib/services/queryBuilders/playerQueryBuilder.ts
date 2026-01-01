import type { EnhancedQuestionAnalysis } from "../../config/enhancedQuestionAnalysis";
import { TeamMappingUtils } from "../chatbotUtils/teamMappingUtils";
import { DateUtils } from "../chatbotUtils/dateUtils";
import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";

export class PlayerQueryBuilder {
	/**
	 * Determines if a metric needs MatchDetail join or can use Player node directly
	 */
	static metricNeedsMatchDetail(metric: string): boolean {
		// Metrics that need MatchDetail join (including complex calculations)
		const matchDetailMetrics = [
			"ALLGSC",
			"GI",
			"HOME",
			"AWAY",
			"HOMEGAMES",
			"AWAYGAMES",
			"HOMEWINS",
			"AWAYWINS",
			"HOMEGAMES%WON",
			"AWAYGAMES%WON",
			"GAMES%WON",
			"HOMEGAMES%LOST",
			"AWAYGAMES%LOST",
			"GAMES%LOST",
			"HOMEGAMES%DRAWN",
			"AWAYGAMES%DRAWN",
			"GAMES%DRAWN",
			"MPERG",
			"MPERCLS",
			"FTPPERAPP",
			"CPERAPP",
			"GPERAPP",
			"GK",
			"DEF",
			"MID",
			"FWD",
			"DIST",
			"MOSTSCOREDFORTEAM",
			"MOSTPLAYEDFORTEAM",
			"MOSTPROLIFICSEASON", // Needs MatchDetail to calculate goals per season
			"FTP",
			"POINTS",
			"FANTASYPOINTS",
			"PENALTY_CONVERSION_RATE", // Needs MatchDetail to calculate from penaltiesScored and penaltiesMissed
		];

		// Check if it's a team-specific appearance metric (1sApps, 2sApps, etc.)
		if (metric.match(/^\d+sApps$/i)) {
			return true; // Team-specific appearances need MatchDetail join to filter by team
		}

		// Check if it's a team-specific appearance metric (1st XI Apps, 2nd XI Apps, etc.)
		if (metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i)) {
			return true; // Team-specific appearances need MatchDetail join to filter by team
		}

		// Check if it's a team-specific goals metric (1sGoals, 2sGoals, etc.)
		if (metric.match(/^\d+sGoals$/i)) {
			return true; // Team-specific goals need MatchDetail join to filter by team
		}

		// Check if it's a team-specific goals metric (1st XI Goals, 2nd XI Goals, etc.)
		if (metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i)) {
			return true; // Team-specific goals need MatchDetail join to filter by team
		}

		// Check if it's a seasonal metric (contains year pattern) - these use MatchDetail joins
		if (metric.match(/\d{4}\/\d{2}(GOALS|APPS|ASSISTS|CLEANSHEETS|SAVES|YELLOWCARDS|REDCARDS|MOM|PENALTIESSCORED|PENALTIESMISSED|PENALTIESSAVED|PENALTIESTAKEN|PENALTIESCONCEDED|OWngoals|CONCEDED|FANTASYPOINTS|DISTANCE)/i)) {
			return true; // Seasonal metrics use MatchDetail joins for accurate data
		}

		// Special case metrics that need MatchDetail joins
		const metricUpper = metric.toUpperCase();
		if (metricUpper === "NUMBERSEASONSPLAYEDFOR" || metricUpper === "NUMBERTEAMSPLAYEDFOR") {
			return true; // These need MatchDetail to count distinct seasons/teams
		}

		return matchDetailMetrics.includes(metric.toUpperCase());
	}

	/**
	 * Gets the return clause for Player node queries
	 */
	static getPlayerNodeReturnClause(metric: string): string {
		switch (metric.toUpperCase()) {
			case "MIN":
				return "coalesce(p.minutes, 0)";
			case "MOM":
				return "coalesce(p.mom, 0)";
			case "G":
				return "coalesce(p.allGoalsScored, 0)";
			case "OPENPLAYGOALS":
				return "coalesce(p.goals, 0)";
			case "A":
				return "coalesce(p.assists, 0)";
			case "Y":
				return "coalesce(p.yellowCards, 0)";
			case "R":
				return "coalesce(p.redCards, 0)";
			case "SAVES":
				return "coalesce(p.saves, 0)";
			case "OG":
				return "coalesce(p.ownGoals, 0)";
			case "C":
				return "coalesce(p.conceded, 0)";
			case "CLS":
				return "coalesce(p.cleanSheets, 0)";
			case "PSC":
				return "coalesce(p.penaltiesScored, 0)";
			case "PM":
				return "coalesce(p.penaltiesMissed, 0)";
			case "PCO":
				return "coalesce(p.penaltiesConceded, 0)";
			case "PSV":
				return "coalesce(p.penaltiesSaved, 0)";
			case "PENALTY_CONVERSION_RATE":
				return "coalesce(p.penaltyConversionRate, 0.0)";
			case "DIST":
				return "coalesce(p.distance, 0)";
			case "GK":
				return "coalesce(p.gk, 0)";
			case "DEF":
				return "coalesce(p.def, 0)";
			case "MID":
				return "coalesce(p.mid, 0)";
			case "FWD":
				return "coalesce(p.fwd, 0)";
			case "APP":
				return "coalesce(p.appearances, 0)";
			case "MOSTPROLIFICSEASON":
				return "p.mostProlificSeason";
			// Seasonal metrics - dynamic handling
			default:
				// Check if it's a seasonal metric (contains year pattern)
				if (metric.match(/\d{4}\/\d{2}(GOALS|APPS)/i)) {
					const seasonMatch = metric.match(/(\d{4}\/\d{2})(GOALS|APPS)/i);
					if (seasonMatch) {
						const season = seasonMatch[1];
						const type = seasonMatch[2];
						// Convert season format from 2017/18 to 201718 for database property names
						const dbSeason = season.replace("/", "");
						const playerField = `${type.toLowerCase()}${dbSeason}`;
						return `coalesce(p.${playerField}, 0)`;
					}
				}
				// Complex calculation metrics (MostCommonPosition, MPERG, MPERCLS, FTPPERAPP, GPERAPP, CPERAPP) are handled by custom queries in buildPlayerQuery and don't need return clauses here
				return "0";
		}
	}

	/**
	 * Gets the return clause for MatchDetail join queries
	 */
	static getMatchDetailReturnClause(metric: string): string {
		switch (metric.toUpperCase()) {
			case "APP":
				return "count(md) as value";
			case "G":
				return `
				coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) + 
				coalesce(sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END), 0) as value`;
			case "OPENPLAYGOALS":
				return `
				coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) as value`;
			case "ALLGSC":
				return `
				coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) + 
				coalesce(sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END), 0) as value`;
			case "GI":
				return `
				coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) + 
				coalesce(sum(CASE WHEN md.assists IS NULL OR md.assists = "" THEN 0 ELSE md.assists END), 0) as value`;
			case "HOME":
				return "count(DISTINCT md) as value";
			case "AWAY":
				return "count(DISTINCT md) as value";
			case "HOMEGAMES":
				return "count(DISTINCT md) as value";
			case "AWAYGAMES":
				return "count(DISTINCT md) as value";
			case "HOMEWINS":
				return "sum(CASE WHEN toUpper(coalesce(f.result, '')) IN ['W', 'WIN'] OR (f.fullResult IS NOT NULL AND toUpper(f.fullResult) STARTS WITH 'W') THEN 1 ELSE 0 END) as value";
			case "AWAYWINS":
				return "sum(CASE WHEN toUpper(coalesce(f.result, '')) IN ['W', 'WIN'] OR (f.fullResult IS NOT NULL AND toUpper(f.fullResult) STARTS WITH 'W') THEN 1 ELSE 0 END) as value";
			case "PENALTY_CONVERSION_RATE":
				return `
				CASE 
					WHEN (sum(coalesce(md.penaltiesScored, 0)) + sum(coalesce(md.penaltiesMissed, 0))) > 0 
					THEN toFloat(sum(coalesce(md.penaltiesScored, 0))) / (sum(coalesce(md.penaltiesScored, 0)) + sum(coalesce(md.penaltiesMissed, 0))) * 100.0
					ELSE 0.0 
				END as value`;
			case "GK":
				return "coalesce(count(md), 0) as value";
			case "DEF":
				return "coalesce(count(md), 0) as value";
			case "MID":
				return "coalesce(count(md), 0) as value";
			case "FWD":
				return "coalesce(count(md), 0) as value";
			case "A":
				return "coalesce(sum(CASE WHEN md.assists IS NULL OR md.assists = '' THEN 0 ELSE md.assists END), 0) as value";
			case "Y":
				return "coalesce(sum(CASE WHEN md.yellowCards IS NULL OR md.yellowCards = '' THEN 0 ELSE md.yellowCards END), 0) as value";
			case "R":
				return "coalesce(sum(CASE WHEN md.redCards IS NULL OR md.redCards = '' THEN 0 ELSE md.redCards END), 0) as value";
			case "DIST":
				return "coalesce(sum(md.distance), 0) as value";
			case "FTP":
			case "POINTS":
			case "FANTASYPOINTS":
				return "coalesce(sum(CASE WHEN md.fantasyPoints IS NULL OR md.fantasyPoints = '' THEN 0 ELSE md.fantasyPoints END), 0) as value";
			// Team-specific appearance metrics (1sApps, 2sApps, etc.)
			default:
				// Check if it's a team-specific appearance metric
				if (metric.match(/^\d+sApps$/i)) {
					return "count(md) as value";
				}

				// Check if it's a team-specific appearance metric (1st XI Apps, 2nd XI Apps, etc.)
				if (metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i)) {
					return "count(md) as value";
				}

				// Check if it's a team-specific goals metric (1sGoals, 2sGoals, etc.)
				if (metric.match(/^\d+sGoals$/i)) {
					return `
					coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) + 
					coalesce(sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END), 0) as value`;
				}

				// Check if it's a team-specific goals metric (1st XI Goals, 2nd XI Goals, etc.)
				if (metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i)) {
					return `
					coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) + 
					coalesce(sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END), 0) as value`;
				}
			// Season-specific goals
			// Dynamic seasonal metrics (any season)
				// Check if it's a seasonal goals metric
				if (metric.match(/\d{4}\/\d{2}GOALS/i)) {
					const seasonMatch = metric.match(/(\d{4}\/\d{2})GOALS/i);
					if (seasonMatch) {
						const season = seasonMatch[1];
						return `coalesce(sum(CASE WHEN f.season = "${season}" AND (md.goals IS NOT NULL AND md.goals <> "") THEN md.goals ELSE 0 END), 0) + 
						coalesce(sum(CASE WHEN f.season = "${season}" AND (md.penaltiesScored IS NOT NULL AND md.penaltiesScored <> "") THEN md.penaltiesScored ELSE 0 END), 0) as value`;
					}
				}

				// Check if it's a seasonal assists metric
				if (metric.match(/\d{4}\/\d{2}ASSISTS/i)) {
					const seasonMatch = metric.match(/(\d{4}\/\d{2})ASSISTS/i);
					if (seasonMatch) {
						const season = seasonMatch[1];
						return `coalesce(sum(CASE WHEN f.season = "${season}" AND (md.assists IS NOT NULL AND md.assists <> "") THEN md.assists ELSE 0 END), 0) as value`;
					}
				}

				// Check if it's a seasonal clean sheets metric
				if (metric.match(/\d{4}\/\d{2}CLEANSHEETS/i)) {
					const seasonMatch = metric.match(/(\d{4}\/\d{2})CLEANSHEETS/i);
					if (seasonMatch) {
						const season = seasonMatch[1];
						return `coalesce(sum(CASE WHEN f.season = "${season}" AND (md.cleanSheets IS NOT NULL AND md.cleanSheets <> "") THEN md.cleanSheets ELSE 0 END), 0) as value`;
					}
				}

				// Check if it's a seasonal saves metric
				if (metric.match(/\d{4}\/\d{2}SAVES/i)) {
					const seasonMatch = metric.match(/(\d{4}\/\d{2})SAVES/i);
					if (seasonMatch) {
						const season = seasonMatch[1];
						return `coalesce(sum(CASE WHEN f.season = "${season}" AND (md.saves IS NOT NULL AND md.saves <> "") THEN md.saves ELSE 0 END), 0) as value`;
					}
				}

				// Check if it's a seasonal appearances metric
				if (metric.match(/\d{4}\/\d{2}APPS/i)) {
					const seasonMatch = metric.match(/(\d{4}\/\d{2})APPS/i);
					if (seasonMatch) {
						const season = seasonMatch[1];
						return `coalesce(count(CASE WHEN f.season = "${season}" THEN 1 END), 0) as value`;
					}
				}
				break;
		}

		// Default fallback for unrecognized metrics
		return "0 as value";
	}

	/**
	 * Build query for "each season" or "per season" questions
	 * Returns data grouped by season for any metric
	 */
	static buildPerSeasonQuery(_playerName: string, metric: string, _analysis: EnhancedQuestionAnalysis): string {
		// Get the return clause for the metric
		const returnClause = PlayerQueryBuilder.getMatchDetailReturnClause(metric);
		
		// Extract the aggregation part (everything before "as value")
		const aggregationMatch = returnClause.match(/^(.+?)\s+as\s+value$/i);
		if (!aggregationMatch) {
			// Fallback if we can't parse it
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WHERE f.season IS NOT NULL AND f.season <> ""
				WITH p, f.season as season, count(md) as value
				ORDER BY season ASC
				RETURN p.playerName as playerName, season, value
			`;
		}
		
		const aggregation = aggregationMatch[1];
		
		// Build query that groups by season
		return `
			MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
			MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
			WHERE f.season IS NOT NULL AND f.season <> ""
			WITH p, f.season as season, ${aggregation} as value
			ORDER BY season ASC
			RETURN p.playerName as playerName, season, value
		`;
	}

	/**
	 * Optimize WHERE clause condition order for better query performance
	 * Most selective conditions (equality, indexed fields) should come first
	 */
	static optimizeWhereConditionOrder(conditions: string[]): string[] {
		// Priority order: most selective first
		// 1. Equality conditions on indexed fields (playerName, team, etc.)
		// 2. Range conditions (date ranges)
		// 3. IN clauses
		// 4. Other conditions
		
		const priority1: string[] = []; // Equality on indexed fields
		const priority2: string[] = []; // Date ranges
		const priority3: string[] = []; // IN clauses
		const priority4: string[] = []; // Other conditions
		
		for (const condition of conditions) {
			if (condition.includes("playerName") || condition.includes("md.team") || condition.includes("f.opposition")) {
				priority1.push(condition);
			} else if (condition.includes("date >=") || condition.includes("date <=")) {
				priority2.push(condition);
			} else if (condition.includes(" IN [")) {
				priority3.push(condition);
			} else {
				priority4.push(condition);
			}
		}
		
		return [...priority1, ...priority2, ...priority3, ...priority4];
	}

	/**
	 * Build WHERE conditions for query filters
	 */
	static buildWhereConditions(
		metric: string,
		analysis: EnhancedQuestionAnalysis,
		isTeamSpecificMetric: boolean,
		teamEntities: string[],
		oppositionEntities: string[],
		timeRange: string | undefined,
		locations: Array<{ type: string; value: string }>,
		needsFixture: boolean = false,
	): string[] {
		const whereConditions: string[] = [];
		const metricUpper = metric.toUpperCase();
		const questionLower = (analysis.question || "").toLowerCase();
		const explicitLocationKeywords = [
			"home",
			"at home",
			"home game",
			"home match",
			"away",
			"away game",
			"away match",
			"away from home",
			"on the road",
			"their ground",
			"our ground",
			"pixham",
		];
		const hasExplicitLocation = explicitLocationKeywords.some((keyword) => questionLower.includes(keyword));

		// Add team filter if specified (but skip if we have a team-specific metric - those use md.team instead)
		if (teamEntities.length > 0 && !isTeamSpecificMetric) {
			const mappedTeamNames = teamEntities.map((team) => TeamMappingUtils.mapTeamName(team));
			const teamNames = mappedTeamNames.map((team) => `toUpper('${team}')`).join(", ");
			whereConditions.push(`toUpper(f.team) IN [${teamNames}]`);
		}

		// Add team exclusion filter if specified (for "not playing for" patterns)
		if (analysis.teamExclusions && analysis.teamExclusions.length > 0) {
			const teamExclusions = analysis.teamExclusions || [];
			// Remove duplicates before mapping to avoid duplicate WHERE conditions
			const uniqueTeamExclusions = [...new Set(teamExclusions)];
			const mappedExcludedTeamNames = uniqueTeamExclusions.map((team) => TeamMappingUtils.mapTeamName(team));
			// Remove duplicates from mapped names as well (in case mapping produces duplicates)
			const uniqueMappedExcludedTeamNames = [...new Set(mappedExcludedTeamNames)];
			
			// For player performance metrics, exclude based on md.team (where individual player team is stored)
			// For team-specific metrics that don't use MatchDetail, we still use md.team for consistency
			// The exclusion means "not playing for team X", which refers to the team in MatchDetail
			for (const excludedTeam of uniqueMappedExcludedTeamNames) {
				whereConditions.push(`toUpper(md.team) <> toUpper('${excludedTeam}')`);
			}
		}

		// Add team-specific appearance filter if metric is team-specific (1sApps, 2sApps, etc.)
		// BUT skip if team exclusions are present (exclusions mean we want all teams except excluded ones)
		if (metric.match(/^\d+sApps$/i) && !(analysis.teamExclusions && analysis.teamExclusions.length > 0)) {
			const teamNumber = metric.match(/^(\d+)sApps$/i)?.[1];
			if (teamNumber) {
				const teamName = TeamMappingUtils.mapTeamName(`${teamNumber}s`);
				whereConditions.push(`toUpper(md.team) = toUpper('${teamName}')`);
			}
		}

		// Add team-specific appearance filter if metric is team-specific (1st XI Apps, 2nd XI Apps, etc.)
		// BUT skip if team exclusions are present (exclusions mean we want all teams except excluded ones)
		if (metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i) && !(analysis.teamExclusions && analysis.teamExclusions.length > 0)) {
			const teamMatch = metric.match(/^(\d+(?:st|nd|rd|th))\s+XI\s+Apps$/i);
			if (teamMatch) {
				const teamName = teamMatch[1] + " XI";
				whereConditions.push(`toUpper(md.team) = toUpper('${teamName}')`);
			}
		}

		// Add team-specific goals filter if metric is team-specific (1sGoals, 2sGoals, etc.)
		if (metric.match(/^\d+sGoals$/i)) {
			const teamNumber = metric.match(/^(\d+)sGoals$/i)?.[1];
			if (teamNumber) {
				const teamName = TeamMappingUtils.mapTeamName(`${teamNumber}s`);
				if (!isTeamSpecificMetric) {
					whereConditions.push(`toUpper(md.team) = toUpper('${teamName}')`);
				}
			}
		}

		// Add team-specific goals filter if metric is team-specific (1st XI Goals, 2nd XI Goals, etc.)
		if (metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i)) {
			const teamMatch = metric.match(/^(\d+(?:st|nd|rd|th))\s+XI\s+Goals$/i);
			if (teamMatch) {
				const teamName = teamMatch[1] + " XI";
				if (!isTeamSpecificMetric) {
					whereConditions.push(`toUpper(md.team) = toUpper('${teamName}')`);
				}
			}
		}

		const metricHandlesLocation = ["HOME", "AWAY", "HOMEGAMES", "AWAYGAMES", "HOMEWINS", "AWAYWINS"].includes(metricUpper);
		
		// Check if metric is team-specific appearance or goals metric (used in multiple places)
		const isTeamSpecificAppearanceOrGoals = !!(metric.match(/^\d+sApps$/i) || 
			metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i) ||
			metric.match(/^\d+sGoals$/i) ||
			metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i));

		// CRITICAL: Never add location filters for team-specific metrics, even if Home/Away was incorrectly detected
		// This prevents issues where "how" was incorrectly matched to "Home" stat type
		if (!isTeamSpecificMetric && !isTeamSpecificAppearanceOrGoals) {
			// Add location filter if specified (only if not already handled by metric)
			if (locations.length > 0 && hasExplicitLocation && !metricHandlesLocation) {
				const locationFilters = locations
					.map((loc) => {
						if (loc.type === "home") return `f.homeOrAway = 'Home'`;
						if (loc.type === "away") return `f.homeOrAway = 'Away'`;
						return null;
					})
					.filter(Boolean);
				if (locationFilters.length > 0) {
					// Use single condition if only one location, otherwise join with OR
					if (locationFilters.length === 1) {
						const singleFilter = locationFilters[0];
						if (singleFilter) {
							whereConditions.push(singleFilter);
						}
					} else {
						whereConditions.push(`(${locationFilters.join(" OR ")})`);
					}
				}
			}
		}

		if (metricUpper === "HOMEWINS") {
			whereConditions.push(`f.homeOrAway = 'Home'`);
		} else if (metricUpper === "AWAYWINS") {
			whereConditions.push(`f.homeOrAway = 'Away'`);
		}

		// Note: We don't filter for wins in WHERE clause for HomeWins/AwayWins queries
		// Instead, we count wins in the aggregation to distinguish between:
		// - Player has no games (query returns empty)
		// - Player has games but 0 wins (query returns value=0)

		// Add opposition filter if specified (but not for team-specific metrics - they don't need Fixture)
		// Filter through OppositionDetails nodes as per schema requirements
		// Use CONTAINS for partial matching (e.g., "Old Hamptonians" matches "Old Hamptonians 2nd")
		// Note: OppositionDetails node is matched in buildPlayerQuery, so we only need to link Fixture to it
		if (oppositionEntities.length > 0 && !isTeamSpecificMetric) {
			const oppositionName = oppositionEntities[0];
			whereConditions.push(`toLower(od.opposition) CONTAINS toLower('${oppositionName}') AND toLower(f.opposition) CONTAINS toLower('${oppositionName}')`);
		}

		// Add time range filter if specified (but not for team-specific metrics - they don't need Fixture)
		if (timeRange && !isTeamSpecificMetric) {
			// Check if we have a "before" type timeFrame in extractionResult (check this FIRST)
			const beforeFrame = analysis.extractionResult?.timeFrames?.find((tf) => tf.type === "before");
			
			// Check if we have a "since" type timeFrame in extractionResult
			const sinceFrame = analysis.extractionResult?.timeFrames?.find((tf) => tf.type === "since");
			
			// For appearance/goals queries, always use md.date to filter MatchDetail nodes directly
			// For other queries that need fixture data, use f.date
			const isAppearanceOrGoalsQuery = metricUpper === "APP" || metricUpper === "G" || metricUpper === "A";
			const dateField = (isAppearanceOrGoalsQuery || !needsFixture) ? "md.date" : "f.date";
			
			if (beforeFrame) {
				// Handle "before [SEASON]" pattern - convert season to start date and use < operator
				const seasonValue = beforeFrame.value;
				// Check if it's a season format (e.g., "2020/21" or "2020-21")
				const seasonMatch = seasonValue.match(/(\d{4})[\/\-](\d{2})/);
				if (seasonMatch) {
					const seasonStartDate = DateUtils.convertSeasonToStartDate(seasonValue);
					whereConditions.push(`${dateField} < '${seasonStartDate}'`);
				} else {
					// Try to parse as a year and use January 1st of that year
					const year = parseInt(seasonValue, 10);
					if (!isNaN(year)) {
						whereConditions.push(`${dateField} < '${year}-01-01'`);
					}
				}
			} else if (sinceFrame) {
				// Handle "since [YEAR]" pattern - convert to first date after that year
				const year = parseInt(sinceFrame.value, 10);
				if (!isNaN(year)) {
					const startDate = DateUtils.convertSinceYearToDate(year);
					whereConditions.push(`${dateField} >= '${startDate}'`);
				}
			} else {
				// Check if this is a date range or single date
				const dateRange = timeRange.split(" to ");
				
				if (dateRange.length === 2) {
					// Handle date range (between X and Y)
					const startDate = DateUtils.convertDateFormat(dateRange[0].trim());
					const endDate = DateUtils.convertDateFormat(dateRange[1].trim());
					whereConditions.push(`${dateField} >= '${startDate}' AND ${dateField} <= '${endDate}'`);
				} else if (dateRange.length === 1) {
					// Single date (could be from "since" pattern that was converted, or a single date query)
					const startDate = DateUtils.convertDateFormat(dateRange[0].trim());
					whereConditions.push(`${dateField} >= '${startDate}'`);
				}
			}
		}

		// Add competition type filter if specified (but not for team-specific metrics - they don't need Fixture)
		if (analysis.competitionTypes && analysis.competitionTypes.length > 0 && !isTeamSpecificMetric) {
			const compTypeFilters = analysis.competitionTypes
				.map((compType) => {
					switch (compType.toLowerCase()) {
						case "league":
							return `f.compType = 'League'`;
						case "cup":
							return `f.compType = 'Cup'`;
						case "friendly":
							return `f.compType = 'Friendly'`;
						default:
							return null;
					}
				})
				.filter(Boolean);
			if (compTypeFilters.length > 0) {
				whereConditions.push(`(${compTypeFilters.join(" OR ")})`);
			}
		}

		// Add competition filter if specified (but not for team-specific appearance or goals queries)
		// Use exact match (=) instead of CONTAINS as per schema requirements
		// This applies to goals queries (G) and other metrics that need Fixture data
		if (analysis.competitions && analysis.competitions.length > 0 && 
			!metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i) && 
			!metric.match(/^\d+sApps$/i) &&
			!metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i) &&
			!metric.match(/^\d+sGoals$/i)) {
			// Map competition names from pseudonyms to actual database values
			const competitionFilters = analysis.competitions.map((comp) => {
				// Use the competition name as-is (already mapped by extractCompetitions)
				return `f.competition = '${comp}'`;
			});
			whereConditions.push(`(${competitionFilters.join(" OR ")})`);
		}

		// Add result filter if specified (but not for team-specific metrics - they don't need Fixture)
		if (analysis.results && analysis.results.length > 0 && !isTeamSpecificMetric) {
			const resultFilters = analysis.results
				.map((result) => {
					switch (result.toLowerCase()) {
						case "win":
						case "w":
							return `f.result = 'W'`;
						case "draw":
						case "d":
							return `f.result = 'D'`;
						case "loss":
						case "l":
							return `f.result = 'L'`;
						default:
							return null;
					}
				})
				.filter(Boolean);
			if (resultFilters.length > 0) {
				whereConditions.push(`(${resultFilters.join(" OR ")})`);
			}
		}

		// Add opponent own goals filter if specified (but not for team-specific metrics - they don't need Fixture)
		if (analysis.opponentOwnGoals === true && !isTeamSpecificMetric) {
			whereConditions.push(`f.oppoOwnGoals > 0`);
		}

		// Add special metric filters
		if (metricUpper === "HOME" || metricUpper === "HOMEGAMES") {
			whereConditions.push(`f.homeOrAway = 'Home'`);
		} else if (metricUpper === "AWAY" || metricUpper === "AWAYGAMES") {
			whereConditions.push(`f.homeOrAway = 'Away'`);
		}

		// Add position filters for position-specific metrics
		if (metricUpper === "GK") {
			whereConditions.push(`md.class = 'GK'`);
		} else if (metricUpper === "DEF") {
			whereConditions.push(`md.class = 'DEF'`);
		} else if (metricUpper === "MID") {
			whereConditions.push(`md.class = 'MID'`);
		} else if (metricUpper === "FWD") {
			whereConditions.push(`md.class = 'FWD'`);
		}

		// Add seasonal metric filters (dynamic for any season)
		if (metric.match(/\d{4}\/\d{2}(GOALS|APPS)/i)) {
			const seasonMatch = metric.match(/(\d{4}\/\d{2})(GOALS|APPS)/i);
			if (seasonMatch) {
				const season = seasonMatch[1];
				whereConditions.push(`f.season = "${season}"`);
			}
		}

		const hasDirectionalLocation = locations.some((loc) => loc.type === "home" || loc.type === "away");
		const shouldKeepLocationFilters = metricHandlesLocation || (hasExplicitLocation && hasDirectionalLocation);
		
		// CRITICAL: For goals queries (G, ALLGSC, OPENPLAYGOALS) with explicit location filters, always keep them
		const isGoalsQuery = metricUpper === "G" || metricUpper === "ALLGSC" || metricUpper === "OPENPLAYGOALS";
		const hasLocationFilter = whereConditions.some((condition) => condition.includes("f.homeOrAway"));
		
		// For team-specific metrics, never keep location filters (isTeamSpecificAppearanceOrGoals already declared above)
		// Exception: Keep location filters for goals queries even if shouldKeepLocationFilters is false
		if ((!shouldKeepLocationFilters && !(isGoalsQuery && hasLocationFilter)) || isTeamSpecificMetric || isTeamSpecificAppearanceOrGoals) {
			return whereConditions.filter((condition) => !condition.includes("f.homeOrAway"));
		}

		return whereConditions;
	}

	/**
	 * Build special case queries that need custom query structures
	 */
	static buildSpecialCaseQuery(_playerName: string, metric: string, analysis: EnhancedQuestionAnalysis): string | null {
		// Normalize metric to uppercase for consistent comparison
		const metricUpper = metric.toUpperCase();
		
		if (metric === "MOSTCOMMONPOSITION" || metric === "MostCommonPosition") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WHERE md.class IS NOT NULL AND md.class <> ""
				WITH p, md.class as position, count(md) as positionCount
				WITH p, position, positionCount,
					CASE 
						WHEN position = 'GK' THEN 1
						WHEN position = 'DEF' THEN 2
						WHEN position = 'MID' THEN 3
						WHEN position = 'FWD' THEN 4
						ELSE 5
					END as priority
				ORDER BY positionCount DESC, priority ASC
				LIMIT 1
				RETURN p.playerName as playerName, position as value
			`;
		} else if (metric.toUpperCase() === "MPERG" || metric === "MperG") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.minutes, 0)) as totalMinutes,
					sum(coalesce(md.goals, 0)) + sum(coalesce(md.penaltiesScored, 0)) as totalGoals
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalGoals > 0 THEN round(100.0 * totalMinutes / totalGoals) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "MPERCLS" || metric === "MperCLS") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				OPTIONAL MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md)
				WITH p,
					sum(coalesce(md.minutes, 0)) as totalMinutes,
					sum(
						CASE 
							WHEN md.cleanSheets IS NOT NULL AND md.cleanSheets <> "" THEN coalesce(md.cleanSheets, 0)
							WHEN f IS NOT NULL AND coalesce(f.conceded, 0) = 0 THEN 1
							ELSE 0
						END
					) as matchDerivedCleanSheets,
					coalesce(p.cleanSheets, 0) as playerCleanSheets
				WITH p, totalMinutes,
					CASE 
						WHEN matchDerivedCleanSheets > 0 THEN matchDerivedCleanSheets
						WHEN playerCleanSheets > 0 THEN playerCleanSheets
						ELSE 0
					END as totalCleanSheets
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalCleanSheets > 0 THEN toInteger(round(toFloat(totalMinutes) / toFloat(totalCleanSheets)))
						ELSE 0 
					END as value
			`;
		} else if (metric.toUpperCase() === "FTPPERAPP" || metric === "FTPperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.fantasyPoints, 0)) as totalFantasyPoints,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalFantasyPoints / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "CPERAPP" || metric === "CperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(f.conceded, 0)) as totalConceded,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(10.0 * totalConceded / totalAppearances) / 10.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "GPERAPP" || metric === "GperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.goals, 0)) + sum(coalesce(md.penaltiesScored, 0)) as totalGoals,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(10.0 * totalGoals / totalAppearances) / 10.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "MINPERAPP" || metric === "MINperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.minutes, 0)) as totalMinutes,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalMinutes / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "MOMPERAPP" || metric === "MOMperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.mom, 0)) as totalMOM,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalMOM / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "YPERAPP" || metric === "YperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.yellowCards, 0)) as totalYellowCards,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalYellowCards / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "RPERAPP" || metric === "RperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.redCards, 0)) as totalRedCards,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalRedCards / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "SAVESPERAPP" || metric === "SAVESperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.saves, 0)) as totalSaves,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalSaves / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "OGPERAPP" || metric === "OGperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.ownGoals, 0)) as totalOwnGoals,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalOwnGoals / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "CLSPERAPP" || metric === "CLSperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WITH p, 
					sum(CASE WHEN coalesce(f.conceded, 0) = 0 THEN 1 ELSE 0 END) as totalCleanSheets,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalCleanSheets / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "PSCPERAPP" || metric === "PSCperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.penaltiesScored, 0)) as totalPenaltiesScored,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalPenaltiesScored / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "PMPERAPP" || metric === "PMperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.penaltiesMissed, 0)) as totalPenaltiesMissed,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalPenaltiesMissed / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "PCOPERAPP" || metric === "PCOperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.penaltiesConceded, 0)) as totalPenaltiesConceded,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalPenaltiesConceded / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metric.toUpperCase() === "PSVPERAPP" || metric === "PSVperAPP") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WITH p, 
					sum(coalesce(md.penaltiesSaved, 0)) as totalPenaltiesSaved,
					count(md) as totalAppearances
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalAppearances > 0 THEN round(100.0 * totalPenaltiesSaved / totalAppearances) / 100.0
						ELSE 0.0 
					END as value
			`;
		} else if (metricUpper === "HOMEGAMES%WON") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WHERE f.homeOrAway = 'Home'
				WITH p, 
					sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) as homeWins,
					count(md) as homeGames
				RETURN p.playerName as playerName, 
					CASE 
						WHEN homeGames > 0 THEN 100.0 * homeWins / homeGames
						ELSE 0.0 
					END as value,
					homeGames as totalGames
			`;
		} else if (metricUpper === "AWAYGAMES%WON") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WHERE f.homeOrAway = 'Away'
				WITH p, 
					sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) as awayWins,
					count(md) as awayGames
				RETURN p.playerName as playerName, 
					CASE 
						WHEN awayGames > 0 THEN 100.0 * awayWins / awayGames
						ELSE 0.0 
					END as value,
					awayGames as totalGames
			`;
		} else if (metricUpper === "GAMES%WON") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WITH p, 
					sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) as totalWins,
					count(md) as totalGames
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalGames > 0 THEN 100.0 * totalWins / totalGames
						ELSE 0.0 
					END as value,
					totalGames as totalGames
			`;
		} else if (metricUpper === "HOMEGAMES%LOST") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WHERE f.homeOrAway = 'Home'
				WITH p, 
					sum(CASE WHEN toUpper(coalesce(f.result, '')) IN ['L', 'LOSS', 'LOSE'] OR (f.fullResult IS NOT NULL AND toUpper(f.fullResult) STARTS WITH 'L') THEN 1 ELSE 0 END) as homeLosses,
					count(md) as homeGames
				RETURN p.playerName as playerName, 
					CASE 
						WHEN homeGames > 0 THEN 100.0 * homeLosses / homeGames
						ELSE 0.0 
					END as value,
					homeGames as totalGames
			`;
		} else if (metricUpper === "AWAYGAMES%LOST") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WHERE f.homeOrAway = 'Away'
				WITH p, 
					sum(CASE WHEN toUpper(coalesce(f.result, '')) IN ['L', 'LOSS', 'LOSE'] OR (f.fullResult IS NOT NULL AND toUpper(f.fullResult) STARTS WITH 'L') THEN 1 ELSE 0 END) as awayLosses,
					count(md) as awayGames
				RETURN p.playerName as playerName, 
					CASE 
						WHEN awayGames > 0 THEN 100.0 * awayLosses / awayGames
						ELSE 0.0 
					END as value,
					awayGames as totalGames
			`;
		} else if (metricUpper === "GAMES%LOST") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WITH p, 
					sum(CASE WHEN toUpper(coalesce(f.result, '')) IN ['L', 'LOSS', 'LOSE'] OR (f.fullResult IS NOT NULL AND toUpper(f.fullResult) STARTS WITH 'L') THEN 1 ELSE 0 END) as totalLosses,
					count(md) as totalGames
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalGames > 0 THEN 100.0 * totalLosses / totalGames
						ELSE 0.0 
					END as value,
					totalGames as totalGames
			`;
		} else if (metricUpper === "HOMEGAMES%DRAWN") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WHERE f.homeOrAway = 'Home'
				WITH p, 
					sum(CASE WHEN toUpper(coalesce(f.result, '')) IN ['D', 'DRAW', 'DRAWN'] OR (f.fullResult IS NOT NULL AND toUpper(f.fullResult) STARTS WITH 'D') THEN 1 ELSE 0 END) as homeDraws,
					count(md) as homeGames
				RETURN p.playerName as playerName, 
					CASE 
						WHEN homeGames > 0 THEN 100.0 * homeDraws / homeGames
						ELSE 0.0 
					END as value,
					homeGames as totalGames
			`;
		} else if (metricUpper === "AWAYGAMES%DRAWN") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WHERE f.homeOrAway = 'Away'
				WITH p, 
					sum(CASE WHEN toUpper(coalesce(f.result, '')) IN ['D', 'DRAW', 'DRAWN'] OR (f.fullResult IS NOT NULL AND toUpper(f.fullResult) STARTS WITH 'D') THEN 1 ELSE 0 END) as awayDraws,
					count(md) as awayGames
				RETURN p.playerName as playerName, 
					CASE 
						WHEN awayGames > 0 THEN 100.0 * awayDraws / awayGames
						ELSE 0.0 
					END as value,
					awayGames as totalGames
			`;
		} else if (metricUpper === "GAMES%DRAWN") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WITH p, 
					sum(CASE WHEN toUpper(coalesce(f.result, '')) IN ['D', 'DRAW', 'DRAWN'] OR (f.fullResult IS NOT NULL AND toUpper(f.fullResult) STARTS WITH 'D') THEN 1 ELSE 0 END) as totalDraws,
					count(md) as totalGames
				RETURN p.playerName as playerName, 
					CASE 
						WHEN totalGames > 0 THEN 100.0 * totalDraws / totalGames
						ELSE 0.0 
					END as value,
					totalGames as totalGames
			`;
		} else if (metric.toUpperCase() === "MOSTPROLIFICSEASON") {
			// Query MatchDetails to get goals per season for chart display
			// Includes regular goals and penalties, but excludes penalty shootout penalties
			return `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WHERE f.season IS NOT NULL AND f.season <> ""
				WITH p, f.season as season, 
					sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END) + 
					sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END) as goals
				ORDER BY season ASC
				RETURN p.playerName as playerName, season, goals as value
			`;
		} else if (metric === "MostPlayedForTeam" || metric === "MOSTPLAYEDFORTEAM" || metric === "TEAM_ANALYSIS") {
			if (TeamMappingUtils.isTeamCountQuestion(analysis.question)) {
				return `
					MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
					WHERE md.team IS NOT NULL AND md.team <> "Fun XI"
					WITH p, collect(DISTINCT md.team) as teams
					RETURN p.playerName as playerName, size(teams) as value
				`;
			} else {
				// Query for all teams played for with counts - return all teams, not just the top one
				return `
					MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
					WHERE md.team IS NOT NULL
					WITH p, md.team as team, count(md) as appearances, 
						sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END) + 
						sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END) as goals
					WITH p, team, appearances, goals,
						CASE 
							WHEN team = "1st XI" THEN 1
							WHEN team = "2nd XI" THEN 2
							WHEN team = "3rd XI" THEN 3
							WHEN team = "4th XI" THEN 4
							WHEN team = "5th XI" THEN 5
							WHEN team = "6th XI" THEN 6
							WHEN team = "7th XI" THEN 7
							WHEN team = "8th XI" THEN 8
							ELSE 9
						END as teamOrder
					ORDER BY appearances DESC, teamOrder ASC
					RETURN p.playerName as playerName, team as value, appearances, teamOrder
				`;
			}
		} else if (metric === "NUMBERTEAMSPLAYEDFOR" || metric === "NumberTeamsPlayedFor") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WHERE md.team IS NOT NULL AND md.team <> "Fun XI"
				WITH p, collect(DISTINCT md.team) as teams
				RETURN p.playerName as playerName, size(teams) as value
			`;
		} else if (metric.toUpperCase() === "NUMBERSEASONSPLAYEDFOR" || metric === "NumberSeasonsPlayedFor" || metric.toUpperCase().includes("NUMBERSEASONSPLAYEDFOR")) {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WHERE md.season IS NOT NULL AND md.season <> ""
				WITH p, collect(DISTINCT md.season) as playerSeasons
				MATCH (allFixtures:Fixture {graphLabel: $graphLabel})
				WHERE allFixtures.season IS NOT NULL AND allFixtures.season <> ""
				WITH p, size(playerSeasons) as playerSeasonCount, collect(DISTINCT allFixtures.season) as allSeasons
				RETURN p.playerName as playerName,
				       playerSeasonCount,
				       size(allSeasons) as totalSeasonCount
			`;
		} else if (metric === "SEASON_ANALYSIS") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WHERE f.season IS NOT NULL
				WITH p, collect(DISTINCT f.season) as seasons
				RETURN p.playerName as playerName, size(seasons) as value
			`;
		} else if (metric === "SEASON_COUNT_WITH_TOTAL") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WHERE f.season IS NOT NULL
				WITH p, collect(DISTINCT f.season) as playerSeasons
				MATCH (f2:Fixture {graphLabel: $graphLabel})
				WHERE f2.season IS NOT NULL
				WITH p, playerSeasons, collect(DISTINCT f2.season) as allSeasons
				WITH p, playerSeasons, allSeasons, size(playerSeasons) as playerSeasonCount, size(allSeasons) as totalSeasonCount
				UNWIND playerSeasons as season
				WITH p, playerSeasonCount, totalSeasonCount, season
				ORDER BY season
				WITH p, playerSeasonCount, totalSeasonCount, collect(season)[0] as firstSeason
				RETURN p.playerName as playerName, 
				       playerSeasonCount,
				       totalSeasonCount,
				       firstSeason
			`;
		} else if (metric === "SEASON_COUNT_SIMPLE") {
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
				WHERE f.season IS NOT NULL
				WITH p, collect(DISTINCT f.season) as seasons
				WITH p, seasons, size(seasons) as seasonCount
				UNWIND seasons as season
				WITH p, seasonCount, season
				ORDER BY season
				WITH p, seasonCount, collect(season)[0] as firstSeason
				RETURN p.playerName as playerName, 
				       seasonCount as value,
				       firstSeason
			`;
		} else if (metric.toUpperCase() === "MOSTSCOREDFORTEAM" || metric === "MostScoredForTeam") {
			// Query for team with most of a specific stat (goals, assists, yellow cards, etc.)
			// Determine which stat to aggregate based on extracted metrics
			const statMetrics = analysis.metrics || [];
			let statField = "goals"; // Default to goals
			let statDisplayName = "goals";
			const questionLower = analysis.question?.toLowerCase() || "";
			
			// Map metric keys to MatchDetail property names
			const statFieldMap: Record<string, { field: string; displayName: string }> = {
				"G": { field: "goals", displayName: "goals" },
				"A": { field: "assists", displayName: "assists" },
				"Y": { field: "yellowCards", displayName: "yellow cards" },
				"R": { field: "redCards", displayName: "red cards" },
				"SAVES": { field: "saves", displayName: "saves" },
				"OG": { field: "ownGoals", displayName: "own goals" },
				"C": { field: "conceded", displayName: "goals conceded" },
				"CLS": { field: "cleanSheets", displayName: "clean sheets" },
				"PSC": { field: "penaltiesScored", displayName: "penalties scored" },
				"PM": { field: "penaltiesMissed", displayName: "penalties missed" },
				"PCO": { field: "penaltiesConceded", displayName: "penalties conceded" },
				"PSV": { field: "penaltiesSaved", displayName: "penalties saved" },
				"goals": { field: "goals", displayName: "goals" },
				"assists": { field: "assists", displayName: "assists" },
				"yellow cards": { field: "yellowCards", displayName: "yellow cards" },
				"red cards": { field: "redCards", displayName: "red cards" },
			};
			
			// Find the stat type from extracted metrics
			for (const extractedMetric of statMetrics) {
				const upperMetric = extractedMetric.toUpperCase();
				if (statFieldMap[upperMetric]) {
					statField = statFieldMap[upperMetric].field;
					statDisplayName = statFieldMap[upperMetric].displayName;
					break;
				}
				// Also check for case-insensitive partial matches
				for (const [key, value] of Object.entries(statFieldMap)) {
					if (extractedMetric.toLowerCase().includes(key.toLowerCase()) || 
					    key.toLowerCase().includes(extractedMetric.toLowerCase())) {
						statField = value.field;
						statDisplayName = value.displayName;
						break;
					}
				}
			}
			
			const mentionsGoals = questionLower.includes("goal") || questionLower.includes("scor");
			const mentionsAssists = questionLower.includes("assist");
			if (mentionsGoals && !mentionsAssists) {
				statField = "goals";
				statDisplayName = "goals";
			}

			// Store the stat field and display name in analysis for response generation
			(analysis as any).mostScoredForTeamStatField = statField;
			(analysis as any).mostScoredForTeamStatDisplayName = statDisplayName;

			const statAggregationExpression =
				statField === "goals"
					? `sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END) + sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END)`
					: `sum(CASE WHEN md.${statField} IS NULL OR md.${statField} = "" THEN 0 ELSE md.${statField} END)`;
			
			return `
				MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
				WHERE md.team IS NOT NULL AND md.team <> "Fun XI"
				WITH p, md.team as team, ${statAggregationExpression} as statValue
				WITH p, team, statValue,
					CASE 
						WHEN team = "1st XI" THEN 1
						WHEN team = "2nd XI" THEN 2
						WHEN team = "3rd XI" THEN 3
						WHEN team = "4th XI" THEN 4
						WHEN team = "5th XI" THEN 5
						WHEN team = "6th XI" THEN 6
						WHEN team = "7th XI" THEN 7
						WHEN team = "8th XI" THEN 8
						ELSE 9
					END as teamOrder
				ORDER BY statValue DESC, teamOrder ASC
				LIMIT 1
				RETURN p.playerName as playerName, team as value, statValue as goalCount
			`;
		}

		return null;
	}

	/**
	 * Builds the optimal query for player data using unified architecture
	 */
	static buildPlayerQuery(_playerName: string, metric: string, analysis: EnhancedQuestionAnalysis): string {
		// Check for "each season" pattern first
		const questionLower = analysis.question?.toLowerCase() || "";
		if (questionLower.includes("each season") || questionLower.includes("per season") || questionLower.includes("every season")) {
			return PlayerQueryBuilder.buildPerSeasonQuery(_playerName, metric, analysis);
		}
		
		// Handle special case queries first (these have custom query structures)
		const specialCaseQuery = PlayerQueryBuilder.buildSpecialCaseQuery(_playerName, metric, analysis);
		if (specialCaseQuery) {
			return specialCaseQuery;
		}

		// Determine query structure requirements
		const teamEntities = analysis.teamEntities || [];
		const oppositionEntities = analysis.oppositionEntities || [];
		const timeRange = analysis.timeRange;
		const locations = analysis.extractionResult?.locations || [];
		const hasLocationFilter = locations.some((loc) => loc.type === "home" || loc.type === "away");
		let needsMatchDetail = PlayerQueryBuilder.metricNeedsMatchDetail(metric);
		// CRITICAL: Force MatchDetail join when filters requiring Fixture are present
		// (competition, competition type, opposition, time range, location, result filters)
		// ALSO: Force MatchDetail when team exclusions are present (need to filter by md.team)
		const hasCompetitionFilter = analysis.competitions && analysis.competitions.length > 0;
		const hasCompetitionTypeFilter = analysis.competitionTypes && analysis.competitionTypes.length > 0;
		const hasOppositionFilter = oppositionEntities.length > 0;
		const hasTimeRangeFilter = timeRange !== undefined;
		const hasResultFilter = analysis.results && analysis.results.length > 0;
		const hasTeamExclusions = analysis.teamExclusions && analysis.teamExclusions.length > 0;
		const hasFiltersRequiringMatchDetail = hasLocationFilter || hasCompetitionFilter || hasCompetitionTypeFilter || 
			hasOppositionFilter || hasTimeRangeFilter || hasResultFilter || hasTeamExclusions;
		
		if (hasFiltersRequiringMatchDetail && !needsMatchDetail) {
			needsMatchDetail = true;
		}
		const isTeamSpecificMetric = !!(metric.match(/^\d+sApps$/i) || 
			metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i) ||
			metric.match(/^\d+sGoals$/i) ||
			metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i));
		const metricUpper = metric.toUpperCase();
		const isPositionMetric = ["GK", "DEF", "MID", "FWD"].includes(metricUpper);
		// CRITICAL: If a player is involved (which is always the case in buildPlayerQuery), 
		// we should NEVER use team-specific metric paths - those are for team stats queries only
		const hasPlayerEntity = _playerName && _playerName.trim().length > 0;
		const fixtureDependentMetrics = new Set([
			"HOME",
			"AWAY",
			"HOMEGAMES",
			"AWAYGAMES",
			"HOMEWINS",
			"AWAYWINS",
			"HOMEGAMES%WON",
			"AWAYGAMES%WON",
			"GAMES%WON",
		]);
		const isSeasonalMetric = metric.match(/\d{4}\/\d{2}(GOALS|APPS|ASSISTS|CLEANSHEETS|SAVES|YELLOWCARDS|REDCARDS|MOM|PENALTIESSCORED|PENALTIESMISSED|PENALTIESSAVED|PENALTIESTAKEN|PENALTIESCONCEDED|OWNGOALS|CONCEDED|FANTASYPOINTS|DISTANCE)/i) !== null;

		// For team-specific metrics (appearances/goals for specific teams), we don't need fixtures
		// Team filtering is done on md.team property, not f.team
		let needsFixture: boolean = isTeamSpecificMetric ? false :
			(teamEntities.length > 0) ||
			(locations.length > 0 && !fixtureDependentMetrics.has(metricUpper)) ||
			(timeRange !== undefined && timeRange !== "") ||
			oppositionEntities.length > 0 ||
			fixtureDependentMetrics.has(metricUpper) ||
			(analysis.competitionTypes && analysis.competitionTypes.length > 0) ||
			(analysis.competitions && analysis.competitions.length > 0) ||
			(analysis.results && analysis.results.length > 0) ||
			analysis.opponentOwnGoals === true;
		if (!needsFixture && isSeasonalMetric) {
			needsFixture = true;
		}

		// Build base query structure
		let query: string;
		
		if (!needsMatchDetail) {
			// Use direct Player node query (no MatchDetail join needed)
			query = `
				MATCH (p:Player {playerName: $playerName})
				RETURN p.playerName as playerName, ${PlayerQueryBuilder.getPlayerNodeReturnClause(metric)} as value
			`;
		} else {
			// Use MatchDetail join query with simplified path pattern
			if (needsFixture) {
				// Use explicit path pattern to ensure we only count the player's own MatchDetail records
				// Add OppositionDetails MATCH when opposition filter is present
				if (oppositionEntities.length > 0 && !isTeamSpecificMetric) {
					const oppositionName = oppositionEntities[0];
					query = `
						MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
						MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
						MATCH (od:OppositionDetails)
						WHERE toLower(od.opposition) CONTAINS toLower('${oppositionName}')
					`;
				} else {
					query = `
						MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
						MATCH (f:Fixture)-[:HAS_MATCH_DETAILS]->(md:MatchDetail)
					`;
				}
			} else {
				// Use simple MatchDetail query for queries that don't need fixture data
				// For team-specific or position metrics, use OPTIONAL MATCH to ensure we always return a row
				// BUT: Don't use OPTIONAL MATCH when team exclusions are present (exclusions work better with regular MATCH)
				// ALSO: Don't use OPTIONAL MATCH for non-team-specific metrics with exclusions (like assists)
				if ((isTeamSpecificMetric || isPositionMetric) && !hasTeamExclusions) {
					query = `
						MATCH (p:Player {playerName: $playerName})
						OPTIONAL MATCH (p)-[:PLAYED_IN]->(md:MatchDetail)
					`;
				} else {
					query = `
						MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
					`;
				}
			}

			// Build WHERE conditions using helper method (pre-computed and optimized)
			let whereConditions = PlayerQueryBuilder.buildWhereConditions(metric, analysis, isTeamSpecificMetric, teamEntities, oppositionEntities, timeRange, locations, needsFixture);

			// For team-specific appearances with OPTIONAL MATCH, remove team filter from WHERE conditions
			// (we'll filter in WITH clause instead to ensure we always return a row)
			// BUT skip this if team exclusions are present (exclusions mean we want all teams except the excluded ones)
			let teamNameForWithClause = "";
			if (!hasTeamExclusions && (isTeamSpecificMetric || isPositionMetric) && (metric.match(/^\d+sApps$/i) || metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i))) {
				if (metric.match(/^\d+sApps$/i)) {
					const teamNumber = metric.match(/^(\d+)sApps$/i)?.[1];
					if (teamNumber) {
						teamNameForWithClause = TeamMappingUtils.mapTeamName(`${teamNumber}s`);
					}
				} else if (metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i)) {
					const teamMatch = metric.match(/^(\d+(?:st|nd|rd|th))\s+XI\s+Apps$/i);
					if (teamMatch) {
						teamNameForWithClause = teamMatch[1] + " XI";
					}
				}
				
				if (teamNameForWithClause) {
					// Remove team filter from WHERE conditions
					const teamFilterPattern = new RegExp(`toUpper\\(md\\.team\\)\\s*=\\s*toUpper\\('${teamNameForWithClause.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\)`, 'i');
					whereConditions = whereConditions.filter(condition => !teamFilterPattern.test(condition));
				}
			}

			// Add WHERE clause if we have conditions
			// Optimize condition order: put most selective conditions first
			if (whereConditions.length > 0) {
				const optimizedConditions = PlayerQueryBuilder.optimizeWhereConditionOrder(whereConditions);
				query += ` WHERE ${optimizedConditions.join(" AND ")}`;
			}

			// Handle non-team-specific metrics with team exclusions FIRST (e.g., assists, goals)
			// This must come before the team-specific metric check to ensure correct routing
			// CRITICAL: Check this FIRST before any team-specific metric checks
			// Also explicitly check that metric is NOT a team-specific appearances metric
			const isTeamSpecificAppsMetric = !!(metric.match(/^\d+sApps$/i) || metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i));
			// CRITICAL: If a player is involved, NEVER use team-specific metric paths - those are for team stats only
			// For player queries, always use standard aggregation with the appropriate return clause
			if (hasPlayerEntity && hasTeamExclusions) {
				// For player queries with team exclusions (e.g., assists, goals), use regular aggregation
				// The exclusion filter is already in WHERE conditions, so just use the standard return clause
				query += ` RETURN p.playerName as playerName, ${PlayerQueryBuilder.getMatchDetailReturnClause(metric)}`;
			} else if (hasTeamExclusions && !isTeamSpecificMetric && !isTeamSpecificAppsMetric) {
				// For non-team-specific metrics with team exclusions (e.g., assists, goals), use regular aggregation
				// The exclusion filter is already in WHERE conditions, so just use the standard return clause
				query += ` RETURN p.playerName as playerName, ${PlayerQueryBuilder.getMatchDetailReturnClause(metric)}`;
			} else if (hasPlayerEntity && !hasTeamExclusions) {
				// For player queries without exclusions, use standard return clause
				// Skip team-specific metric paths entirely for player queries
				query += ` RETURN p.playerName as playerName, ${PlayerQueryBuilder.getMatchDetailReturnClause(metric)}`;
			} else if (isTeamSpecificMetric && !hasTeamExclusions && (metric.match(/^\d+sGoals$/i) || metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i))) {
				// Extract team name for filtering
				let teamName = "";
				if (metric.match(/^\d+sGoals$/i)) {
					const teamNumber = metric.match(/^(\d+)sGoals$/i)?.[1];
					if (teamNumber) {
						teamName = TeamMappingUtils.mapTeamName(`${teamNumber}s`);
					}
				} else if (metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i)) {
					const teamMatch = metric.match(/^(\d+(?:st|nd|rd|th))\s+XI\s+Goals$/i);
					if (teamMatch) {
						teamName = teamMatch[1] + " XI";
					}
				}
				
				if (teamName) {
					// Use WITH clause to aggregate and filter by team
					// Ensure we always return a row even when there are no MatchDetail records
					// The key is to use OPTIONAL MATCH and then aggregate, which will always return a row
					query += ` WITH p, collect(md) as matchDetails`;
					query += ` WITH p, CASE WHEN size(matchDetails) = 0 OR matchDetails[0] IS NULL THEN [] ELSE [md IN matchDetails WHERE md IS NOT NULL AND toUpper(md.team) = toUpper('${teamName}')] END as filteredDetails`;
					query += ` WITH p, CASE WHEN size(filteredDetails) = 0 THEN 0 ELSE reduce(total = 0, md IN filteredDetails | total + CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END + CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END) END as totalGoals`;
					query += ` RETURN p.playerName as playerName, totalGoals as value`;
				} else {
					query += ` RETURN p.playerName as playerName, ${PlayerQueryBuilder.getMatchDetailReturnClause(metric)}`;
				}
			} else if (!hasPlayerEntity && isTeamSpecificMetric && (metric.match(/^\d+sApps$/i) || metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i))) {
				// Check if we have team exclusions - if so, don't use team-specific pattern
				// BUT: Only enter this block if the metric actually matches team-specific appearances pattern
				// CRITICAL: NEVER use team-specific metric paths for player queries - those are for team stats only
				// This prevents non-team-specific metrics (like assists) from entering this path
				if (teamNameForWithClause && !hasTeamExclusions) {
					// Use WITH clause to aggregate and filter by team
					// Ensure we always return a row even when there are no MatchDetail records
					query += ` WITH p, collect(md) as matchDetails`;
					query += ` WITH p, CASE WHEN size(matchDetails) = 0 OR matchDetails[0] IS NULL THEN [] ELSE [md IN matchDetails WHERE md IS NOT NULL AND toUpper(md.team) = toUpper('${teamNameForWithClause}')] END as filteredDetails`;
					query += ` WITH p, size(filteredDetails) as appearanceCount`;
					query += ` RETURN p.playerName as playerName, appearanceCount as value`;
				} else if (hasTeamExclusions && (metric.match(/^\d+sApps$/i) || metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i))) {
					// When exclusions are present for team-specific appearances, use regular aggregation with exclusion filter
					// This path is ONLY for team-specific appearance metrics (3sApps, etc.), not for other metrics like assists
					// The metric.match check ensures we only use this path for actual team-specific appearances
					const mappedExcludedTeamNames = (analysis.teamExclusions || []).map((team) => TeamMappingUtils.mapTeamName(team));
					const exclusionConditions = mappedExcludedTeamNames.map(team => `toUpper(md.team) <> toUpper('${team}')`).join(" AND ");
					query += ` WITH p, collect(md) as matchDetails`;
					query += ` WITH p, CASE WHEN size(matchDetails) = 0 OR matchDetails[0] IS NULL THEN [] ELSE [md IN matchDetails WHERE md IS NOT NULL AND (${exclusionConditions})] END as filteredDetails`;
					query += ` WITH p, size(filteredDetails) as appearanceCount`;
					query += ` RETURN p.playerName as playerName, appearanceCount as value`;
				} else {
					query += ` RETURN p.playerName as playerName, ${PlayerQueryBuilder.getMatchDetailReturnClause(metric)}`;
				}
			} else {
				// Add return clause
				query += ` RETURN p.playerName as playerName, ${PlayerQueryBuilder.getMatchDetailReturnClause(metric)}`;
			}
		}

		// Return the built query
		return query;
	}
}
