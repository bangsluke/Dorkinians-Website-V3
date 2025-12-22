import type { EnhancedQuestionAnalysis } from "../../config/enhancedQuestionAnalysis";
import { loggingService } from "../loggingService";

export class LeagueTableQueryHandler {
	/**
	 * Query league table data
	 */
	static async queryLeagueTableData(
		entities: string[],
		_metrics: string[],
		analysis: EnhancedQuestionAnalysis,
	): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 queryLeagueTableData called with entities: ${entities}`, null, "log");

		try {
			// Extract team name and season from entities and question
			const question = analysis.question?.toLowerCase() || "";
			const teamEntities = analysis.teamEntities || [];
			
			// Check for team-specific highest/lowest position queries
			const isTeamHighestQuery = 
				teamEntities.length > 0 &&
				(question.includes("highest position") ||
				 question.includes("best position") ||
				 question.includes("best finish") ||
				 (question.includes("highest") && (question.includes("position") || question.includes("finish"))));
			
			const isTeamLowestQuery = 
				teamEntities.length > 0 &&
				(question.includes("lowest position") ||
				 question.includes("worst position") ||
				 question.includes("worst finish") ||
				 (question.includes("lowest") && (question.includes("position") || question.includes("finish"))));
			
			// Handle team-specific highest position query
			if (isTeamHighestQuery) {
				const teamName = teamEntities[0];
				const { getTeamHighestPosition } = await import("../leagueTableService");
				const result = await getTeamHighestPosition(teamName);
				
				if (!result) {
					return {
						type: "not_found",
						data: [],
						message: `I couldn't find any historical league position data for the ${teamName}.`,
					};
				}
				
				const positionSuffix = result.position.position === 1 ? "st" : result.position.position === 2 ? "nd" : result.position.position === 3 ? "rd" : "th";
				
				return {
					type: "league_table",
					data: [result.position],
					fullTable: result.fullTable,
					season: result.position.season,
					division: result.division,
					answer: `The ${teamName}'s highest league finish was ${result.position.position}${positionSuffix} position in ${result.position.season} (${result.division}). They finished with ${result.position.points} points from ${result.position.played} games (${result.position.won} wins, ${result.position.drawn} draws, ${result.position.lost} losses).`,
				};
			}
			
			// Handle team-specific lowest position query
			if (isTeamLowestQuery) {
				const teamName = teamEntities[0];
				const { getTeamLowestPosition } = await import("../leagueTableService");
				const result = await getTeamLowestPosition(teamName);
				
				if (!result) {
					return {
						type: "not_found",
						data: [],
						message: `I couldn't find any historical league position data for the ${teamName}.`,
					};
				}
				
				const positionSuffix = result.position.position === 1 ? "st" : result.position.position === 2 ? "nd" : result.position.position === 3 ? "rd" : "th";
				
				return {
					type: "league_table",
					data: [result.position],
					fullTable: result.fullTable,
					season: result.position.season,
					division: result.division,
					answer: `The ${teamName}'s lowest league finish was ${result.position.position}${positionSuffix} position in ${result.position.season} (${result.division}). They finished with ${result.position.points} points from ${result.position.played} games (${result.position.won} wins, ${result.position.drawn} draws, ${result.position.lost} losses).`,
				};
			}
			
			// Check for "highest league finish" queries (no team name required)
			const isHighestFinishQuery = 
				question.includes("highest league finish") ||
				question.includes("best league position") ||
				question.includes("best league finish") ||
				(question.includes("highest") && question.includes("league") && question.includes("finish")) ||
				(question.includes("my") && question.includes("highest") && (question.includes("finish") || question.includes("position")));
			
			if (isHighestFinishQuery) {
				const { getHighestLeagueFinish, getSeasonDataFromJSON, getCurrentSeasonDataFromNeo4j, normalizeSeasonFormat } = await import("../leagueTableService");
				const bestFinish = await getHighestLeagueFinish();
				
				if (!bestFinish) {
					return {
						type: "not_found",
						data: [],
						message: "I couldn't find any historical league position data.",
					};
				}
				
				// Get full league table for this season
				const normalizedSeason = normalizeSeasonFormat(bestFinish.season, 'hyphen');
				const seasonData = await getSeasonDataFromJSON(normalizedSeason);
				let fullTable = seasonData?.teams[bestFinish.team]?.table || [];
				
				// If not found in JSON, try current season from Neo4j
				if (fullTable.length === 0) {
					const currentSeasonData = await getCurrentSeasonDataFromNeo4j();
					if (currentSeasonData && normalizeSeasonFormat(currentSeasonData.season, 'slash') === normalizeSeasonFormat(bestFinish.season, 'slash')) {
						fullTable = currentSeasonData.teams[bestFinish.team]?.table || [];
					}
				}
				
				const positionSuffix = bestFinish.position === 1 ? "st" : bestFinish.position === 2 ? "nd" : bestFinish.position === 3 ? "rd" : "th";
				
				return {
					type: "league_table",
					data: [bestFinish],
					fullTable: fullTable,
					season: bestFinish.season,
					division: bestFinish.division,
					answer: `Your highest league finish was ${bestFinish.position}${positionSuffix} position with the ${bestFinish.team} in ${bestFinish.season} (${bestFinish.division}). They finished with ${bestFinish.points} points from ${bestFinish.played} games (${bestFinish.won} wins, ${bestFinish.drawn} draws, ${bestFinish.lost} losses).`,
				};
			}
			
			// Find team entity (1s, 2s, 3s, etc.)
			let teamName = "";
			if (teamEntities.length > 0) {
				teamName = teamEntities[0];
			} else {
				const teamMatch = question.match(/\b(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th)\b/);
				if (teamMatch) {
					const teamStr = teamMatch[1];
					if (teamStr.includes("st") || teamStr.includes("nd") || teamStr.includes("rd") || teamStr.includes("th")) {
						const num = teamStr.match(/\d+/)?.[0];
						if (num) {
							teamName = `${num}s`;
						}
					} else {
						teamName = teamStr;
					}
				}
			}

			// Check for "currently" or "current season" keywords
			const isCurrentSeasonQuery = 
				question.includes("currently") ||
				question.includes("current season") ||
				question.includes("current") && (question.includes("position") || question.includes("table"));

			// Extract season from question or timeRange
			let season = analysis.timeRange || "";
			if (!season && !isCurrentSeasonQuery) {
				const seasonMatch = question.match(/\b(20\d{2}[/-]20\d{2}|20\d{2}[/-]\d{2})\b/);
				if (seasonMatch) {
					season = seasonMatch[1].replace("-", "/");
				}
			}

			if (!teamName && !isHighestFinishQuery) {
				return {
					type: "no_team",
					data: [],
					message: "I need to know which team you're asking about. Please specify (e.g., 1s, 2s, 3s, etc.)",
				};
			}

			const { getTeamSeasonData, getCurrentSeasonDataFromNeo4j, normalizeSeasonFormat } = await import("../leagueTableService");
			
			// Normalize season format if present
			if (season) {
				season = normalizeSeasonFormat(season, 'slash');
			}

			// If season specified and not current season query, get that season's data
			if (season && !isCurrentSeasonQuery) {
				const normalizedSeason = normalizeSeasonFormat(season, 'slash');
				const teamData = await getTeamSeasonData(teamName, normalizedSeason);
				
				if (!teamData) {
					return {
						type: "not_found",
						data: [],
						message: `I couldn't find league table data for the ${teamName} in ${season}.`,
					};
				}

				const { getSeasonDataFromJSON } = await import("../leagueTableService");
				const seasonData = await getSeasonDataFromJSON(normalizedSeason);
				const fullTable = seasonData?.teams[teamName]?.table || [];

				const positionSuffix = teamData.position === 1 ? "st" : teamData.position === 2 ? "nd" : teamData.position === 3 ? "rd" : "th";
				const division = seasonData?.teams[teamName]?.division || "";
				
				return {
					type: "league_table",
					data: [teamData],
					fullTable: fullTable,
					season: normalizedSeason,
					division: division,
					answer: `The ${teamName} finished in ${teamData.position}${positionSuffix} position in the league in ${season}, with ${teamData.points} points from ${teamData.played} games (${teamData.won} wins, ${teamData.drawn} draws, ${teamData.lost} losses).`,
				};
			}

			// No season specified or current season query - get current season
			const currentSeasonData = await getCurrentSeasonDataFromNeo4j(teamName);
			if (!currentSeasonData || !currentSeasonData.teams[teamName]) {
				return {
					type: "not_found",
					data: [],
					message: `I couldn't find current season league table data for the ${teamName}.`,
				};
			}

			const teamData = currentSeasonData.teams[teamName];
			if (!teamData || !teamData.table) {
				return {
					type: "not_found",
					data: [],
					message: `I couldn't find current season league table data for the ${teamName}.`,
				};
			}

			const dorkiniansEntry = teamData.table.find((entry) => entry.team.toLowerCase().includes("dorkinians"));
			
			if (!dorkiniansEntry) {
				return {
					type: "not_found",
					data: [],
					message: `I couldn't find Dorkinians' position in the ${teamName} league table for the current season.`,
				};
			}

			const positionSuffix = dorkiniansEntry.position === 1 ? "st" : dorkiniansEntry.position === 2 ? "nd" : dorkiniansEntry.position === 3 ? "rd" : "th";
			const fullTable = teamData.table || [];
			const division = teamData.division || "";
			
			return {
				type: "league_table",
				data: [dorkiniansEntry],
				fullTable: fullTable,
				season: currentSeasonData.season,
				division: division,
				answer: `The ${teamName} are currently in ${dorkiniansEntry.position}${positionSuffix} position in the league for ${currentSeasonData.season}, with ${dorkiniansEntry.points} points from ${dorkiniansEntry.played} games (${dorkiniansEntry.won} wins, ${dorkiniansEntry.drawn} draws, ${dorkiniansEntry.lost} losses).`,
			};
		} catch (error) {
			loggingService.log(`❌ Error in queryLeagueTableData:`, error, "error");
			return {
				type: "error",
				data: [],
				error: "Error querying league table data",
			};
		}
	}
}
