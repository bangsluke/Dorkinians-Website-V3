import type { EnhancedQuestionAnalysis } from "../../config/enhancedQuestionAnalysis";
import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { findMetricByAlias } from "../../config/chatbotMetrics";
import { loggingService } from "../loggingService";
import { TeamMappingUtils } from "../chatbotUtils/teamMappingUtils";

export class RankingQueryHandler {
	/**
	 * Query ranking data for "which" questions (top players/teams)
	 */
	static async queryRankingData(
		entities: string[],
		metrics: string[],
		analysis: EnhancedQuestionAnalysis,
	): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 queryRankingData called with entities: ${entities}, metrics: ${metrics}`, null, "log");

		const lowerQuestion = analysis.question?.toLowerCase() || "";
		
		// CRITICAL: Check question text for explicit metric keywords FIRST (before checking metrics.length)
		// This ensures metrics like "goal-per-game ratio" are detected even if extraction fails
		// Check for GperAPP (goal per game ratio) questions
		const hasGoalPerGameKeyword = lowerQuestion.includes("goal per game") || 
		                               lowerQuestion.includes("goal-per-game") ||
		                               lowerQuestion.includes("goals per appearance") ||
		                               lowerQuestion.includes("goal per appearance") ||
		                               lowerQuestion.includes("goals per game") ||
		                               (lowerQuestion.includes("goal") && lowerQuestion.includes("ratio"));
		
		// Check for penalty keywords
		const hasPenaltyKeyword = lowerQuestion.includes("penalties") || lowerQuestion.includes("penalty");
		const hasScoredKeyword = lowerQuestion.includes("scored") || lowerQuestion.includes("score");
		const hasMostKeyword = lowerQuestion.includes("most");
		const hasWorstKeyword = lowerQuestion.includes("worst");
		const hasBestKeyword = lowerQuestion.includes("best");
		const isShootout = lowerQuestion.includes("shootout");
		
		// Check for "worst penalty record" and "best penalty record" questions - must be detected before other penalty logic
		const isWorstPenaltyRecord = hasWorstKeyword && hasPenaltyKeyword && (lowerQuestion.includes("record") || hasMostKeyword);
		const isBestPenaltyRecord = hasBestKeyword && hasPenaltyKeyword && (lowerQuestion.includes("record") || hasMostKeyword);
		
		// Determine if this is a GperAPP question (check before early return)
		const isGperAPPQuestion = hasGoalPerGameKeyword || (metrics.length > 0 && metrics[0].toUpperCase() === "GPERAPP");
		
		// Only return early if no metrics AND no special metric detected in question text
		if (metrics.length === 0 && !isGperAPPQuestion && !hasPenaltyKeyword) {
			return { type: "no_metrics", data: [], message: "No metrics specified for ranking" };
		}

		let metric = metrics.length > 0 ? metrics[0] : "";
		
		// Extract minimum appearance threshold from question (e.g., "more than 5 games" → minAppearances = 6)
		let minAppearances: number | null = null;
		if (isGperAPPQuestion) {
			// Look for patterns like "more than X games", "at least X games", "X or more games", "played more than X"
			const moreThanMatch = lowerQuestion.match(/(?:more than|at least|minimum of|minimum)\s+(\d+)\s+games?/);
			const orMoreMatch = lowerQuestion.match(/(\d+)\s+or\s+more\s+games?/);
			const playedMoreThanMatch = lowerQuestion.match(/played\s+more\s+than\s+(\d+)\s+games?/);
			
			if (moreThanMatch || orMoreMatch || playedMoreThanMatch) {
				const threshold = parseInt((moreThanMatch || orMoreMatch || playedMoreThanMatch)![1]);
				// "more than 5" means > 5, so minAppearances = 5 (since we use appearances > $minAppearances)
				// "at least 5" means >= 5, so minAppearances = 5
				if (moreThanMatch || playedMoreThanMatch) {
					minAppearances = threshold;
				} else {
					minAppearances = threshold;
				}
				loggingService.log(`✅ Detected minimum appearance threshold: ${minAppearances}`, null, "log");
			}
		}
		
		// Override metric if GperAPP question detected (do this early, before penalty checks)
		if (isGperAPPQuestion) {
			metric = "GPERAPP";
			loggingService.log(`✅ Detected metric from question text: GPERAPP (goals per appearance)`, null, "log");
		}
		
		// Only process penalty logic if GperAPP wasn't detected (to avoid overriding)
		if (hasPenaltyKeyword && !isShootout && !isGperAPPQuestion) {
			// If this is a worst or best penalty record question, we'll handle it specially later
			if (isWorstPenaltyRecord || isBestPenaltyRecord) {
				metric = "PSC"; // Use PSC as base metric, but we'll override the calculation
				loggingService.log(`✅ Detected ${isWorstPenaltyRecord ? "worst" : "best"} penalty record question - will calculate conversion rate`, null, "log");
			} else if (hasScoredKeyword || hasMostKeyword) {
				// If question mentions penalties and scored/most, it's about penalties scored
				metric = "PSC";
				loggingService.log(`✅ Detected metric from question text: PSC (penalties scored)`, null, "log");
			} else if (lowerQuestion.includes("missed")) {
				metric = "PM";
				loggingService.log(`✅ Detected metric from question text: PM (penalties missed)`, null, "log");
			} else if (lowerQuestion.includes("saved")) {
				metric = "PSV";
				loggingService.log(`✅ Detected metric from question text: PSV (penalties saved)`, null, "log");
			} else if (lowerQuestion.includes("conceded")) {
				metric = "PCO";
				loggingService.log(`✅ Detected metric from question text: PCO (penalties conceded)`, null, "log");
			} else {
				// Default to penalties scored if just "penalties" is mentioned in a ranking context
				metric = "PSC";
				loggingService.log(`✅ Detected metric from question text: PSC (penalties - defaulting to scored)`, null, "log");
			}
		}

		// Determine if this is asking about players or teams
		const isPlayerQuestion = lowerQuestion.includes("player") || lowerQuestion.includes("who");
		const isTeamQuestion = lowerQuestion.includes("team");

		// Determine result quantity (singular vs plural)
		// For ranking questions with "most", always default to plural (top 10) unless explicitly singular
		let resultQuantity = analysis.resultQuantity || "plural";
		
		// Override: Ranking questions with "most" should show top 10 by default
		if (hasMostKeyword && resultQuantity === "singular") {
			resultQuantity = "plural";
			loggingService.log(`✅ Overriding resultQuantity to plural for "most" ranking question`, null, "log");
		}
		
		// Check if user asked for a specific number (e.g., "top 3", "top 5")
		const topNumberMatch = lowerQuestion.match(/top\s+(\d+)/);
		// For worst or best penalty record, default to 5 (or fewer if less than 5 have taken penalties)
		// For GperAPP questions, default to 5 (expandable to 10)
		const requestedLimit = (isWorstPenaltyRecord || isBestPenaltyRecord) ? 5 : 
		                        (isGperAPPQuestion ? 5 : 
		                        (resultQuantity === "singular" ? 1 : (topNumberMatch ? parseInt(topNumberMatch[1]) : 5)));

		// Normalize metric to uppercase for consistent matching
		metric = metric.toUpperCase();

		// Get the metric configuration
		const metricConfig = findMetricByAlias(metric);
		if (!metricConfig) {
			return { type: "unknown_metric", data: [], message: `Unknown metric: ${metric}` };
		}

		let query: string;
		let returnClause: string;

		// Build the appropriate query based on metric
		// Special case: worst and best penalty record use conversion rate calculation
		if (isWorstPenaltyRecord || isBestPenaltyRecord) {
			// For worst penalty record, we need to return conversion rate, penaltiesScored, and penaltiesMissed
			returnClause = `sum(coalesce(md.penaltiesScored, 0)) as penaltiesScored,
				sum(coalesce(md.penaltiesMissed, 0)) as penaltiesMissed,
				CASE 
					WHEN (sum(coalesce(md.penaltiesScored, 0)) + sum(coalesce(md.penaltiesMissed, 0))) > 0 
					THEN toFloat(sum(coalesce(md.penaltiesScored, 0))) / (sum(coalesce(md.penaltiesScored, 0)) + sum(coalesce(md.penaltiesMissed, 0)))
					ELSE NULL
				END as value`;
		} else if (isGperAPPQuestion || metric === "GPERAPP") {
			// For GperAPP, we need to calculate (goals + penaltiesScored) / appearances
			// This will be handled in a special query structure similar to penalty records
			// Note: We calculate totalGoals and appearances, then use them in a second WITH clause for value calculation
			returnClause = `sum(coalesce(md.goals, 0)) + sum(coalesce(md.penaltiesScored, 0)) as totalGoals,
				count(md) as appearances`;
		} else {
			switch (metric) {
				case "G":
				case "goals":
					returnClause = "coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = '' THEN 0 ELSE md.goals END), 0) as value";
					break;
				case "A":
				case "assists":
					returnClause = "coalesce(sum(CASE WHEN md.assists IS NULL OR md.assists = '' THEN 0 ELSE md.assists END), 0) as value";
					break;
				case "AP":
				case "appearances":
					returnClause = "count(md) as value";
					break;
				case "CS":
				case "clean_sheets":
					returnClause = "coalesce(sum(CASE WHEN md.cleanSheets = true THEN 1 ELSE 0 END), 0) as value";
					break;
				case "TOTW":
				case "team_of_the_week":
					returnClause = "coalesce(sum(CASE WHEN md.totw = true THEN 1 ELSE 0 END), 0) as value";
					break;
				case "PSC":
				case "penalties_scored":
					returnClause = "coalesce(sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = '' THEN 0 ELSE md.penaltiesScored END), 0) as value";
					break;
				default:
					return { type: "unsupported_metric", data: [], message: `Ranking not supported for metric: ${metric}` };
			}
		}

		// Extract team name from teamEntities if present
		const teamEntities = analysis.teamEntities || [];
		let teamName: string | null = null;
		if (teamEntities.length > 0) {
			teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
		} else {
			// Try to extract team from question text
			const teamMatch = lowerQuestion.match(/\b(?:for|in|with)\s+(?:the\s+)?(\d+)(?:st|nd|rd|th|s)\b/i);
			if (teamMatch) {
				const teamNum = teamMatch[1];
				teamName = TeamMappingUtils.mapTeamName(`${teamNum}s`);
			}
		}

		// Use a higher limit to ensure we get all available results, then trim to requested count
		// For expandable tables, fetch at least 10 results even if requestedLimit is 5
		const expandableLimit = requestedLimit === 5 ? 10 : requestedLimit;
		const maxLimit = Math.max(expandableLimit * 2, 50);

		// Build WHERE conditions
		const graphLabel = neo4jService.getGraphLabel();
		const whereConditions: string[] = ["p.allowOnSite = true"];
		const params: Record<string, unknown> = { graphLabel };

		// Add team filter if team name is detected
		if (teamName) {
			whereConditions.push("md.team = $teamName");
			params.teamName = teamName;
		}
		
		// Add minimum appearances filter for GperAPP queries if specified
		if (isGperAPPQuestion && minAppearances !== null) {
			params.minAppearances = minAppearances;
		}

		// For worst/best penalty record, use IS NOT NULL (to include 0% conversion rates)
		// Worst: order ASCENDING (lowest conversion rate first)
		// Best: order DESCENDING (highest conversion rate first)
		// For GperAPP, use value > 0 and order DESCENDING (highest GperAPP first)
		// For other metrics, use value > 0 and order DESCENDING
		// Tie-breaking: When values are tied, players with more appearances are shown first
		const whereValueCondition = (isWorstPenaltyRecord || isBestPenaltyRecord) ? "value IS NOT NULL" : "value > 0";
		const orderByClause = isWorstPenaltyRecord ? "ORDER BY value ASC, appearances DESC" : 
		                       isBestPenaltyRecord ? "ORDER BY value DESC, appearances DESC" : 
		                       "ORDER BY value DESC, appearances DESC";
		const orderByClauseTeam = isWorstPenaltyRecord ? "ORDER BY value ASC" : 
		                          isBestPenaltyRecord ? "ORDER BY value DESC" : 
		                          "ORDER BY value DESC";

		if (isPlayerQuestion) {
			if (isWorstPenaltyRecord || isBestPenaltyRecord) {
				query = `
					MATCH (p:Player {graphLabel: $graphLabel})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
					WHERE ${whereConditions.join(" AND ")}
					WITH p.playerName as playerName, ${returnClause}, count(md) as appearances
					WHERE value IS NOT NULL
					RETURN playerName, value, appearances, penaltiesScored, penaltiesMissed
					${orderByClause}
					LIMIT ${maxLimit}
				`;
			} else if (isGperAPPQuestion || metric === "GPERAPP") {
				// Special query for GperAPP with optional minimum appearances filter
				let minAppearancesFilter = "";
				if (minAppearances !== null) {
					minAppearancesFilter = `AND appearances > $minAppearances`;
				}
				query = `
					MATCH (p:Player {graphLabel: $graphLabel})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
					WHERE ${whereConditions.join(" AND ")}
					WITH p.playerName as playerName, ${returnClause}
					WITH playerName, totalGoals, appearances,
						CASE 
							WHEN appearances > 0 
							THEN toFloat(totalGoals) / appearances
							ELSE 0.0
						END as value
					WHERE value > 0 ${minAppearancesFilter}
					RETURN playerName, value, appearances
					${orderByClause}
					LIMIT ${maxLimit}
				`;
			} else {
				query = `
					MATCH (p:Player {graphLabel: $graphLabel})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
					WHERE ${whereConditions.join(" AND ")}
					WITH p.playerName as playerName, ${returnClause}, count(md) as appearances
					WHERE ${whereValueCondition}
					RETURN playerName, value, appearances
					${orderByClause}
					LIMIT ${maxLimit}
				`;
			}
		} else if (isTeamQuestion) {
			whereConditions.push("md.team IS NOT NULL");
			query = `
				MATCH (p:Player {graphLabel: $graphLabel})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				WHERE ${whereConditions.join(" AND ")}
				WITH md.team as teamName, ${returnClause}
				WHERE ${whereValueCondition}
				RETURN teamName, value
				${orderByClauseTeam}
				LIMIT ${maxLimit}
			`;
		} else {
			if (isWorstPenaltyRecord || isBestPenaltyRecord) {
				query = `
					MATCH (p:Player {graphLabel: $graphLabel})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
					WHERE ${whereConditions.join(" AND ")}
					WITH p.playerName as playerName, ${returnClause}, count(md) as appearances
					WHERE value IS NOT NULL
					RETURN playerName, value, appearances, penaltiesScored, penaltiesMissed
					${orderByClause}
					LIMIT ${maxLimit}
				`;
			} else if (isGperAPPQuestion || metric === "GPERAPP") {
				// Special query for GperAPP with optional minimum appearances filter
				let minAppearancesFilter = "";
				if (minAppearances !== null) {
					minAppearancesFilter = `AND appearances > $minAppearances`;
				}
				query = `
					MATCH (p:Player {graphLabel: $graphLabel})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
					WHERE ${whereConditions.join(" AND ")}
					WITH p.playerName as playerName, ${returnClause}
					WITH playerName, totalGoals, appearances,
						CASE 
							WHEN appearances > 0 
							THEN toFloat(totalGoals) / appearances
							ELSE 0.0
						END as value
					WHERE value > 0 ${minAppearancesFilter}
					RETURN playerName, value, appearances
					${orderByClause}
					LIMIT ${maxLimit}
				`;
			} else {
				query = `
					MATCH (p:Player {graphLabel: $graphLabel})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
					WHERE ${whereConditions.join(" AND ")}
					WITH p.playerName as playerName, ${returnClause}, count(md) as appearances
					WHERE ${whereValueCondition}
					RETURN playerName, value, appearances
					${orderByClause}
					LIMIT ${maxLimit}
				`;
			}
		}

		try {
			const result = await neo4jService.executeQuery(query, Object.keys(params).length > 0 ? params : undefined);
			loggingService.log(`🔍 Ranking query result:`, result, "log");

			if (!result || result.length === 0) {
				return { type: "no_data", data: [], message: "No ranking data found" };
			}

			// Store all results up to expandableLimit (10 if requestedLimit is 5, otherwise requestedLimit)
			const allResults = result.slice(0, expandableLimit);
			// Limit initial display to requestedLimit
			const limitedResult = allResults.slice(0, requestedLimit);

			return {
				type: "ranking",
				data: limitedResult,
				fullData: allResults, // Store full data for expansion
				metric: metric,
				isPlayerQuestion: isPlayerQuestion,
				isTeamQuestion: isTeamQuestion,
				requestedLimit: requestedLimit,
				expandableLimit: expandableLimit,
				cypherQuery: query,
				isWorstPenaltyRecord: isWorstPenaltyRecord, // Pass flag for response formatting
				isBestPenaltyRecord: isBestPenaltyRecord, // Pass flag for response formatting
			};
		} catch (error) {
			loggingService.log(`❌ Error in queryRankingData:`, error, "error");
			return { type: "error", data: [], error: "Error querying ranking data" };
		}
	}
}
