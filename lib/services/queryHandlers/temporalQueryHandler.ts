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
