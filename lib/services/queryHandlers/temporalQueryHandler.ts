import type { EnhancedQuestionAnalysis } from "../../config/enhancedQuestionAnalysis";
import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { loggingService } from "../loggingService";

interface ParsedSeasonWeek {
	season: string;
	week: number;
	original: string;
}

export class TemporalQueryHandler {
	/**
	 * Query temporal data (time-based queries)
	 */
	static async queryTemporalData(entities: string[], metrics: string[], timeRange?: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying temporal data for entities: ${entities}, metrics: ${metrics}, timeRange: ${timeRange}`, null, "log");

		if (entities.length === 0) {
			return { type: "no_context", data: [], message: "No player context provided" };
		}

		const playerName = entities[0];
		const metric = metrics[0] || "goals";

		// Parse time range
		let dateFilter = "";
		let params: Record<string, string> = { playerName };

		if (timeRange) {
			if (timeRange.includes("since")) {
				const year = timeRange.match(/\d{4}/)?.[0];
				if (year) {
					dateFilter = "AND md.date >= $startDate";
					params.startDate = `${year}-01-01`;
				}
			} else if (timeRange.includes("between")) {
				const years = timeRange.match(/\d{4}/g);
				if (years && years.length === 2) {
					dateFilter = "AND md.date >= $startDate AND md.date <= $endDate";
					params.startDate = `${years[0]}-01-01`;
					params.endDate = `${years[1]}-12-31`;
				}
			} else if (timeRange.includes("before")) {
				const year = timeRange.match(/\d{4}/)?.[0];
				if (year) {
					dateFilter = "AND md.date < $endDate";
					params.endDate = `${year}-01-01`;
				}
			}
		}

		let returnClause = "coalesce(sum(md.goals), 0) as value";

		switch (metric.toLowerCase()) {
			case "appearances":
			case "app":
				returnClause = "count(md) as value";
				break;
			case "goals":
			case "g":
				returnClause = "coalesce(sum(md.goals), 0) as value";
				break;
			case "assists":
			case "a":
				returnClause = "coalesce(sum(md.assists), 0) as value";
				break;
			default:
				returnClause = "coalesce(sum(md.goals), 0) as value";
		}

		const query = `
			MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
			WHERE 1=1 ${dateFilter}
			RETURN p.playerName as playerName, ${returnClause}
		`;

		try {
			const result = await neo4jService.executeQuery(query, params);
			return { type: "temporal", data: result, playerName, metric, timeRange };
		} catch (error) {
			loggingService.log(`❌ Error in temporal query:`, error, "error");
			return { type: "error", data: [], error: "Error querying temporal data" };
		}
	}

	/**
	 * Query streak data
	 */
	static async queryStreakData(entities: string[], metrics: string[], analysis?: EnhancedQuestionAnalysis): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying streak data for entities: ${entities}, metrics: ${metrics}`, null, "log");

		if (entities.length === 0) {
			return { type: "no_context", data: [], message: "No player context provided" };
		}

		const playerName = entities[0];
		const question = analysis?.question?.toLowerCase() || "";

		// Check if this is a consecutive weekends question
		if (question.includes("weekend") || question.includes("weekends")) {
			return await TemporalQueryHandler.queryConsecutiveWeekendsStreak(playerName);
		}

		// Check if this is a clean sheet streak question (consecutive games with 0 conceded)
		const isCleanSheetStreak = (question.includes("clean sheet") && (question.includes("in a row") || question.includes("consecutive"))) ||
			(metrics.some(m => m.toLowerCase() === "clean_sheets" || m.toLowerCase() === "cls") && (question.includes("in a row") || question.includes("consecutive")));

		// Check if this is a goal involvement streak question
		const isGoalInvolvementStreak = question.includes("goal involvement") && (question.includes("consecutive") || question.includes("in a row") || question.includes("scored") || question.includes("assisted")) ||
			((question.includes("scored") || question.includes("assisted")) && (question.includes("consecutive") || question.includes("in a row")));

		if (isCleanSheetStreak) {
			return await TemporalQueryHandler.queryConsecutiveCleanSheetsStreak(playerName);
		}

