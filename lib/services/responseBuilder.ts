import { neo4jService } from "../../netlify/functions/lib/neo4j.js";
import { findMetricByAlias, getMetricDisplayName } from "../config/chatbotMetrics";
import { getZeroStatResponse } from "./zeroStatResponses";
import { statObject } from "../../config/config";
import { getAppropriateVerb, getResponseTemplate, formatNaturalResponse } from "../config/naturalLanguageResponses";
import type { EnhancedQuestionAnalysis } from "../config/enhancedQuestionAnalysis";
import { loggingService } from "./loggingService";
import { responseTemplateManager } from "./responseTemplates";
import type { LeagueTableEntry } from "./leagueTableService";
import { TeamMappingUtils } from "./chatbotUtils/teamMappingUtils";
import { FormattingUtils } from "./chatbotUtils/formattingUtils";
import { DateUtils } from "./chatbotUtils/dateUtils";
import type { ChatbotResponse } from "./chatbotService";

/**
 * ResponseBuilder - Handles building chatbot responses from query data
 */
export class ResponseBuilder {
	/**
	 * Extract sources from query data and analysis
	 */
	static extractSources(data: Record<string, unknown> | null, analysis: EnhancedQuestionAnalysis): string[] {
		const sources: string[] = ["Neo4j Database"];

		if (!data || !("data" in data) || !Array.isArray(data.data) || data.data.length === 0) {
			return sources;
		}

		// Extract season information if available
		const firstRecord = data.data[0] as Record<string, unknown>;
		if (firstRecord && typeof firstRecord === "object") {
			if (firstRecord.season) {
				sources.push(`Season: ${firstRecord.season}`);
			}
			if (firstRecord.dateRange) {
				sources.push(`Date Range: ${firstRecord.dateRange}`);
			}
		}

		// Add time range context if present
		if (analysis.timeRange) {
			sources.push(`Time Period: ${analysis.timeRange}`);
		}

		// Add team context if present
		if (analysis.teamEntities && analysis.teamEntities.length > 0) {
			sources.push(`Team: ${analysis.teamEntities.map(t => TeamMappingUtils.mapTeamName(t)).join(", ")}`);
		}

		// Add location context if present
		const locations = analysis.extractionResult?.locations || [];
		if (locations.length > 0) {
			const locationTypes = locations.map(l => l.type === "home" ? "Home" : l.type === "away" ? "Away" : l.value).join(", ");
			sources.push(`Location: ${locationTypes}`);
		}

		return sources;
	}

