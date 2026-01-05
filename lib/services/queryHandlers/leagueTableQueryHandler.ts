import type { EnhancedQuestionAnalysis } from "../../config/enhancedQuestionAnalysis";
import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { ChatbotService } from "../chatbotService";
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
			
			// Check for "which season did [team] concede the most goals" query
			const isTeamSeasonMostConcededQuery = 
				teamEntities.length > 0 &&
				(question.includes("which season") || question.includes("what season")) &&
				question.includes("concede") &&
				(question.includes("most goals") || (question.includes("most") && question.includes("goals")));
			
			if (isTeamSeasonMostConcededQuery) {
				const teamName = teamEntities[0];
				const normalizedTeamName = teamName.includes("st") || teamName.includes("nd") || teamName.includes("rd") || teamName.includes("th") 
					? teamName.match(/\d+/)?.[0] + "s" 
					: teamName;
				
				// Query Neo4j for all seasons for this team, find the one with max goalsAgainst
				const graphLabel = neo4jService.getGraphLabel();
				const connected = await neo4jService.connect();
				if (!connected) {
					return {
						type: "error",
						data: [],
						error: "Neo4j connection failed",
					};
				}
				
				// First, try to get from Neo4j (current season and recent seasons)
				const neo4jQuery = `
					MATCH (lt:LeagueTable {graphLabel: $graphLabel, teamName: $teamName})
					WHERE lt.goalsAgainst IS NOT NULL
					WITH lt.season as season, lt.goalsAgainst as goalsAgainst
					ORDER BY goalsAgainst DESC
					LIMIT 1
					RETURN season, goalsAgainst
				`;
				
				// Push query to chatbotService for extraction
				try {
					const chatbotService = ChatbotService.getInstance();
					const readyToExecuteQuery = neo4jQuery
						.replace(/\$graphLabel/g, `'${graphLabel}'`)
						.replace(/\$teamName/g, `'${normalizedTeamName}'`);
					chatbotService.lastExecutedQueries.push(`TEAM_SEASON_MOST_CONCEDED_QUERY: ${neo4jQuery}`);
					chatbotService.lastExecutedQueries.push(`TEAM_SEASON_MOST_CONCEDED_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
				} catch (error) {
					// Ignore if chatbotService not available
				}
				
				const neo4jResult = await neo4jService.executeQuery(neo4jQuery, { graphLabel, teamName: normalizedTeamName });
				
				// Also check JSON files for historical seasons
				const { getAllHistoricalPositions, getSeasonDataFromJSON, normalizeSeasonFormat } = await import("../leagueTableService");
				const allPositions = await getAllHistoricalPositions();
				const teamPositions = allPositions.filter((pos) => pos.team === normalizedTeamName);
				
				let maxSeason: string | null = null;
				let maxGoalsAgainst = 0;
				
				// Compare Neo4j result with JSON results
				if (neo4jResult && neo4jResult.length > 0) {
					const neo4jGoalsAgainst = neo4jResult[0].goalsAgainst || 0;
					if (neo4jGoalsAgainst > maxGoalsAgainst) {
						maxGoalsAgainst = neo4jGoalsAgainst;
						maxSeason = normalizeSeasonFormat(neo4jResult[0].season, 'slash');
					}
				}
				
				// Check JSON positions
				for (const pos of teamPositions) {
					if (pos.goalsAgainst > maxGoalsAgainst) {
						maxGoalsAgainst = pos.goalsAgainst;
						maxSeason = pos.season;
					}
				}
				
				if (!maxSeason) {
					return {
						type: "not_found",
						data: [],
						message: `I couldn't find league table data for the ${normalizedTeamName} to determine which season they conceded the most goals.`,
					};
				}
				
				// Get full league table for that season
				const normalizedSeason = normalizeSeasonFormat(maxSeason, 'hyphen');
				const seasonData = await getSeasonDataFromJSON(normalizedSeason);
				const fullTable = seasonData?.teams[normalizedTeamName]?.table || [];
				const division = seasonData?.teams[normalizedTeamName]?.division || "";
				
				// Find the Dorkinians team entry
				const dorkiniansEntry = fullTable.find((entry) => entry.team.toLowerCase().includes("dorkinians"));
				
				if (!dorkiniansEntry) {
					return {
						type: "not_found",
						data: [],
						message: `I couldn't find the ${normalizedTeamName} league table for ${maxSeason}.`,
					};
				}
				
				// Format team name
				const teamNum = normalizedTeamName.replace('s', '');
				const ordinalMap: { [key: string]: string } = {
					'1': '1st', '2': '2nd', '3': '3rd', '4': '4th',
					'5': '5th', '6': '6th', '7': '7th', '8': '8th'
				};
				const ordinalTeam = ordinalMap[teamNum] ? `${ordinalMap[teamNum]} XI` : normalizedTeamName;
				
				return {
					type: "league_table",
					data: [dorkiniansEntry],
					fullTable: fullTable,
					season: maxSeason,
					division: division,
					answer: `The ${ordinalTeam} conceded the most goals in the ${maxSeason} season, with ${maxGoalsAgainst} goals against.`,
					answerValue: maxSeason,
					goalsAgainst: maxGoalsAgainst,
				};
			}
			
			// Check for "which team had the best defensive record in [season]" query
			const isBestDefensiveRecordQuery = 
				(question.includes("which team") || question.includes("what team")) &&
				(question.includes("best defensive record") || 
				 (question.includes("best") && question.includes("defensive") && question.includes("record")));
			
			if (isBestDefensiveRecordQuery) {
				// Extract season from question
				let season: string | null = null;
				const seasonMatch = question.match(/\b(20\d{2}[/-]20\d{2}|20\d{2}[/-]\d{2})\b/);
				if (seasonMatch) {
					season = seasonMatch[1].replace("-", "/");
				} else {
					const timeFrames = analysis.extractionResult?.timeFrames || [];
					const seasonFrame = timeFrames.find(tf => tf.type === "season");
					if (seasonFrame) {
						season = seasonFrame.value.replace("-", "/");
					}
				}
				
				if (!season) {
					return {
						type: "no_season",
						data: [],
						message: "I need to know which season you're asking about. Please specify (e.g., 2019/20).",
					};
				}
				
				const { getSeasonDataFromJSON, getCurrentSeasonDataFromNeo4j, normalizeSeasonFormat } = await import("../leagueTableService");
				const normalizedSeason = normalizeSeasonFormat(season, 'slash');
				
				// Get all teams for this season from JSON and Neo4j
				const seasonData = await getSeasonDataFromJSON(normalizeSeasonFormat(season, 'hyphen'));
				
				// Also query Neo4j for this specific season (not just current season)
				const graphLabel = neo4jService.getGraphLabel();
				const connected = await neo4jService.connect();
				let neo4jSeasonData: any = null;
				
				if (connected) {
					// Query Neo4j for the specific season (try both slash and hyphen formats)
					const seasonHyphen = normalizeSeasonFormat(season, 'hyphen');
					loggingService.log(`🔍 Querying Neo4j for season: ${normalizedSeason} or ${seasonHyphen}`, null, "log");
					
					// Try multiple season format variations
					const seasonVariations = [
						normalizedSeason,  // 2019/20
						seasonHyphen,      // 2019-20
						'2019/20',
						'2019-20',
						'2019/2020',
						'2019-2020'
					];
					
					// First, let's check what seasons are available in Neo4j
					const availableSeasonsQuery = `
						MATCH (lt:LeagueTable {graphLabel: $graphLabel})
						WHERE lt.season IS NOT NULL
						WITH DISTINCT lt.season as season
						RETURN season
						ORDER BY season DESC
					`;
					try {
						const availableSeasons = await neo4jService.executeQuery(availableSeasonsQuery, { graphLabel });
						const seasonList = availableSeasons?.map((s: any) => s.season) || [];
						loggingService.log(`🔍 Available seasons in Neo4j:`, seasonList, "log");
						
						// Also check if any Dorkinians data exists at all
						const dorkiniansCheckQuery = `
							MATCH (lt:LeagueTable {graphLabel: $graphLabel})
							WHERE lt.team CONTAINS 'Dorkinians'
							WITH DISTINCT lt.season as season, count(lt) as count
							RETURN season, count
							ORDER BY season DESC
							LIMIT 10
						`;
						try {
							const dorkiniansSeasons = await neo4jService.executeQuery(dorkiniansCheckQuery, { graphLabel });
							const dorkiniansSeasonList = dorkiniansSeasons?.map((s: any) => ({season: s.season, count: s.count})) || [];
						} catch (error) {
							// Error checking Dorkinians seasons - continue
						}
					} catch (error) {
						loggingService.log(`⚠️ Error checking available seasons:`, error, "warn");
					}
					
					const neo4jQuery = `
						MATCH (lt:LeagueTable {graphLabel: $graphLabel})
						WHERE lt.season IN $seasonVariations
						  AND lt.team CONTAINS 'Dorkinians'
						  AND lt.goalsAgainst IS NOT NULL
						WITH lt.teamName as teamName, 
							lt.division as division, 
							lt.lastUpdated as lastUpdated, 
							lt.url as url,
							head(collect(DISTINCT lt.season)) as actualSeason,
							collect({
								position: lt.position,
								team: lt.team,
								played: lt.played,
								won: lt.won,
								drawn: lt.drawn,
								lost: lt.lost,
								goalsFor: lt.goalsFor,
								goalsAgainst: lt.goalsAgainst,
								goalDifference: lt.goalDifference,
								points: lt.points
							}) as entries
						WITH teamName, 
							COALESCE(division, '') as division,
							lastUpdated,
							url,
							actualSeason,
							entries
						RETURN 
							actualSeason as season,
							teamName,
							CASE WHEN division IS NULL OR division = '' THEN '' ELSE division END as division,
							url,
							lastUpdated,
							entries
						ORDER BY teamName
					`;
					
					// Push query to chatbotService for extraction
					try {
						const chatbotService = ChatbotService.getInstance();
						const readyToExecuteQuery = neo4jQuery
							.replace(/\$graphLabel/g, `'${graphLabel}'`)
							.replace(/\$seasonVariations/g, JSON.stringify(seasonVariations));
						chatbotService.lastExecutedQueries.push(`LEAGUE_TABLE_QUERY: ${neo4jQuery}`);
						chatbotService.lastExecutedQueries.push(`LEAGUE_TABLE_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
					} catch (error) {
						// Ignore if chatbotService not available
					}
					
					try {
						const result = await neo4jService.runQuery(neo4jQuery, { graphLabel, seasonVariations: seasonVariations });
						
						loggingService.log(`🔍 Neo4j query returned ${result.records.length} records for season ${normalizedSeason}`, null, "log");
						
						if (result.records.length > 0) {
							// Convert Neo4j result to SeasonLeagueData format
							const teams: { [key: string]: any } = {};
							let seasonLastUpdated: string | undefined = undefined;
							
							for (const record of result.records) {
								const teamName = record.get('teamName');
								const entries = record.get('entries') || [];
								const divisionRaw = record.get('division');
								const url = record.get('url') || '';
								const lastUpdated = record.get('lastUpdated');
								
								const division = divisionRaw ? String(divisionRaw).trim() : '';
								
								if (!seasonLastUpdated && lastUpdated) {
									seasonLastUpdated = lastUpdated.toString();
								}
								
								if (teamName && entries.length > 0) {
									// Convert team name to key (e.g., "1st XI" -> "1s")
									const teamNameToKey = (teamName: string): string => {
										const teamNameLower = teamName.toLowerCase().trim();
										const mapping: { [key: string]: string } = {
											'1st xi': '1s',
											'2nd xi': '2s',
											'3rd xi': '3s',
											'4th xi': '4s',
											'5th xi': '5s',
											'6th xi': '6s',
											'7th xi': '7s',
											'8th xi': '8s',
										};
										return mapping[teamNameLower] || teamName;
									};
									
									const teamKey = teamNameToKey(teamName);
									teams[teamKey] = {
										division: division,
										url: url || '',
										lastUpdated: lastUpdated ? lastUpdated.toString() : undefined,
										table: entries.map((entry: any) => ({
											position: entry.position?.toNumber?.() ?? entry.position ?? 0,
											team: entry.team ?? '',
											played: entry.played?.toNumber?.() ?? entry.played ?? 0,
											won: entry.won?.toNumber?.() ?? entry.won ?? 0,
											drawn: entry.drawn?.toNumber?.() ?? entry.drawn ?? 0,
											lost: entry.lost?.toNumber?.() ?? entry.lost ?? 0,
											goalsFor: entry.goalsFor?.toNumber?.() ?? entry.goalsFor ?? 0,
											goalsAgainst: entry.goalsAgainst?.toNumber?.() ?? entry.goalsAgainst ?? 0,
											goalDifference: entry.goalDifference?.toNumber?.() ?? entry.goalDifference ?? 0,
											points: entry.points?.toNumber?.() ?? entry.points ?? 0,
										})),
									};
								}
							}
							
							if (Object.keys(teams).length > 0) {
								neo4jSeasonData = {
									season: normalizedSeason,
									lastUpdated: seasonLastUpdated,
									teams: teams,
								};
							}
						}
					} catch (error) {
						loggingService.log(`⚠️ Error querying Neo4j for season ${normalizedSeason}:`, error, "warn");
					}
				} else {
					loggingService.log(`⚠️ Neo4j connection failed`, null, "warn");
				}
				
				// Also check current season from Neo4j if it matches
				const currentSeasonData = await getCurrentSeasonDataFromNeo4j();
				
				let bestTeam: string | null = null;
				let minGoalsAgainst = Infinity;
				let bestTeamData: any = null;
				
				// Check JSON data
				if (seasonData) {
					loggingService.log(`🔍 Found JSON data for season ${normalizedSeason} with ${Object.keys(seasonData.teams).length} teams`, null, "log");
					for (const [teamKey, teamData] of Object.entries(seasonData.teams)) {
						if (!teamData || !teamData.table) continue;
						const dorkiniansEntry = teamData.table.find((entry) => entry.team.toLowerCase().includes("dorkinians"));
						if (dorkiniansEntry) {
							loggingService.log(`🔍 Found ${teamKey}: goalsAgainst=${dorkiniansEntry.goalsAgainst}`, null, "log");
							if (dorkiniansEntry.goalsAgainst < minGoalsAgainst) {
								minGoalsAgainst = dorkiniansEntry.goalsAgainst;
								bestTeam = teamKey;
								bestTeamData = { entry: dorkiniansEntry, fullTable: teamData.table, division: teamData.division };
							}
						}
					}
				} else {
					loggingService.log(`⚠️ No JSON data found for season ${normalizedSeason}`, null, "warn");
				}
				
				// Check current season data if it matches the requested season
				if (currentSeasonData && currentSeasonData.season === normalizedSeason) {
					loggingService.log(`🔍 Found current season data matching ${normalizedSeason} with ${Object.keys(currentSeasonData.teams).length} teams`, null, "log");
					for (const [teamKey, teamData] of Object.entries(currentSeasonData.teams)) {
						if (!teamData || !teamData.table) continue;
						const dorkiniansEntry = teamData.table.find((entry) => entry.team.toLowerCase().includes("dorkinians"));
						if (dorkiniansEntry) {
							loggingService.log(`🔍 Found ${teamKey} in current season: goalsAgainst=${dorkiniansEntry.goalsAgainst}`, null, "log");
							if (dorkiniansEntry.goalsAgainst < minGoalsAgainst) {
								minGoalsAgainst = dorkiniansEntry.goalsAgainst;
								bestTeam = teamKey;
								bestTeamData = { entry: dorkiniansEntry, fullTable: teamData.table, division: teamData.division };
							}
						}
					}
				}
				
				// Check Neo4j data for the specific season
				if (neo4jSeasonData) {
					loggingService.log(`🔍 Found Neo4j data for season ${normalizedSeason} with ${Object.keys(neo4jSeasonData.teams).length} teams`, null, "log");
					for (const [teamKey, teamData] of Object.entries(neo4jSeasonData.teams)) {
						if (!teamData || typeof teamData !== 'object' || !('table' in teamData) || !Array.isArray(teamData.table)) continue;
						const teamDataTyped = teamData as { table: any[]; division?: string; url?: string; lastUpdated?: string };
						const dorkiniansEntry = teamDataTyped.table.find((entry: { team?: string; [key: string]: any }) => entry.team?.toLowerCase().includes("dorkinians"));
						if (dorkiniansEntry) {
							loggingService.log(`🔍 Found ${teamKey} in Neo4j: goalsAgainst=${dorkiniansEntry.goalsAgainst}`, null, "log");
							if (dorkiniansEntry.goalsAgainst < minGoalsAgainst) {
								minGoalsAgainst = dorkiniansEntry.goalsAgainst;
								bestTeam = teamKey;
								bestTeamData = { entry: dorkiniansEntry, fullTable: teamDataTyped.table, division: teamDataTyped.division };
							}
						}
					}
				} else {
					loggingService.log(`⚠️ No Neo4j data found for season ${normalizedSeason}`, null, "warn");
				}
				
				// Check current season from Neo4j if it matches
				if (currentSeasonData && normalizeSeasonFormat(currentSeasonData.season, 'slash') === normalizedSeason) {
					for (const [teamKey, teamData] of Object.entries(currentSeasonData.teams)) {
						if (!teamData || !teamData.table) continue;
						const dorkiniansEntry = teamData.table.find((entry) => entry.team.toLowerCase().includes("dorkinians"));
						if (dorkiniansEntry && dorkiniansEntry.goalsAgainst < minGoalsAgainst) {
							minGoalsAgainst = dorkiniansEntry.goalsAgainst;
							bestTeam = teamKey;
							bestTeamData = { entry: dorkiniansEntry, fullTable: teamData.table, division: teamData.division };
						}
					}
				}
				
				if (!bestTeam || !bestTeamData) {
					loggingService.log(`❌ No best team found. Checked JSON: ${!!seasonData}, Neo4j: ${!!neo4jSeasonData}, Current: ${!!currentSeasonData}`, null, "warn");
					
					// Provide more specific error message based on what was checked
					let errorMessage = `I couldn't find league table data for Dorkinians teams in the ${season} season.`;
					if (!seasonData && !neo4jSeasonData) {
						errorMessage = `I couldn't find league table data for the ${season} season. The data may not be available in the system.`;
					}
					
					return {
						type: "not_found",
						data: [],
						message: errorMessage,
					};
				}
				
				loggingService.log(`✅ Best defensive record: ${bestTeam} with ${minGoalsAgainst} goals against`, null, "log");
				
				// Extract "1st XI" format from team name or convert from teamKey
				let teamDisplayName = "1st XI";
				const teamNameFromEntry = bestTeamData.entry.team || "";
				
				// Try to extract "Xst XI", "Xnd XI", "Xrd XI", or "Xth XI" from the team name
				const teamNameMatch = teamNameFromEntry.match(/\b(\d+)(?:st|nd|rd|th)\s+XI\b/i);
				if (teamNameMatch) {
					const num = teamNameMatch[1];
					const ordinalMap: { [key: string]: string } = {
						'1': '1st', '2': '2nd', '3': '3rd', '4': '4th',
						'5': '5th', '6': '6th', '7': '7th', '8': '8th'
					};
					teamDisplayName = ordinalMap[num] ? `${ordinalMap[num]} XI` : `${num}th XI`;
				} else {
					// Convert from teamKey (e.g., "1s" -> "1st XI")
					const teamNum = bestTeam.replace('s', '');
					const ordinalMap: { [key: string]: string } = {
						'1': '1st', '2': '2nd', '3': '3rd', '4': '4th',
						'5': '5th', '6': '6th', '7': '7th', '8': '8th'
					};
					teamDisplayName = ordinalMap[teamNum] ? `${ordinalMap[teamNum]} XI` : `${teamNum}th XI`;
				}
				
				return {
					type: "league_table",
					data: [bestTeamData.entry],
					fullTable: bestTeamData.fullTable,
					season: normalizedSeason,
					division: bestTeamData.division,
					answer: `The ${teamDisplayName} had the best defensive record in the ${normalizedSeason} season, conceding only ${minGoalsAgainst} goals.`,
					answerValue: teamDisplayName,
					goalsAgainst: minGoalsAgainst,
				};
			}
			
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
				
				// Push representative query (data is from JSON, but show what Neo4j query would look like)
				try {
					const chatbotService = ChatbotService.getInstance();
					const graphLabel = neo4jService.getGraphLabel();
					const representativeQuery = `
						MATCH (lt:LeagueTable {graphLabel: $graphLabel, season: $season})
						WHERE lt.teamName = $teamName
						RETURN lt.position as position, lt.team as team, lt.played as played, 
						       lt.won as won, lt.drawn as drawn, lt.lost as lost, 
						       lt.goalsFor as goalsFor, lt.goalsAgainst as goalsAgainst, 
						       lt.goalDifference as goalDifference, lt.points as points
						ORDER BY lt.position
						LIMIT 1
					`;
					const readyToExecuteQuery = representativeQuery
						.replace(/\$graphLabel/g, `'${graphLabel}'`)
						.replace(/\$season/g, `'${normalizedSeason}'`)
						.replace(/\$teamName/g, `'${teamName}'`);
					chatbotService.lastExecutedQueries.push(`LEAGUE_TABLE_QUERY: ${representativeQuery}`);
					chatbotService.lastExecutedQueries.push(`LEAGUE_TABLE_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
				} catch (error) {
					// Ignore if chatbotService not available
				}

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
			// Push representative query (getCurrentSeasonDataFromNeo4j will push its own query)
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
