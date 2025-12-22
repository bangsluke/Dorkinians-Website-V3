import type { EnhancedQuestionAnalysis } from "../../config/enhancedQuestionAnalysis";
import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { TeamMappingUtils } from "../chatbotUtils/teamMappingUtils";
import { DateUtils } from "../chatbotUtils/dateUtils";
import { loggingService } from "../loggingService";

export class FixtureDataQueryHandler {
	/**
	 * Query fixture data (opposition queries)
	 */
	static async queryFixtureData(
		entities: string[],
		_metrics: string[],
		analysis?: EnhancedQuestionAnalysis,
	): Promise<Record<string, unknown>> {
		const graphLabel = neo4jService.getGraphLabel();
		
		// Extract team name from entities or analysis
		let teamName = "";
		if (analysis?.teamEntities && analysis.teamEntities.length > 0) {
			teamName = TeamMappingUtils.mapTeamName(analysis.teamEntities[0]);
		} else if (entities.length > 0) {
			teamName = TeamMappingUtils.mapTeamName(entities[0]);
		}
		
		if (!teamName) {
			loggingService.log(`⚠️ No team name found in queryFixtureData`, null, "warn");
			return { type: "team_not_found", data: [], message: "Could not identify team from question" };
		}
		
		// Extract date range from time frames
		let startDate: string | null = null;
		let endDate: string | null = null;
		
		if (analysis?.extractionResult?.timeFrames) {
			const timeFrames = analysis.extractionResult.timeFrames;
			
			// Check for ordinal weekend pattern
			const ordinalWeekendFrame = timeFrames.find(tf => tf.type === "ordinal_weekend");
			if (ordinalWeekendFrame) {
				const match = ordinalWeekendFrame.value.match(/weekend_(\d+)_(\d{4})/);
				if (match) {
					const ordinal = parseInt(match[1], 10);
					const year = parseInt(match[2], 10);
					const dates = DateUtils.calculateWeekendDates(year, ordinal);
					startDate = dates.startDate;
					endDate = dates.endDate;
				}
			} else {
				// Check for date range
				const rangeFrame = timeFrames.find(tf => tf.type === "range");
				if (rangeFrame && rangeFrame.value.includes(" to ")) {
					const dateRange = rangeFrame.value.split(" to ");
					if (dateRange.length === 2) {
						startDate = DateUtils.convertDateFormat(dateRange[0].trim());
						endDate = DateUtils.convertDateFormat(dateRange[1].trim());
					}
				} else {
					// Check for single date
					const dateFrame = timeFrames.find(tf => tf.type === "date");
					if (dateFrame) {
						const convertedDate = DateUtils.convertDateFormat(dateFrame.value);
						startDate = convertedDate;
						endDate = convertedDate;
					}
				}
			}
		}
		
		// Build query
		const params: Record<string, unknown> = {
			graphLabel,
			teamName,
		};
		
		let query = `
			MATCH (f:Fixture {graphLabel: $graphLabel})
			WHERE f.team = $teamName
		`;
		
		if (startDate && endDate) {
			loggingService.log(`🔍 Calculated weekend dates - startDate: ${startDate}, endDate: ${endDate}, teamName: ${teamName}`, null, "log");
			query += ` AND f.date >= $startDate AND f.date <= $endDate`;
			params.startDate = startDate;
			params.endDate = endDate;
		}
		
		query += `
			RETURN f.opposition as opposition, f.date as date, f.homeOrAway as homeOrAway
			ORDER BY f.date ASC
		`;
		
		try {
			const result = await neo4jService.executeQuery(query, params);
			loggingService.log(`🔍 Fixture query result count: ${result?.length || 0}`, null, "log");
			
			if (!result || result.length === 0) {
				loggingService.log(`⚠️ No fixtures found for ${teamName}${startDate && endDate ? ` between ${startDate} and ${endDate}` : ""}`, null, "warn");
				return {
					type: "opposition_query",
					teamName,
					oppositions: [],
					dates: startDate && endDate ? { start: startDate, end: endDate } : undefined,
					message: `No fixtures found for ${teamName}${startDate && endDate ? ` between ${startDate} and ${endDate}` : ""}`,
				};
			}
			
			loggingService.log(`✅ Found ${result.length} fixture(s) for ${teamName}`, null, "log");
			
			const oppositions = result.map((r: { opposition: string; date: string; homeOrAway?: string }) => ({
				name: r.opposition,
				date: r.date,
				homeOrAway: r.homeOrAway,
			}));
			
			return {
				type: "opposition_query",
				teamName,
				oppositions,
				dates: startDate && endDate ? { start: startDate, end: endDate } : undefined,
			};
		} catch (error) {
			loggingService.log(`❌ Error in queryFixtureData:`, error, "error");
			return {
				type: "error",
				data: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}
}