	/**
	 * Build contextual response for player metrics
	 */
	static buildContextualResponse(playerName: string, metric: string, value: unknown, analysis: EnhancedQuestionAnalysis): string {
		// Resolve metric alias to canonical key for display and formatting
		const resolvedMetricForDisplay = findMetricByAlias(metric)?.key || metric;
		// Get the metric display name
		const metricName = getMetricDisplayName(resolvedMetricForDisplay, value as number);
		const formattedValue = FormattingUtils.formatValueByMetric(resolvedMetricForDisplay, value as number);
		let verb = getAppropriateVerb(metric, value as number);

		// Special handling for MostPlayedForTeam/TEAM_ANALYSIS - value is a team name string
		if (metric === "MostPlayedForTeam" || metric === "MOSTPLAYEDFORTEAM" || metric === "TEAM_ANALYSIS") {
			const teamName = typeof value === "string" ? value : String(value);
			return `${playerName} has played for the ${teamName} most.`;
		}

		// Special handling for GPERAPP - always include numeric value for test extraction
		if (metric === "GperAPP" || metric.toUpperCase() === "GPERAPP") {
			return `${playerName} averages ${formattedValue} goals per appearance.`;
		}

		// Special handling for AwayGames%Won - always include numeric value for test extraction
		if (metric === "AwayGames%Won" || metric.toUpperCase() === "AWAYGAMES%WON") {
			return `${playerName} has won ${formattedValue} of away games.`;
		}

		// Special handling for PENALTY_CONVERSION_RATE - format as percentage
		if (metric === "PENALTY_CONVERSION_RATE" || metric.toUpperCase() === "PENALTY_CONVERSION_RATE") {
			const numericValue = typeof value === "number" ? value : Number(value);
			if (!Number.isNaN(numericValue)) {
				// Value is already a percentage (0-100) from database, format with % sign
				const percentageValue = numericValue.toFixed(1);
				return `${playerName} has a penalty conversion rate of ${percentageValue}%.`;
			}
		}

		// Special handling for CperAPP - check for zero and return appropriate zero stat response (must be before general zero check)
		if (metric === "CperAPP" || metric.toUpperCase() === "CPERAPP") {
			const numericValue = typeof value === "number" ? value : Number(value);
			if (!Number.isNaN(numericValue) && (numericValue === 0 || Math.abs(numericValue) < 0.001)) {
				const zeroResponse = getZeroStatResponse(resolvedMetricForDisplay, playerName, { metricDisplayName: metricName });
				if (zeroResponse) {
					return zeroResponse;
				}
				// Fallback: if getZeroStatResponse returns null, return the zero message directly
				return `${playerName} has not conceded a goal.`;
			}
			return `${playerName} has averaged ${formattedValue} goals conceded per appearance.`;
		}

		// Special handling for HomeWins and AwayWins - check for zero and return appropriate zero stat response
		if (metric === "HomeWins" || metric.toUpperCase() === "HOMEWINS") {
			const numericValue = typeof value === "number" ? value : Number(value);
			if (!Number.isNaN(numericValue) && numericValue === 0) {
				const zeroResponse = getZeroStatResponse(resolvedMetricForDisplay, playerName, { metricDisplayName: metricName });
				if (zeroResponse) {
					return zeroResponse;
				}
			}
		}

		if (metric === "AwayWins" || metric.toUpperCase() === "AWAYWINS") {
			const numericValue = typeof value === "number" ? value : Number(value);
			if (!Number.isNaN(numericValue) && numericValue === 0) {
				const zeroResponse = getZeroStatResponse(resolvedMetricForDisplay, playerName, { metricDisplayName: metricName });
				if (zeroResponse) {
					return zeroResponse;
				}
			}
		}

		const numericValue = typeof value === "number" ? value : Number(value);
		if (!Number.isNaN(numericValue) && numericValue === 0) {
			const zeroResponse = getZeroStatResponse(resolvedMetricForDisplay, playerName, { metricDisplayName: metricName });
			if (zeroResponse) {
				return zeroResponse;
			}
		}

		// Debug logging for percentage issues
		if (metric.includes("HomeGames%Won") || value === 51.764705) {
			loggingService.log(
				`🔧 buildContextualResponse - metric: ${metric}, value: ${value}, formattedValue: ${formattedValue}, metricName: ${metricName}`,
				null,
				"log",
			);
		}

		if (metric === "MperG") {
			return `${playerName} averages ${formattedValue} minutes per goal scored.`;
		}

		if (metric === "MperCLS") {
			return `${playerName} takes on average ${formattedValue} minutes to keep a clean sheet.`;
		}

		if (metric === "FTPperAPP") {
			return `${playerName} averages ${formattedValue} fantasy points per appearance.`;
		}

		// Special handling for season count with total
		if (metric === "SEASON_COUNT_WITH_TOTAL") {
			const data = value as { playerSeasonCount: number; totalSeasonCount: number; firstSeason: string };
			return `${playerName} has played in ${data.playerSeasonCount}/${data.totalSeasonCount} of the club's stat recorded seasons, starting in ${data.firstSeason}`;
		}

		// Special handling for simple season count
		if (metric === "SEASON_COUNT_SIMPLE") {
			const data = value as { value: number; firstSeason: string };
			return `${playerName} has played for ${data.value} seasons, starting in ${data.firstSeason}`;
		}

		// Handle cases where verb and metric name overlap (e.g., "conceded" + "goals conceded")
		let finalMetricName = metricName;
		if (verb && metricName.toLowerCase().includes(verb.toLowerCase())) {
			// Remove the verb from the metric name to avoid duplication
			finalMetricName = metricName.toLowerCase().replace(verb.toLowerCase(), "").trim();
		}

		// Check if this is a goal metric and "open play" wasn't mentioned in the question
		// If so, replace "open play goals" with "goals"
		const questionLower = (analysis.question || "").toLowerCase();
		const isGoalMetric = resolvedMetricForDisplay === "G" || resolvedMetricForDisplay.toUpperCase() === "OPENPLAYGOALS";
		const mentionsOpenPlay = questionLower.includes("open play") || questionLower.includes("openplay");
		
		if (isGoalMetric && !mentionsOpenPlay && finalMetricName.toLowerCase().includes("open play")) {
			// Replace "open play goals" with "goals"
			finalMetricName = finalMetricName.toLowerCase().replace("open play ", "").replace("openplay ", "");
		}

		// Special handling for red cards - match question phrasing for "sent off"
		const isRedCardMetric = resolvedMetricForDisplay === "R" || resolvedMetricForDisplay.toUpperCase() === "REDCARDS";
		const mentionsSentOff = questionLower.includes("sent off") || questionLower.includes("been sent off");
		
		if (isRedCardMetric && mentionsSentOff) {
			// Use "been sent off" phrasing to match the question
			verb = "been sent off";
			// Adjust metric name to avoid redundancy
			if (finalMetricName.toLowerCase().includes("red card")) {
				finalMetricName = "times";
			}
		}

		// Start with the basic response
		let response = `${playerName} has ${verb} ${formattedValue} ${finalMetricName}`;

		// Add team context if present
		if (analysis.teamEntities && analysis.teamEntities.length > 0) {
			const teamName = TeamMappingUtils.mapTeamName(analysis.teamEntities[0]);
			response += ` for the ${teamName}`;
		}

		// Add team exclusion context if present
		if (analysis.teamExclusions && analysis.teamExclusions.length > 0) {
			const excludedTeam = TeamMappingUtils.mapTeamName(analysis.teamExclusions[0]);
			// Convert to display format (e.g., "3rd XI" -> "3s")
			const excludedTeamDisplay = excludedTeam
				.replace("1st XI", "1s")
				.replace("2nd XI", "2s")
				.replace("3rd XI", "3s")
				.replace("4th XI", "4s")
				.replace("5th XI", "5s")
				.replace("6th XI", "6s")
				.replace("7th XI", "7s")
				.replace("8th XI", "8s");
			response += ` when not playing for the ${excludedTeamDisplay}`;
		}

		// Add location context if present
		const locations = (analysis.extractionResult && analysis.extractionResult.locations) || [];
		if (locations && locations.length > 0) {
			const location = locations[0].value;
			if (location === "home") {
				response += ` whilst playing at home`;
			} else if (location === "away") {
				response += ` whilst playing away`;
			}
		}

		// Add date context for "since" or "between" queries
		const timeFrames = analysis.extractionResult?.timeFrames || [];
		const sinceFrame = timeFrames.find((tf) => tf.type === "since");
		const rangeFrame = timeFrames.find((tf) => tf.type === "range");
		
		let dateContextAdded = false;
		
		if (sinceFrame) {
			// Handle "since [YEAR]" pattern
			const year = parseInt(sinceFrame.value, 10);
			if (!isNaN(year)) {
				const startDate = DateUtils.convertSinceYearToDate(year);
				const formattedDate = DateUtils.formatDate(startDate);
				response += ` since ${formattedDate}`;
				dateContextAdded = true;
			}
		} else if (rangeFrame && rangeFrame.value.includes(" to ")) {
			// Handle "between X and Y" date range
			const dateRange = rangeFrame.value.split(" to ");
			if (dateRange.length === 2) {
				const formattedStart = DateUtils.formatDate(DateUtils.convertDateFormat(dateRange[0].trim()));
				const formattedEnd = DateUtils.formatDate(DateUtils.convertDateFormat(dateRange[1].trim()));
				response += ` between ${formattedStart} and ${formattedEnd}`;
				dateContextAdded = true;
			}
		}

		// Add time range context if present (but ignore placeholder values and skip if we already added date context)
		if (!dateContextAdded && analysis.timeRange && analysis.timeRange !== "between_dates" && analysis.timeRange.trim() !== "") {
			if (analysis.timeRange.includes(" to ")) {
				const formattedTimeRange = DateUtils.formatTimeRange(analysis.timeRange);
				response += ` between ${formattedTimeRange}`;
			} else {
				const formattedDate = DateUtils.formatDate(analysis.timeRange);
				response += ` on ${formattedDate}`;
			}
		}

		// Add period for final sentence
		response += ".";

		return response;
	}
}
