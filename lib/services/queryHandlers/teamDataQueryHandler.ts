import type { EnhancedQuestionAnalysis } from "../../config/enhancedQuestionAnalysis";
import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { TeamMappingUtils } from "../chatbotUtils/teamMappingUtils";
import { DateUtils } from "../chatbotUtils/dateUtils";
import { loggingService } from "../loggingService";
import { ChatbotService } from "../chatbotService";

export class TeamDataQueryHandler {
	/**
	 * Query team data based on entities, metrics, and analysis
	 */
	static async queryTeamData(entities: string[], metrics: string[], analysis: EnhancedQuestionAnalysis): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 queryTeamData called with entities: ${entities}, metrics: ${metrics}`, null, "log");

		const question = analysis.question?.toLowerCase() || "";
		const teamEntities = analysis.teamEntities || [];
		const extractedMetrics = metrics || [];
		
		// Extract team name from entities or question
		let teamName = "";
		if (teamEntities.length > 0) {
			teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
		} else if (entities.length > 0) {
			teamName = TeamMappingUtils.mapTeamName(entities[0]);
		} else {
			const teamMatch = question.match(/(\d+)(?:st|nd|rd|th)?\s*(?:team|s|xi)/i);
			if (teamMatch) {
				const teamNum = teamMatch[1];
				teamName = TeamMappingUtils.mapTeamName(`${teamNum}s`);
			}
		}

		if (!teamName) {
			loggingService.log(`⚠️ No team name found in queryTeamData`, null, "warn");
			return { type: "team_not_found", data: [], message: "Could not identify team from question" };
		}

		// Map metric keys to MatchDetail field names
		const metricToFieldMap: { [key: string]: string } = {
			"G": "goals",
			"A": "assists",
			"R": "redCards",
			"Y": "yellowCards",
			"APP": "appearances",
			"MOM": "mom",
			"SAVES": "saves",
			"CLS": "cleanSheets",
			"OG": "ownGoals",
			"C": "conceded",
			"MIN": "minutes",
			"PSC": "penaltiesScored",
			"PM": "penaltiesMissed",
			"PCO": "penaltiesConceded",
			"PSV": "penaltiesSaved",
		};

		// Find the primary metric from question text keywords FIRST (most reliable)
		let detectedMetric: string | null = null;
		let metricField: string | null = null;
		
		const questionLower = question.toLowerCase();
		if (questionLower.includes("red card") || questionLower.includes("reds")) {
			detectedMetric = "R";
			metricField = "redCards";
			loggingService.log(`✅ Detected metric from question text: R (redCards)`, null, "log");
		} else if (questionLower.includes("yellow card") || questionLower.includes("booking") || questionLower.includes("yellows")) {
			detectedMetric = "Y";
			metricField = "yellowCards";
			loggingService.log(`✅ Detected metric from question text: Y (yellowCards)`, null, "log");
		} else if (questionLower.includes("assist")) {
			detectedMetric = "A";
			metricField = "assists";
			loggingService.log(`✅ Detected metric from question text: A (assists)`, null, "log");
		} else if (questionLower.includes("clean sheet")) {
			detectedMetric = "CLS";
			metricField = "cleanSheets";
			loggingService.log(`✅ Detected metric from question text: CLS (cleanSheets)`, null, "log");
		} else if (questionLower.includes("save")) {
			detectedMetric = "SAVES";
			metricField = "saves";
			loggingService.log(`✅ Detected metric from question text: SAVES (saves)`, null, "log");
		} else if (questionLower.includes("man of the match") || questionLower.includes("mom")) {
			detectedMetric = "MOM";
			metricField = "mom";
			loggingService.log(`✅ Detected metric from question text: MOM (mom)`, null, "log");
		} else if (questionLower.includes("appearance") || questionLower.includes("app") || questionLower.includes("game")) {
			detectedMetric = "APP";
			metricField = "appearances";
			loggingService.log(`✅ Detected metric from question text: APP (appearances)`, null, "log");
		}
		
		// If no metric found from question text, check extracted metrics
		if (!detectedMetric && extractedMetrics.length > 0) {
			const primaryMetric = extractedMetrics[0].toUpperCase();
			if (metricToFieldMap[primaryMetric]) {
				detectedMetric = primaryMetric;
				metricField = metricToFieldMap[primaryMetric];
				loggingService.log(`✅ Detected metric from extracted metrics: ${detectedMetric} (${metricField})`, null, "log");
			}
		}
		
		const isGoalsConceded = !detectedMetric && question.includes("conceded");
		const isOpenPlayGoals = question.includes("open play") || 
		                        question.includes("openplay") ||
		                        extractedMetrics.some(m => m.toUpperCase() === "OPENPLAYGOALS" || m.toUpperCase() === "OPENPLAY");
		// Check for goals scored - include both "scored" (past tense) and "score" (infinitive/present) to handle normalized colloquial terms
		// Also check if detectedMetric is "G" (goals) - this indicates a goals query even if detectedMetric is set
		const hasGoalsInQuestion = question.includes("scored") || question.includes("score") || question.includes("goals");
		const isGoalsScored = (!detectedMetric || detectedMetric === "G") && hasGoalsInQuestion && !isGoalsConceded;
		
		// Check if this is a team goals query (team goals, not player goals)
		// This happens when asking "How many goals did the 2nd team score during the 2017/18 season?"
		const isTeamGoalsQuery = isGoalsScored && !question.includes("player") && !question.includes("for");

		// Extract season and date range filters
		const timeRange = analysis.timeRange;
		const timeFrames = analysis.extractionResult?.timeFrames || [];
		
		// Check for "last season" in question (handle typo "least season" as well)
		const isLastSeasonQuery = question.includes("last season") || question.includes("least season");
		
		// Extract season from timeFrames or question
		let season: string | null = null;
		const seasonFrame = timeFrames.find(tf => tf.type === "season");
		// If seasonFrame exists but value is just "season" (literal), treat as unresolved and try to resolve "last season"
		if (seasonFrame && seasonFrame.value && seasonFrame.value.toLowerCase() !== "season") {
			season = seasonFrame.value;
			season = season.replace("-", "/");
		} else if (isLastSeasonQuery || (seasonFrame && seasonFrame.value && seasonFrame.value.toLowerCase() === "season")) {
			// Query database to get current season and calculate last season
			const graphLabel = neo4jService.getGraphLabel();
			try {
				const currentSeasonQuery = `
					MATCH (sd:SiteDetail {graphLabel: $graphLabel})
					RETURN sd.currentSeason as currentSeason
					LIMIT 1
				`;
				const seasonResult = await neo4jService.executeQuery(currentSeasonQuery, { graphLabel });
				if (seasonResult && seasonResult.length > 0 && seasonResult[0].currentSeason) {
					const currentSeason = seasonResult[0].currentSeason;
					// Calculate last season (previous season)
					// Format is YYYY/YY, e.g., 2024/25 -> 2023/24
					const seasonMatch = currentSeason.match(/(\d{4})\/(\d{2})/);
					if (seasonMatch) {
						const startYear = parseInt(seasonMatch[1], 10);
						const endYearShort = parseInt(seasonMatch[2], 10);
						// Last season is one year before
						const lastStartYear = startYear - 1;
						const lastEndYearShort = endYearShort - 1;
						// Handle year rollover (e.g., 2024/25 -> 2023/24, not 2023/24)
						season = `${lastStartYear}/${String(lastEndYearShort).padStart(2, '0')}`;
						loggingService.log(`🔍 Resolved "last season" to: ${season} (current: ${currentSeason})`, null, "log");
					} else {
						// Fallback: try to get most recent season from fixtures
						const recentSeasonQuery = `
							MATCH (f:Fixture {graphLabel: $graphLabel})
							WHERE f.season IS NOT NULL AND f.season <> ''
							WITH DISTINCT f.season as season
							ORDER BY f.season DESC
							LIMIT 2
							RETURN collect(season) as seasons
						`;
						const recentResult = await neo4jService.executeQuery(recentSeasonQuery, { graphLabel });
						if (recentResult && recentResult.length > 0 && recentResult[0].seasons && recentResult[0].seasons.length >= 2) {
							// Second most recent season is "last season"
							season = recentResult[0].seasons[1];
							loggingService.log(`🔍 Resolved "last season" from fixtures: ${season}`, null, "log");
						}
					}
				}
			} catch (error) {
				loggingService.log(`⚠️ Error resolving last season:`, error, "warn");
			}
		} else {
			const seasonMatch = question.match(/(\d{4})[\/\-](\d{2})/);
			if (seasonMatch) {
				season = `${seasonMatch[1]}/${seasonMatch[2]}`;
			}
		}
		
		// Extract date range from timeRange or question
		let startDate: string | null = null;
		let endDate: string | null = null;
		
		if (timeRange && timeRange.includes(" to ")) {
			const dateRange = timeRange.split(" to ");
			if (dateRange.length === 2) {
				startDate = DateUtils.convertDateFormat(dateRange[0].trim());
				endDate = DateUtils.convertDateFormat(dateRange[1].trim());
			}
		}
		
		if (!startDate || !endDate) {
			const betweenDateMatch = question.match(/between\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+and\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
			if (betweenDateMatch) {
				startDate = DateUtils.convertDateFormat(betweenDateMatch[1]);
				endDate = DateUtils.convertDateFormat(betweenDateMatch[2]);
			} else {
				const betweenYearMatch = question.match(/between\s+(\d{4})\s+and\s+(\d{4})/i);
				if (betweenYearMatch) {
					const startYear = parseInt(betweenYearMatch[1], 10);
					const endYear = parseInt(betweenYearMatch[2], 10);
					startDate = `${startYear}-01-01`;
					endDate = `${endYear}-12-31`;
				}
			}
		}
		
		if (!startDate || !endDate) {
			const rangeFrame = timeFrames.find(tf => tf.type === "range");
			if (rangeFrame && rangeFrame.value.includes(" to ")) {
				const dateRange = rangeFrame.value.split(" to ");
				if (dateRange.length === 2) {
					const startYearMatch = dateRange[0].trim().match(/^(\d{4})$/);
					const endYearMatch = dateRange[1].trim().match(/^(\d{4})$/);
					if (startYearMatch && endYearMatch) {
						const startYear = parseInt(startYearMatch[1], 10);
						const endYear = parseInt(endYearMatch[1], 10);
						startDate = `${startYear}-01-01`;
						endDate = `${endYear}-12-31`;
					} else {
						startDate = DateUtils.convertDateFormat(dateRange[0].trim());
						endDate = DateUtils.convertDateFormat(dateRange[1].trim());
					}
				}
			}
		}

		const graphLabel = neo4jService.getGraphLabel();
		const params: any = {
			graphLabel,
			teamName,
		};
		
		// Build WHERE conditions for filters
		const whereConditions: string[] = [`f.team = $teamName`];
		
		// Add season filter
		if (season) {
			params.season = season;
			const normalizedSeason = season.replace("/", "-");
			params.normalizedSeason = normalizedSeason;
			whereConditions.push(`(f.season = $season OR f.season = $normalizedSeason)`);
		}
		
		// Add date range filter
		if (startDate && endDate) {
			params.startDate = startDate;
			params.endDate = endDate;
			whereConditions.push(`f.date >= $startDate AND f.date <= $endDate`);
		}

		// Check for win rate queries
		const isWinRateQuery = question.includes("win rate") || question.includes("win percentage");
		
		if (isWinRateQuery) {
			const winRateQuery = `
				MATCH (f:Fixture {graphLabel: $graphLabel})
				WHERE ${whereConditions.join(" AND ")}
				WITH count(DISTINCT f) as totalGames,
				     sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) as wins,
				     sum(CASE WHEN f.result = 'D' THEN 1 ELSE 0 END) as draws,
				     sum(CASE WHEN f.result = 'L' THEN 1 ELSE 0 END) as losses
				RETURN totalGames, wins, draws, losses,
				       CASE WHEN totalGames > 0 THEN round(100.0 * wins / totalGames * 100) / 100.0 ELSE 0.0 END as winRate
			`;

			try {
				const result = await neo4jService.executeQuery(winRateQuery, params);
				if (result && result.length > 0) {
					const stats = result[0];
					return {
						type: "team_win_rate",
						teamName,
						totalGames: stats.totalGames || 0,
						wins: stats.wins || 0,
						draws: stats.draws || 0,
						losses: stats.losses || 0,
						winRate: stats.winRate || 0.0,
						season: season || undefined,
						startDate: startDate || undefined,
						endDate: endDate || undefined,
					};
				}
			} catch (error) {
				loggingService.log(`❌ Error in win rate query:`, error, "error");
			}
		}

		// Build query based on what metric is being asked about
		// Priority: Team goals query with season takes precedence over detectedMetric branch
		let query = "";
		if (isTeamGoalsQuery && season) {
			// Team goals query for a specific season - query Fixture nodes directly
			query = `
				MATCH (f:Fixture {graphLabel: $graphLabel, team: $teamName})
				WHERE (f.season = $season OR f.season = $normalizedSeason)
				  AND (f.status IS NULL OR NOT (f.status IN ['Void', 'Postponed', 'Abandoned']))
				RETURN 
					coalesce(sum(f.dorkiniansGoals), 0) as goalsScored,
					count(f) as gamesPlayed
			`;
		} else if (detectedMetric && metricField) {
			if (metricField === "appearances") {
				query = `
					MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md:MatchDetail {graphLabel: $graphLabel})
					WHERE ${whereConditions.join(" AND ")} AND md.team = $teamName
					RETURN 
						count(md) as value,
						count(DISTINCT f) as gamesPlayed
				`;
			} else {
				query = `
					MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md:MatchDetail {graphLabel: $graphLabel})
					WHERE ${whereConditions.join(" AND ")} AND md.team = $teamName
					RETURN 
						coalesce(sum(md.${metricField}), 0) as value,
						count(DISTINCT f) as gamesPlayed
				`;
			}
		} else {
			query = `
				MATCH (f:Fixture {graphLabel: $graphLabel})
				WHERE ${whereConditions.join(" AND ")}
				RETURN 
					coalesce(sum(f.dorkiniansGoals), 0) as goalsScored,
					coalesce(sum(f.conceded), 0) as goalsConceded,
					count(f) as gamesPlayed
			`;
		}

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			let readyToExecuteQuery = query;
			// Replace parameters with actual values
			Object.keys(params).forEach(key => {
				const value = params[key];
				const replacement = typeof value === 'string' ? `'${value}'` : String(value);
				readyToExecuteQuery = readyToExecuteQuery.replace(new RegExp(`\\$${key}`, 'g'), replacement);
			});
			chatbotService.lastExecutedQueries.push(`TEAM_DATA_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`TEAM_DATA_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, params);
			loggingService.log(`🔍 Team data query result:`, result, "log");

			if (result && result.length > 0) {
				const teamStats = result[0];
				// Priority: Team goals query with season takes precedence over detectedMetric branch
				if (isTeamGoalsQuery && season) {
					// Return team goals for specific season
					return {
						type: "team_stats",
						teamName,
						goalsScored: teamStats.goalsScored || 0,
						gamesPlayed: teamStats.gamesPlayed || 0,
						isGoalsScored: true,
						isOpenPlayGoals: false, // Team goals are always total goals, not just open play
						season: season,
						isLastSeason: isLastSeasonQuery, // Flag to indicate "last season" query for response generation
					};
				} else if (detectedMetric && metricField) {
					return {
						type: "team_stats",
						teamName,
						value: teamStats.value || 0,
						gamesPlayed: teamStats.gamesPlayed || 0,
						metric: detectedMetric,
						metricField: metricField,
						season: season || undefined,
						startDate: startDate || undefined,
						endDate: endDate || undefined,
					};
				} else {
					return {
						type: "team_stats",
						teamName,
						goalsScored: teamStats.goalsScored || 0,
						goalsConceded: teamStats.goalsConceded || 0,
						gamesPlayed: teamStats.gamesPlayed || 0,
						isGoalsScored,
						isGoalsConceded,
						isOpenPlayGoals,
					};
				}
			}

			if (isTeamGoalsQuery && season) {
				return { 
					type: "team_stats", 
					teamName, 
					goalsScored: 0, 
					gamesPlayed: 0, 
					isGoalsScored: true,
					isOpenPlayGoals: false, // Team goals are always total goals, not just open play
					season: season,
					isLastSeason: isLastSeasonQuery, // Flag to indicate "last season" query for response generation
				};
			} else if (detectedMetric && metricField) {
				return { 
					type: "team_stats", 
					teamName, 
					value: 0, 
					gamesPlayed: 0, 
					metric: detectedMetric, 
					metricField: metricField,
					season: season || undefined,
					startDate: startDate || undefined,
					endDate: endDate || undefined,
				};
			} else if (isTeamGoalsQuery && season) {
				return { 
					type: "team_stats", 
					teamName, 
					goalsScored: 0, 
					gamesPlayed: 0, 
					isGoalsScored: true,
					isOpenPlayGoals: false, // Team goals are always total goals, not just open play
					season: season,
					isLastSeason: isLastSeasonQuery, // Flag to indicate "last season" query for response generation
				};
			} else {
				return { type: "team_stats", teamName, goalsScored: 0, goalsConceded: 0, gamesPlayed: 0, isGoalsScored, isGoalsConceded, isOpenPlayGoals };
			}
		} catch (error) {
			loggingService.log(`❌ Error in queryTeamData:`, error, "error");
			return { type: "error", data: [], error: "Error querying team data" };
		}
	}

	/**
	 * Query longest unbeaten/winning run for a team within a date range
	 * @param includeDraws - If true, streak includes wins and draws (unbeaten run). If false, streak includes only wins (winning run).
	 */
	static async queryLongestUnbeatenRun(entities: string[], metrics: string[], analysis: EnhancedQuestionAnalysis, includeDraws: boolean = true): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 queryLongestUnbeatenRun called with entities: ${entities}`, null, "log");

		const question = analysis.question?.toLowerCase() || "";
		const teamEntities = analysis.teamEntities || [];
		
		// Extract team name from entities or question
		let teamName = "";
		if (teamEntities.length > 0) {
			teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
		} else if (entities.length > 0) {
			teamName = TeamMappingUtils.mapTeamName(entities[0]);
		} else {
			const teamMatch = question.match(/(\d+)(?:st|nd|rd|th)?\s*(?:team|s|xi)/i);
			if (teamMatch) {
				const teamNum = teamMatch[1];
				teamName = TeamMappingUtils.mapTeamName(`${teamNum}s`);
			}
		}

		if (!teamName) {
			loggingService.log(`⚠️ No team name found in queryLongestUnbeatenRun`, null, "warn");
			return { type: "team_not_found", data: [], message: "Could not identify team from question" };
		}

		// Extract date range from timeFrames or question
		const timeFrames = analysis.extractionResult?.timeFrames || [];
		let startDate: string | null = null;
		let endDate: string | null = null;

		// Try to extract date range from timeFrames
		const rangeFrame = timeFrames.find(tf => tf.type === "range");
		if (rangeFrame && rangeFrame.value.includes(" to ")) {
			const dateRange = rangeFrame.value.split(" to ");
			if (dateRange.length === 2) {
				const startYearMatch = dateRange[0].trim().match(/^(\d{4})$/);
				const endYearMatch = dateRange[1].trim().match(/^(\d{4})$/);
				if (startYearMatch && endYearMatch) {
					const startYear = parseInt(startYearMatch[1], 10);
					const endYear = parseInt(endYearMatch[1], 10);
					startDate = `${startYear}-01-01`;
					endDate = `${endYear}-12-31`;
				}
			}
		}

		// If no date range from timeFrames, try to extract from question
		if (!startDate || !endDate) {
			const betweenYearMatch = question.match(/between\s+(\d{4})\s+and\s+(\d{4})/i);
			if (betweenYearMatch) {
				const startYear = parseInt(betweenYearMatch[1], 10);
				const endYear = parseInt(betweenYearMatch[2], 10);
				startDate = `${startYear}-01-01`;
				endDate = `${endYear}-12-31`;
			}
		}

		if (!startDate || !endDate) {
			loggingService.log(`⚠️ No date range found in queryLongestUnbeatenRun`, null, "warn");
			return { type: "error", data: [], error: "Could not identify date range from question" };
		}

		const graphLabel = neo4jService.getGraphLabel();
		
		// Query all fixtures for the team within date range, ordered chronologically
		const query = `
			MATCH (f:Fixture {graphLabel: $graphLabel})
			WHERE f.team = $teamName 
			  AND f.date >= $startDate 
			  AND f.date <= $endDate
			  AND (f.status IS NULL OR NOT (f.status IN ['Void', 'Postponed', 'Abandoned']))
			WITH f
			ORDER BY f.date ASC
			RETURN f.date as date, f.result as result
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$teamName/g, `'${teamName}'`)
				.replace(/\$startDate/g, `'${startDate}'`)
				.replace(/\$endDate/g, `'${endDate}'`);
			chatbotService.lastExecutedQueries.push(`UNBEATEN_RUN_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`UNBEATEN_RUN_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, {
				graphLabel,
				teamName,
				startDate,
				endDate
			});

			if (!result || result.length === 0) {
				return {
					type: "longest_unbeaten_run",
					teamName,
					count: 0,
					startDate,
					endDate
				};
			}

			// Process results to find longest consecutive sequence
			// If includeDraws is true, streak includes wins and draws (unbeaten run)
			// If includeDraws is false, streak includes only wins (winning run)
			let longestRun = 0;
			let currentRun = 0;
			let longestRunStartDate: string | null = null;
			let longestRunEndDate: string | null = null;
			let currentRunStartDate: string | null = null;

			for (const fixture of result) {
				const date = fixture.date as string;
				const resultValue = fixture.result as string;

				// Check if this result continues the streak
				const continuesStreak = resultValue === 'W' || (includeDraws && resultValue === 'D');

				if (continuesStreak) {
					// Win (or draw if includeDraws is true) - continue or start streak
					if (currentRun === 0) {
						// Starting a new streak
						currentRun = 1;
						currentRunStartDate = date;
					} else {
						// Continuing streak
						currentRun++;
					}

					// Update longest run if current is longer
					if (currentRun > longestRun) {
						longestRun = currentRun;
						longestRunStartDate = currentRunStartDate;
						longestRunEndDate = date;
					}
				} else {
					// Loss (or draw if includeDraws is false) - streak breaks
					currentRun = 0;
					currentRunStartDate = null;
				}
			}

			loggingService.log(`✅ Found longest unbeaten run: ${longestRun} games for ${teamName}`, null, "log");

			return {
				type: "longest_unbeaten_run",
				teamName,
				count: longestRun,
				startDate: longestRunStartDate,
				endDate: longestRunEndDate,
				includeDraws,
				dateRange: {
					start: startDate,
					end: endDate
				}
			};
		} catch (error) {
			loggingService.log(`❌ Error in queryLongestUnbeatenRun:`, error, "error");
			return { type: "error", data: [], error: "Error querying longest unbeaten run data" };
		}
	}

	/**
	 * Query longest unbeaten/winning run for all teams in a given year
	 * Returns the team with the longest streak and calendar data
	 * @param includeDraws - If true, streak includes wins and draws (unbeaten run). If false, streak includes only wins (winning run).
	 */
	static async queryLongestUnbeatenRunAllTeams(entities: string[], metrics: string[], analysis: EnhancedQuestionAnalysis, includeDraws: boolean = true): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 queryLongestUnbeatenRunAllTeams called with entities: ${entities}`, null, "log");

		const question = analysis.question?.toLowerCase() || "";
		
		// Extract year from question (e.g., "in 2022")
		let year: number | null = null;
		const yearMatch = question.match(/\b(20\d{2})\b/);
		if (yearMatch) {
			year = parseInt(yearMatch[1], 10);
		}

		// Also try to extract from timeFrames
		if (!year) {
			const timeFrames = analysis.extractionResult?.timeFrames || [];
			const yearFrame = timeFrames.find(tf => tf.type === "year");
			if (yearFrame) {
				const yearMatch2 = yearFrame.value.match(/\b(20\d{2})\b/);
				if (yearMatch2) {
					year = parseInt(yearMatch2[1], 10);
				}
			}
		}

		if (!year) {
			loggingService.log(`⚠️ No year found in queryLongestUnbeatenRunAllTeams`, null, "warn");
			return { type: "error", data: [], error: "Could not identify year from question" };
		}

		const startDate = `${year}-01-01`;
		const endDate = `${year}-12-31`;

		const graphLabel = neo4jService.getGraphLabel();

		// First, get all distinct teams that played in this year
		const getAllTeamsQuery = `
			MATCH (f:Fixture {graphLabel: $graphLabel})
			WHERE f.date >= $startDate 
			  AND f.date <= $endDate
			  AND (f.status IS NULL OR NOT (f.status IN ['Void', 'Postponed', 'Abandoned']))
			  AND f.team IS NOT NULL
			RETURN DISTINCT f.team as team
			ORDER BY f.team ASC
		`;

		try {
			const teamsResult = await neo4jService.executeQuery(getAllTeamsQuery, {
				graphLabel,
				startDate,
				endDate
			});

			if (!teamsResult || teamsResult.length === 0) {
				return {
					type: "longest_unbeaten_run_all_teams",
					teamName: "",
					count: 0,
					year,
					startDate,
					endDate
				};
			}

			const teams = (teamsResult || []).map((r: { team: string }) => r.team);

			// For each team, calculate longest winning streak
			let longestStreakTeam = "";
			let longestStreak = 0;
			let longestStreakStartDate: string | null = null;
			let longestStreakEndDate: string | null = null;
			let longestStreakTeamData: Array<{ date: string; result: string }> = [];

			for (const teamName of teams) {
				// Query all fixtures for this team in the year
				const teamFixturesQuery = `
					MATCH (f:Fixture {graphLabel: $graphLabel})
					WHERE f.team = $teamName 
					  AND f.date >= $startDate 
					  AND f.date <= $endDate
					  AND (f.status IS NULL OR NOT (f.status IN ['Void', 'Postponed', 'Abandoned']))
					WITH f
					ORDER BY f.date ASC
					RETURN f.date as date, f.result as result
				`;

				const teamFixtures = await neo4jService.executeQuery(teamFixturesQuery, {
					graphLabel,
					teamName,
					startDate,
					endDate
				});

				if (!teamFixtures || teamFixtures.length === 0) {
					continue;
				}

				// Calculate longest consecutive streak (allowing gaps between fixtures)
				// If includeDraws is true, streak includes wins and draws (unbeaten run)
				// If includeDraws is false, streak includes only wins (winning run)
				let currentStreak = 0;
				let longestStreakForTeam = 0;
				let currentStreakStartDate: string | null = null;
				let longestStreakStartDateForTeam: string | null = null;
				let longestStreakEndDateForTeam: string | null = null;
				const streakFixtures: Array<{ date: string; result: string }> = [];
				let currentStreakFixtures: Array<{ date: string; result: string }> = [];

				for (const fixture of teamFixtures) {
					const date = fixture.date as string;
					const resultValue = fixture.result as string;

					// Check if this result continues the streak
					const continuesStreak = resultValue === 'W' || (includeDraws && resultValue === 'D');

					if (continuesStreak) {
						// Win (or draw if includeDraws is true) - continue or start streak
						if (currentStreak === 0) {
							// Starting a new streak
							currentStreak = 1;
							currentStreakStartDate = date;
							currentStreakFixtures = [{ date, result: resultValue }];
						} else {
							// Continuing streak
							currentStreak++;
							currentStreakFixtures.push({ date, result: resultValue });
						}

						// Update longest streak if current is longer
						if (currentStreak > longestStreakForTeam) {
							longestStreakForTeam = currentStreak;
							longestStreakStartDateForTeam = currentStreakStartDate;
							longestStreakEndDateForTeam = date;
							streakFixtures.length = 0;
							streakFixtures.push(...currentStreakFixtures);
						}
					} else {
						// Loss (or draw if includeDraws is false) - streak breaks
						currentStreak = 0;
						currentStreakStartDate = null;
						currentStreakFixtures = [];
					}
				}

				// Update overall longest streak if this team's streak is longer
				if (longestStreakForTeam > longestStreak) {
					longestStreak = longestStreakForTeam;
					longestStreakTeam = teamName;
					longestStreakStartDate = longestStreakStartDateForTeam;
					longestStreakEndDate = longestStreakEndDateForTeam;
					longestStreakTeamData = streakFixtures;
				}
			}

			if (longestStreak === 0 || !longestStreakTeam) {
				return {
					type: "longest_unbeaten_run_all_teams",
					teamName: "",
					count: 0,
					year,
					startDate,
					endDate
				};
			}

			// Get the latest fixture date from the database to determine the full date range
			const latestDateQuery = `
				MATCH (f:Fixture {graphLabel: $graphLabel})
				WHERE f.date IS NOT NULL
				  AND (f.status IS NULL OR NOT (f.status IN ['Void', 'Postponed', 'Abandoned']))
				RETURN max(f.date) as latestDate
			`;

			const latestDateResult = await neo4jService.executeQuery(latestDateQuery, {
				graphLabel
			});

			// Determine the full date range for calendar display
			const fullStartDate = "2016-01-01";
			let fullEndDate = "2025-12-31"; // Default fallback
			
			if (latestDateResult && latestDateResult.length > 0 && latestDateResult[0].latestDate) {
				const latestDate = latestDateResult[0].latestDate as string;
				// Format the date to YYYY-MM-DD if needed
				if (typeof latestDate === 'string') {
					fullEndDate = latestDate.split('T')[0]; // Handle ISO date strings
				} else {
					// If it's a Date object or other format, convert it
					const date = new Date(latestDate);
					if (!isNaN(date.getTime())) {
						fullEndDate = date.toISOString().split('T')[0];
					}
				}
			}

			// Get all fixtures for the winning team across the full date range for calendar display
			const allTeamFixturesQuery = `
				MATCH (f:Fixture {graphLabel: $graphLabel})
				WHERE f.team = $teamName 
				  AND f.date >= $fullStartDate 
				  AND f.date <= $fullEndDate
				  AND (f.status IS NULL OR NOT (f.status IN ['Void', 'Postponed', 'Abandoned']))
				WITH f
				ORDER BY f.date ASC
				RETURN f.date as date, f.result as result, f.dorkiniansGoals as dorkiniansGoals, f.conceded as conceded
			`;

			const allTeamFixtures = await neo4jService.executeQuery(allTeamFixturesQuery, {
				graphLabel,
				teamName: longestStreakTeam,
				fullStartDate,
				fullEndDate
			});

			// Create fixture results map (date -> result) and fixture scorelines map (date -> scoreline)
			const fixtureResults: Record<string, string> = {};
			const fixtureScorelines: Record<string, string> = {};
			const allFixtureDates: string[] = [];
			(allTeamFixtures || []).forEach((fixture: { date: string; result: string; dorkiniansGoals: number | null; conceded: number | null }) => {
				const date = fixture.date as string;
				const result = fixture.result as string;
				const dorkiniansGoals = fixture.dorkiniansGoals ?? 0;
				const conceded = fixture.conceded ?? 0;
				
				fixtureResults[date] = result;
				
				// Create scoreline format: "W 3-1" (result + dorkiniansGoals-conceded)
				if (dorkiniansGoals !== null && conceded !== null) {
					fixtureScorelines[date] = `${result} ${dorkiniansGoals}-${conceded}`;
				} else {
					fixtureScorelines[date] = result;
				}
				
				allFixtureDates.push(date);
			});

			// Create streak dates array for highlighting
			const streakDates = longestStreakTeamData.map(f => f.date);

			loggingService.log(`✅ Found longest unbeaten run: ${longestStreak} games for ${longestStreakTeam} in ${year}`, null, "log");

			return {
				type: "longest_unbeaten_run_all_teams",
				teamName: longestStreakTeam,
				count: longestStreak,
				year,
				startDate: longestStreakStartDate,
				endDate: longestStreakEndDate,
				includeDraws,
				dateRange: {
					start: startDate,
					end: endDate
				},
				fullDateRange: {
					start: fullStartDate,
					end: fullEndDate
				},
				fixtureResults,
				fixtureScorelines,
				allFixtureDates,
				streakDates
			};
		} catch (error) {
			loggingService.log(`❌ Error in queryLongestUnbeatenRunAllTeams:`, error, "error");
			return { type: "error", data: [], error: "Error querying longest unbeaten run data for all teams" };
		}
	}
}
