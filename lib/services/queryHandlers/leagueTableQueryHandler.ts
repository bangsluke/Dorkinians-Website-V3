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
		userContext?: string,
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
					position: result.position.position,
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
					position: result.position.position,
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
				const { getPlayerHighestLeagueFinish, getHighestLeagueFinish, getSeasonDataFromJSON, getCurrentSeasonDataFromNeo4j, normalizeSeasonFormat } = await import("../leagueTableService");
				
				// If userContext is provided, find player-specific highest finish
				let bestFinish;
				if (userContext) {
					bestFinish = await getPlayerHighestLeagueFinish(userContext);
				}
				
				// Fallback to club-wide highest finish if no player context or player-specific query failed
				if (!bestFinish) {
					bestFinish = await getHighestLeagueFinish();
				}
				
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
				const answerText = userContext 
					? `Your highest league finish was ${bestFinish.position}${positionSuffix} position with the ${bestFinish.team} in ${bestFinish.season} (${bestFinish.division}). They finished with ${bestFinish.points} points from ${bestFinish.played} games (${bestFinish.won} wins, ${bestFinish.drawn} draws, ${bestFinish.lost} losses).`
					: `Your highest league finish was ${bestFinish.position}${positionSuffix} position with the ${bestFinish.team} in ${bestFinish.season} (${bestFinish.division}). They finished with ${bestFinish.points} points from ${bestFinish.played} games (${bestFinish.won} wins, ${bestFinish.drawn} draws, ${bestFinish.lost} losses).`;
				
				return {
					type: "league_table",
					data: [bestFinish],
					fullTable: fullTable,
					season: bestFinish.season,
					division: bestFinish.division,
					answer: answerText,
					position: bestFinish.position,
				};
			}
			
			// Find team entity (1s, 2s, 3s, etc.)
			let teamName = "";
			// Helper function to convert team format to "5s" format
			const normalizeTeamName = (teamStr: string): string => {
				if (teamStr.includes("st") || teamStr.includes("nd") || teamStr.includes("rd") || teamStr.includes("th")) {
					const num = teamStr.match(/\d+/)?.[0];
					if (num) {
						return `${num}s`;
					}
				}
				return teamStr;
			};
			
			if (teamEntities.length > 0) {
				// Convert team entity to "5s" format if needed
				teamName = normalizeTeamName(teamEntities[0]);
			} else {
				// Enhanced regex to handle "5th XI", "5th team", "5th", "5s", etc.
				const teamMatch = question.match(/\b(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th)(?:\s+(?:xi|team))?\b/i);
				if (teamMatch) {
					const teamStr = teamMatch[1];
					teamName = normalizeTeamName(teamStr);
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

			// Check for goal difference queries
			const isGoalDifferenceQuery = 
				question.includes("goal difference") ||
				question.includes("goal diff") ||
				(question.includes("goal") && question.includes("difference"));

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
				
				// Find the Dorkinians team entry to get the correct team name (e.g., "Dorkinians II" instead of "2s")
				const dorkiniansEntry = fullTable.find((entry) => entry.team.toLowerCase().includes("dorkinians"));
				const teamDisplayName = dorkiniansEntry?.team || teamData.team || teamName;
				
				// Handle goal difference query
				if (isGoalDifferenceQuery) {
					const goalDiff = teamData.goalDifference;
					const goalDiffSign = goalDiff >= 0 ? "+" : "";
					// Format team name to "4th XI" format
					const teamNum = teamName.replace('s', '');
					const ordinalMap: { [key: string]: string } = {
						'1': '1st', '2': '2nd', '3': '3rd', '4': '4th',
						'5': '5th', '6': '6th', '7': '7th', '8': '8th'
					};
					const ordinalTeam = ordinalMap[teamNum] ? `${ordinalMap[teamNum]} XI` : teamDisplayName;
					return {
						type: "league_table",
						data: [teamData],
						fullTable: fullTable,
						season: normalizedSeason,
						division: division,
						answer: `The ${ordinalTeam} had a goal difference of ${goalDiffSign}${goalDiff} in the ${normalizedSeason} season.`,
						goalDifference: goalDiff,
					};
				}
				
				return {
					type: "league_table",
					data: [teamData],
					fullTable: fullTable,
					season: normalizedSeason,
					division: division,
					answer: `${teamDisplayName} were ranked ${teamData.position}${positionSuffix} with ${teamData.points} points.`,
					position: teamData.position,
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
			
			// Handle goal difference query for current season
			if (isGoalDifferenceQuery) {
				const goalDiff = dorkiniansEntry.goalDifference;
				const goalDiffSign = goalDiff >= 0 ? "+" : "";
				// Format team name to "4th XI" format
				const teamNum = teamName.replace('s', '');
				const ordinalMap: { [key: string]: string } = {
					'1': '1st', '2': '2nd', '3': '3rd', '4': '4th',
					'5': '5th', '6': '6th', '7': '7th', '8': '8th'
				};
				const ordinalTeam = ordinalMap[teamNum] ? `${ordinalMap[teamNum]} XI` : teamName;
				return {
					type: "league_table",
					data: [dorkiniansEntry],
					fullTable: fullTable,
					season: currentSeasonData.season,
					division: division,
					answer: `The ${ordinalTeam} currently have a goal difference of ${goalDiffSign}${goalDiff} in the ${currentSeasonData.season} season.`,
					goalDifference: goalDiff,
				};
			}
			
			return {
				type: "league_table",
				data: [dorkiniansEntry],
				fullTable: fullTable,
				season: currentSeasonData.season,
				division: division,
				answer: `The ${teamName} are currently in ${dorkiniansEntry.position}${positionSuffix} position in the league for ${currentSeasonData.season}, with ${dorkiniansEntry.points} points from ${dorkiniansEntry.played} games (${dorkiniansEntry.won} wins, ${dorkiniansEntry.drawn} draws, ${dorkiniansEntry.lost} losses).`,
				position: dorkiniansEntry.position,
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
