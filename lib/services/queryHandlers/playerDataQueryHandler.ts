import type { EnhancedQuestionAnalysis } from "../../config/enhancedQuestionAnalysis";
import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { PlayerQueryBuilder } from "../queryBuilders/playerQueryBuilder";
import { EntityResolutionUtils } from "../chatbotUtils/entityResolutionUtils";
import { TeamMappingUtils } from "../chatbotUtils/teamMappingUtils";
import { DateUtils } from "../chatbotUtils/dateUtils";
import { QueryExecutionUtils } from "../chatbotUtils/queryExecutionUtils";
import { loggingService } from "../loggingService";
import { RelationshipQueryHandler } from "./relationshipQueryHandler";
import { AwardsQueryHandler } from "./awardsQueryHandler";
import { ChatbotService } from "../chatbotService";

export class PlayerDataQueryHandler {
	/**
	 * Query player data based on entities, metrics, and analysis
	 */
	static async queryPlayerData(
		entities: string[],
		metrics: string[],
		analysis: EnhancedQuestionAnalysis,
		userContext?: string,
	): Promise<Record<string, unknown>> {
		// Use enhanced analysis data directly
		const teamEntities = analysis.teamEntities || [];
		const oppositionEntities = analysis.oppositionEntities || [];
		const timeRange = analysis.timeRange;
		const locations = analysis.extractionResult?.locations || [];

		// Essential debug info for complex queries
		if (teamEntities.length > 0 || timeRange || locations.length > 0) {
			loggingService.log(
				`🔍 Complex player query - Teams: ${teamEntities.join(",") || "none"}, Time: ${timeRange || "none"}, Locations: ${locations.length}`,
				null,
				"log",
			);
		}

		// Filter out invalid entities (team numbers, etc.)
		const validEntities = entities.filter((entity) => {
			const lowerEntity = entity.toLowerCase();
			// Skip team numbers (3s, 3rd, etc.)
			return !lowerEntity.match(/^\d+(st|nd|rd|th|s)?$/);
		});

		// Check if we have valid entities (player names) to query
		// If no valid entities but we have userContext, use that instead
		if (validEntities.length === 0) {
			if (userContext) {
				// Use userContext as the player name - this handles cases where team numbers were incorrectly extracted
				loggingService.log(`🔍 No valid entities found, using userContext: ${userContext}`, null, "log");
				// Replace entities array with userContext for the rest of the function
				entities = [userContext];
			} else {
				return { type: "no_context", data: [], message: "No player context provided" };
			}
		} else {
			// Use valid entities (filtered to remove team numbers)
			entities = validEntities;
		}

		// Check for "played with" or "most played with" questions
		// This check must happen BEFORE the normal player query path to prevent incorrect metric extraction
		const questionLower = (analysis.question?.toLowerCase() || "").trim();
		const isPlayedWithQuestion = 
			questionLower.includes("played with") ||
			questionLower.includes("played most") ||
			questionLower.includes("who have i played") ||
			questionLower.includes("who have you played") ||
			(questionLower.includes("who have") && questionLower.includes("played") && questionLower.includes("most")) ||
			(questionLower.includes("who has") && questionLower.includes("played") && (questionLower.includes("most") || questionLower.includes("with"))) ||
			(questionLower.includes("most") && questionLower.includes("games") && (questionLower.includes("with") || questionLower.includes("teammate")));

		// Check if this is a "goals whilst playing together" question (2+ entities, goals metric, "playing together" phrases)
		// This must be checked BEFORE isSpecificPlayerPairQuestion to handle goals queries correctly
		// Check for goals in question text (more reliable than relying on extracted metrics)
		const hasGoalsMetric = questionLower.includes("goals") || questionLower.includes("goal");
		
		// Check for "playing together" phrases
		const hasPlayingTogetherPhrases = 
			questionLower.includes("playing together") ||
			questionLower.includes("whilst playing together") ||
			questionLower.includes("while playing together") ||
			questionLower.includes("got together") ||
			questionLower.includes("scored together") ||
			(questionLower.includes("together") && (questionLower.includes("goals") || questionLower.includes("scored") || questionLower.includes("got")));
		
		// Check for player entities - use extractionResult for more accurate detection
		const playerEntities = analysis.extractionResult?.entities?.filter(e => e.type === "player") || [];
		const hasTwoPlayerEntities = playerEntities.length >= 2 || entities.length >= 2;
		
		// Also check if userContext is set and we have at least one other player entity
		const hasUserContextAndOneEntity = userContext && (playerEntities.length >= 1 || entities.length >= 1);
		
		// Also try to extract player names directly from question text as fallback
		// Pattern: "How many goals have [Player1] and [Player2] got..."
		const playerNamePattern = /(?:have|has)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+and\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i;
		const playerNameMatch = (analysis.question || "").match(playerNamePattern);
		const hasPlayerNamesInQuestion = !!playerNameMatch;
		
		const isGoalsTogetherQuestion = 
			hasGoalsMetric &&
			hasPlayingTogetherPhrases &&
			(hasTwoPlayerEntities || hasUserContextAndOneEntity || hasPlayerNamesInQuestion);

		loggingService.log(`🔍 Checking for "goals whilst playing together" question. Question: "${questionLower}", hasGoalsMetric: ${hasGoalsMetric}, hasPlayingTogetherPhrases: ${hasPlayingTogetherPhrases}, playerEntities: ${playerEntities.length}, entities: ${entities.length}, hasUserContext: ${!!userContext}, isGoalsTogetherQuestion: ${isGoalsTogetherQuestion}`, null, "log");

		// If this is a "goals whilst playing together" question, handle it specially
		if (isGoalsTogetherQuestion) {
			// Helper function to trim player names at verb boundaries
			const trimPlayerName = (name: string): string => {
				if (!name) return name;
				// Common stop words that indicate the end of a player name
				const stopWords = /\s+(got|have|has|playing|whilst|while|together|for|with|in|at|on|by|from|to|when|where|what|which|who|how|and|or|but)\b/i;
				const match = name.match(stopWords);
				if (match && match.index !== undefined) {
					return name.substring(0, match.index).trim();
				}
				return name.trim();
			};

			// Determine player names - use userContext if available, otherwise use entities
			let playerName1: string | undefined;
			let playerName2: string | undefined;
			
			// Try to extract from question text first (most reliable for this pattern)
			// Match full names (greedy) - first name stops at "and", second name will be trimmed if it includes verbs
			// Pattern: "have/has [Name1] and [Name2] [optional verb]"
			const playerNamePattern = /(?:have|has)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+and\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i;
			const playerNameMatch = (analysis.question || "").match(playerNamePattern);
			
			if (playerNameMatch && playerNameMatch.length >= 3) {
				// Extract from question text and trim at verb boundaries
				playerName1 = trimPlayerName(playerNameMatch[1]);
				playerName2 = trimPlayerName(playerNameMatch[2]);
			} else if (userContext && (playerEntities.length >= 1 || entities.length >= 1)) {
				// User context is set, use it as first player
				playerName1 = userContext;
				playerName2 = trimPlayerName(playerEntities.length > 0 ? playerEntities[0].value : entities[0]);
			} else if (playerEntities.length >= 2) {
				// Use player entities from extraction
				playerName1 = trimPlayerName(playerEntities[0].value);
				playerName2 = trimPlayerName(playerEntities[1].value);
			} else if (entities.length >= 2) {
				// Fallback to legacy entities
				playerName1 = trimPlayerName(entities[0]);
				playerName2 = trimPlayerName(entities[1]);
			}
			
			// Only proceed if we have both player names
			if (playerName1 && playerName2) {
				const resolvedPlayerName1 = await EntityResolutionUtils.resolvePlayerName(playerName1);
				const resolvedPlayerName2 = await EntityResolutionUtils.resolvePlayerName(playerName2);
				
				if (!resolvedPlayerName1) {
					loggingService.log(`❌ Player not found: ${playerName1}`, null, "error");
					return {
						type: "player_not_found",
						data: [],
						message: `I couldn't find a player named "${playerName1}". Please check the spelling or try a different player name.`,
						playerName: playerName1,
					};
				}
				
				if (!resolvedPlayerName2) {
					loggingService.log(`❌ Player not found: ${playerName2}`, null, "error");
					return {
						type: "player_not_found",
						data: [],
						message: `I couldn't find a player named "${playerName2}". Please check the spelling or try a different player name.`,
						playerName: playerName2,
					};
				}
				
				// Extract team name if present in team entities
				let teamName: string | undefined = undefined;
				if (teamEntities.length > 0) {
					teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
					loggingService.log(`🔍 Team filter detected: ${teamName}`, null, "log");
				}
				
				// Extract season and date range filters
				const timeFrames = analysis.extractionResult?.timeFrames || [];
				const question = analysis.question || "";
				
				// Extract season from timeFrames or question
				let season: string | null = null;
				const seasonFrame = timeFrames.find(tf => tf.type === "season");
				if (seasonFrame) {
					season = seasonFrame.value;
					season = season.replace("-", "/");
				} else {
					const seasonMatch = question.match(/(\d{4})[\/\-](\d{2})/);
					if (seasonMatch) {
						season = `${seasonMatch[1]}/${seasonMatch[2]}`;
					}
				}
				
				// Extract date range from timeRange or question
				let startDate: string | null = null;
				let endDate: string | null = null;
				
				if (timeRange && typeof timeRange === "string" && timeRange.includes(" to ")) {
					const dateRange = timeRange.split(" to ");
					if (dateRange.length === 2) {
						startDate = DateUtils.convertDateFormat(dateRange[0].trim());
						endDate = DateUtils.convertDateFormat(dateRange[1].trim());
					}
				}
				
				if (!startDate || !endDate) {
					const rangeFrame = timeFrames.find(tf => tf.type === "range");
					if (rangeFrame && rangeFrame.value.includes(" to ")) {
						const dateRange = rangeFrame.value.split(" to ");
						if (dateRange.length === 2) {
							startDate = DateUtils.convertDateFormat(dateRange[0].trim());
							endDate = DateUtils.convertDateFormat(dateRange[1].trim());
						}
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
				
				loggingService.log(`🔍 Resolved player names: ${resolvedPlayerName1} and ${resolvedPlayerName2}, calling queryGoalsScoredTogether`, null, "log");
				return await RelationshipQueryHandler.queryGoalsScoredTogether(resolvedPlayerName1, resolvedPlayerName2, teamName, season, startDate, endDate);
			} else {
				// Not enough entities found, continue to normal flow
				loggingService.log(`⚠️ Not enough player entities found for goals together question, continuing to normal flow`, null, "warn");
			}
		}

		// Check if this is a "how many games/appearances with [specific player]" question (2+ entities)
		const hasHowMany = questionLower.includes("how many") || questionLower.includes("how much");
		const hasWith = questionLower.includes("with");
		const hasGamesOrAppearances = questionLower.includes("games") || questionLower.includes("appearances");
		const hasDirectPattern = questionLower.includes("played with") || 
		                        questionLower.includes("play with") ||
		                        questionLower.includes("have with") || 
		                        questionLower.includes("made with") ||
		                        questionLower.includes("make with");
		const hasGamesAppearancesWithPattern = hasGamesOrAppearances && 
		                                      hasWith && 
		                                      (questionLower.includes("played") || 
		                                       questionLower.includes("play") ||
		                                       questionLower.includes("have") || 
		                                       questionLower.includes("made") ||
		                                       questionLower.includes("make"));
		const isSpecificPlayerPairQuestion = 
			entities.length >= 2 && 
			hasHowMany &&
			hasWith &&
			(hasDirectPattern || hasGamesAppearancesWithPattern);

		loggingService.log(`🔍 Checking for "played with" question. Question: "${questionLower}", isPlayedWithQuestion: ${isPlayedWithQuestion}, isSpecificPlayerPairQuestion: ${isSpecificPlayerPairQuestion}`, null, "log");

		// If this is a specific player pair question ("How many games have I played with [Player]?")
		if (isSpecificPlayerPairQuestion && entities.length >= 2) {
			const playerName1 = entities[0];
			const playerName2 = entities[1];
			const resolvedPlayerName1 = await EntityResolutionUtils.resolvePlayerName(playerName1);
			const resolvedPlayerName2 = await EntityResolutionUtils.resolvePlayerName(playerName2);
			
			if (!resolvedPlayerName1) {
				loggingService.log(`❌ Player not found: ${playerName1}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName1}". Please check the spelling or try a different player name.`,
					playerName: playerName1,
				};
			}
			
			if (!resolvedPlayerName2) {
				loggingService.log(`❌ Player not found: ${playerName2}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName2}". Please check the spelling or try a different player name.`,
					playerName: playerName2,
				};
			}
			
			// Extract team name if present in team entities
			let teamName: string | undefined = undefined;
			if (teamEntities.length > 0) {
				teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
				loggingService.log(`🔍 Team filter detected: ${teamName}`, null, "log");
			}
			
			// Extract season and date range filters
			const timeFrames = analysis.extractionResult?.timeFrames || [];
			const question = analysis.question || "";
			
			// Extract season from timeFrames or question
			let season: string | null = null;
			const seasonFrame = timeFrames.find(tf => tf.type === "season");
			if (seasonFrame) {
				season = seasonFrame.value;
				season = season.replace("-", "/");
			} else {
				const seasonMatch = question.match(/(\d{4})[\/\-](\d{2})/);
				if (seasonMatch) {
					season = `${seasonMatch[1]}/${seasonMatch[2]}`;
				}
			}
			
			// Extract date range from timeRange or question
			let startDate: string | null = null;
			let endDate: string | null = null;
			
			if (timeRange && typeof timeRange === "string" && timeRange.includes(" to ")) {
				const dateRange = timeRange.split(" to ");
				if (dateRange.length === 2) {
					startDate = DateUtils.convertDateFormat(dateRange[0].trim());
					endDate = DateUtils.convertDateFormat(dateRange[1].trim());
				}
			}
			
			if (!startDate || !endDate) {
				const rangeFrame = timeFrames.find(tf => tf.type === "range");
				if (rangeFrame && rangeFrame.value.includes(" to ")) {
					const dateRange = rangeFrame.value.split(" to ");
					if (dateRange.length === 2) {
						startDate = DateUtils.convertDateFormat(dateRange[0].trim());
						endDate = DateUtils.convertDateFormat(dateRange[1].trim());
					}
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
			
			loggingService.log(`🔍 Resolved player names: ${resolvedPlayerName1} and ${resolvedPlayerName2}, calling queryGamesPlayedTogether`, null, "log");
			return await RelationshipQueryHandler.queryGamesPlayedTogether(resolvedPlayerName1, resolvedPlayerName2, teamName, season, startDate, endDate);
		}

		// If this is a "played with" question (but not specific player pair), handle it specially
		if (isPlayedWithQuestion && entities.length > 0) {
			const playerName = entities[0];
			const resolvedPlayerName = await EntityResolutionUtils.resolvePlayerName(playerName);
			
			if (!resolvedPlayerName) {
				loggingService.log(`❌ Player not found: ${playerName}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
					playerName,
				};
			}
			
			// Extract team name if present in team entities
			let teamName: string | undefined = undefined;
			if (teamEntities.length > 0) {
				teamName = TeamMappingUtils.mapTeamName(teamEntities[0]);
				loggingService.log(`🔍 Team filter detected: ${teamName}`, null, "log");
			}
			
			// Extract season and date range filters
			const timeFrames = analysis.extractionResult?.timeFrames || [];
			const question = analysis.question || "";
			
			// Fallback: Extract team name directly from question text if not found in team entities
			// This handles patterns like "whilst playing in the 3s" or "while playing for the 3s"
			if (!teamName) {
				const teamMatch = question.match(/\b(?:in|for|with)\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th)\b/i);
				if (teamMatch) {
					teamName = TeamMappingUtils.mapTeamName(teamMatch[1]);
					loggingService.log(`🔍 Team filter detected from question text: ${teamName}`, null, "log");
				}
			}
			
			let season: string | null = null;
			const seasonFrame = timeFrames.find(tf => tf.type === "season");
			if (seasonFrame) {
				season = seasonFrame.value;
				season = season.replace("-", "/");
			} else {
				const seasonMatch = question.match(/(\d{4})[\/\-](\d{2})/);
				if (seasonMatch) {
					season = `${seasonMatch[1]}/${seasonMatch[2]}`;
				}
			}
			
			let startDate: string | null = null;
			let endDate: string | null = null;
			
			if (timeRange && typeof timeRange === "string" && timeRange.includes(" to ")) {
				const dateRange = timeRange.split(" to ");
				if (dateRange.length === 2) {
					startDate = DateUtils.convertDateFormat(dateRange[0].trim());
					endDate = DateUtils.convertDateFormat(dateRange[1].trim());
				}
			}
			
			if (!startDate || !endDate) {
				const rangeFrame = timeFrames.find(tf => tf.type === "range");
				if (rangeFrame && rangeFrame.value.includes(" to ")) {
					const dateRange = rangeFrame.value.split(" to ");
					if (dateRange.length === 2) {
						startDate = DateUtils.convertDateFormat(dateRange[0].trim());
						endDate = DateUtils.convertDateFormat(dateRange[1].trim());
					}
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
			
			loggingService.log(`🔍 Resolved player name: ${resolvedPlayerName}, calling queryMostPlayedWith`, null, "log");
			return await RelationshipQueryHandler.queryMostPlayedWith(resolvedPlayerName, teamName, season, startDate, endDate);
		}

		// Check for "highest score in a week" questions
		const isHighestWeeklyScoreQuestion = 
			(questionLower.includes("highest score") && questionLower.includes("week")) ||
			(questionLower.includes("highest") && questionLower.includes("score") && questionLower.includes("week")) ||
			(questionLower.includes("best score") && questionLower.includes("week")) ||
			(questionLower.includes("most points") && questionLower.includes("week"));

		loggingService.log(`🔍 Checking for "highest weekly score" question. Question: "${questionLower}", isHighestWeeklyScoreQuestion: ${isHighestWeeklyScoreQuestion}`, null, "log");

		// If this is a "highest weekly score" question, handle it specially
		if (isHighestWeeklyScoreQuestion && entities.length > 0) {
			const playerName = entities[0];
			const resolvedPlayerName = await EntityResolutionUtils.resolvePlayerName(playerName);
			
			if (!resolvedPlayerName) {
				loggingService.log(`❌ Player not found: ${playerName}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
					playerName,
				};
			}
			
			loggingService.log(`🔍 Resolved player name: ${resolvedPlayerName}, calling queryHighestWeeklyScore`, null, "log");
			return await PlayerDataQueryHandler.queryHighestWeeklyScore(resolvedPlayerName);
		}

		// Check for "how many times" + opposition appearance queries (e.g., "How many times have I played Old Hamptonians?")
		// Try to extract opposition name from question if not in entities
		let extractedOppositionName = "";
		if (oppositionEntities.length > 0) {
			extractedOppositionName = oppositionEntities[0];
		} else {
			// Fallback: try to extract capitalized team name from question
			// Pattern: "how many times have I played [Team Name]?" or "played against [Team Name]"
			// Only extract if it's clearly an opposition context (not "playing for" or team-related)
			const oppositionMatch = analysis.question?.match(/(?:played|play)\s+(?:against\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
			if (oppositionMatch && oppositionMatch[1]) {
				const potentialOpposition = oppositionMatch[1];
				// Skip if it's a team number (3s, 3rd, etc.) or if it's followed by "for" (team context)
				const afterMatch = analysis.question?.substring(oppositionMatch.index! + oppositionMatch[0].length).trim();
				if (!potentialOpposition.match(/^\d+(st|nd|rd|th|s)?$/) && 
				    !afterMatch?.toLowerCase().startsWith("for") &&
				    !afterMatch?.toLowerCase().startsWith("the")) {
					extractedOppositionName = potentialOpposition;
					loggingService.log(`🔍 Extracted opposition name from question: "${extractedOppositionName}"`, null, "log");
				}
			}
		}

		// Check for team exclusions - if present, don't treat as opposition query
		const hasTeamExclusions = analysis.teamExclusions && analysis.teamExclusions.length > 0;
		
		const isOppositionAppearanceQuery = 
			!hasTeamExclusions &&
			extractedOppositionName.length > 0 && 
			(questionLower.includes("how many times") || questionLower.includes("how many")) &&
			(questionLower.includes("played") || questionLower.includes("play")) &&
			!questionLower.includes("goals") &&
			!questionLower.includes("scored");

		loggingService.log(`🔍 Checking opposition appearance query. oppositionEntities: ${oppositionEntities.length}, extractedOppositionName: "${extractedOppositionName}", question: "${questionLower}", hasTeamExclusions: ${hasTeamExclusions}, isOppositionAppearanceQuery: ${isOppositionAppearanceQuery}`, null, "log");

		if (isOppositionAppearanceQuery) {
			// Resolve player name - use userContext if available (for "I" questions), otherwise use entities
			let playerName = "";
			if (userContext) {
				playerName = userContext;
			} else if (entities.length > 0) {
				playerName = entities[0];
			} else {
				return {
					type: "no_context",
					data: [],
					message: "Please specify which player you're asking about, or log in to use 'I' in your question."
				};
			}
			
			const resolvedPlayerName = await EntityResolutionUtils.resolvePlayerName(playerName);
			const oppositionName = extractedOppositionName;
			
			if (!resolvedPlayerName) {
				loggingService.log(`❌ Player not found: ${playerName}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
					playerName,
				};
			}

			loggingService.log(`🔍 Querying appearances against opposition: ${resolvedPlayerName} vs ${oppositionName}`, null, "log");
			return await PlayerDataQueryHandler.queryOppositionAppearances(resolvedPlayerName, oppositionName);
		}

		// Check for opposition-specific queries (goals against opposition, record vs opposition, etc.)
		// Skip if team exclusions are present (exclusions only apply to player queries, not opposition queries)
		const hasOppositionQuery = !hasTeamExclusions && oppositionEntities.length > 0 && (
			questionLower.includes("against") ||
			questionLower.includes("vs") ||
			questionLower.includes("versus") ||
			questionLower.includes("opposition")
		);

		if (hasOppositionQuery && entities.length > 0) {
			const playerName = entities[0];
			const resolvedPlayerName = await EntityResolutionUtils.resolvePlayerName(playerName);
			const oppositionName = oppositionEntities[0];
			
			if (!resolvedPlayerName) {
				loggingService.log(`❌ Player not found: ${playerName}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
					playerName,
				};
			}

			// Check for specific question types
			if (questionLower.includes("win rate") || questionLower.includes("record")) {
				loggingService.log(`🔍 Querying win rate against opposition: ${oppositionName}`, null, "log");
				return await RelationshipQueryHandler.queryWinRateAgainstOpposition(oppositionName, resolvedPlayerName);
			} else if (questionLower.includes("distance") || questionLower.includes("far") || questionLower.includes("travel")) {
				loggingService.log(`🔍 Querying distance to opposition: ${oppositionName}`, null, "log");
				return await RelationshipQueryHandler.queryDistanceToOpposition(oppositionName);
			} else {
				// Default: query player stats against opposition
				const metric = metrics.length > 0 ? metrics[0] : undefined;
				loggingService.log(`🔍 Querying player stats against opposition: ${resolvedPlayerName} vs ${oppositionName}`, null, "log");
				return await RelationshipQueryHandler.queryPlayerStatsAgainstOpposition(resolvedPlayerName, oppositionName, metric);
			}
		}

		// Check for "opposition most" or "played against the most" questions
		const isOppositionMostQuestion = 
			(questionLower.includes("opposition") && questionLower.includes("most")) ||
			(questionLower.includes("opposition") && questionLower.includes("played against")) ||
			(questionLower.includes("played against") && questionLower.includes("most")) ||
			(questionLower.includes("what opposition") && questionLower.includes("most")) ||
			(questionLower.includes("which opposition") && questionLower.includes("most"));

		loggingService.log(`🔍 Checking for "opposition most" question. Question: "${questionLower}", isOppositionMostQuestion: ${isOppositionMostQuestion}`, null, "log");

		// If this is an "opposition most" question, handle it specially
		if (isOppositionMostQuestion) {
			const playerName = entities.length > 0 ? entities[0] : undefined;
			if (playerName) {
				const resolvedPlayerName = await EntityResolutionUtils.resolvePlayerName(playerName);
				
				if (!resolvedPlayerName) {
					loggingService.log(`❌ Player not found: ${playerName}`, null, "error");
					return {
						type: "player_not_found",
						data: [],
						message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
						playerName,
					};
				}
				
				loggingService.log(`🔍 Resolved player name: ${resolvedPlayerName}, calling queryPlayerOpponentsData`, null, "log");
				return await RelationshipQueryHandler.queryPlayerOpponentsData(resolvedPlayerName);
			} else {
				// No player specified, query overall most played against
				loggingService.log(`🔍 Querying most played against opposition (overall)`, null, "log");
				return await RelationshipQueryHandler.queryMostPlayedAgainstOpposition();
			}
		}

		// Check for penalty shootout questions
		const isPenaltyShootoutQuestion = 
			(questionLower.includes("penalty shootout") || questionLower.includes("penalties shootout")) &&
			(questionLower.includes("scored") || questionLower.includes("missed") || questionLower.includes("saved") || questionLower.includes("record") || questionLower.includes("conversion"));

		if (isPenaltyShootoutQuestion && entities.length > 0) {
			const playerName = entities[0];
			const resolvedPlayerName = await EntityResolutionUtils.resolvePlayerName(playerName);
			
			if (!resolvedPlayerName) {
				loggingService.log(`❌ Player not found: ${playerName}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
					playerName,
				};
			}
			
			loggingService.log(`🔍 Querying penalty shootout stats for ${resolvedPlayerName}`, null, "log");
			return await PlayerDataQueryHandler.queryPenaltyShootoutStats(resolvedPlayerName);
		}

		// Check for "penalties taken" questions
		const isPenaltiesTakenQuestion = 
			(questionLower.includes("how many") && questionLower.includes("penalties") && questionLower.includes("taken")) ||
			(questionLower.includes("how many") && questionLower.includes("penalty") && questionLower.includes("taken")) ||
			(questionLower.includes("penalties") && questionLower.includes("taken")) ||
			(questionLower.includes("penalty") && questionLower.includes("taken"));

		loggingService.log(`🔍 Checking for "penalties taken" question. Question: "${questionLower}", isPenaltiesTakenQuestion: ${isPenaltiesTakenQuestion}`, null, "log");

		// If this is a "penalties taken" question, handle it specially
		if (isPenaltiesTakenQuestion && entities.length > 0) {
			const playerName = entities[0];
			const resolvedPlayerName = await EntityResolutionUtils.resolvePlayerName(playerName);
			
			if (!resolvedPlayerName) {
				loggingService.log(`❌ Player not found: ${playerName}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
					playerName,
				};
			}
			
			loggingService.log(`🔍 Resolved player name: ${resolvedPlayerName}, calling queryPenaltiesTaken`, null, "log");
			return await PlayerDataQueryHandler.queryPenaltiesTaken(resolvedPlayerName);
		}

		// Check for "most prolific season" questions
		const isMostProlificSeasonQuestion = 
			(questionLower.includes("most prolific season") || questionLower.includes("prolific season")) &&
			(questionLower.includes("what") || questionLower.includes("which") || questionLower.includes("my") || questionLower.includes("your"));

		if (isMostProlificSeasonQuestion && (entities.length > 0 || userContext)) {
			// Resolve player name - use userContext if available (for "I" questions), otherwise use entities
			let playerName = "";
			if (userContext) {
				playerName = userContext;
			} else if (entities.length > 0) {
				playerName = entities[0];
			} else {
				return {
					type: "no_context",
					data: [],
					message: "Please specify which player you're asking about, or log in to use 'I' in your question."
				};
			}
			
			const resolvedPlayerName = await EntityResolutionUtils.resolvePlayerName(playerName);
			
			if (!resolvedPlayerName) {
				loggingService.log(`❌ Player not found: ${playerName}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
					playerName,
				};
			}

			loggingService.log(`🔍 Querying most prolific season for ${resolvedPlayerName}`, null, "log");
			// Use MostProlificSeason metric to trigger the special case query
			const query = PlayerQueryBuilder.buildPlayerQuery(resolvedPlayerName, "MostProlificSeason", analysis);
			
			try {
				const chatbotService = ChatbotService.getInstance();
				chatbotService.lastExecutedQueries.push(`MOST_PROLIFIC_SEASON: ${query}`);
				chatbotService.lastExecutedQueries.push(`PARAMS: ${JSON.stringify({ playerName: resolvedPlayerName, graphLabel: neo4jService.getGraphLabel() })}`);

				const result = await QueryExecutionUtils.executeQueryWithProfiling(query, {
					playerName: resolvedPlayerName,
					graphLabel: neo4jService.getGraphLabel(),
				});

				if (!result || !Array.isArray(result) || result.length === 0) {
					return {
						type: "specific_player",
						playerName: resolvedPlayerName,
						data: [],
						message: `I couldn't find any season data for ${resolvedPlayerName}.`,
					};
				}

				return {
					type: "specific_player",
					playerName: resolvedPlayerName,
					metric: "MostProlificSeason",
					data: result,
				};
			} catch (error) {
				loggingService.log(`❌ Error querying most prolific season:`, error, "error");
				return {
					type: "error",
					data: [],
					error: error instanceof Error ? error.message : String(error),
				};
			}
		}

		// Check for season comparison questions
		const isSeasonComparisonQuestion = 
			(questionLower.includes("compare") && questionLower.includes("season")) ||
			(questionLower.includes("vs") && (questionLower.includes("season") || /\d{4}[\/\-]\d{2}/.test(questionLower))) ||
			(questionLower.includes("versus") && (questionLower.includes("season") || /\d{4}[\/\-]\d{2}/.test(questionLower))) ||
			(questionLower.includes("best season") || questionLower.includes("worst season"));

		if (isSeasonComparisonQuestion && entities.length > 0) {
			const playerName = entities[0];
			const resolvedPlayerName = await EntityResolutionUtils.resolvePlayerName(playerName);
			
			if (!resolvedPlayerName) {
				loggingService.log(`❌ Player not found: ${playerName}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
					playerName,
				};
			}

			// Extract seasons from question
			const seasonMatches = questionLower.match(/(\d{4})[\/\-](\d{2,4})/g);
			const seasons: string[] = [];
			if (seasonMatches) {
				seasonMatches.forEach(match => {
					const normalized = match.replace("-", "/");
					if (normalized.match(/\d{4}\/\d{4}/)) {
						// Full year format: 2018/2019 -> 2018/19
						const parts = normalized.split("/");
						const shortEnd = parts[1].substring(2);
						seasons.push(`${parts[0]}/${shortEnd}`);
					} else {
						seasons.push(normalized);
					}
				});
			}

			const metric = metrics.length > 0 ? metrics[0] : "G";
			loggingService.log(`🔍 Querying season comparison for ${resolvedPlayerName}, seasons: ${seasons.join(", ")}, metric: ${metric}`, null, "log");
			return await PlayerDataQueryHandler.querySeasonComparison(resolvedPlayerName, seasons, metric);
		}

		// Check for "penalty record" questions
		const isPenaltyRecordQuestion = 
			questionLower.includes("penalty record") ||
			(questionLower.includes("penalty") && questionLower.includes("record"));

		loggingService.log(`🔍 Checking for "penalty record" question. Question: "${questionLower}", isPenaltyRecordQuestion: ${isPenaltyRecordQuestion}`, null, "log");

		// If this is a "penalty record" question, handle it specially
		if (isPenaltyRecordQuestion && entities.length > 0) {
			const playerName = entities[0];
			const resolvedPlayerName = await EntityResolutionUtils.resolvePlayerName(playerName);
			
			if (!resolvedPlayerName) {
				loggingService.log(`❌ Player not found: ${playerName}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
					playerName,
				};
			}
			
			loggingService.log(`🔍 Resolved player name: ${resolvedPlayerName}, calling queryPenaltyRecord`, null, "log");
			return await PlayerDataQueryHandler.queryPenaltyRecord(resolvedPlayerName);
		}

		// If we have a specific player name and metrics, query their stats
		if (entities.length > 0 && metrics.length > 0) {
			const playerName = entities[0];
			const originalMetric = metrics[0] || "";

			// CRITICAL: Check question text for explicit metric keywords FIRST (before normalizing)
			// This ensures "assists", "yellow cards", "red cards" are detected even if analysis incorrectly identifies team-specific metrics
			const questionLower = (analysis.question?.toLowerCase() || "").trim();
			let detectedMetricFromQuestion: string | null = null;
			if (questionLower.includes("yellow card") || questionLower.includes("yelow card") || questionLower.includes("booking") || questionLower.includes("yellows")) {
				// Handle typo "yelow" as well as correct "yellow"
				detectedMetricFromQuestion = "Y";
			} else if (questionLower.includes("red card") || questionLower.includes("reds")) {
				detectedMetricFromQuestion = "R";
			} else if (questionLower.includes("assist")) {
				detectedMetricFromQuestion = "A";
			} else if (questionLower.includes("goal") && !questionLower.includes("assist")) {
				detectedMetricFromQuestion = "G";
			} else if (questionLower.includes("appearance") || questionLower.includes("app") || questionLower.includes("game")) {
				// Only detect appearances if assists/goals/yellow cards/red cards are NOT mentioned
				if (!questionLower.includes("assist") && !questionLower.includes("goal") && 
					!questionLower.includes("yellow") && !questionLower.includes("red card")) {
					detectedMetricFromQuestion = "APP";
				}
			}
			
			// Use detected metric from question if available, otherwise use extracted metric
			const metricToUse = detectedMetricFromQuestion || originalMetric;

			// Normalize metric names before uppercase conversion
			let normalizedMetric = metricToUse;
			if (originalMetric === "Home Games % Won") {
				normalizedMetric = "HomeGames%Won";
			} else if (originalMetric === "Away Games % Won") {
				normalizedMetric = "AwayGames%Won";
			} else if (originalMetric === "Games % Won") {
				normalizedMetric = "Games%Won";
			} else if (originalMetric === "Home Games % Lost") {
				normalizedMetric = "HomeGames%Lost";
			} else if (originalMetric === "Away Games % Lost") {
				normalizedMetric = "AwayGames%Lost";
			} else if (originalMetric === "Games % Lost") {
				normalizedMetric = "Games%Lost";
			} else if (originalMetric === "Home Games % Drawn") {
				normalizedMetric = "HomeGames%Drawn";
			} else if (originalMetric === "Away Games % Drawn") {
				normalizedMetric = "AwayGames%Drawn";
			} else if (originalMetric === "Games % Drawn") {
				normalizedMetric = "Games%Drawn";
			}

			const metric = normalizedMetric.toUpperCase();

			// Check if this is a team-specific question
			if (playerName.match(/^\d+(?:st|nd|rd|th)?$/)) {
				return await PlayerDataQueryHandler.queryTeamSpecificPlayerData(playerName, metric);
			}

			// Check if player name matches the selected player (userContext) before fuzzy matching
			// This preserves the selected player when a partial name was matched earlier
			let actualPlayerName: string;
			
			// Check if the player name matches userContext (case-insensitive)
			const playerNameNormalized = playerName.toLowerCase().trim();
			const userContextNormalized = userContext?.toLowerCase().trim();
			
			if (userContext && playerNameNormalized === userContextNormalized) {
				// Player name already matches the selected player, use it directly
				actualPlayerName = userContext;
				loggingService.log(`✅ Using selected player directly: ${actualPlayerName} (matched ${playerName})`, null, "log");
			} else if (userContext && userContextNormalized && userContextNormalized.includes(playerNameNormalized) && playerNameNormalized.length >= 2) {
				// Player name is a partial match of the selected player (e.g., "Luke" matches "Luke Bangs")
				// Use the full selected player name
				actualPlayerName = userContext;
				loggingService.log(`✅ Using selected player for partial match: ${actualPlayerName} (matched partial ${playerName})`, null, "log");
			} else {
				// Resolve player name with fuzzy matching
				const resolvedPlayerName = await EntityResolutionUtils.resolvePlayerName(playerName);

				if (!resolvedPlayerName) {
					loggingService.log(`❌ Player not found: ${playerName}`, null, "error");
					return {
						type: "player_not_found",
						data: [],
						message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
						playerName,
						metric,
					};
				}

				actualPlayerName = resolvedPlayerName;
				loggingService.log(`🔍 Resolved player name via fuzzy matching: ${playerName} → ${actualPlayerName}`, null, "log");
			}

			// Check for special queries that can use enhanced relationship properties
			if (metric === "TOTW" || metric === "WEEKLY_TOTW") {
				return await AwardsQueryHandler.queryPlayerTOTWData(actualPlayerName, "weekly", analysis.question);
			}

			if (metric === "SEASON_TOTW") {
				return await AwardsQueryHandler.queryPlayerTOTWData(actualPlayerName, "season", analysis.question);
			}

			if (metric === "POTM" || metric === "PLAYER_OF_THE_MONTH") {
				return await AwardsQueryHandler.queryPlayersOfTheMonthData(actualPlayerName);
			}

			if (metric === "CAPTAIN" || metric === "CAPTAIN_AWARDS") {
				return await AwardsQueryHandler.queryPlayerCaptainAwardsData(actualPlayerName);
			}

			if (metric === "CO_PLAYERS" || metric === "PLAYED_WITH") {
				return await RelationshipQueryHandler.queryPlayerCoPlayersData(actualPlayerName);
			}

			if (metric === "OPPONENTS" || metric === "PLAYED_AGAINST") {
				return await RelationshipQueryHandler.queryPlayerOpponentsData(actualPlayerName);
			}

			// Build the optimal query using unified architecture
			const query = PlayerQueryBuilder.buildPlayerQuery(actualPlayerName, metric, analysis);

			try {
				// Store query for debugging - add to chatbotService for client visibility
				const chatbotService = ChatbotService.getInstance();
				
				// Create query with real values for client console display
				const readyToExecuteQuery = query
					.replace(/\$playerName/g, `'${actualPlayerName}'`)
					.replace(/\$graphLabel/g, `'${neo4jService.getGraphLabel()}'`);
				chatbotService.lastExecutedQueries.push(`READY_TO_EXECUTE: ${readyToExecuteQuery}`);

				const result = await QueryExecutionUtils.executeQueryWithProfiling(query, {
					playerName: actualPlayerName,
					graphLabel: neo4jService.getGraphLabel(),
				});

				// For team-specific goals queries with OPTIONAL MATCH, if result is empty, return a row with value 0
				const metricStr = metric && typeof metric === 'string' ? metric : '';
				const originalMetricStr = originalMetric && typeof originalMetric === 'string' ? originalMetric : '';
				
				const isTeamSpecificGoalsMetric = 
					(metricStr && (
						/^\d+sGoals?$/i.test(metricStr) || 
						/^\d+(?:st|nd|rd|th)\s+XI\s+Goals?$/i.test(metricStr) ||
						/^\d+(?:st|nd|rd|th)\s+team.*goals?/i.test(metricStr) ||
						/^\d+s.*goals?/i.test(metricStr) ||
						/^\d+(?:st|nd|rd|th)\s+XI\s+Goals?$/i.test(metricStr.replace(/\s+/g, ' '))
					)) ||
					(originalMetricStr && (
						/^\d+sGoals?$/i.test(originalMetricStr) || 
						/^\d+(?:st|nd|rd|th)\s+XI\s+Goals?$/i.test(originalMetricStr) ||
						/^\d+(?:st|nd|rd|th)\s+team.*goals?/i.test(originalMetricStr) ||
						/^\d+s.*goals?/i.test(originalMetricStr) ||
						/^\d+(?:st|nd|rd|th)\s+XI\s+Goals?$/i.test(originalMetricStr.replace(/\s+/g, ' '))
					));
				
				if ((!result || !Array.isArray(result) || result.length === 0) && isTeamSpecificGoalsMetric) {
					loggingService.log(`⚠️ No results found for ${actualPlayerName} with metric ${metric} (original: ${originalMetric}), returning 0`, null, "warn");
					return { 
						type: "specific_player", 
						data: [{ playerName: actualPlayerName, value: 0 }], 
						playerName: actualPlayerName, 
						metric: metricToUse, 
						cypherQuery: query 
					};
				}

				if (!result || !Array.isArray(result) || result.length === 0) {
					loggingService.log(`❌ No results found for ${actualPlayerName} with metric ${metric}`, null, "warn");
				}

				// Use metricToUse (the corrected metric) instead of originalMetric for response generation
				// This ensures the response text uses the correct metric name (e.g., "assists" instead of "3rd team appearances")
				return { type: "specific_player", data: result, playerName: actualPlayerName, metric: metricToUse, cypherQuery: query };
			} catch (error) {
				loggingService.log(`❌ Error in player query:`, error, "error");
				let errorMessage = "Error querying player data";
				if (error instanceof Error) {
					if (error.message.includes("Unknown function")) {
						errorMessage = "Generated query used an unsupported Neo4j function";
					} else {
						errorMessage = error.message;
					}
				}
				return { type: "error", data: [], error: errorMessage };
			}
		}

		// If we have player names but no metrics, return general player info
		if (entities.length > 0 && metrics.length === 0) {
			return { type: "general_player", data: entities, message: "General player query" };
		}

		loggingService.log(`🔍 No specific player query, falling back to general player query`, null, "log");

		// Fallback to general player query
		const query = `
      MATCH (p:Player)
      WHERE p.playerName IS NOT NULL
      RETURN p.playerName as name, p.id as source
      LIMIT 50
    `;

		const result = await neo4jService.executeQuery(query);
		return { type: "general_players", data: result };
	}

	/**
	 * Query highest weekly score for a player
	 */
	static async queryHighestWeeklyScore(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying highest weekly score for player: ${playerName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();

		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.seasonWeek IS NOT NULL AND md.fantasyPoints IS NOT NULL
			WITH md.seasonWeek as seasonWeek, sum(md.fantasyPoints) as weeklyPoints
			RETURN max(weeklyPoints) as highestWeeklyScore
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			const highestScore = result && result.length > 0 && result[0].highestWeeklyScore !== undefined 
				? (typeof result[0].highestWeeklyScore === 'number' 
					? result[0].highestWeeklyScore 
					: (result[0].highestWeeklyScore?.low || 0) + (result[0].highestWeeklyScore?.high || 0) * 4294967296)
				: 0;
			return { type: "highest_weekly_score", highestScore, playerName };
		} catch (error) {
			loggingService.log(`❌ Error in highest weekly score query:`, error, "error");
			return { type: "error", data: [], error: "Error querying highest weekly score data" };
		}
	}

	/**
	 * Query penalties taken for a player (penaltiesScored + penaltiesMissed)
	 */
	static async queryPenaltiesTaken(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying penalties taken for player: ${playerName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();

		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WITH p, 
				sum(coalesce(md.penaltiesScored, 0)) as penaltiesScored,
				sum(coalesce(md.penaltiesMissed, 0)) as penaltiesMissed
			RETURN p.playerName as playerName, 
				(penaltiesScored + penaltiesMissed) as value,
				penaltiesScored,
				penaltiesMissed
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			if (result && result.length > 0) {
				const row = result[0];
				return { 
					type: "penalties_taken", 
					data: [{ 
						playerName: row.playerName, 
						value: row.value || 0,
						penaltiesScored: row.penaltiesScored || 0,
						penaltiesMissed: row.penaltiesMissed || 0
					}], 
					playerName,
					penaltiesScored: row.penaltiesScored || 0,
					penaltiesMissed: row.penaltiesMissed || 0
				};
			}
			return { 
				type: "penalties_taken", 
				data: [{ playerName, value: 0, penaltiesScored: 0, penaltiesMissed: 0 }], 
				playerName,
				penaltiesScored: 0,
				penaltiesMissed: 0
			};
		} catch (error) {
			loggingService.log(`❌ Error in penalties taken query:`, error, "error");
			return { type: "error", data: [], error: "Error querying penalties taken data" };
		}
	}

	/**
	 * Query penalty shootout stats for a player
	 */
	static async queryPenaltyShootoutStats(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying penalty shootout stats for player: ${playerName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();

		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WITH p, 
				sum(coalesce(md.penaltyShootoutPenaltiesScored, 0)) as penaltyShootoutScored,
				sum(coalesce(md.penaltyShootoutPenaltiesMissed, 0)) as penaltyShootoutMissed,
				sum(coalesce(md.penaltyShootoutPenaltiesSaved, 0)) as penaltyShootoutSaved
			RETURN p.playerName as playerName, 
				penaltyShootoutScored,
				penaltyShootoutMissed,
				penaltyShootoutSaved,
				(penaltyShootoutScored + penaltyShootoutMissed) as totalPenaltyShootoutTaken,
				CASE 
					WHEN (penaltyShootoutScored + penaltyShootoutMissed) > 0 
					THEN round(100.0 * penaltyShootoutScored / (penaltyShootoutScored + penaltyShootoutMissed) * 100) / 100.0
					ELSE 0.0 
				END as penaltyShootoutConversionRate
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			if (result && result.length > 0) {
				const row = result[0];
				return { 
					type: "penalty_shootout_stats", 
					data: row, 
					playerName,
					penaltyShootoutScored: row.penaltyShootoutScored || 0,
					penaltyShootoutMissed: row.penaltyShootoutMissed || 0,
					penaltyShootoutSaved: row.penaltyShootoutSaved || 0,
					totalPenaltyShootoutTaken: row.totalPenaltyShootoutTaken || 0,
					penaltyShootoutConversionRate: row.penaltyShootoutConversionRate || 0.0
				};
			}
			return { 
				type: "penalty_shootout_stats", 
				data: { playerName, penaltyShootoutScored: 0, penaltyShootoutMissed: 0, penaltyShootoutSaved: 0, totalPenaltyShootoutTaken: 0, penaltyShootoutConversionRate: 0.0 }, 
				playerName,
				penaltyShootoutScored: 0,
				penaltyShootoutMissed: 0,
				penaltyShootoutSaved: 0,
				totalPenaltyShootoutTaken: 0,
				penaltyShootoutConversionRate: 0.0
			};
		} catch (error) {
			loggingService.log(`❌ Error in penalty shootout stats query:`, error, "error");
			return { type: "error", data: [], error: "Error querying penalty shootout stats data" };
		}
	}

	/**
	 * Query penalty record for a player (returns both penaltiesScored and penaltiesMissed)
	 */
	static async queryPenaltyRecord(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying penalty record for player: ${playerName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();

		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WITH p, 
				sum(coalesce(md.penaltiesScored, 0)) as penaltiesScored,
				sum(coalesce(md.penaltiesMissed, 0)) as penaltiesMissed
			RETURN p.playerName as playerName, 
				penaltiesScored,
				penaltiesMissed,
				(penaltiesScored + penaltiesMissed) as totalPenalties
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			if (result && result.length > 0) {
				const row = result[0];
				return { 
					type: "penalty_record", 
					data: [{ 
						playerName: row.playerName, 
						penaltiesScored: row.penaltiesScored || 0,
						penaltiesMissed: row.penaltiesMissed || 0,
						totalPenalties: row.totalPenalties || 0
					}], 
					playerName,
					penaltiesScored: row.penaltiesScored || 0,
					penaltiesMissed: row.penaltiesMissed || 0,
					totalPenalties: row.totalPenalties || 0
				};
			}
			return { 
				type: "penalty_record", 
				data: [{ playerName, penaltiesScored: 0, penaltiesMissed: 0, totalPenalties: 0 }], 
				playerName,
				penaltiesScored: 0,
				penaltiesMissed: 0,
				totalPenalties: 0
			};
		} catch (error) {
			loggingService.log(`❌ Error in penalty record query:`, error, "error");
			return { type: "error", data: [], error: "Error querying penalty record data" };
		}
	}

	/**
	 * Query season comparison for a player
	 */
	static async querySeasonComparison(playerName: string, seasons: string[], metric: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying season comparison for player: ${playerName}, seasons: ${seasons.join(", ")}, metric: ${metric}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();

		// Build query to get stats for each season
		const returnClause = PlayerQueryBuilder.getMatchDetailReturnClause(metric);
		const aggregationMatch = returnClause.match(/^(.+?)\s+as\s+value$/i);
		const aggregation = aggregationMatch ? aggregationMatch[1] : "count(md)";

		let query = "";
		if (seasons.length > 0) {
			// Compare specific seasons
			const seasonFilters = seasons.map(s => `f.season = "${s}"`).join(" OR ");
			query = `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
				WHERE (${seasonFilters}) AND f.season IS NOT NULL AND f.season <> ""
				WITH p, f.season as season, ${aggregation} as value
				ORDER BY season ASC
				RETURN p.playerName as playerName, season, value
			`;
		} else {
			// Get all seasons
			query = `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
				WHERE f.season IS NOT NULL AND f.season <> ""
				WITH p, f.season as season, ${aggregation} as value
				ORDER BY season ASC
				RETURN p.playerName as playerName, season, value
			`;
		}

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			return { type: "season_comparison", data: result, playerName, seasons, metric };
		} catch (error) {
			loggingService.log(`❌ Error in season comparison query:`, error, "error");
			return { type: "error", data: [], error: "Error querying season comparison data" };
		}
	}

	/**
	 * Query team-specific player data
	 */
	static async queryTeamSpecificPlayerData(teamName: string, metric: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying team-specific data for team: ${teamName}, metric: ${metric}`, null, "log");

		// Normalize team name
		const normalizedTeam = teamName.replace(/(\d+)(st|nd|rd|th)?/, "$1s");

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
			case "fantasy_points":
			case "ftp":
				returnClause = "coalesce(sum(md.fantasyPoints), 0) as value";
				break;
			default:
				returnClause = "coalesce(sum(md.goals), 0) as value";
		}

		const query = `
			MATCH (p:Player)-[:PLAYED_IN]->(md:MatchDetail)
			WHERE p.allowOnSite = true AND md.team = $teamName
			RETURN p.playerName as playerName, ${returnClause}
			ORDER BY value DESC
			LIMIT 20
		`;

		try {
			const result = await neo4jService.executeQuery(query, { teamName: normalizedTeam });
			return { type: "team_specific", data: result, teamName: normalizedTeam, metric };
		} catch (error) {
			loggingService.log(`❌ Error in team-specific query:`, error, "error");
			return { type: "error", data: [], error: "Error querying team-specific data" };
		}
	}

	/**
	 * Query how many leagues a player has won (seasons where their team finished 1st)
	 * Uses the same approach as Club Achievements API - gets winning teams from JSON files,
	 * then checks if player played for those teams in those seasons
	 * Excludes current season as it hasn't finished yet
	 */
	static async queryPlayerLeagueWinsCount(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying league wins count for player: ${playerName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();

		try {
			// Import league table service functions
			const { getAvailableSeasons, getSeasonDataFromJSON, normalizeSeasonFormat } = await import("../leagueTableService");
			const { TeamMappingUtils } = await import("../chatbotUtils/teamMappingUtils");

			// Get current season from SiteDetail
			const currentSeasonQuery = `
				MATCH (sd:SiteDetail {graphLabel: $graphLabel})
				RETURN sd.currentSeason as currentSeason
				LIMIT 1
			`;
			const seasonResult = await neo4jService.executeQuery(currentSeasonQuery, { graphLabel });
			const currentSeason = seasonResult && seasonResult.length > 0 ? seasonResult[0].currentSeason : null;

			// Get all club achievements (winning teams/seasons) from JSON files
			const seasons = await getAvailableSeasons();
			const winningTeams: Array<{ team: string; season: string }> = [];

			for (const season of seasons) {
				// Skip current season
				const normalizedSeason = normalizeSeasonFormat(season, 'slash');
				if (currentSeason && normalizedSeason === currentSeason) {
					continue;
				}

				const seasonData = await getSeasonDataFromJSON(season);
				if (!seasonData) continue;

				// Iterate through all teams in this season
				for (const [teamKey, teamData] of Object.entries(seasonData.teams)) {
					if (!teamData || !teamData.table || teamData.table.length === 0) continue;

					// Find Dorkinians entry in this team's table
					const dorkiniansEntry = teamData.table.find((entry) =>
						entry.team.toLowerCase().includes('dorkinians'),
					);

					// Check if Dorkinians finished in 1st place
					if (dorkiniansEntry && dorkiniansEntry.position === 1) {
						winningTeams.push({
							team: teamKey,
							season: normalizedSeason,
						});
					}
				}
			}

			if (winningTeams.length === 0) {
				return { type: "league_wins_count", count: 0, playerName };
			}

			// Check which winning teams/seasons the player participated in
			// Map team keys to database format (e.g., "1s" -> "1st XI")
			const playerWins: string[] = [];
			
			for (const { team, season } of winningTeams) {
				const mappedTeam = TeamMappingUtils.mapTeamName(team);
				
				// Query if player played for this team in this season (League games only)
				const playerQuery = `
					MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
					MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
					WHERE md.team = $team 
						AND f.season = $season 
						AND f.compType = "League"
					RETURN count(md) as appearances
					LIMIT 1
				`;

				const result = await neo4jService.executeQuery(playerQuery, {
					graphLabel,
					playerName,
					team: mappedTeam,
					season,
				});

				const appearances = result && result.length > 0 && result[0].appearances !== undefined
					? (typeof result[0].appearances === 'number'
						? result[0].appearances
						: (result[0].appearances?.low || 0) + (result[0].appearances?.high || 0) * 4294967296)
					: 0;

				// If player made at least one appearance for this winning team, count it
				if (appearances > 0) {
					playerWins.push(`${team} - ${season}`);
				}
			}

			const count = playerWins.length;
			return { type: "league_wins_count", count, playerName };
		} catch (error) {
			loggingService.log(`❌ Error in league wins count query:`, error, "error");
			return { type: "error", data: [], error: "Error querying league wins count data" };
		}
	}

	/**
	 * Query how many times a player has played against a specific opposition
	 * Counts MatchDetail nodes connected to the player, filtered by OppositionDetails
	 */
	static async queryOppositionAppearances(playerName: string, oppositionName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying appearances against opposition: ${playerName} vs ${oppositionName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();

		// Query to count MatchDetail nodes where player played against the opposition
		// Uses CONTAINS for partial matching (e.g., "Old Hamptonians" matches "Old Hamptonians 2nd")
		// Verifies OppositionDetails nodes exist with matching opposition name
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			WHERE toLower(f.opposition) CONTAINS toLower($oppositionName)
				AND EXISTS {
					MATCH (od:OppositionDetails {graphLabel: $graphLabel})
					WHERE toLower(od.opposition) CONTAINS toLower($oppositionName)
				}
			RETURN count(md) as appearances
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName, oppositionName, graphLabel });
			const appearances = result && result.length > 0 ? (result[0].appearances || 0) : 0;
			
			return { 
				type: "player_opposition_appearances", 
				data: [{ appearances }], 
				playerName, 
				oppositionName,
				appearances 
			};
		} catch (error) {
			loggingService.log(`❌ Error in opposition appearances query:`, error, "error");
			return { type: "error", data: [], error: "Error querying opposition appearances" };
		}
	}

	/**
	 * Query home vs away games comparison for a player
	 * Counts fixtures where homeOrAway = "Home" vs "Away" for all fixtures the player has played in
	 */
	static async queryHomeAwayGamesComparison(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying home/away games comparison for player: ${playerName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();

		// Query to count home and away games for the player
		// Uses DISTINCT to count unique fixtures (in case player has multiple MatchDetail records for same fixture)
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			WITH DISTINCT f
			RETURN 
				sum(CASE WHEN f.homeOrAway = "Home" THEN 1 ELSE 0 END) as homeGames,
				sum(CASE WHEN f.homeOrAway = "Away" THEN 1 ELSE 0 END) as awayGames
		`;

		// Store query for debugging
		const chatbotService = ChatbotService.getInstance();
		chatbotService.lastExecutedQueries.push(`HOME_AWAY_COMPARISON: ${query}`);
		chatbotService.lastExecutedQueries.push(`PARAMS: ${JSON.stringify({ playerName, graphLabel })}`);

		// Log copyable query for debugging
		const readyToExecuteQuery = query.replace(/\$graphLabel/g, `'${graphLabel}'`).replace(/\$playerName/g, `'${playerName}'`);
		chatbotService.lastExecutedQueries.push(`READY_TO_EXECUTE: ${readyToExecuteQuery}`);

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			
			if (!result || result.length === 0) {
				return {
					type: "home_away_comparison",
					playerName,
					homeGames: 0,
					awayGames: 0,
					cypherQuery: query,
				};
			}

			const homeGames = result[0].homeGames || 0;
			const awayGames = result[0].awayGames || 0;

			// Handle Neo4j Integer objects
			const homeGamesCount = typeof homeGames === "object" && "toNumber" in homeGames 
				? (homeGames as { toNumber: () => number }).toNumber() 
				: Number(homeGames) || 0;
			const awayGamesCount = typeof awayGames === "object" && "toNumber" in awayGames 
				? (awayGames as { toNumber: () => number }).toNumber() 
				: Number(awayGames) || 0;

			return {
				type: "home_away_comparison",
				playerName,
				homeGames: homeGamesCount,
				awayGames: awayGamesCount,
				cypherQuery: query,
			};
		} catch (error) {
			loggingService.log(`❌ Error in home/away games comparison query:`, error, "error");
			return { type: "error", data: [], error: "Error querying home/away games comparison" };
		}
	}
}
