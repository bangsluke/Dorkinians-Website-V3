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
		// #region agent log
		console.log('[DEBUG] buildContextualResponse entry', {playerName,metric,value,question:analysis.question});
		fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'responseBuilder.ts:63',message:'buildContextualResponse entry',data:{playerName,metric,value,question:analysis.question},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
		// #endregion
		// Resolve metric alias to canonical key for display and formatting
		const resolvedMetricForDisplay = findMetricByAlias(metric)?.key || metric;
		// Get the metric display name
		const metricName = getMetricDisplayName(resolvedMetricForDisplay, value as number);
		const formattedValue = FormattingUtils.formatValueByMetric(resolvedMetricForDisplay, value as number);
		let verb = getAppropriateVerb(metric, value as number);
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'responseBuilder.ts:69',message:'After initial setup',data:{resolvedMetricForDisplay,metricName,formattedValue,verb},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
		// #endregion

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

		// Special handling for HomeGames and AwayGames with zero value
		if ((metric === "HomeGames" || metric.toUpperCase() === "HOMEGAMES" || metric === "Home Games" || metric.toUpperCase() === "HOME")) {
			const numericValue = typeof value === "number" ? value : Number(value);
			if (!Number.isNaN(numericValue) && numericValue === 0) {
				return `${playerName} has not played a home game.`;
			}
		}
		
		if ((metric === "AwayGames" || metric.toUpperCase() === "AWAYGAMES" || metric === "Away Games" || metric.toUpperCase() === "AWAY")) {
			const numericValue = typeof value === "number" ? value : Number(value);
			if (!Number.isNaN(numericValue) && numericValue === 0) {
				return `${playerName} has not played an away game.`;
			}
		}

		// Special handling for season-specific appearance queries with zero value
		// Check if this is an appearance query (APP metric) with 0 value and a season/range timeFrame
		// This matches the logic in chatbotService.ts for empty array handling to ensure consistency
		const numericValue = typeof value === "number" ? value : Number(value);
		if ((metric === "APP" || metric.toUpperCase() === "APP" || resolvedMetricForDisplay.toUpperCase() === "APP") && 
			!Number.isNaN(numericValue) && numericValue === 0) {
			// Use original question from analysis if available for extraction
			const questionText = analysis.question || "";
			let season: string | null = null;
			let dateRange: { start: string; end: string } | null = null;
			
			// Check for range timeFrame first (date ranges like "2021 to 2022")
			const rangeFrame = analysis.extractionResult?.timeFrames?.find((tf) => tf.type === "range");
			if (rangeFrame && rangeFrame.value.includes(" to ")) {
				const rangeMatch = rangeFrame.value.match(/(\d{4})\s+to\s+(\d{4})/i);
				if (rangeMatch) {
					dateRange = { start: rangeMatch[1], end: rangeMatch[2] };
				}
			}
			
			// If no range frame, check timeRange directly
			if (!dateRange && analysis.timeRange && analysis.timeRange.includes(" to ")) {
				const rangeMatch = analysis.timeRange.match(/(\d{4})\s+to\s+(\d{4})/i);
				if (rangeMatch) {
					dateRange = { start: rangeMatch[1], end: rangeMatch[2] };
				}
			}
			
			// If no range, check question text for date range (try both question parameter and analysis.question)
			if (!dateRange && questionText) {
				const questionRangeMatch = questionText.match(/(\d{4})\s+to\s+(\d{4})/i);
				if (questionRangeMatch) {
					dateRange = { start: questionRangeMatch[1], end: questionRangeMatch[2] };
				}
			}
			
			// If we have a date range, use it
			if (dateRange) {
				return `${playerName} didn't make an appearance between ${dateRange.start} and ${dateRange.end}.`;
			}
			
			// Check for season timeFrame in analysis
			const seasonFrame = analysis.extractionResult?.timeFrames?.find((tf) => tf.type === "season");
			if (seasonFrame) {
				// Normalize season format (handle both slash and dash)
				season = seasonFrame.value.replace("-", "/");
			} else if (analysis.timeRange) {
				const seasonMatch = analysis.timeRange.match(/(\d{4}[\/\-]\d{2})/i);
				if (seasonMatch) {
					season = seasonMatch[1].replace("-", "/");
				}
			} else if (questionText) {
				const seasonMatch = questionText.match(/(\d{4})[\/\-](\d{2})/i);
				if (seasonMatch) {
					season = `${seasonMatch[1]}/${seasonMatch[2]}`;
				}
			}
			
			if (season) {
				return `${playerName} didn't make an appearance in ${season}.`;
			}
		}

		// Special handling for season-specific goals queries with zero value
		// Check if this is a goals query (G metric) with 0 value and a season/range timeFrame
		// This matches the logic in chatbotService.ts for empty array handling to ensure consistency
		if ((metric === "G" || metric.toUpperCase() === "G" || metric.toUpperCase() === "GOALS" || metric.toUpperCase() === "GOAL" || resolvedMetricForDisplay.toUpperCase() === "G") && 
			!Number.isNaN(numericValue) && numericValue === 0) {
			// Use original question from analysis if available for extraction
			const questionText = analysis.question || "";
			let season: string | null = null;
			let dateRange: { start: string; end: string } | null = null;
			
			// Check for range timeFrame first (date ranges like "2021 to 2022")
			const rangeFrame = analysis.extractionResult?.timeFrames?.find((tf) => tf.type === "range");
			if (rangeFrame && rangeFrame.value.includes(" to ")) {
				const rangeMatch = rangeFrame.value.match(/(\d{4})\s+to\s+(\d{4})/i);
				if (rangeMatch) {
					dateRange = { start: rangeMatch[1], end: rangeMatch[2] };
				}
			}
			
			// If no range frame, check timeRange directly
			if (!dateRange && analysis.timeRange && analysis.timeRange.includes(" to ")) {
				const rangeMatch = analysis.timeRange.match(/(\d{4})\s+to\s+(\d{4})/i);
				if (rangeMatch) {
					dateRange = { start: rangeMatch[1], end: rangeMatch[2] };
				}
			}
			
			// If no range, check question text for date range (try both question parameter and analysis.question)
			if (!dateRange && questionText) {
				const questionRangeMatch = questionText.match(/(\d{4})\s+to\s+(\d{4})/i);
				if (questionRangeMatch) {
					dateRange = { start: questionRangeMatch[1], end: questionRangeMatch[2] };
				}
			}
			
			// If we have a date range, use it
			if (dateRange) {
				return `${playerName} did not score a goal between ${dateRange.start} and ${dateRange.end}.`;
			}
			
			// Check for season timeFrame in analysis
			const seasonFrame = analysis.extractionResult?.timeFrames?.find((tf) => tf.type === "season");
			if (seasonFrame) {
				// Normalize season format (handle both slash and dash)
				season = seasonFrame.value.replace("-", "/");
			} else if (analysis.timeRange) {
				const seasonMatch = analysis.timeRange.match(/(\d{4}[\/\-]\d{2})/i);
				if (seasonMatch) {
					season = seasonMatch[1].replace("-", "/");
				}
			} else if (questionText) {
				const seasonMatch = questionText.match(/(\d{4})[\/\-](\d{2})/i);
				if (seasonMatch) {
					season = `${seasonMatch[1]}/${seasonMatch[2]}`;
				}
			}
			
			if (season) {
				return `${playerName} did not score in the ${season} season.`;
			}
		}

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

		// Special handling for team-specific appearance metrics (e.g., "4th XI Apps", "4sApps")
		// This must be checked BEFORE setting verb and finalMetricName to avoid using "got" and "4th team appearances"
		// Check both the original metric and the resolved metric
		const metricMatch1 = metric.match(/^\d+sApps$/i);
		const metricMatch2 = metric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i);
		const resolvedMatch1 = resolvedMetricForDisplay.match(/^\d+sApps$/i);
		const resolvedMatch2 = resolvedMetricForDisplay.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i);
		const isTeamSpecificAppearanceMetric = !!(metricMatch1 || metricMatch2 || resolvedMatch1 || resolvedMatch2);
		if (isTeamSpecificAppearanceMetric) {
			// Extract team name from metric or use teamEntities
			let teamDisplayName = "";
			if (analysis.teamEntities && analysis.teamEntities.length > 0) {
				const teamName = TeamMappingUtils.mapTeamName(analysis.teamEntities[0]);
				teamDisplayName = teamName
					.replace("1st XI", "1s")
					.replace("2nd XI", "2s")
					.replace("3rd XI", "3s")
					.replace("4th XI", "4s")
					.replace("5th XI", "5s")
					.replace("6th XI", "6s")
					.replace("7th XI", "7s")
					.replace("8th XI", "8s");
			} else {
				// Extract team from metric name (e.g., "4th XI Apps" -> "4s", "4sApps" -> "4s")
				const teamMatch = metric.match(/^(\d+(?:st|nd|rd|th))\s+XI\s+Apps$/i) || metric.match(/^(\d+)sApps$/i);
				if (teamMatch) {
					const teamNumber = teamMatch[1];
					if (metric.includes("XI")) {
						// Format like "4th XI" -> "4s"
						const ordinalMatch = teamNumber.match(/^(\d+)(st|nd|rd|th)$/i);
						if (ordinalMatch) {
							teamDisplayName = ordinalMatch[1] + "s";
						} else {
							teamDisplayName = teamNumber + "s";
						}
					} else {
						// Already in "4s" format
						teamDisplayName = teamNumber + "s";
					}
				}
			}
			
			if (teamDisplayName) {
				const numericValue = typeof value === "number" ? value : Number(value);
				return `${playerName} has ${formattedValue} ${numericValue === 1 ? "appearance" : "appearances"} for the ${teamDisplayName}.`;
			}
		}

		// Check if this is a goal metric and "open play" wasn't mentioned in the question
		// If so, replace "open play goals" with "goals" BEFORE handling verb overlap
		const questionLower = (analysis.question || "").toLowerCase();
		const isGoalMetric = resolvedMetricForDisplay === "G" || resolvedMetricForDisplay.toUpperCase() === "OPENPLAYGOALS";
		const mentionsOpenPlay = questionLower.includes("open play") || questionLower.includes("openplay");
		
		// For G metric, override metricName early to ensure "goals" instead of "open play goals" when not mentioned
		let adjustedMetricName = metricName;
		if (isGoalMetric && !mentionsOpenPlay && resolvedMetricForDisplay === "G") {
			// Force "goals" for G metric when "open play" isn't mentioned, regardless of what getMetricDisplayName returned
			adjustedMetricName = "goals";
		}
		
		// Handle cases where verb and metric name overlap (e.g., "conceded" + "goals conceded")
		let finalMetricName = adjustedMetricName;
		if (verb && adjustedMetricName.toLowerCase().includes(verb.toLowerCase())) {
			// Remove the verb from the metric name to avoid duplication
			finalMetricName = adjustedMetricName.toLowerCase().replace(verb.toLowerCase(), "").trim();
		}
		
		// #region agent log
		console.log('[DEBUG] Before goal metric logic', {questionLower,isGoalMetric,mentionsOpenPlay,finalMetricName,resolvedMetricForDisplay,metricName,adjustedMetricName});
		fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'responseBuilder.ts:371',message:'Before goal metric logic',data:{questionLower,isGoalMetric,mentionsOpenPlay,finalMetricName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
		// #endregion
		
		// Special handling for open play goals - use "scored" verb and format as "open play goals" only if mentioned in question
		const isOpenPlayGoalsMetric = resolvedMetricForDisplay.toUpperCase() === "OPENPLAYGOALS";
		if (isOpenPlayGoalsMetric) {
			verb = "scored";
			// Only use "open play goals" if the question mentions "open play", otherwise use "goals"
			finalMetricName = mentionsOpenPlay ? "open play goals" : "goals";
		} else if (isGoalMetric && !mentionsOpenPlay) {
			// For G metric (not OPENPLAYGOALS), always use "goals" if question doesn't mention "open play"
			// This ensures we don't show "open play goals" when the question just asks about "goals"
			finalMetricName = "goals";
		}
		// #region agent log
		console.log('[DEBUG] After goal metric logic', {isOpenPlayGoalsMetric,verb,finalMetricName});
		fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'responseBuilder.ts:383',message:'After goal metric logic',data:{isOpenPlayGoalsMetric,verb,finalMetricName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
		// #endregion

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
		// #region agent log
		console.log('[DEBUG] Initial response string', {response,verb,finalMetricName});
		fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'responseBuilder.ts:399',message:'Initial response string',data:{response,verb,finalMetricName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
		// #endregion

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

		// Add date context for "before", "since", or "between" queries
		const timeFrames = analysis.extractionResult?.timeFrames || [];
		const beforeFrame = timeFrames.find((tf) => tf.type === "before");
		const sinceFrame = timeFrames.find((tf) => tf.type === "since");
		const rangeFrame = timeFrames.find((tf) => tf.type === "range");
		
		let dateContextAdded = false;
		
		if (beforeFrame) {
			// Handle "before [SEASON]" pattern
			const seasonValue = beforeFrame.value;
			// Check if it's a season format (e.g., "2020/21" or "2020-21")
			const seasonMatch = seasonValue.match(/(\d{4})[\/\-](\d{2})/);
			if (seasonMatch) {
				// Format as "before the 2020/21 season"
				response += ` before the ${seasonValue} season`;
				dateContextAdded = true;
			} else {
				// Try to parse as a year
				const year = parseInt(seasonValue, 10);
				if (!isNaN(year)) {
					response += ` before ${year}`;
					dateContextAdded = true;
				}
			}
		} else if (sinceFrame) {
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
				// #region agent log
				console.log('[DEBUG] Adding rangeFrame date context', {rangeFrame:rangeFrame.value,formattedStart,formattedEnd,responseBefore:response});
				// #endregion
				response += ` between ${formattedStart} and ${formattedEnd}`;
				dateContextAdded = true;
				// #region agent log
				console.log('[DEBUG] After adding rangeFrame date context', {response});
				// #endregion
			}
		}

		// Add time range context if present (but ignore placeholder values and skip if we already added date context)
		if (!dateContextAdded && analysis.timeRange && analysis.timeRange !== "between_dates" && analysis.timeRange.trim() !== "") {
			// #region agent log
			console.log('[DEBUG] Adding timeRange context', {timeRange:analysis.timeRange,responseBefore:response,dateContextAdded});
			// #endregion
			if (analysis.timeRange.includes(" to ")) {
				const formattedTimeRange = DateUtils.formatTimeRange(analysis.timeRange);
				response += ` between ${formattedTimeRange}`;
			} else {
				const formattedDate = DateUtils.formatDate(analysis.timeRange);
				response += ` on ${formattedDate}`;
			}
			// #region agent log
			console.log('[DEBUG] After adding timeRange context', {response});
			// #endregion
		}

		// Add period for final sentence
		response += ".";

		// #region agent log
		console.log('[DEBUG] buildContextualResponse exit', {response});
		fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'responseBuilder.ts:495',message:'buildContextualResponse exit',data:{response},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
		// #endregion
		return response;
	}
}
