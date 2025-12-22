import type { EnhancedQuestionAnalysis } from "../../config/enhancedQuestionAnalysis";
import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { findMetricByAlias } from "../../config/chatbotMetrics";
import { loggingService } from "../loggingService";

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

		if (metrics.length === 0) {
			return { type: "no_metrics", data: [], message: "No metrics specified for ranking" };
		}

		const metric = metrics[0];
		const lowerQuestion = analysis.question?.toLowerCase() || "";

		// Determine if this is asking about players or teams
		const isPlayerQuestion = lowerQuestion.includes("player") || lowerQuestion.includes("who");
		const isTeamQuestion = lowerQuestion.includes("team");

		// Determine result quantity (singular vs plural)
		const resultQuantity = analysis.resultQuantity || "plural";
		
		// Check if user asked for a specific number (e.g., "top 3", "top 5")
		const topNumberMatch = lowerQuestion.match(/top\s+(\d+)/);
		const requestedLimit = resultQuantity === "singular" ? 1 : (topNumberMatch ? parseInt(topNumberMatch[1]) : 10);

		// Get the metric configuration
		const metricConfig = findMetricByAlias(metric);
		if (!metricConfig) {
			return { type: "unknown_metric", data: [], message: `Unknown metric: ${metric}` };
		}

		let query: string;
		let returnClause: string;

		// Build the appropriate query based on metric
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
			default:
				return { type: "unsupported_metric", data: [], message: `Ranking not supported for metric: ${metric}` };
		}

		// Use a higher limit to ensure we get all available results, then trim to requested count
		const maxLimit = Math.max(requestedLimit * 2, 50);

		if (isPlayerQuestion) {
			query = `
				MATCH (p:Player)-[:PLAYED_IN]->(md:MatchDetail)
				WHERE p.allowOnSite = true
				RETURN p.playerName as playerName, ${returnClause}
				ORDER BY value DESC
				LIMIT ${maxLimit}
			`;
		} else if (isTeamQuestion) {
			query = `
				MATCH (p:Player)-[:PLAYED_IN]->(md:MatchDetail)
				WHERE p.allowOnSite = true AND md.team IS NOT NULL
				RETURN md.team as teamName, ${returnClause}
				ORDER BY value DESC
				LIMIT ${maxLimit}
			`;
		} else {
			query = `
				MATCH (p:Player)-[:PLAYED_IN]->(md:MatchDetail)
				WHERE p.allowOnSite = true
				RETURN p.playerName as playerName, ${returnClause}
				ORDER BY value DESC
				LIMIT ${maxLimit}
			`;
		}

		try {
			const result = await neo4jService.executeQuery(query);
			loggingService.log(`🔍 Ranking query result:`, result, "log");

			if (!result || result.length === 0) {
				return { type: "no_data", data: [], message: "No ranking data found" };
			}

			// Limit results to the requested number (or all available if fewer)
			const limitedResult = result.slice(0, requestedLimit);

			return {
				type: "ranking",
				data: limitedResult,
				metric: metric,
				isPlayerQuestion: isPlayerQuestion,
				isTeamQuestion: isTeamQuestion,
				requestedLimit: requestedLimit,
				cypherQuery: query,
			};
		} catch (error) {
			loggingService.log(`❌ Error in queryRankingData:`, error, "error");
			return { type: "error", data: [], error: "Error querying ranking data" };
		}
	}
}