		if (isGoalInvolvementStreak) {
			return await TemporalQueryHandler.queryConsecutiveGoalInvolvementStreak(playerName);
		}

		const metric = metrics[0] || "goals";

		// Determine streak type based on metric
		let streakType = "goals";
		let streakField = "goals";
		let streakCondition = "md.goals > 0";

		switch (metric.toLowerCase()) {
			case "assists":
			case "a":
				streakType = "assists";
				streakField = "assists";
				streakCondition = "md.assists > 0";
				break;
			case "clean_sheets":
			case "cls":
				streakType = "clean_sheets";
				streakField = "cleanSheets";
				streakCondition = "md.cleanSheets > 0";
				break;
			case "appearances":
			case "app":
				streakType = "appearances";
				streakField = "appearances";
				streakCondition = "md.minutes > 0";
				break;
			default:
				streakType = "goals";
				streakField = "goals";
				streakCondition = "md.goals > 0";
		}

		const query = `
			MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
			WHERE ${streakCondition}
			RETURN md.date as date, md.${streakField} as ${streakField}, md.team as team, md.opposition as opposition
			ORDER BY md.date DESC
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName });
			return { type: "streak", data: result, playerName, streakType };
		} catch (error) {
			loggingService.log(`❌ Error in streak query:`, error, "error");
			return { type: "error", data: [], error: "Error querying streak data" };
		}
	}

	/**
	 * Query consecutive weekends streak data
	 */
	static async queryConsecutiveWeekendsStreak(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying consecutive weekends streak for player: ${playerName}`, null, "log");

		const graphLabel = neo4jService.getGraphLabel();

		// Query to get distinct seasonWeek values and their dates for calendar visualization
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.minutes > 0 AND md.seasonWeek IS NOT NULL AND md.seasonWeek <> ""
			WITH md.seasonWeek as seasonWeek, md.season as season, md.week as week, md.date as date
			ORDER BY season ASC, week ASC, date ASC
			WITH seasonWeek, season, week, collect(date)[0] as firstDate
			RETURN seasonWeek, season, week, firstDate as date
			ORDER BY season ASC, week ASC
		`;

		try {
			const result = await neo4jService.executeQuery(query, { graphLabel, playerName });
			const seasonWeeks = (result || [])
				.map((record: any) => record?.seasonWeek)
				.filter((sw: string | null | undefined) => sw !== null && sw !== undefined && sw !== "");

			// Create a map from seasonWeek to date for quick lookup
			const seasonWeekToDateMap = new Map<string, string>();
			const dateData = (result || [])
				.map((record: any) => {
					if (record?.seasonWeek && record?.date) {
						seasonWeekToDateMap.set(record.seasonWeek, record.date);
					}
					return {
						date: record?.date,
						seasonWeek: record?.seasonWeek,
					};
				})
				.filter((item: any) => item.date && item.seasonWeek);

			if (seasonWeeks.length === 0) {
				loggingService.log(`⚠️ No seasonWeek data found for player: ${playerName}`, null, "warn");
				return { type: "streak", data: [], playerName, streakType: "consecutive_weekends", streakCount: 0, streakSequence: [] };
			}

			const streakResult = TemporalQueryHandler.calculateConsecutiveWeeks(seasonWeeks);
			const longestStreak = streakResult.count;
			const streakSequence = streakResult.sequence;
			
			// Calculate start and end dates for the streak
			let streakStartDate: string | null = null;
			let streakEndDate: string | null = null;
			let highlightRange: { startWeek: number; startYear: number; endWeek: number; endYear: number } | undefined = undefined;

			if (streakSequence.length > 0) {
				// Get dates for first and last seasonWeek in the streak
				const firstSeasonWeek = streakSequence[0];
				const lastSeasonWeek = streakSequence[streakSequence.length - 1];
				
				streakStartDate = seasonWeekToDateMap.get(firstSeasonWeek) || null;
				streakEndDate = seasonWeekToDateMap.get(lastSeasonWeek) || null;

				// Calculate highlight range for calendar visualization
				// Using Google Sheets WEEKNUM(date, 2) equivalent: Week starts Monday, Week 1 = week containing January 1st
				if (streakStartDate && streakEndDate) {
					const startDate = new Date(streakStartDate);
					const endDate = new Date(streakEndDate);
					
					const getWeekNumber = (date: Date): { year: number; week: number } => {
						const year = date.getFullYear();
						const jan1 = new Date(year, 0, 1);
						const jan1Day = jan1.getDay();
						const jan1MondayBased = jan1Day === 0 ? 6 : jan1Day - 1;
						const daysSinceJan1 = Math.floor((date.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
						const weekNumber = Math.floor((daysSinceJan1 + jan1MondayBased) / 7) + 1;
						return { year, week: weekNumber };
					};

					const startWeekInfo = getWeekNumber(startDate);
					const endWeekInfo = getWeekNumber(endDate);
					
					highlightRange = {
						startWeek: startWeekInfo.week,
						startYear: startWeekInfo.year,
						endWeek: endWeekInfo.week,
						endYear: endWeekInfo.year,
					};
				}
			}
			
			loggingService.log(`✅ Calculated consecutive weekends streak: ${longestStreak} for player: ${playerName}`, null, "log");
			loggingService.log(`📊 Longest consecutive streak sequence: ${streakSequence.join(' → ')}`, null, "log");
			if (streakStartDate && streakEndDate) {
				loggingService.log(`📅 Streak dates: ${streakStartDate} to ${streakEndDate}`, null, "log");
			}

			return { 
				type: "streak", 
				data: dateData, 
				playerName, 
				streakType: "consecutive_weekends", 
				streakCount: longestStreak,
				streakSequence: streakSequence,
				streakStartDate: streakStartDate,
				streakEndDate: streakEndDate,
				highlightRange: highlightRange
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			loggingService.log(`❌ Error in consecutive weekends streak query: ${errorMessage}`, error, "error");
			return { type: "error", data: [], error: `Error querying consecutive weekends streak data: ${errorMessage}` };
		}
	}

	/**
	 * Parse seasonWeek string into season and week components
	 * Format: "YYYY/YY-WK#" (e.g., "2023/24-38")
	 */
	static parseSeasonWeek(seasonWeek: string): ParsedSeasonWeek | null {
		const match = seasonWeek.match(/^(\d{4}\/\d{2})-(\d+)$/);
		if (!match) {
			loggingService.log(`⚠️ Invalid seasonWeek format: ${seasonWeek}`, null, "warn");
			return null;
		}

		const season = match[1];
		const week = parseInt(match[2], 10);

		return { season, week, original: seasonWeek };
	}

	/**
	 * Check if two seasons are consecutive (e.g., "2023/24" -> "2024/25")
	 */
	static areSeasonsConsecutive(season1: string, season2: string): boolean {
		const match1 = season1.match(/^(\d{4})\/(\d{2})$/);
		const match2 = season2.match(/^(\d{4})\/(\d{2})$/);

		if (!match1 || !match2) {
			return false;
		}

		const year1 = parseInt(match1[1], 10);
		const year2 = parseInt(match2[1], 10);

		// Check if season2 is the next season after season1
		return year2 === year1 + 1;
	}

	/**
	 * Calculate consecutive games in the player's full game history
	 * This checks if games meeting a condition are consecutive in the player's appearance history
	 * Returns count, sequence of dates, start date, and end date
	 */
	static calculateConsecutiveGamesInHistory(conditionMetDates: string[], allGameDates: string[]): { count: number; sequence: string[]; startDate: string | null; endDate: string | null } {
		if (conditionMetDates.length === 0 || allGameDates.length === 0) {
			return { count: 0, sequence: [], startDate: null, endDate: null };
		}

		// Create a set for quick lookup
		const conditionMetSet = new Set(conditionMetDates);

		// Find consecutive sequences in the full game history
		let longestStreak = 0;
		let longestStreakStart = -1;
		let longestStreakEnd = -1;
		let currentStreak = 0;
		let currentStreakStart = -1;

		for (let i = 0; i < allGameDates.length; i++) {
			const gameDate = allGameDates[i];
			if (conditionMetSet.has(gameDate)) {
				if (currentStreak === 0) {
					currentStreakStart = i;
				}
				currentStreak++;
				if (currentStreak > longestStreak) {
					longestStreak = currentStreak;
					longestStreakStart = currentStreakStart;
					longestStreakEnd = i;
				}
			} else {
				currentStreak = 0;
				currentStreakStart = -1;
			}
		}

		if (longestStreak === 0) {
			return { count: 0, sequence: [], startDate: null, endDate: null };
		}

		// Extract the longest streak sequence
		const streakSequence = allGameDates
			.slice(longestStreakStart, longestStreakEnd + 1)
			.filter(date => conditionMetSet.has(date));

		const startDate = streakSequence.length > 0 ? streakSequence[0] : null;
		const endDate = streakSequence.length > 0 ? streakSequence[streakSequence.length - 1] : null;

		return {
			count: longestStreak,
			sequence: streakSequence,
			startDate,
			endDate,
		};
	}

	/**
	 * Calculate the longest consecutive streak of game dates
	 * Returns count, sequence of dates, start date, and end date
	 * @deprecated Use calculateConsecutiveGamesInHistory for more accurate consecutive game calculation
	 */
	static calculateConsecutiveGamesStreak(gameDates: string[]): { count: number; sequence: string[]; startDate: string | null; endDate: string | null } {
		if (gameDates.length === 0) {
			return { count: 0, sequence: [], startDate: null, endDate: null };
		}

		// Parse and sort dates
		const parsedDates = gameDates
			.map(dateStr => {
				const date = new Date(dateStr);
				return isNaN(date.getTime()) ? null : date;
			})
			.filter((date): date is Date => date !== null)
			.sort((a, b) => a.getTime() - b.getTime());

		if (parsedDates.length === 0) {
			return { count: 0, sequence: [], startDate: null, endDate: null };
		}

		// Remove duplicates
		const uniqueDates: Date[] = [];
		for (const date of parsedDates) {
			const dateStr = date.toISOString().split('T')[0];
			if (!uniqueDates.some(d => d.toISOString().split('T')[0] === dateStr)) {
				uniqueDates.push(date);
			}
		}

		if (uniqueDates.length === 0) {
			return { count: 0, sequence: [], startDate: null, endDate: null };
		}

		// Find longest consecutive streak
		// For football, consecutive games means games where the player appeared with no other appearances in between
		// Since we're already filtering to games that meet the condition, we check if dates are sequential
		// We'll consider games consecutive if they're within 21 days (3 weeks) - reasonable for football schedules
		let longestStreak = 1;
		let currentStreak = 1;
		let longestStreakStart = 0;
		let longestStreakEnd = 0;
		let currentStreakStart = 0;

		for (let i = 1; i < uniqueDates.length; i++) {
			const prevDate = uniqueDates[i - 1];
			const currDate = uniqueDates[i];
			
			// Calculate days difference
			const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
			
			// Games are consecutive if they're within 21 days (3 weeks)
			// This accounts for weekly/bi-weekly game schedules while avoiding large gaps
			if (daysDiff <= 21) {
				currentStreak++;
				if (currentStreak > longestStreak) {
					longestStreak = currentStreak;
					longestStreakStart = currentStreakStart;
					longestStreakEnd = i;
				}
			} else {
				currentStreak = 1;
				currentStreakStart = i;
			}
		}

		// Extract the longest streak sequence
		const streakSequence = uniqueDates
			.slice(longestStreakStart, longestStreakEnd + 1)
			.map(date => date.toISOString().split('T')[0]);

		const startDate = streakSequence.length > 0 ? streakSequence[0] : null;
		const endDate = streakSequence.length > 0 ? streakSequence[streakSequence.length - 1] : null;

		return {
			count: longestStreak,
			sequence: streakSequence,
			startDate,
			endDate,
		};
	}

	/**
	 * Normalize date to YYYY-MM-DD format consistently
	 * Handles various date formats from Neo4j and avoids timezone issues
	 */
	static normalizeDate(date: any): string {
		if (!date) return '';
		const dateStr = String(date).trim();
		
		// If already in YYYY-MM-DD format, return as-is
		if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
			return dateStr;
		}
		
		// If in YYYY/MM/DD format, convert
		if (dateStr.includes('/')) {
			const parts = dateStr.split('/');
			if (parts.length === 3) {
				return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
			}
		}
		
		// Try parsing as Date and convert to YYYY-MM-DD using UTC to avoid timezone issues
		try {
			const d = new Date(dateStr);
			if (!isNaN(d.getTime())) {
				// Use UTC to avoid timezone issues
				const year = d.getUTCFullYear();
				const month = String(d.getUTCMonth() + 1).padStart(2, '0');
				const day = String(d.getUTCDate()).padStart(2, '0');
				return `${year}-${month}-${day}`;
			}
		} catch (e) {
			// Fall through
		}
		
		return dateStr;
	}

	/**
	 * Query consecutive clean sheets streak (games with 0 conceded goals)
	 */
	static async queryConsecutiveCleanSheetsStreak(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying consecutive clean sheets streak for player: ${playerName}`, null, "log");

		const graphLabel = neo4jService.getGraphLabel();

		// First, get all games where player played (to check for gaps)
		// Then filter to only games with clean sheets and check if they're consecutive in the full game history
		const allGamesQuery = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.minutes > 0
			RETURN md.date as date
			ORDER BY md.date ASC
		`;

		// Query to get games where player played and fixture had 0 conceded goals
		const cleanSheetsQuery = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			WHERE md.minutes > 0 AND f.conceded = 0
			RETURN md.date as date, f.conceded as conceded, md.team as team, md.opposition as opposition
			ORDER BY md.date ASC
		`;

		try {
			// Get all games the player played
			const allGamesResult = await neo4jService.executeQuery(allGamesQuery, { graphLabel, playerName });
			const allGameDates = (allGamesResult || [])
				.map((record: any) => TemporalQueryHandler.normalizeDate(record?.date))
				.filter((date: string) => date !== '')
				.sort();

			// Get clean sheet games
			const result = await neo4jService.executeQuery(cleanSheetsQuery, { graphLabel, playerName });
			const cleanSheetDates = (result || [])
				.map((record: any) => TemporalQueryHandler.normalizeDate(record?.date))
				.filter((date: string) => date !== '');

			if (cleanSheetDates.length === 0) {
				loggingService.log(`⚠️ No clean sheet games found for player: ${playerName}`, null, "warn");
				return { 
					type: "streak", 
					data: [], 
					playerName, 
					streakType: "consecutive_clean_sheets", 
					streakCount: 0, 
					streakSequence: [],
					streakStartDate: null,
					streakEndDate: null,
					highlightRange: undefined
				};
			}

			// Find consecutive clean sheets in the player's game history
			const streakResult = TemporalQueryHandler.calculateConsecutiveGamesInHistory(cleanSheetDates, allGameDates);
			const longestStreak = streakResult.count;
			const streakSequence = streakResult.sequence;
			const streakStartDate = streakResult.startDate;
			const streakEndDate = streakResult.endDate;

			// Calculate highlight range for calendar visualization
			let highlightRange: { startWeek: number; startYear: number; endWeek: number; endYear: number } | undefined = undefined;

			if (streakStartDate && streakEndDate) {
				const startDate = new Date(streakStartDate);
				const endDate = new Date(streakEndDate);
				
				const getWeekNumber = (date: Date): { year: number; week: number } => {
					const year = date.getFullYear();
					const jan1 = new Date(year, 0, 1);
					const jan1Day = jan1.getDay();
					const jan1MondayBased = jan1Day === 0 ? 6 : jan1Day - 1;
					const daysSinceJan1 = Math.floor((date.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
					const weekNumber = Math.floor((daysSinceJan1 + jan1MondayBased) / 7) + 1;
					return { year, week: weekNumber };
				};

				const startWeekInfo = getWeekNumber(startDate);
				const endWeekInfo = getWeekNumber(endDate);
				
				highlightRange = {
					startWeek: startWeekInfo.week,
					startYear: startWeekInfo.year,
					endWeek: endWeekInfo.week,
					endYear: endWeekInfo.year,
				};
			}

			// Prepare data for calendar visualization
			const dateData = (result || []).map((record: any) => ({
				date: record?.date,
				conceded: record?.conceded,
				team: record?.team,
				opposition: record?.opposition,
			}));

			loggingService.log(`✅ Calculated consecutive clean sheets streak: ${longestStreak} for player: ${playerName}`, null, "log");
			if (streakStartDate && streakEndDate) {
				loggingService.log(`📅 Streak dates: ${streakStartDate} to ${streakEndDate}`, null, "log");
			}

			return { 
				type: "streak", 
				data: dateData, 
				playerName, 
				streakType: "consecutive_clean_sheets", 
				streakCount: longestStreak,
				streakSequence: streakSequence,
				streakStartDate: streakStartDate,
				streakEndDate: streakEndDate,
				highlightRange: highlightRange
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			loggingService.log(`❌ Error in consecutive clean sheets streak query: ${errorMessage}`, error, "error");
			return { type: "error", data: [], error: `Error querying consecutive clean sheets streak data: ${errorMessage}` };
		}
	}

	/**
	 * Query consecutive goal involvement streak (goals, penalties scored, or assists)
	 */
	static async queryConsecutiveGoalInvolvementStreak(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying consecutive goal involvement streak for player: ${playerName}`, null, "log");

		const graphLabel = neo4jService.getGraphLabel();

		// First, get all games where player played (to check for gaps)
		const allGamesQuery = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.minutes > 0
			RETURN md.date as date
			ORDER BY md.date ASC
		`;

		// Query to get games where player had goal involvement (goals, penalties scored, or assists)
		const goalInvolvementQuery = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.minutes > 0 AND (md.goals > 0 OR md.penaltiesScored > 0 OR md.assists > 0)
			RETURN md.date as date, md.goals as goals, md.penaltiesScored as penaltiesScored, md.assists as assists, md.team as team, md.opposition as opposition
			ORDER BY md.date ASC
		`;

		try {
			// Get all games the player played
			const allGamesResult = await neo4jService.executeQuery(allGamesQuery, { graphLabel, playerName });
			const allGameDates = (allGamesResult || [])
				.map((record: any) => TemporalQueryHandler.normalizeDate(record?.date))
				.filter((date: string) => date !== '')
				.sort();

			// Get goal involvement games
			const result = await neo4jService.executeQuery(goalInvolvementQuery, { graphLabel, playerName });
			const goalInvolvementDates = (result || [])
				.map((record: any) => TemporalQueryHandler.normalizeDate(record?.date))
				.filter((date: string) => date !== '');

			if (goalInvolvementDates.length === 0) {
				loggingService.log(`⚠️ No goal involvement games found for player: ${playerName}`, null, "warn");
				return { 
					type: "streak", 
					data: [], 
					playerName, 
					streakType: "consecutive_goal_involvement", 
					streakCount: 0, 
					streakSequence: [],
					streakStartDate: null,
					streakEndDate: null,
					highlightRange: undefined
				};
			}

			// Find consecutive goal involvement games in the player's game history
			const streakResult = TemporalQueryHandler.calculateConsecutiveGamesInHistory(goalInvolvementDates, allGameDates);
			const longestStreak = streakResult.count;
			const streakSequence = streakResult.sequence;
			const streakStartDate = streakResult.startDate;
			const streakEndDate = streakResult.endDate;

			// Calculate highlight range for calendar visualization
			let highlightRange: { startWeek: number; startYear: number; endWeek: number; endYear: number } | undefined = undefined;

			if (streakStartDate && streakEndDate) {
				const startDate = new Date(streakStartDate);
				const endDate = new Date(streakEndDate);
				
				const getWeekNumber = (date: Date): { year: number; week: number } => {
					const year = date.getFullYear();
					const jan1 = new Date(year, 0, 1);
					const jan1Day = jan1.getDay();
					const jan1MondayBased = jan1Day === 0 ? 6 : jan1Day - 1;
					const daysSinceJan1 = Math.floor((date.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
					const weekNumber = Math.floor((daysSinceJan1 + jan1MondayBased) / 7) + 1;
					return { year, week: weekNumber };
				};

				const startWeekInfo = getWeekNumber(startDate);
				const endWeekInfo = getWeekNumber(endDate);
				
				highlightRange = {
					startWeek: startWeekInfo.week,
					startYear: startWeekInfo.year,
					endWeek: endWeekInfo.week,
					endYear: endWeekInfo.year,
				};
			}

			// Prepare data for calendar visualization
			const dateData = (result || []).map((record: any) => ({
				date: record?.date,
				goals: record?.goals,
				penaltiesScored: record?.penaltiesScored,
				assists: record?.assists,
				team: record?.team,
				opposition: record?.opposition,
			}));

			loggingService.log(`✅ Calculated consecutive goal involvement streak: ${longestStreak} for player: ${playerName}`, null, "log");
			if (streakStartDate && streakEndDate) {
				loggingService.log(`📅 Streak dates: ${streakStartDate} to ${streakEndDate}`, null, "log");
			}

			return { 
				type: "streak", 
				data: dateData, 
				playerName, 
				streakType: "consecutive_goal_involvement", 
				streakCount: longestStreak,
				streakSequence: streakSequence,
				streakStartDate: streakStartDate,
				streakEndDate: streakEndDate,
				highlightRange: highlightRange
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			loggingService.log(`❌ Error in consecutive goal involvement streak query: ${errorMessage}`, error, "error");
			return { type: "error", data: [], error: `Error querying consecutive goal involvement streak data: ${errorMessage}` };
		}
	}

	/**
	 * Calculate the longest consecutive streak of weeks
	 * Returns both the count and the sequence of seasonWeek values
	 */
	static calculateConsecutiveWeeks(seasonWeeks: string[]): { count: number; sequence: string[] } {
		if (seasonWeeks.length === 0) {
			return { count: 0, sequence: [] };
		}

		// Parse all seasonWeek values
		const parsed = seasonWeeks
			.map((sw) => TemporalQueryHandler.parseSeasonWeek(sw))
			.filter((p): p is ParsedSeasonWeek => p !== null);

		if (parsed.length === 0) {
			return { count: 0, sequence: [] };
		}

		// Sort by season and week
		parsed.sort((a, b) => {
			// First compare seasons
			const seasonA = a.season;
			const seasonB = b.season;
			if (seasonA !== seasonB) {
				const yearA = parseInt(seasonA.match(/^(\d{4})/)?.[1] || "0", 10);
				const yearB = parseInt(seasonB.match(/^(\d{4})/)?.[1] || "0", 10);
				return yearA - yearB;
			}
			// Then compare weeks within the same season
			return a.week - b.week;
		});

		// Remove duplicates (same season and week)
		const unique: ParsedSeasonWeek[] = [];
		for (const item of parsed) {
			const exists = unique.some((u) => u.season === item.season && u.week === item.week);
			if (!exists) {
				unique.push(item);
			}
		}

		if (unique.length === 0) {
			return { count: 0, sequence: [] };
		}

		// Find longest consecutive streak
		let longestStreak = 1;
		let currentStreak = 1;
		let longestStreakSequence: ParsedSeasonWeek[] = [unique[0]];
		let currentStreakSequence: ParsedSeasonWeek[] = [unique[0]];

		for (let i = 1; i < unique.length; i++) {
			const prev = unique[i - 1];
			const curr = unique[i];

			let isConsecutive = false;

			if (prev.season === curr.season) {
				// Same season: check if weeks are consecutive
				isConsecutive = prev.week + 1 === curr.week;
			} else {
				// Different seasons: check if it's a season boundary transition
				// (e.g., "2023/24-52" -> "2024/25-1")
				const areConsecutiveSeasons = TemporalQueryHandler.areSeasonsConsecutive(prev.season, curr.season);
				isConsecutive = areConsecutiveSeasons && prev.week === 52 && curr.week === 1;
			}

			if (isConsecutive) {
				currentStreak++;
				currentStreakSequence.push(curr);
				if (currentStreak > longestStreak) {
					longestStreak = currentStreak;
					longestStreakSequence = [...currentStreakSequence];
				}
			} else {
				currentStreak = 1;
				currentStreakSequence = [curr];
			}
		}

		return {
			count: longestStreak,
			sequence: longestStreakSequence.map((s) => s.original),
		};
	}
}
