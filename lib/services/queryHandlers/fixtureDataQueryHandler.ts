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
		const question = analysis?.question?.toLowerCase() || "";
		
		// Check if this is a highest scoring game query
		const isHighestScoringGameQuery = 
			question.includes("highest scoring game") ||
			question.includes("highest scoring") && question.includes("game") ||
			question.includes("most goals") && question.includes("game") ||
			question.includes("highest total") && question.includes("game");
		
		if (isHighestScoringGameQuery) {
			return await this.queryHighestScoringGame(entities, analysis);
		}
		
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

	/**
	 * Query highest scoring game for a team in a season
	 * Returns the fixture with highest combined dorkiniansGoals + conceded
	 */
	private static async queryHighestScoringGame(
		entities: string[],
		analysis?: EnhancedQuestionAnalysis,
	): Promise<Record<string, unknown>> {
		const graphLabel = neo4jService.getGraphLabel();
		const question = analysis?.question?.toLowerCase() || "";
		
		// Extract team name from entities or analysis
		let teamName = "";
		if (analysis?.teamEntities && analysis.teamEntities.length > 0) {
			teamName = TeamMappingUtils.mapTeamName(analysis.teamEntities[0]);
		} else if (entities.length > 0) {
			teamName = TeamMappingUtils.mapTeamName(entities[0]);
		} else {
			// Try to extract from question text
			const teamMatch = question.match(/\b(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th)\b/);
			if (teamMatch) {
				const teamStr = teamMatch[1];
				if (teamStr.includes("st") || teamStr.includes("nd") || teamStr.includes("rd") || teamStr.includes("th")) {
					const num = teamStr.match(/\d+/)?.[0];
					if (num) {
						teamName = TeamMappingUtils.mapTeamName(`${num}s`);
					}
				} else {
					teamName = TeamMappingUtils.mapTeamName(teamStr);
				}
			}
		}
		
		if (!teamName) {
			loggingService.log(`⚠️ No team name found in queryHighestScoringGame`, null, "warn");
			return { type: "team_not_found", data: [], message: "Could not identify team from question" };
		}
		
		// Extract season from question or timeRange
		let season: string | null = null;
		const timeFrames = analysis?.extractionResult?.timeFrames || [];
		const seasonFrame = timeFrames.find(tf => tf.type === "season");
		
		if (seasonFrame) {
			season = seasonFrame.value;
			// Normalize season format: 2020-2021 -> 2020/21, 2020/21 -> 2020/21
			if (season.includes("-")) {
				// Handle full year format: 2020-2021 -> 2020/21
				const fullYearMatch = season.match(/(\d{4})-(\d{4})/);
				if (fullYearMatch) {
					const startYear = fullYearMatch[1];
					const endYear = fullYearMatch[2];
					const shortEndYear = endYear.substring(2);
					season = `${startYear}/${shortEndYear}`;
				} else {
					// Handle short format: 2020-21 -> 2020/21
					season = season.replace("-", "/");
				}
			}
		} else if (analysis?.timeRange) {
			// Try to extract from timeRange
			const seasonMatch = analysis.timeRange.match(/(\d{4})[\/\-](\d{2,4})/);
			if (seasonMatch) {
				const startYear = seasonMatch[1];
				const endYear = seasonMatch[2];
				if (endYear.length === 4) {
					// Full year format: 2020-2021 -> 2020/21
					const shortEndYear = endYear.substring(2);
					season = `${startYear}/${shortEndYear}`;
				} else {
					// Short format: 2020-21 -> 2020/21
					season = `${startYear}/${endYear}`;
				}
			}
		} else {
			// Try to extract from question text
			const fullYearFullMatch = question.match(/(\d{4})[\/\-](\d{4})/);
			if (fullYearFullMatch) {
				const startYear = fullYearFullMatch[1];
				const endYear = fullYearFullMatch[2];
				const shortEndYear = endYear.substring(2);
				season = `${startYear}/${shortEndYear}`;
			} else {
				const seasonMatch = question.match(/(\d{4})[\/\-](\d{2})/);
				if (seasonMatch) {
					season = `${seasonMatch[1]}/${seasonMatch[2]}`;
				}
			}
		}
		
		if (!season) {
			loggingService.log(`⚠️ No season found in queryHighestScoringGame`, null, "warn");
			return { type: "season_not_found", data: [], message: "Could not identify season from question" };
		}
		
		// Build Cypher query to find highest scoring game
		const params: Record<string, unknown> = {
			graphLabel,
			team: teamName,
			season: season,
		};
		
		// Also try normalized season format (hyphen)
		const normalizedSeason = season.replace("/", "-");
		params.normalizedSeason = normalizedSeason;
		
		const query = `
			MATCH (f:Fixture {graphLabel: $graphLabel, team: $team})
			WHERE (f.season = $season OR f.season = $normalizedSeason)
			  AND (f.status IS NULL OR f.status NOT IN ['Void', 'Postponed', 'Abandoned'])
			WITH f, 
			     coalesce(f.dorkiniansGoals, 0) + coalesce(f.conceded, 0) as totalGoals
			ORDER BY totalGoals DESC
			LIMIT 1
			RETURN f.date as date,
			       f.opposition as opposition,
			       f.homeOrAway as homeOrAway,
			       f.result as result,
			       f.dorkiniansGoals as dorkiniansGoals,
			       f.conceded as conceded,
			       totalGoals
		`;
		
		try {
			const result = await neo4jService.executeQuery(query, params);
			loggingService.log(`🔍 Highest scoring game query result count: ${result?.length || 0}`, null, "log");
			
			if (!result || result.length === 0) {
				loggingService.log(`⚠️ No fixtures found for ${teamName} in ${season}`, null, "warn");
				return {
					type: "highest_scoring_game",
					teamName,
					season,
					data: null,
					message: `No fixtures found for ${teamName} in ${season}.`,
				};
			}
			
			const game = result[0];
			loggingService.log(`✅ Found highest scoring game for ${teamName} in ${season}: ${game.totalGoals} total goals`, null, "log");
			
			return {
				type: "highest_scoring_game",
				teamName,
				season,
				data: {
					date: game.date,
					opposition: game.opposition,
					homeOrAway: game.homeOrAway,
					result: game.result,
					dorkiniansGoals: game.dorkiniansGoals,
					conceded: game.conceded,
					totalGoals: game.totalGoals,
				},
			};
		} catch (error) {
			loggingService.log(`❌ Error in queryHighestScoringGame:`, error, "error");
			return {
				type: "error",
				data: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}
}
