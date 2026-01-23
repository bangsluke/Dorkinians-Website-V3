import type { EnhancedQuestionAnalysis } from "../../config/enhancedQuestionAnalysis";
import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { loggingService } from "../loggingService";
import { ChatbotService } from "../chatbotService";

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
		// Enhanced detection to catch variations like "consecutive games have I scored/assisted/had a goal involvement"
		// Also detect "longest run of games where I had goal involvements"
		const isGoalInvolvementStreak = 
			((question.includes("goal involvement") || question.includes("goals involvement")) && (question.includes("consecutive") || question.includes("in a row") || question.includes("scored") || question.includes("assisted") || question.includes("longest run") || question.includes("longest streak"))) ||
			((question.includes("scored") || question.includes("assisted")) && (question.includes("consecutive") || question.includes("in a row"))) ||
			(question.includes("consecutive games") && (question.includes("scored") || question.includes("assisted") || question.includes("goal involvement") || question.includes("goals involvement"))) ||
			(question.includes("consecutive") && question.includes("games") && (question.includes("scored") || question.includes("assisted") || question.includes("goal involvement") || question.includes("goals involvement"))) ||
			((question.includes("longest run") || question.includes("longest streak")) && (question.includes("goal involvement") || question.includes("goal involvements")) && !question.includes("no") && !question.includes("without"));

		// Check if this is a "no goal involvement" streak question (longest run without goal involvements)
		// Handle variations: "longest run", "longest streak", "lowest run" (likely typo/normalization issue)
		// Handle variations: "goal involvement", "goal involvements", "goals goal involvements"
		const isNoGoalInvolvementStreak = 
			(question.includes("longest run") || question.includes("longest streak") || question.includes("lowest run") || question.includes("run of games")) &&
			(question.includes("no goal involvement") || question.includes("no goal involvements") || 
			 question.includes("no goals goal involvements") || question.includes("no goals goal involvement") ||
			 question.includes("without goal involvement") || question.includes("without goal involvements") ||
			 (question.includes("goal involvement") && (question.includes("no") || question.includes("without"))) ||
			 (question.includes("goals goal involvements") && (question.includes("no") || question.includes("without"))));

		// Check if this is a goal scoring streak question (goals + penalties, excluding assists)
		const isGoalScoringStreak = 
			(question.includes("longest") && (question.includes("goal scoring streak") || question.includes("goal scoring run") || question.includes("scoring streak"))) ||
			(question.includes("longest") && question.includes("streak") && question.includes("scored") && !question.includes("assist"));

		// Check if this is an assisting run question (assists only)
		// Handle both "assisting" and common typo "assiting"
		const isAssistingRun = 
			(question.includes("longest") && (question.includes("assisting run") || question.includes("assisting streak") || question.includes("assiting run") || question.includes("assiting streak"))) ||
			(question.includes("longest") && question.includes("run") && (question.includes("assist") || question.includes("assit")) && !question.includes("goal"));

		if (isCleanSheetStreak) {
			return await TemporalQueryHandler.queryConsecutiveCleanSheetsStreak(playerName);
		}

		if (isNoGoalInvolvementStreak) {
			return await TemporalQueryHandler.queryLongestNoGoalInvolvementStreak(playerName);
		}

		if (isGoalScoringStreak) {
			return await TemporalQueryHandler.queryLongestGoalScoringStreak(playerName);
		}

		if (isAssistingRun) {
			return await TemporalQueryHandler.queryLongestAssistingRun(playerName);
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

		// Query to get all weekends with fixtures (for any Dorkinians team)
		const allFixturesQuery = `
			MATCH (f:Fixture {graphLabel: $graphLabel})
			WHERE f.seasonWeek IS NOT NULL AND f.seasonWeek <> ""
			  AND (f.status IS NULL OR NOT (f.status IN ['Void', 'Postponed', 'Abandoned']))
			WITH DISTINCT f.seasonWeek as seasonWeek, f.season as season, f.week as week, f.date as date
			ORDER BY season ASC, week ASC, date ASC
			WITH seasonWeek, season, week, collect(date)[0] as firstDate
			RETURN seasonWeek, season, week, firstDate as date
			ORDER BY season ASC, week ASC
		`;

		// Query to get weekends where the player played
		const playerPlayedQuery = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.minutes > 0 AND md.seasonWeek IS NOT NULL AND md.seasonWeek <> ""
			WITH md.seasonWeek as seasonWeek, md.season as season, md.week as week, md.date as date
			ORDER BY season ASC, week ASC, date ASC
			WITH seasonWeek, season, week, collect(date)[0] as firstDate
			RETURN seasonWeek, season, week, firstDate as date
			ORDER BY season ASC, week ASC
		`;

		// Push queries to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteAllFixtures = allFixturesQuery.replace(/\$graphLabel/g, `'${graphLabel}'`);
			const readyToExecutePlayerPlayed = playerPlayedQuery
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`CONSECUTIVE_WEEKENDS_ALL_FIXTURES: ${allFixturesQuery}`);
			chatbotService.lastExecutedQueries.push(`CONSECUTIVE_WEEKENDS_PLAYER_PLAYED: ${playerPlayedQuery}`);
			chatbotService.lastExecutedQueries.push(`CONSECUTIVE_WEEKENDS_READY_TO_EXECUTE: ${readyToExecutePlayerPlayed}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			// Get all weekends with fixtures
			const allFixturesResult = await neo4jService.executeQuery(allFixturesQuery, { graphLabel });
			const allFixtureSeasonWeeks = new Set<string>();
			const allFixtureSeasonWeekToDateMap = new Map<string, string>();
			
			(allFixturesResult || []).forEach((record: any) => {
				if (record?.seasonWeek) {
					allFixtureSeasonWeeks.add(record.seasonWeek);
					if (record?.date) {
						allFixtureSeasonWeekToDateMap.set(record.seasonWeek, record.date);
					}
				}
			});

			// Get weekends where player played
			const playerPlayedResult = await neo4jService.executeQuery(playerPlayedQuery, { graphLabel, playerName });
			const playerPlayedSeasonWeeks = new Set<string>();
			const seasonWeekToDateMap = new Map<string, string>();
			const dateData: Array<{ date: string; seasonWeek: string }> = [];
			
			(playerPlayedResult || []).forEach((record: any) => {
				if (record?.seasonWeek) {
					playerPlayedSeasonWeeks.add(record.seasonWeek);
					if (record?.date) {
						seasonWeekToDateMap.set(record.seasonWeek, record.date);
						dateData.push({
							date: record.date,
							seasonWeek: record.seasonWeek,
						});
					}
				}
			});

			// Build streak calculation based on available weekends
			// Strategy: Only consider weekends where ANY team played (available weekends)
			// Player must play on every available weekend to continue the streak
			// Weekends with no fixtures are automatically skipped (not in available weekends list)
			
			// Sort all available weekends chronologically
			const sortedAvailableWeeks = Array.from(allFixtureSeasonWeeks).sort((a, b) => {
				const parsedA = TemporalQueryHandler.parseSeasonWeek(a);
				const parsedB = TemporalQueryHandler.parseSeasonWeek(b);
				if (!parsedA || !parsedB) return 0;
				if (parsedA.season !== parsedB.season) {
					const yearA = parseInt(parsedA.season.match(/^(\d{4})/)?.[1] || "0", 10);
					const yearB = parseInt(parsedB.season.match(/^(\d{4})/)?.[1] || "0", 10);
					return yearA - yearB;
				}
				return parsedA.week - parsedB.week;
			});

			if (sortedAvailableWeeks.length === 0) {
				loggingService.log(`⚠️ No available weekends found for streak calculation: ${playerName}`, null, "warn");
				return { type: "streak", data: [], playerName, streakType: "consecutive_weekends", streakCount: 0, streakSequence: [] };
			}

			// Find longest consecutive sequence where player played in ALL available weekends
			let longestStreak = 0;
			let longestStreakSequence: string[] = [];
			let currentStreak = 0;
			let currentStreakSequence: string[] = [];

			for (let i = 0; i < sortedAvailableWeeks.length; i++) {
				const availableWeek = sortedAvailableWeeks[i];
				const playerPlayed = playerPlayedSeasonWeeks.has(availableWeek);
				
				// Check if this week is consecutive to the previous week in the current streak
				// Weeks must be consecutive in the available weekends list to continue the streak
				let isConsecutive = true;
				if (currentStreakSequence.length > 0) {
					const prevWeek = currentStreakSequence[currentStreakSequence.length - 1];
					const prevParsed = TemporalQueryHandler.parseSeasonWeek(prevWeek);
					const currParsed = TemporalQueryHandler.parseSeasonWeek(availableWeek);
					
					if (prevParsed && currParsed) {
						if (prevParsed.season === currParsed.season) {
							// Same season: check if weeks are consecutive
							isConsecutive = currParsed.week === prevParsed.week + 1;
						} else {
							// Different seasons: check if it's a season boundary transition
							const areConsecutiveSeasons = TemporalQueryHandler.areSeasonsConsecutive(prevParsed.season, currParsed.season);
							isConsecutive = areConsecutiveSeasons && prevParsed.week === 52 && currParsed.week === 1;
						}
					} else {
						isConsecutive = false;
					}
				}
				
				if (playerPlayed && isConsecutive) {
					// Player played this weekend AND it's consecutive - continue/add to streak
					currentStreak++;
					currentStreakSequence.push(availableWeek);
					
					// Check if this is the longest streak so far
					if (currentStreak > longestStreak) {
						longestStreak = currentStreak;
						longestStreakSequence = [...currentStreakSequence];
					}
				} else {
					// Player didn't play OR week is not consecutive - streak breaks
					currentStreak = 0;
					currentStreakSequence = [];
					
					// If player played but week is not consecutive, start a new streak
					if (playerPlayed && !isConsecutive) {
						currentStreak = 1;
						currentStreakSequence = [availableWeek];
					}
				}
			}

			const streakSequence = longestStreakSequence;
			
			// Collect actual dates from streak sequence for precise calendar matching
			const streakDates: string[] = [];
			streakSequence.forEach(seasonWeek => {
				const date = seasonWeekToDateMap.get(seasonWeek) || allFixtureSeasonWeekToDateMap.get(seasonWeek);
				if (date) {
					// Normalize to YYYY-MM-DD
					const dateStr = String(date).trim();
					if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
						streakDates.push(dateStr);
					} else {
						const d = new Date(dateStr);
						if (!isNaN(d.getTime())) {
							const year = d.getFullYear();
							const month = String(d.getMonth() + 1).padStart(2, '0');
							const day = String(d.getDate()).padStart(2, '0');
							streakDates.push(`${year}-${month}-${day}`);
						}
					}
				}
			});
			
			// Calculate start and end dates for the streak
			let streakStartDate: string | null = null;
			let streakEndDate: string | null = null;
			let highlightRange: { startWeek: number; startYear: number; endWeek: number; endYear: number } | undefined = undefined;

			if (streakSequence.length > 0) {
				// Get dates for first and last seasonWeek in the streak
				// Use player's date map first, fall back to fixture date map
				const firstSeasonWeek = streakSequence[0];
				const lastSeasonWeek = streakSequence[streakSequence.length - 1];
				
				const firstDate = seasonWeekToDateMap.get(firstSeasonWeek) || allFixtureSeasonWeekToDateMap.get(firstSeasonWeek) || null;
				const lastDate = seasonWeekToDateMap.get(lastSeasonWeek) || allFixtureSeasonWeekToDateMap.get(lastSeasonWeek) || null;

				// Ensure dates are in correct order (earliest to latest)
				if (firstDate && lastDate) {
					const firstDateObj = new Date(firstDate);
					const lastDateObj = new Date(lastDate);
					
					// Compare dates to ensure correct ordering
					if (firstDateObj <= lastDateObj) {
						streakStartDate = firstDate;
						streakEndDate = lastDate;
					} else {
						// Dates are reversed, swap them
						streakStartDate = lastDate;
						streakEndDate = firstDate;
					}
				} else if (firstDate) {
					streakStartDate = firstDate;
					streakEndDate = firstDate;
				} else if (lastDate) {
					streakStartDate = lastDate;
					streakEndDate = lastDate;
				}

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
			
			// Collect all fixture dates for calendar visualization
			// Use the same fixture data that was used in streak calculation
			const allFixtureDates: string[] = [];
			(allFixturesResult || []).forEach((record: any) => {
				if (record?.date) {
					// Normalize date to YYYY-MM-DD format
					const dateStr = String(record.date).trim();
					if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
						allFixtureDates.push(dateStr);
					} else {
						// Try to parse and normalize
						const d = new Date(dateStr);
						if (!isNaN(d.getTime())) {
							const year = d.getFullYear();
							const month = String(d.getMonth() + 1).padStart(2, '0');
							const day = String(d.getDate()).padStart(2, '0');
							allFixtureDates.push(`${year}-${month}-${day}`);
						}
					}
				}
			});
			// Remove duplicates
			const uniqueFixtureDates = Array.from(new Set(allFixtureDates));

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
				highlightRange: highlightRange,
				allFixtureDates: uniqueFixtureDates,
				streakDates: streakDates
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

		// Push queries to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteCleanSheets = cleanSheetsQuery
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`CLEAN_SHEETS_STREAK_QUERY: ${cleanSheetsQuery}`);
			chatbotService.lastExecutedQueries.push(`CLEAN_SHEETS_STREAK_READY_TO_EXECUTE: ${readyToExecuteCleanSheets}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			// Get all games the player played
			const allGamesResult = await neo4jService.executeQuery(allGamesQuery, { graphLabel, playerName });
			const allGameDates = Array.from(new Set((allGamesResult || [])
				.map((record: any) => TemporalQueryHandler.normalizeDate(record?.date))
				.filter((date: string) => date !== '')))
				.sort();

			// Get clean sheet games
			const result = await neo4jService.executeQuery(cleanSheetsQuery, { graphLabel, playerName });
			const cleanSheetDates = Array.from(new Set((result || [])
				.map((record: any) => TemporalQueryHandler.normalizeDate(record?.date))
				.filter((date: string) => date !== '')));

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

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = goalInvolvementQuery
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`CONSECUTIVE_GOAL_INVOLVEMENT_QUERY: ${goalInvolvementQuery}`);
			chatbotService.lastExecutedQueries.push(`CONSECUTIVE_GOAL_INVOLVEMENT_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			// Get all games the player played
			const allGamesResult = await neo4jService.executeQuery(allGamesQuery, { graphLabel, playerName });
			const allGameDates = Array.from(new Set((allGamesResult || [])
				.map((record: any) => TemporalQueryHandler.normalizeDate(record?.date))
				.filter((date: string) => date !== '')))
				.sort();

			// Get goal involvement games
			const result = await neo4jService.executeQuery(goalInvolvementQuery, { graphLabel, playerName });
			const goalInvolvementDates = Array.from(new Set((result || [])
				.map((record: any) => TemporalQueryHandler.normalizeDate(record?.date))
				.filter((date: string) => date !== '')));

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

			// Prepare data for calendar visualization - ALL games with goal involvement data
			// For consecutive goal involvement, we want to show all games (not just streak games) so calendar can display properly
			// Get all games the player played with goal involvement data
			const allGamesWithDataQuery = `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				WHERE md.minutes > 0
				RETURN md.date as date, md.goals as goals, md.penaltiesScored as penaltiesScored, md.assists as assists, md.team as team, md.opposition as opposition
				ORDER BY md.date ASC
			`;
			const allGamesWithDataResult = await neo4jService.executeQuery(allGamesWithDataQuery, { graphLabel, playerName });
			
			const dateData = (allGamesWithDataResult || []).map((record: any) => {
				const goals = (record?.goals as number) || 0;
				const assists = (record?.assists as number) || 0;
				const penaltiesScored = (record?.penaltiesScored as number) || 0;
				const goalInvolvements = goals + assists + penaltiesScored;
				
				return {
					date: record?.date,
					goals: goals,
					penaltiesScored: penaltiesScored,
					assists: assists,
					goalInvolvements: goalInvolvements,
					team: record?.team,
					opposition: record?.opposition,
				};
			});

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
	 * Query longest goal scoring streak (goals + penalties scored, excluding assists)
	 * Returns calendar data with goal scoring data and highlights the longest consecutive streak
	 */
	static async queryLongestGoalScoringStreak(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying longest goal scoring streak for player: ${playerName}`, null, "log");

		const graphLabel = neo4jService.getGraphLabel();

		// First, get all games where player played (to check for gaps)
		const allGamesQuery = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.minutes > 0
			RETURN md.date as date
			ORDER BY md.date ASC
		`;

		// Query to get games where player scored (goals or penalties scored, excluding assists)
		const goalScoringQuery = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.minutes > 0 AND (md.goals > 0 OR md.penaltiesScored > 0)
			RETURN md.date as date, md.goals as goals, md.penaltiesScored as penaltiesScored, md.team as team, md.opposition as opposition
			ORDER BY md.date ASC
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = goalScoringQuery
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`GOAL_SCORING_STREAK_QUERY: ${goalScoringQuery}`);
			chatbotService.lastExecutedQueries.push(`GOAL_SCORING_STREAK_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			// Get all games the player played
			const allGamesResult = await neo4jService.executeQuery(allGamesQuery, { graphLabel, playerName });
			const allGameDates = Array.from(new Set((allGamesResult || [])
				.map((record: any) => TemporalQueryHandler.normalizeDate(record?.date))
				.filter((date: string) => date !== '')))
				.sort();

			// Get goal scoring games
			const result = await neo4jService.executeQuery(goalScoringQuery, { graphLabel, playerName });
			const goalScoringDates = Array.from(new Set((result || [])
				.map((record: any) => TemporalQueryHandler.normalizeDate(record?.date))
				.filter((date: string) => date !== '')));

			if (goalScoringDates.length === 0) {
				loggingService.log(`⚠️ No goal scoring games found for player: ${playerName}`, null, "warn");
				return { 
					type: "streak", 
					data: [], 
					playerName, 
					streakType: "longest_goal_scoring_streak", 
					streakCount: 0, 
					streakSequence: [],
					streakStartDate: null,
					streakEndDate: null,
					highlightRange: undefined
				};
			}

			// Find consecutive goal scoring games in the player's game history
			const streakResult = TemporalQueryHandler.calculateConsecutiveGamesInHistory(goalScoringDates, allGameDates);
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

			// Prepare data for calendar visualization - ALL games with goal scoring data
			// Get all games the player played with goal scoring data
			const allGamesWithDataQuery = `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				WHERE md.minutes > 0
				RETURN md.date as date, md.goals as goals, md.penaltiesScored as penaltiesScored, md.assists as assists, md.team as team, md.opposition as opposition
				ORDER BY md.date ASC
			`;
			const allGamesWithDataResult = await neo4jService.executeQuery(allGamesWithDataQuery, { graphLabel, playerName });
			
			const dateData = (allGamesWithDataResult || []).map((record: any) => {
				const goals = (record?.goals as number) || 0;
				const penaltiesScored = (record?.penaltiesScored as number) || 0;
				const assists = (record?.assists as number) || 0;
				// For goal scoring streak, we only count goals + penalties, not assists
				const goalScoring = goals + penaltiesScored;
				
				return {
					date: record?.date,
					goals: goals,
					penaltiesScored: penaltiesScored,
					assists: assists,
					goalScoring: goalScoring,
					team: record?.team,
					opposition: record?.opposition,
				};
			});

			loggingService.log(`✅ Calculated longest goal scoring streak: ${longestStreak} for player: ${playerName}`, null, "log");
			if (streakStartDate && streakEndDate) {
				loggingService.log(`📅 Streak dates: ${streakStartDate} to ${streakEndDate}`, null, "log");
			}

			return { 
				type: "streak", 
				data: dateData, 
				playerName, 
				streakType: "longest_goal_scoring_streak", 
				streakCount: longestStreak,
				streakSequence: streakSequence,
				streakStartDate: streakStartDate,
				streakEndDate: streakEndDate,
				highlightRange: highlightRange
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			loggingService.log(`❌ Error in longest goal scoring streak query: ${errorMessage}`, error, "error");
			return { type: "error", data: [], error: `Error querying longest goal scoring streak data: ${errorMessage}` };
		}
	}

	/**
	 * Query longest assisting run (assists only)
	 * Returns calendar data with assist data and highlights the longest consecutive streak
	 */
	static async queryLongestAssistingRun(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying longest assisting run for player: ${playerName}`, null, "log");

		const graphLabel = neo4jService.getGraphLabel();

		// First, get all games where player played (to check for gaps)
		const allGamesQuery = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.minutes > 0
			RETURN md.date as date
			ORDER BY md.date ASC
		`;

		// Query to get games where player assisted (assists only)
		const assistingQuery = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.minutes > 0 AND md.assists > 0
			RETURN md.date as date, md.assists as assists, md.team as team, md.opposition as opposition
			ORDER BY md.date ASC
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = assistingQuery
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`ASSISTING_RUN_QUERY: ${assistingQuery}`);
			chatbotService.lastExecutedQueries.push(`ASSISTING_RUN_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			// Get all games the player played
			const allGamesResult = await neo4jService.executeQuery(allGamesQuery, { graphLabel, playerName });
			const allGameDates = Array.from(new Set((allGamesResult || [])
				.map((record: any) => TemporalQueryHandler.normalizeDate(record?.date))
				.filter((date: string) => date !== '')))
				.sort();

			// Get assisting games
			const assistingResult = await neo4jService.executeQuery(assistingQuery, { graphLabel, playerName });
			const assistingDates = Array.from(new Set((assistingResult || [])
				.map((record: any) => TemporalQueryHandler.normalizeDate(record?.date))
				.filter((date: string) => date !== '')));

			if (assistingDates.length === 0) {
				loggingService.log(`⚠️ No assisting games found for player: ${playerName}`, null, "warn");
				return { 
					type: "streak", 
					data: [], 
					playerName, 
					streakType: "longest_assisting_run", 
					streakCount: 0, 
					streakSequence: [],
					streakStartDate: null,
					streakEndDate: null,
					highlightRange: undefined
				};
			}

			// Find consecutive assisting games in the player's game history
			const streakResult = TemporalQueryHandler.calculateConsecutiveGamesInHistory(assistingDates, allGameDates);
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

			// Prepare data for calendar visualization - ALL games with assist data
			// Get all games the player played with assist data
			const allGamesWithDataQuery = `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				WHERE md.minutes > 0
				RETURN md.date as date, md.goals as goals, md.penaltiesScored as penaltiesScored, md.assists as assists, md.team as team, md.opposition as opposition
				ORDER BY md.date ASC
			`;
			const allGamesWithDataResult = await neo4jService.executeQuery(allGamesWithDataQuery, { graphLabel, playerName });
			
			const dateData = (allGamesWithDataResult || []).map((record: any) => {
				const goals = (record?.goals as number) || 0;
				const penaltiesScored = (record?.penaltiesScored as number) || 0;
				const assists = (record?.assists as number) || 0;
				// For assisting run, we only count assists
				
				return {
					date: record?.date,
					goals: goals,
					penaltiesScored: penaltiesScored,
					assists: assists,
					assisting: assists,
					team: record?.team,
					opposition: record?.opposition,
				};
			});

			loggingService.log(`✅ Calculated longest assisting run: ${longestStreak} for player: ${playerName}`, null, "log");
			if (streakStartDate && streakEndDate) {
				loggingService.log(`📅 Streak dates: ${streakStartDate} to ${streakEndDate}`, null, "log");
			}

			return { 
				type: "streak", 
				data: dateData, 
				playerName, 
				streakType: "longest_assisting_run", 
				streakCount: longestStreak,
				streakSequence: streakSequence,
				streakStartDate: streakStartDate,
				streakEndDate: streakEndDate,
				highlightRange: highlightRange
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			loggingService.log(`❌ Error in longest assisting run query: ${errorMessage}`, error, "error");
			return { type: "error", data: [], error: `Error querying longest assisting run data: ${errorMessage}` };
		}
	}

	/**
	 * Query longest streak of games without goal involvements
	 * Returns calendar data with goal involvement counts and highlights the longest streak without goal involvements
	 */
	static async queryLongestNoGoalInvolvementStreak(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying longest no goal involvement streak for player: ${playerName}`, null, "log");

		const graphLabel = neo4jService.getGraphLabel();

		// Get all games where player played with goal involvement data
		const allGamesQuery = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.minutes > 0
			RETURN md.date as date, md.goals as goals, md.penaltiesScored as penaltiesScored, md.assists as assists, md.team as team, md.opposition as opposition
			ORDER BY md.date ASC
		`;

		// Query to get games where player had goal involvement (goals, penalties scored, or assists)
		const goalInvolvementQuery = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.minutes > 0 AND (md.goals > 0 OR md.penaltiesScored > 0 OR md.assists > 0)
			RETURN md.date as date
			ORDER BY md.date ASC
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = goalInvolvementQuery
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`NO_GOAL_INVOLVEMENT_STREAK_QUERY: ${goalInvolvementQuery}`);
			chatbotService.lastExecutedQueries.push(`NO_GOAL_INVOLVEMENT_STREAK_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			// Get all games the player played with full data
			const allGamesResult = await neo4jService.executeQuery(allGamesQuery, { graphLabel, playerName });
			const allGameDates = Array.from(new Set((allGamesResult || [])
				.map((record: any) => TemporalQueryHandler.normalizeDate(record?.date))
				.filter((date: string) => date !== '')))
				.sort();

			// Get goal involvement games (dates only)
			const goalInvolvementResult = await neo4jService.executeQuery(goalInvolvementQuery, { graphLabel, playerName });
			const goalInvolvementDates = Array.from(new Set((goalInvolvementResult || [])
				.map((record: any) => TemporalQueryHandler.normalizeDate(record?.date))
				.filter((date: string) => date !== '')));

			// Create a set of dates with goal involvements for quick lookup
			const goalInvolvementSet = new Set(goalInvolvementDates);

			// Find games WITHOUT goal involvements (invert the condition)
			const noGoalInvolvementDates = allGameDates.filter(date => !goalInvolvementSet.has(date));

			if (noGoalInvolvementDates.length === 0) {
				loggingService.log(`⚠️ All games had goal involvements for player: ${playerName}`, null, "warn");
				// Still return calendar data with all games showing their goal involvement counts
			}

			// Find longest consecutive streak of games WITHOUT goal involvements
			const streakResult = TemporalQueryHandler.calculateConsecutiveGamesInHistory(noGoalInvolvementDates, allGameDates);
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

			// Prepare data for calendar visualization - ALL games with goal involvement counts
			// Goal involvement = goals + assists + penaltiesScored
			const dateData = (allGamesResult || []).map((record: any) => {
				const goals = (record?.goals as number) || 0;
				const assists = (record?.assists as number) || 0;
				const penaltiesScored = (record?.penaltiesScored as number) || 0;
				const goalInvolvements = goals + assists + penaltiesScored;
				
				return {
					date: record?.date,
					goals: goals,
					penaltiesScored: penaltiesScored,
					assists: assists,
					goalInvolvements: goalInvolvements,
					team: record?.team,
					opposition: record?.opposition,
				};
			});

			loggingService.log(`✅ Calculated longest no goal involvement streak: ${longestStreak} for player: ${playerName}`, null, "log");
			if (streakStartDate && streakEndDate) {
				loggingService.log(`📅 Streak dates: ${streakStartDate} to ${streakEndDate}`, null, "log");
			}

			return { 
				type: "streak", 
				data: dateData, 
				playerName, 
				streakType: "longest_no_goal_involvement", 
				streakCount: longestStreak,
				streakSequence: streakSequence,
				streakStartDate: streakStartDate,
				streakEndDate: streakEndDate,
				highlightRange: highlightRange
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			loggingService.log(`❌ Error in longest no goal involvement streak query: ${errorMessage}`, error, "error");
			return { type: "error", data: [], error: `Error querying longest no goal involvement streak data: ${errorMessage}` };
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

	/**
	 * Query most consecutive games played across all players
	 * Returns top 10 players with longest consecutive game streaks
	 */
	static async queryMostConsecutiveGamesPlayed(): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying most consecutive games played across all players`, null, "log");

		const graphLabel = neo4jService.getGraphLabel();

		// Query all players with their seasonWeek values (same approach as consecutive weekends)
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, allowOnSite: true})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.minutes > 0 AND md.seasonWeek IS NOT NULL AND md.seasonWeek <> ""
			WITH p, collect(DISTINCT md.seasonWeek) as seasonWeeks
			WHERE size(seasonWeeks) > 0
			RETURN p.playerName as playerName, seasonWeeks
			ORDER BY p.playerName
		`;

		try {
			const result = await neo4jService.executeQuery(query, { graphLabel });
			
			if (!result || result.length === 0) {
				loggingService.log(`⚠️ No players with games found`, null, "warn");
				return { 
					type: "most_consecutive_games", 
					data: [],
					top5Data: []
				};
			}

			// Calculate consecutive streak for each player using seasonWeek (same logic as consecutive weekends)
			const playerStreaks: Array<{ playerName: string; streakCount: number }> = [];

			for (const record of result) {
				const playerName = record?.playerName;
				const seasonWeeks = (record?.seasonWeeks || []) as string[];

				if (!playerName || seasonWeeks.length === 0) {
					continue;
				}

				// Filter out null/empty seasonWeeks
				const validSeasonWeeks = seasonWeeks.filter((sw: string | null | undefined) => sw !== null && sw !== undefined && sw !== "");

				if (validSeasonWeeks.length === 0) {
					continue;
				}

				// Use the same calculateConsecutiveWeeks logic as consecutive weekends
				const streakResult = TemporalQueryHandler.calculateConsecutiveWeeks(validSeasonWeeks);
				const longestStreak = streakResult.count;

				playerStreaks.push({
					playerName,
					streakCount: longestStreak
				});
			}

			// Sort by streak count descending
			playerStreaks.sort((a, b) => b.streakCount - a.streakCount);

			// Get top 10
			const top10 = playerStreaks.slice(0, 10);
			const top5 = playerStreaks.slice(0, 5);

			loggingService.log(`✅ Calculated consecutive games streaks for ${playerStreaks.length} players`, null, "log");
			if (top10.length > 0) {
				loggingService.log(`📊 Top player: ${top10[0].playerName} with ${top10[0].streakCount} consecutive games`, null, "log");
			}

			return {
				type: "most_consecutive_games",
				data: top10,
				top5Data: top5
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			loggingService.log(`❌ Error in most consecutive games query: ${errorMessage}`, error, "error");
			return { 
				type: "error", 
				data: [], 
				error: `Error querying most consecutive games data: ${errorMessage}` 
			};
		}
	}

	/**
	 * Query monthly goal involvements for a player
	 * Returns goal involvements (goals + assists + penaltiesScored) grouped by month
	 */
	static async queryMonthlyGoalInvolvements(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying monthly goal involvements for player: ${playerName}`, null, "log");

		const graphLabel = neo4jService.getGraphLabel();
		const params: Record<string, unknown> = {
			playerName,
			graphLabel
		};

		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WITH md,
			     CASE 
			       WHEN toString(md.date) CONTAINS 'T' THEN substring(toString(md.date), 0, size(toString(md.date)) - size(split(toString(md.date), 'T')[1]) - 1)
			       ELSE toString(md.date)
			     END as dateOnly
			WITH md, dateOnly,
			     CASE 
			       WHEN dateOnly CONTAINS '-' THEN split(dateOnly, '-')[1]
			       WHEN dateOnly CONTAINS '/' THEN split(dateOnly, '/')[1]
			       ELSE ''
			     END as monthNum
			WHERE monthNum IS NOT NULL AND monthNum <> ''
			WITH md, monthNum,
			     CASE 
			       WHEN monthNum = '01' THEN 'January'
			       WHEN monthNum = '02' THEN 'February'
			       WHEN monthNum = '03' THEN 'March'
			       WHEN monthNum = '04' THEN 'April'
			       WHEN monthNum = '05' THEN 'May'
			       WHEN monthNum = '06' THEN 'June'
			       WHEN monthNum = '07' THEN 'July'
			       WHEN monthNum = '08' THEN 'August'
			       WHEN monthNum = '09' THEN 'September'
			       WHEN monthNum = '10' THEN 'October'
			       WHEN monthNum = '11' THEN 'November'
			       WHEN monthNum = '12' THEN 'December'
			       ELSE 'Unknown'
			     END as monthName
			WHERE monthName <> 'Unknown'
			WITH monthName,
			     sum(coalesce(md.goals, 0) + coalesce(md.assists, 0) + coalesce(md.penaltiesScored, 0)) as goalInvolvements
			RETURN monthName, goalInvolvements
			ORDER BY 
				CASE monthName
					WHEN 'January' THEN 1
					WHEN 'February' THEN 2
					WHEN 'March' THEN 3
					WHEN 'April' THEN 4
					WHEN 'May' THEN 5
					WHEN 'June' THEN 6
					WHEN 'July' THEN 7
					WHEN 'August' THEN 8
					WHEN 'September' THEN 9
					WHEN 'October' THEN 10
					WHEN 'November' THEN 11
					WHEN 'December' THEN 12
					ELSE 13
				END ASC
		`;

		try {
			const result = await neo4jService.executeQuery(query, params);
			
			if (!result || result.length === 0) {
				return {
					type: "monthly_goal_involvements",
					data: [],
					playerName
				};
			}

			return {
				type: "monthly_goal_involvements",
				data: result,
				playerName
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			loggingService.log(`❌ Error in monthly goal involvements query: ${errorMessage}`, error, "error");
			return { 
				type: "error", 
				data: [], 
				error: `Error querying monthly goal involvements: ${errorMessage}` 
			};
		}
	}
}
