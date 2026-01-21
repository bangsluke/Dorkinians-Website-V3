import type { EnhancedQuestionAnalysis } from "../../config/enhancedQuestionAnalysis";
import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { PlayerQueryBuilder } from "../queryBuilders/playerQueryBuilder";
import { EntityResolutionUtils } from "../chatbotUtils/entityResolutionUtils";
import { EntityNameResolver } from "../entityNameResolver";
import { TeamMappingUtils } from "../chatbotUtils/teamMappingUtils";
import { DateUtils } from "../chatbotUtils/dateUtils";
import { QueryExecutionUtils } from "../chatbotUtils/queryExecutionUtils";
import { loggingService } from "../loggingService";
import { RelationshipQueryHandler } from "./relationshipQueryHandler";
import { AwardsQueryHandler } from "./awardsQueryHandler";
import { ChatbotService } from "../chatbotService";
import { FixtureDataQueryHandler } from "./fixtureDataQueryHandler";

// Special nickname mapping
const TWAT_NICKNAME_MAP: Record<string, string> = {
	"twat": "Kieran Mackrell",
};

export class PlayerDataQueryHandler {
	/**
	 * Check if a player name is a partial name that needs clarification
	 * Returns clarification message if needed, null otherwise
	 */
	private static checkPartialNameClarification(playerName: string, userContext?: string): { needsClarification: boolean; message?: string } | null {
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'playerDataQueryHandler.ts:25',message:'checkPartialNameClarification called',data:{playerName,userContext},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
		// #endregion
		if (!userContext) {
			return null;
		}

		const normalizedName = playerName.toLowerCase().trim();
		// Strip punctuation before checking common words
		const nameWithoutPunctuation = normalizedName.replace(/[?!.,;:]+$/, "").trim();
		const selectedPlayerLower = userContext.toLowerCase().trim();
		const pronouns = ["i", "i've", "me", "my", "myself"];
		
		// Common words that should not trigger clarification (including "play" from "open play")
		const commonWords = ["play", "playing", "goals", "goal", "assists", "assist", "games", "game", "appearances", "appearance", "minutes", "saves", "cards", "penalties", "penalty"];

		// Skip pronouns
		if (pronouns.includes(normalizedName)) {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'playerDataQueryHandler.ts:35',message:'Skipped pronoun',data:{normalizedName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
			// #endregion
			return null;
		}
		
		// Skip common words (check both with and without punctuation)
		if (commonWords.includes(normalizedName) || commonWords.includes(nameWithoutPunctuation)) {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'playerDataQueryHandler.ts:45',message:'Skipped common word',data:{normalizedName,nameWithoutPunctuation},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
			// #endregion
			return null;
		}

		// Check if it's a single word (partial name)
		const isSingleWord = !normalizedName.includes(" ") && normalizedName.length >= 2 && normalizedName.length < 20;

		if (isSingleWord) {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'playerDataQueryHandler.ts:48',message:'Single word detected',data:{normalizedName,isSingleWord},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
			// #endregion
			// Check special case: "Twat" -> "Kieran Mackrell"
			if (normalizedName === "twat") {
				return {
					needsClarification: true,
					message: "Did you mean Kieran Mackrell?",
				};
			}

			// Check if selected player contains this partial name
			if (selectedPlayerLower.includes(normalizedName) && normalizedName.length >= 2) {
				// Partial name matches selected player, no clarification needed
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'playerDataQueryHandler.ts:56',message:'Partial name matches userContext',data:{normalizedName,selectedPlayerLower},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
				// #endregion
				return null;
			}

			// Partial name doesn't match selected player, clarification needed
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'playerDataQueryHandler.ts:63',message:'Clarification needed',data:{normalizedName,selectedPlayerLower},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
			// #endregion
			return {
				needsClarification: true,
				message: `Please provide clarification on who ${playerName} is.`,
			};
		}

		return null;
	}

	/**
	 * Check if a player name is ambiguous (has multiple matches)
	 * Returns the clarification message if ambiguous, null otherwise
	 */
	private static async checkAmbiguousPlayerName(playerName: string): Promise<string | null> {
		try {
			const entityResolver = EntityNameResolver.getInstance();
			const result = await entityResolver.resolveEntityName(playerName, "player");
			
			// Check for first name ambiguity FIRST (e.g., "Kieran" matching multiple Kierans)
			// This is the most common case and should be checked before fuzzy matching
			const normalizedInput = playerName.toLowerCase().trim();
			const isSingleWord = !normalizedInput.includes(' ');
			
			if (isSingleWord) {
				// For single-word inputs (likely first names), always query the database directly
				// to ensure we get the most up-to-date list of all players
				try {
					const graphLabel = neo4jService.getGraphLabel();
					const query = `
						MATCH (p:Player {graphLabel: $graphLabel})
						WHERE p.allowOnSite = true
						RETURN p.playerName as playerName
						ORDER BY p.playerName
					`;
					const dbResult = await neo4jService.executeQuery(query, { graphLabel });
					let allEntities: string[] = [];
					if (dbResult && Array.isArray(dbResult)) {
						allEntities = dbResult.map((row: any) => row.playerName).filter((name: string) => name);
					}
					
					// Fallback to result.allEntities if database query fails or returns empty
					if (allEntities.length === 0) {
						allEntities = result.allEntities || [];
					}
					
					// Check if there are multiple players with this first name
					const matchingPlayers = allEntities.filter((name: string) => {
						const normalizedName = name.toLowerCase().trim();
						const firstName = normalizedName.split(' ')[0];
						// Check if the first name matches the input exactly
						return firstName === normalizedInput;
					});
					
					loggingService.log(`🔍 Found ${matchingPlayers.length} players with first name "${normalizedInput}": ${matchingPlayers.join(", ")}`, null, "log");
					
					if (matchingPlayers.length > 1) {
						const playerNames = matchingPlayers.slice(0, 5).join(", ");
						return `Please clarify which ${playerName} you are asking about. I found multiple players: ${playerNames}.`;
					}
				} catch (dbError) {
					loggingService.log(`⚠️ Could not query database for all players, using cached entities: ${dbError}`, null, "warn");
					// Fallback to using result.allEntities if database query fails
					const allEntities = result.allEntities || [];
					const matchingPlayers = allEntities.filter((name: string) => {
						const normalizedName = name.toLowerCase().trim();
						const firstName = normalizedName.split(' ')[0];
						return firstName === normalizedInput;
					});
					
					if (matchingPlayers.length > 1) {
						const playerNames = matchingPlayers.slice(0, 5).join(", ");
						return `Please clarify which ${playerName} you are asking about. I found multiple players: ${playerNames}.`;
					}
				}
			}
			
			// Check if there are multiple high-confidence fuzzy matches (2 or more)
			// This indicates ambiguity when multiple players have similar names
			if (result.fuzzyMatches.length >= 2) {
				// Check if the top matches have similar confidence (within 0.15)
				const topMatch = result.fuzzyMatches[0];
				const secondMatch = result.fuzzyMatches[1];
				
				// If both matches have high confidence and are close, it's ambiguous
				// Lower the threshold to catch more ambiguous cases
				if (topMatch.confidence >= 0.6 && secondMatch.confidence >= 0.6 && 
				    Math.abs(topMatch.confidence - secondMatch.confidence) < 0.2) {
					const playerNames = result.fuzzyMatches.slice(0, 5).map(m => m.entityName).join(", ");
					return `Please clarify which ${playerName} you are asking about. I found multiple players: ${playerNames}.`;
				}
			}
			
			return null;
		} catch (error) {
			loggingService.log(`❌ Error checking ambiguous player name: ${error}`, null, "error");
			return null;
		}
	}

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

		// Filter out invalid entities (team numbers, hattrick terms, stat-related words, etc.)
		const validEntities = entities.filter((entity) => {
			const lowerEntity = entity.toLowerCase();
			// Skip team numbers (3s, 3rd, etc.)
			if (lowerEntity.match(/^\d+(st|nd|rd|th|s)?$/)) return false;
			// Skip hattrick terms (hattrick, hat-trick, hat trick, etc.)
			// Handles various dash characters: regular hyphen (-), non-breaking hyphen (\u2011), en dash (–), em dash (—), and spaces
			if (/^hat[-\u2011\u2013\u2014 ]?trick/i.test(lowerEntity)) return false;
			// Skip stat-related words that might be incorrectly extracted as player entities
			const statWords = [
				"season", "best", "worst", "goals", "goal", "assists", "assist",
				"saves", "save", "sheets", "sheet", "clean", "cards", "card", 
				"yellow", "red", "mom", "match", "man", "of", "the", "own", 
				"conceded", "penalt", "penalties", "appearances", "appearance", 
				"minutes", "minute"
			];
			if (statWords.some(word => lowerEntity.includes(word))) return false;
			return true;
		});

		// Check for "played with" or "most played with" questions
		// This check must happen BEFORE the normal player query path to prevent incorrect metric extraction
		const questionLower = (analysis.question?.toLowerCase() || "").trim();

		// Check if this is a "how many clean sheets occurred in games where I played with [player]" question
		// This must be checked BEFORE entity filtering to preserve all player names
		const hasCleanSheetsInQuestion = questionLower.includes("clean sheet") || questionLower.includes("clean sheets");
		const hasHowManyCleanSheets = hasCleanSheetsInQuestion && (questionLower.includes("how many") || questionLower.includes("how much"));
		const hasPlayedWithPattern = questionLower.includes("played with") || questionLower.includes("play with");
		const hasOccurredInGames = questionLower.includes("occurred") || questionLower.includes("in games");
		const isCleanSheetsWithPlayerQuestion = hasHowManyCleanSheets && (hasPlayedWithPattern || hasOccurredInGames) && (entities.length >= 1 || userContext);
		
		if (isCleanSheetsWithPlayerQuestion) {
			// Extract player names: current player from userContext or entities[0], other player from entities
			// Use original entities array before filtering
			let playerName1 = "";
			let playerName2 = "";
			
			// Filter out pronouns from entities
			const pronouns = ["i", "me", "my", "myself", "i've", "you", "your", "player", "players"];
			const validPlayerEntities = entities.filter(e => !pronouns.includes(e.toLowerCase()));
			
			// Determine player 1 (current player): use userContext if available, otherwise first valid entity
			if (userContext) {
				playerName1 = userContext;
			} else if (validPlayerEntities.length > 0) {
				playerName1 = validPlayerEntities[0];
			} else if (entities.length > 0) {
				playerName1 = entities[0];
			}
			
			// Determine player 2 (other player): use first valid entity that's not the current player
			if (validPlayerEntities.length > 0) {
				playerName2 = validPlayerEntities.find(e => e.toLowerCase() !== playerName1.toLowerCase()) || validPlayerEntities[0];
			} else if (entities.length > 0) {
				playerName2 = entities.find(e => e.toLowerCase() !== playerName1.toLowerCase()) || entities[0];
			}
			
			if (playerName1 && playerName2 && playerName1.toLowerCase() !== playerName2.toLowerCase()) {
				const resolvedPlayerName1 = await EntityResolutionUtils.resolvePlayerName(playerName1);
				const resolvedPlayerName2 = await EntityResolutionUtils.resolvePlayerName(playerName2);
				
				if (resolvedPlayerName1 && resolvedPlayerName2) {
					loggingService.log(`🔍 Detected clean sheets with specific player question, routing to queryCleanSheetsPlayedTogether`, null, "log");
					return await RelationshipQueryHandler.queryCleanSheetsPlayedTogether(resolvedPlayerName1, resolvedPlayerName2);
				}
			}
		}

		// Check for hat-trick questions (year-wide, team-specific, or date-filtered) FIRST (before entity processing)
		// This prevents "hat‑tricks" from being treated as a player entity
		// Handles various dash characters: regular hyphen (-), non-breaking hyphen (\u2011), en dash (–), em dash (—), and spaces
		const hatTrickPatternEarly = /hat[-\u2011\u2013\u2014 ]?trick/i;
		const isHatTrickQuestionEarly = hatTrickPatternEarly.test(questionLower) && 
			(questionLower.includes("how many") || questionLower.includes("count"));
		
		if (isHatTrickQuestionEarly) {
			const hasYear = questionLower.match(/\b(20\d{2})\b/) || 
				analysis.extractionResult?.timeFrames?.some(tf => {
					const yearMatch = tf.value?.match(/\b(20\d{2})\b/);
					return yearMatch !== null;
				});
			const hasYearWidePhrases = questionLower.includes("across all teams") || 
				questionLower.includes("across all team") ||
				questionLower.includes("across all") ||
				questionLower.includes("all teams") ||
				questionLower.includes("all team");
			const hasPlayerMention = questionLower.includes("has ") || 
				questionLower.includes("have ") || 
				questionLower.includes(" i ") || 
				questionLower.match(/\bi\b/);
			const hasTeamFilter = (teamEntities.length > 0) ||
				questionLower.match(/\b(?:by|for)\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)\b/i);
			const hasDateFilter = questionLower.includes("after ") || 
				questionLower.includes("before ") ||
				questionLower.includes("since ") ||
				questionLower.includes("between ") ||
				analysis.extractionResult?.timeFrames?.some(tf => 
					tf.type === "since" || tf.type === "before" || tf.type === "range"
				);
			
			// Year-wide question: has year AND (year-wide phrases OR no player mention) AND no team filter
			const isYearWideQuestion = hasYear && (hasYearWidePhrases || !hasPlayerMention) && !hasTeamFilter;
			// Team-specific or date-filtered question: hat-trick question with team filter or date filter
			const isFilteredHatTrickQuestion = (hasTeamFilter || hasDateFilter || hasYear) && !hasPlayerMention;

			if (isYearWideQuestion || isFilteredHatTrickQuestion) {
				loggingService.log(`🔍 Detected hat-trick question with filters, routing to FixtureDataQueryHandler. hasYear: ${!!hasYear}, hasTeamFilter: ${hasTeamFilter}, hasDateFilter: ${hasDateFilter}, hasPlayerMention: ${hasPlayerMention}`, null, "log");
				return await FixtureDataQueryHandler.queryFixtureData(entities, metrics, analysis);
			}
		}

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
		
		// Check for "scoring record" questions - map to goals metric
		const isScoringRecordQuestion = 
			questionLower.includes("scoring record") &&
			(teamEntities.length > 0 || questionLower.match(/\b(?:for|in|with)\s+(?:the\s+)?(\d+)(?:st|nd|rd|th|s)\b/i));
		
		if (isScoringRecordQuestion) {
		// Override metrics to "G" (goals) for scoring record questions
		metrics = ["G"];
		loggingService.log(`🔍 Detected "scoring record" question, mapping to goals metric`, null, "log");
	}
	
	// Check for "highest win percentage with" questions
	const isWinPercentageQuestion = 
		(questionLower.includes("highest win percentage") && questionLower.includes("with")) ||
		(questionLower.includes("win percentage") && questionLower.includes("highest") && questionLower.includes("with")) ||
		(questionLower.includes("best win percentage") && questionLower.includes("with"));
	
	if (isWinPercentageQuestion) {
		// Resolve player name - prioritize "I" detection for userContext, then explicit player names
		let playerName: string | undefined;
		
		// First, check if question contains "I" or first-person pronouns - use userContext immediately
		const hasFirstPerson = questionLower.includes(" i ") || 
		                       questionLower.match(/\bi\b/) ||
		                       questionLower.includes("have i") ||
		                       questionLower.includes("has i") ||
		                       questionLower.includes("did i");
		
		if (hasFirstPerson && userContext) {
			playerName = userContext;
		} else if (entities.length > 0) {
			playerName = entities[0];
		}
		
		if (!playerName) {
			loggingService.log(`❌ No player context found for win percentage question`, null, "error");
			return {
				type: "no_context",
				data: [],
				message: "I need to know which player you're asking about. Please specify a player name or select a player.",
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
		
		loggingService.log(`🔍 Resolved player name: ${resolvedPlayerName}, calling queryHighestWinPercentageWith`, null, "log");
		return await RelationshipQueryHandler.queryHighestWinPercentageWith(resolvedPlayerName);
	}
	
	const isPlayedWithQuestion =
			questionLower.includes("played with") ||
			questionLower.includes("play with") ||
			questionLower.includes("played most") ||
			questionLower.includes("shared the pitch") ||
			questionLower.includes("shared pitch") ||
			questionLower.includes("who did i play") ||
			questionLower.includes("who did you play") ||
			questionLower.includes("who have i played") ||
			questionLower.includes("who have you played") ||
			(questionLower.includes("which player") && questionLower.includes("played") && (questionLower.includes("most") || questionLower.includes("with"))) ||
			(questionLower.includes("which player") && (questionLower.includes("shared the pitch") || questionLower.includes("shared pitch"))) ||
			(questionLower.includes("who") && questionLower.includes("played") && questionLower.includes("most") && questionLower.includes("with")) ||
			(questionLower.includes("who have") && questionLower.includes("played") && questionLower.includes("most")) ||
			(questionLower.includes("who has") && questionLower.includes("played") && (questionLower.includes("most") || questionLower.includes("with"))) ||
			(questionLower.includes("who did") && questionLower.includes("play") && (questionLower.includes("most") || questionLower.includes("with"))) ||
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
			
			// Filter out pronouns to get the actual player name to check
			const pronouns = ["i", "me", "my", "myself", "i've", "you", "your", "player", "players"];
			const playerNameToCheck = pronouns.includes(playerName2.toLowerCase()) ? playerName1 : playerName2;
			
			if (playerNameToCheck && !pronouns.includes(playerNameToCheck.toLowerCase())) {
				// Check for partial name FIRST (before ambiguous check)
				loggingService.log(`🔍 Checking for partial player name: ${playerNameToCheck}`, null, "log");
				const partialNameCheck = PlayerDataQueryHandler.checkPartialNameClarification(playerNameToCheck, userContext);
				if (partialNameCheck && partialNameCheck.needsClarification && partialNameCheck.message) {
					loggingService.log(`⚠️ Partial player name detected: ${playerNameToCheck}`, null, "warn");
					return {
						type: "clarification_needed",
						data: [],
						message: partialNameCheck.message,
						answerValue: "Clarification needed",
					};
				}

				// Check for ambiguous player names AFTER partial name check
				loggingService.log(`🔍 Checking for ambiguous player name: ${playerNameToCheck}`, null, "log");
				const ambiguousCheck = await PlayerDataQueryHandler.checkAmbiguousPlayerName(playerNameToCheck);
				if (ambiguousCheck) {
					loggingService.log(`⚠️ Ambiguous player name detected: ${playerNameToCheck}`, null, "warn");
					return {
						type: "clarification_needed",
						data: [],
						message: ambiguousCheck,
						answerValue: "Clarification needed",
					};
				}
			}
			
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
			
			// Handle "since" timeFrame - extract year from phrases like "2019ish", "like 2019ish", etc.
			if (!startDate) {
				const sinceFrame = timeFrames.find(tf => tf.type === "since");
				if (sinceFrame) {
					let year: number | null = null;
					const yearMatch = sinceFrame.value.match(/\b(20\d{2})\b/);
					if (yearMatch) {
						year = parseInt(yearMatch[1], 10);
					} else {
						// Fallback to direct parsing if no match found
						year = parseInt(sinceFrame.value, 10);
					}
					
					if (!isNaN(year) && year >= 2000 && year <= 2100) {
						startDate = DateUtils.convertSinceYearToDate(year);
						// For "since" queries, endDate is not needed (it's open-ended)
						// But we set it to a far future date to ensure all matches are included
						endDate = "2099-12-31";
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
			
			// Check if this is a clean sheets question
			const hasCleanSheets = questionLower.includes("clean sheet") || questionLower.includes("clean sheets");
			
			if (hasCleanSheets) {
				loggingService.log(`🔍 Resolved player names: ${resolvedPlayerName1} and ${resolvedPlayerName2}, calling queryCleanSheetsPlayedTogether`, null, "log");
				return await RelationshipQueryHandler.queryCleanSheetsPlayedTogether(resolvedPlayerName1, resolvedPlayerName2, teamName, season, startDate, endDate);
			}
			
			loggingService.log(`🔍 Resolved player names: ${resolvedPlayerName1} and ${resolvedPlayerName2}, calling queryGamesPlayedTogether`, null, "log");
			return await RelationshipQueryHandler.queryGamesPlayedTogether(resolvedPlayerName1, resolvedPlayerName2, teamName, season, startDate, endDate);
		}

		// If this is a "played with" question (but not specific player pair), handle it specially
		if (isPlayedWithQuestion && (entities.length > 0 || userContext)) {
			// Check for personal questions (I, me, my) - use userContext
			const isPersonalQuestion = questionLower.includes(" i ") || questionLower.includes(" i've") || 
				questionLower.includes(" have i ") || questionLower.includes(" have you ") ||
				questionLower.includes(" my ") || questionLower.includes(" me ") ||
				questionLower.includes("which player have i") || questionLower.includes("who did i");
			
			// Filter out pronouns from entities
			const pronouns = ["i", "me", "my", "myself", "i've", "you", "your", "player", "players"];
			const validEntities = entities.filter(e => !pronouns.includes(e.toLowerCase()));
			
			// Determine player name: prioritize valid entities, then userContext for personal questions
			let playerName = "";
			let playerNameToCheck = ""; // The name to check for ambiguity (the other player, not "I")
			if (validEntities.length > 0) {
				playerName = validEntities[0];
				playerNameToCheck = validEntities[0];
			} else if (isPersonalQuestion && userContext) {
				playerName = userContext;
				// For personal questions, we need to check if there's another player mentioned
				// The ambiguity check should be for the other player, not the user
				// But if no other player is mentioned, we can't check ambiguity here
			} else if (userContext) {
				playerName = userContext;
			}
			
			if (!playerName) {
				loggingService.log(`⚠️ No player name found for played with question`, null, "warn");
				return {
					type: "no_context",
					data: [],
					message: "Please specify which player you're asking about, or log in to use 'I' in your question."
				};
			}
			
			// Check for ambiguous player names if we have a player name to check
			if (playerNameToCheck) {
				const ambiguousCheck = await PlayerDataQueryHandler.checkAmbiguousPlayerName(playerNameToCheck);
				if (ambiguousCheck) {
					loggingService.log(`⚠️ Ambiguous player name detected: ${playerNameToCheck}`, null, "warn");
					return {
						type: "clarification_needed",
						data: [],
						message: ambiguousCheck,
						answerValue: "Clarification needed",
					};
				}
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
			
			// Check for cup game filter in "played with" or "shared the pitch" questions
			let compType: string | null = null;
			// Default to 5 for all "most played with" questions (expandable to 10)
			let requestedLimit: number = 5;
			const isCupGameQuestion = 
				questionLower.includes("cup") && 
				(questionLower.includes("played with") || questionLower.includes("shared the pitch") || questionLower.includes("shared pitch"));
			
			if (isCupGameQuestion) {
				compType = "Cup";
				requestedLimit = 5; // Top 5 initially, expandable to 10
				loggingService.log(`🔍 Cup game filter detected for played with question`, null, "log");
			}
			
			loggingService.log(`🔍 Resolved player name: ${resolvedPlayerName}, calling queryMostPlayedWith`, null, "log");
			return await RelationshipQueryHandler.queryMostPlayedWith(resolvedPlayerName, teamName, season, startDate, endDate, compType, requestedLimit);
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

		// Check for hat-trick questions (handles "hattrick", "hat-trick", "hat trick" variations)
		// Note: Year-wide hat-trick questions are already handled earlier in the function
		// Handles various dash characters: regular hyphen (-), non-breaking hyphen (\u2011), en dash (–), em dash (—), and spaces
		const hatTrickPattern = /hat[-\u2011\u2013\u2014 ]?trick/i;
		const isHatTrickQuestion = hatTrickPattern.test(questionLower) && 
			(questionLower.includes("how many") || questionLower.includes("count"));

		loggingService.log(`🔍 Checking for "hat-trick" question. Question: "${questionLower}", isHatTrickQuestion: ${isHatTrickQuestion}`, null, "log");

		// If this is a hat-trick question (and not year-wide, which was already handled), handle it specially
		if (isHatTrickQuestion) {
			// Resolve player name - prioritize "I" detection for userContext, then explicit player names
			// This allows questions like "How many hat tricks has Oli Goddard scored?" to use Oli Goddard
			// while "How many hat tricks have I scored?" will use userContext
			let playerName: string | undefined;
			
			// First, check if question contains "I" or first-person pronouns - use userContext immediately
			const hasFirstPerson = questionLower.includes(" i ") || 
			                       questionLower.match(/\bi\b/) ||
			                       questionLower.includes("have i") ||
			                       questionLower.includes("has i") ||
			                       analysis.extractionResult?.entities?.some(e => 
			                         e.type === "player" && e.value.toLowerCase() === "i"
			                       ) ||
			                       entities.some(e => e.toLowerCase() === "i");
			
			if (hasFirstPerson && userContext) {
				playerName = userContext;
				loggingService.log(`🔍 Detected "I" in hat-trick question, using userContext: ${playerName}`, null, "log");
			} else {
				// Try to extract player name directly from question text
				// This handles cases where entity extraction might pick up "tricks" instead of the player name
				const questionText = analysis.question || "";
				const playerNamePatterns = [
					// Pattern 1: "has [Name] scored" or "have [Name] scored"
					/(?:has|have)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:scored|score)/i,
					// Pattern 2: "[Name] has scored" or "[Name] have scored"
					/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:has|have)\s+(?:scored|score)/i,
				];
				
				for (const pattern of playerNamePatterns) {
					const match = questionText.match(pattern);
					if (match && match[1]) {
						let extractedName = match[1].trim();
						// Filter out common words that might be captured
						if (extractedName && !["Hat", "Trick", "Tricks", "What", "Which", "How", "Many"].includes(extractedName)) {
							playerName = extractedName;
							loggingService.log(`🔍 Extracted player name from hat-trick question text: ${playerName}`, null, "log");
							break;
						}
					}
				}
				
				// If no name extracted from text, check entities (filter out hattrick terms and "I")
				if (!playerName) {
					// Filter out non-player entities (like "tricks", "hattrick", etc.)
					// Handles various dash characters: regular hyphen (-), non-breaking hyphen (\u2011), en dash (–), em dash (—), and spaces
					const playerEntities = analysis.extractionResult?.entities?.filter(e => 
						e.type === "player" && 
						e.value.toLowerCase() !== "i" &&
						!["tricks", "trick"].includes(e.value.toLowerCase()) &&
						!/^hat[-\u2011\u2013\u2014 ]?trick/i.test(e.value.toLowerCase())
					) || [];
					
					if (playerEntities.length > 0) {
						playerName = playerEntities[0].value;
					} else if (validEntities.length > 0) {
						// Filter out hattrick terms from valid entities (already filtered, but double-check)
						// Handles various dash characters: regular hyphen (-), non-breaking hyphen (\u2011), en dash (–), em dash (—), and spaces
						const filteredEntities = validEntities.filter(e => 
							!/^hat[-\u2011\u2013\u2014 ]?trick/i.test(e.toLowerCase()) &&
							!["tricks", "trick"].includes(e.toLowerCase())
						);
						if (filteredEntities.length > 0) {
							playerName = filteredEntities[0];
						}
					}
				}
				
				// Fallback to userContext if no player entity was found
				if (!playerName && userContext) {
					playerName = userContext;
				}
			}

			if (!playerName) {
				loggingService.log(`❌ No player context found for hat-trick question`, null, "warn");
				return {
					type: "no_context",
					data: [],
					message: "Please specify which player you're asking about, or select a player first.",
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

			loggingService.log(`🔍 Resolved player name: ${resolvedPlayerName}, calling queryPlayerHatTricks`, null, "log");
			return await PlayerDataQueryHandler.queryPlayerHatTricks(resolvedPlayerName, analysis);
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
			// CRITICAL: Skip if question contains "since" or date patterns (these are date queries, not opposition queries)
			// CRITICAL: Skip if question contains competition-related words (cup, league, friendly, competition, competitions)
			const hasDatePattern = questionLower.includes("since") || 
			                       questionLower.includes("between") ||
			                       questionLower.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/);
			const hasCompetitionPattern = questionLower.includes("cup") || 
			                             questionLower.includes("league") || 
			                             questionLower.includes("friendly") ||
			                             questionLower.includes("competition") ||
			                             questionLower.includes("competitions") ||
			                             (analysis.competitionTypes && analysis.competitionTypes.length > 0) ||
			                             (analysis.competitions && analysis.competitions.length > 0);
			
			if (!hasDatePattern && !hasCompetitionPattern) {
				const oppositionMatch = analysis.question?.match(/(?:played|play)\s+(?:against\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
				if (oppositionMatch && oppositionMatch[1]) {
					const potentialOpposition = oppositionMatch[1];
					// Skip if it's a team number (3s, 3rd, etc.), a date keyword, or if it's followed by "for" (team context)
					// Also skip competition-related words
					const afterMatch = analysis.question?.substring(oppositionMatch.index! + oppositionMatch[0].length).trim();
					const isDateKeyword = ["since", "before", "after", "until", "from"].includes(potentialOpposition.toLowerCase());
					const isCompetitionKeyword = ["cup", "league", "friendly", "competition", "competitions"].includes(potentialOpposition.toLowerCase());
					if (!potentialOpposition.match(/^\d+(st|nd|rd|th|s)?$/) && 
					    !isDateKeyword &&
					    !isCompetitionKeyword &&
					    !afterMatch?.toLowerCase().startsWith("for") &&
					    !afterMatch?.toLowerCase().startsWith("the")) {
						extractedOppositionName = potentialOpposition;
						loggingService.log(`🔍 Extracted opposition name from question: "${extractedOppositionName}"`, null, "log");
					}
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
			!questionLower.includes("scored") &&
			!(analysis.competitionTypes && analysis.competitionTypes.length > 0) &&
			!(analysis.competitions && analysis.competitions.length > 0);

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

		// Check for "goals against opposition" questions (must come before general opposition most check)
		// Handles variations: "Which team have I scored the most against?" and similar
		const isOppositionGoalsQuestion = 
			(questionLower.includes("opposition") && questionLower.includes("goals") && questionLower.includes("most")) ||
			(questionLower.includes("scored") && questionLower.includes("most") && questionLower.includes("goals") && questionLower.includes("against")) ||
			(questionLower.includes("most goals") && questionLower.includes("against")) ||
			(questionLower.includes("what opposition") && questionLower.includes("scored") && questionLower.includes("goals")) ||
			(questionLower.includes("which opposition") && questionLower.includes("scored") && questionLower.includes("goals")) ||
			((questionLower.includes("which team") || questionLower.includes("what team") || questionLower.includes("which opposition") || questionLower.includes("what opposition")) && 
			 questionLower.includes("scored") && questionLower.includes("most") && questionLower.includes("against")) ||
			(questionLower.includes("against") && (questionLower.includes("which team") || questionLower.includes("what team")) && 
			 questionLower.includes("scored") && questionLower.includes("most"));

		loggingService.log(`🔍 Checking for "opposition goals" question. Question: "${questionLower}", isOppositionGoalsQuestion: ${isOppositionGoalsQuestion}`, null, "log");

		// If this is a "goals against opposition" question, handle it specially
		if (isOppositionGoalsQuestion) {
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
				
				loggingService.log(`🔍 Resolved player name: ${resolvedPlayerName}, calling queryPlayerGoalsAgainstOpposition`, null, "log");
				return await RelationshipQueryHandler.queryPlayerGoalsAgainstOpposition(resolvedPlayerName);
			} else if (userContext) {
				// Use userContext if no player entity found
				const resolvedPlayerName = await EntityResolutionUtils.resolvePlayerName(userContext);
				
				if (!resolvedPlayerName) {
					loggingService.log(`❌ Player not found: ${userContext}`, null, "error");
					return {
						type: "player_not_found",
						data: [],
						message: `I couldn't find a player named "${userContext}". Please check the spelling or try a different player name.`,
						playerName: userContext,
					};
				}
				
				loggingService.log(`🔍 Resolved player name from context: ${resolvedPlayerName}, calling queryPlayerGoalsAgainstOpposition`, null, "log");
				return await RelationshipQueryHandler.queryPlayerGoalsAgainstOpposition(resolvedPlayerName);
			}
		}

		// Check for "clean sheets against opposition" questions (must come before general opposition most check)
		// Handles variations: "Which/What team/opposition have I kept the most clean sheets against?"
		// and "Against which team have I kept the most clean sheets?"
		const isOppositionCleanSheetsQuestion = 
			(questionLower.includes("clean sheet") && questionLower.includes("against") && questionLower.includes("most")) ||
			(questionLower.includes("kept") && questionLower.includes("most") && questionLower.includes("clean sheet") && questionLower.includes("against")) ||
			(questionLower.includes("most clean sheet") && questionLower.includes("against")) ||
			((questionLower.includes("which team") || questionLower.includes("what team") || questionLower.includes("which opposition") || questionLower.includes("what opposition")) && 
			 questionLower.includes("kept") && questionLower.includes("clean sheet")) ||
			(questionLower.includes("against") && (questionLower.includes("which team") || questionLower.includes("what team")) && 
			 questionLower.includes("kept") && questionLower.includes("clean sheet"));

		loggingService.log(`🔍 Checking for "opposition clean sheets" question. Question: "${questionLower}", isOppositionCleanSheetsQuestion: ${isOppositionCleanSheetsQuestion}`, null, "log");

		// If this is a "clean sheets against opposition" question, handle it specially
		if (isOppositionCleanSheetsQuestion) {
			let playerName = entities.length > 0 ? entities[0] : undefined;
			
			// If entity is "I" or "my" (from "my", "I", etc.), use userContext instead
			if (playerName && (playerName.toLowerCase() === "i" || playerName.toLowerCase() === "my")) {
				if (userContext) {
					playerName = userContext;
				} else {
					// No userContext available for "I" or "my"
					return {
						type: "no_context",
						data: [],
						message: "Please specify which player you're asking about, or log in to use 'I' in your question.",
					};
				}
			}
			
			// If we have a player name (either from entities or userContext), resolve and query
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
				
				loggingService.log(`🔍 Resolved player name: ${resolvedPlayerName}, calling queryPlayerCleanSheetsAgainstOpposition`, null, "log");
				return await RelationshipQueryHandler.queryPlayerCleanSheetsAgainstOpposition(resolvedPlayerName);
			} else if (userContext) {
				// Use userContext if no player entity found
				const resolvedPlayerName = await EntityResolutionUtils.resolvePlayerName(userContext);
				
				if (!resolvedPlayerName) {
					loggingService.log(`❌ Player not found: ${userContext}`, null, "error");
					return {
						type: "player_not_found",
						data: [],
						message: `I couldn't find a player named "${userContext}". Please check the spelling or try a different player name.`,
						playerName: userContext,
					};
				}
				
				loggingService.log(`🔍 Resolved player name from context: ${resolvedPlayerName}, calling queryPlayerCleanSheetsAgainstOpposition`, null, "log");
				return await RelationshipQueryHandler.queryPlayerCleanSheetsAgainstOpposition(resolvedPlayerName);
			} else {
				// No player entity found and no userContext available
				return {
					type: "no_context",
					data: [],
					message: "Please specify which player you're asking about, or log in to use 'I' in your question.",
				};
			}
		}

		// Check for generic stat type against opposition questions (assists, saves, cards, etc.)
		// Pattern: "Which/What team/opposition have I [stat] the most against?"
		// Exclude goals and clean sheets (already handled above)
		const hasStatKeyword = questionLower.includes("assist") || questionLower.includes("save") || 
			questionLower.includes("yellow card") || questionLower.includes("booking") ||
			questionLower.includes("red card") || questionLower.includes("man of the match") ||
			questionLower.includes("mom") || (questionLower.includes("appearance") && !questionLower.includes("clean sheet")) || 
			(questionLower.includes("game") && !questionLower.includes("clean sheet") && !questionLower.includes("goal")) || 
			questionLower.includes("own goal") || questionLower.includes("penalt");
		
		const isGenericStatAgainstOpposition = 
			!isOppositionGoalsQuestion && !isOppositionCleanSheetsQuestion &&
			((questionLower.includes("which team") || questionLower.includes("what team") || 
			  questionLower.includes("which opposition") || questionLower.includes("what opposition") ||
			  (questionLower.includes("against") && (questionLower.includes("which team") || questionLower.includes("what team")))) &&
			 questionLower.includes("most") && questionLower.includes("against") &&
			 hasStatKeyword);

		if (isGenericStatAgainstOpposition) {
			let playerName = entities.length > 0 ? entities[0] : undefined;
			
			// If entity is "I" or "my", use userContext instead
			if (playerName && (playerName.toLowerCase() === "i" || playerName.toLowerCase() === "my")) {
				if (userContext) {
					playerName = userContext;
				} else {
					return {
						type: "no_context",
						data: [],
						message: "Please specify which player you're asking about, or log in to use 'I' in your question.",
					};
				}
			}
			
			// Resolve player name
			const resolvedPlayerName = playerName 
				? await EntityResolutionUtils.resolvePlayerName(playerName)
				: userContext 
					? await EntityResolutionUtils.resolvePlayerName(userContext)
					: null;
			
			if (!resolvedPlayerName) {
				const nameToCheck = playerName || userContext || "Unknown";
				loggingService.log(`❌ Player not found: ${nameToCheck}`, null, "error");
				return {
					type: "player_not_found",
					data: [],
					message: `I couldn't find a player named "${nameToCheck}". Please check the spelling or try a different player name.`,
					playerName: nameToCheck,
				};
			}
			
			// Use generic query method to detect and query the stat type
			const result = await RelationshipQueryHandler.queryPlayerStatAgainstOppositionFromQuestion(
				resolvedPlayerName,
				questionLower
			);
			
			if (result) {
				return result;
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
			// Check for personal questions (I, me, my) - use userContext
			const isPersonalQuestion = questionLower.includes(" i ") || questionLower.includes(" i've") || 
				questionLower.includes(" have i ") || questionLower.includes(" have you ") ||
				questionLower.includes(" my ") || questionLower.includes(" me ");
			
			// Filter out pronouns from entities
			const pronouns = ["i", "me", "my", "myself", "i've", "you", "your"];
			const validEntities = entities.filter(e => !pronouns.includes(e.toLowerCase()));
			
			// Determine player name: prioritize valid entities, then userContext for personal questions
			let playerName: string | undefined = undefined;
			if (validEntities.length > 0) {
				playerName = validEntities[0];
			} else if (isPersonalQuestion && userContext) {
				playerName = userContext;
			}
			
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
				
				loggingService.log(`🔍 Resolved player name: ${resolvedPlayerName}, calling queryMostPlayedAgainstOpposition`, null, "log");
				return await RelationshipQueryHandler.queryMostPlayedAgainstOpposition(resolvedPlayerName);
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

		// Check for "most prolific season", "highest scoring season", or "season I scored the most goals" questions (same question, different wording)
		// Helper function to detect various patterns
		const detectMostGoalsSeasonPattern = (q: string): boolean => {
			const lower = q.toLowerCase();
			// Pattern 1: "most prolific season" or "highest scoring season"
			if ((lower.includes("most prolific season") || 
				 lower.includes("prolific season") ||
				 lower.includes("highest scoring season") ||
				 (lower.includes("highest") && lower.includes("scoring") && lower.includes("season")))) {
				return true;
			}
			// Pattern 2: "season I scored the most goals" / "season I scored most goals"
			if (lower.includes("season") && lower.includes("scored") && 
				(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
				return true;
			}
			// Pattern 3: "season did I score the most goals" / "season did I score most goals"
			if (lower.includes("season") && lower.includes("did") && lower.includes("score") && 
				(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
				return true;
			}
			// Pattern 4: "when did I score the most goals" / "when did I score most goals"
			if (lower.includes("when") && lower.includes("did") && lower.includes("score") && 
				(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
				return true;
			}
			// Pattern 5: "season with the most goals" / "season with most goals"
			if (lower.includes("season") && lower.includes("with") && 
				(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
				return true;
			}
			// Pattern 6: "which season" + "most goals" / "what season" + "most goals"
			if ((lower.includes("which season") || lower.includes("what season")) && 
				(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
				return true;
			}
			return false;
		};
		
		const isMostProlificSeasonQuestion = 
			detectMostGoalsSeasonPattern(questionLower) &&
			(questionLower.includes("what") || questionLower.includes("which") || questionLower.includes("when") || questionLower.includes("my") || questionLower.includes("your") || questionLower.includes("i ") || questionLower.includes(" did"));

		if (isMostProlificSeasonQuestion && (entities.length > 0 || userContext)) {
			// Resolve player name - prioritize explicit player entities from question over userContext
			let playerName = "";
			// Check for explicit player entities (not first-person pronouns) in the question
			// Filter out all first-person pronouns (I, my, me, myself, i've)
			// Also filter out invalid player names that contain "season", "scoring", etc.
			const firstPersonPronouns = ["i", "my", "me", "myself", "i've"];
			const invalidPlayerNamePatterns = ["season", "scoring", "prolific", "highest", "most"];
			const playerEntities = analysis.extractionResult?.entities?.filter(e => {
				if (e.type !== "player") return false;
				const lowerValue = e.value.toLowerCase();
				// Filter out first-person pronouns
				if (firstPersonPronouns.includes(lowerValue)) return false;
				// Filter out invalid player names that contain season/scoring related words
				if (invalidPlayerNamePatterns.some(pattern => lowerValue.includes(pattern))) return false;
				return true;
			}) || [];
			if (playerEntities.length > 0) {
				// Explicit player name mentioned in question takes priority
				playerName = playerEntities[0].value;
			} else {
				// Skip regex extraction for most prolific season questions - they use first-person pronouns
				// and should rely on userContext instead of trying to extract names from question text
				// The regex patterns can incorrectly match parts of the question like "scoring season"
				// For most prolific season questions, we should never extract player names from question text
				// when using first-person pronouns - just skip to using entities/userContext
				
				// Only fall back to entities/userContext if no name extracted from question
				if (!playerName) {
					if (entities.length > 0) {
						playerName = entities[0];
						// Fix: If entity is "I" or "my" (from "my", "I", etc.), use userContext instead
						if ((playerName.toLowerCase() === "i" || playerName.toLowerCase() === "my") && userContext) {
							playerName = userContext;
						}
					} else if (userContext) {
						playerName = userContext;
					}
				}
			}
			
			if (!playerName) {
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

		// Check for "which season did I play the most minutes" questions
		const detectMostMinutesSeasonPattern = (q: string): boolean => {
			const lower = q.toLowerCase();
			// Pattern: "which season did I play the most minutes" / "what season did I play the most minutes"
			if ((lower.includes("which season") || lower.includes("what season")) && 
				lower.includes("play") && 
				(lower.includes("most minutes") || (lower.includes("most") && lower.includes("minutes")))) {
				return true;
			}
			// Pattern: "season I played the most minutes" / "season did I play most minutes"
			if (lower.includes("season") && lower.includes("play") && 
				(lower.includes("most minutes") || (lower.includes("most") && lower.includes("minutes")))) {
				return true;
			}
			return false;
		};

		const isMostMinutesSeasonQuestion = 
			detectMostMinutesSeasonPattern(questionLower) &&
			(questionLower.includes("what") || questionLower.includes("which") || questionLower.includes("my") || questionLower.includes("your") || questionLower.includes("i ") || questionLower.includes(" did"));

		if (isMostMinutesSeasonQuestion && (entities.length > 0 || userContext)) {
			// Resolve player name - prioritize explicit player entities from question over userContext
			let playerName = "";
			const firstPersonPronouns = ["i", "my", "me", "myself", "i've"];
			const invalidPlayerNamePatterns = ["season", "minutes", "most", "play"];
			const playerEntities = analysis.extractionResult?.entities?.filter(e => {
				if (e.type !== "player") return false;
				const lowerValue = e.value.toLowerCase();
				if (firstPersonPronouns.includes(lowerValue)) return false;
				if (invalidPlayerNamePatterns.some(pattern => lowerValue.includes(pattern))) return false;
				return true;
			}) || [];
			if (playerEntities.length > 0) {
				playerName = playerEntities[0].value;
			} else {
				if (entities.length > 0) {
					playerName = entities[0];
					if ((playerName.toLowerCase() === "i" || playerName.toLowerCase() === "my") && userContext) {
						playerName = userContext;
					}
				} else if (userContext) {
					playerName = userContext;
				}
			}
			
			if (!playerName) {
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

			loggingService.log(`🔍 Querying most minutes season for ${resolvedPlayerName}`, null, "log");
			// Use MostMinutesSeason metric to trigger the special case query
			const query = PlayerQueryBuilder.buildPlayerQuery(resolvedPlayerName, "MostMinutesSeason", analysis);
			
			try {
				const chatbotService = ChatbotService.getInstance();
				chatbotService.lastExecutedQueries.push(`MOST_MINUTES_SEASON: ${query}`);
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
						message: `I couldn't find any season minutes data for ${resolvedPlayerName}.`,
					};
				}

				return {
					type: "specific_player",
					playerName: resolvedPlayerName,
					metric: "MostMinutesSeason",
					data: result,
				};
			} catch (error) {
				loggingService.log(`❌ Error querying most minutes season:`, error, "error");
				return {
					type: "error",
					data: [],
					error: error instanceof Error ? error.message : String(error),
				};
			}
		}

		// Check for "which season did I appear in the most matches" questions
		const detectMostAppearancesSeasonPattern = (q: string): boolean => {
			const lower = q.toLowerCase();
			// Pattern: "which season did I appear in the most matches" / "what season did I appear in the most matches"
			const pattern1Match = (lower.includes("which season") || lower.includes("what season")) && 
				lower.includes("appear") && 
				(lower.includes("most matches") || lower.includes("most appearances") || 
				 (lower.includes("most") && (lower.includes("matches") || lower.includes("appearances"))));
			// Pattern: "season I appeared in the most matches" / "season did I appear most"
			const pattern2Match = lower.includes("season") && lower.includes("appear") && 
				(lower.includes("most matches") || lower.includes("most appearances") || 
				 (lower.includes("most") && (lower.includes("matches") || lower.includes("appearances"))));
			const result = pattern1Match || pattern2Match;
			return result;
		};

		const patternMatchResult = detectMostAppearancesSeasonPattern(questionLower);
		const secondConditionCheck = questionLower.includes("what") || questionLower.includes("which") || questionLower.includes("my") || questionLower.includes("your") || questionLower.includes("i ") || questionLower.includes(" did");
		const isMostAppearancesSeasonQuestion = patternMatchResult && secondConditionCheck;

		if (isMostAppearancesSeasonQuestion && (entities.length > 0 || userContext)) {
			// Resolve player name - prioritize explicit player entities from question over userContext
			let playerName = "";
			const firstPersonPronouns = ["i", "my", "me", "myself", "i've"];
			const invalidPlayerNamePatterns = ["season", "matches", "appearances", "most", "appear"];
			const playerEntities = analysis.extractionResult?.entities?.filter(e => {
				if (e.type !== "player") return false;
				const lowerValue = e.value.toLowerCase();
				if (firstPersonPronouns.includes(lowerValue)) return false;
				if (invalidPlayerNamePatterns.some(pattern => lowerValue.includes(pattern))) return false;
				return true;
			}) || [];
			
			if (playerEntities.length > 0) {
				playerName = playerEntities[0].value;
				// For first-person questions, prioritize userContext over playerEntities if they don't match
				const questionLower = analysis.question?.toLowerCase() || "";
				const isFirstPersonQuestion = questionLower.includes(" i ") || questionLower.includes(" my ") || 
					questionLower.startsWith("i ") || questionLower.startsWith("my ") ||
					questionLower.includes(" did i ") || questionLower.includes(" did my ");
				
				if (isFirstPersonQuestion && userContext && playerName.toLowerCase() !== userContext.toLowerCase()) {
					// First-person question but playerEntity doesn't match userContext - use userContext
					playerName = userContext;
				}
			} else {
				if (entities.length > 0) {
					playerName = entities[0];
					// For first-person questions, prioritize userContext over entities if they don't match
					const questionLower = analysis.question?.toLowerCase() || "";
					const isFirstPersonQuestion = questionLower.includes(" i ") || questionLower.includes(" my ") || 
						questionLower.startsWith("i ") || questionLower.startsWith("my ") ||
						questionLower.includes(" did i ") || questionLower.includes(" did my ");
					
					if (isFirstPersonQuestion && userContext && playerName.toLowerCase() !== userContext.toLowerCase()) {
						// First-person question but entity doesn't match userContext - use userContext
						playerName = userContext;
					} else if ((playerName.toLowerCase() === "i" || playerName.toLowerCase() === "my") && userContext) {
						playerName = userContext;
					}
				} else if (userContext) {
					playerName = userContext;
				}
			}
			
			if (!playerName) {
				return {
					type: "no_context",
					data: [],
					message: "Please specify which player you're asking about, or log in to use 'I' in your question."
				};
			}
			
			// Check if player name matches userContext before fuzzy matching
			let resolvedPlayerName: string;
			const playerNameNormalized = playerName.toLowerCase().trim();
			const userContextNormalized = userContext?.toLowerCase().trim();
			
			if (userContext && playerNameNormalized === userContextNormalized) {
				// Player name already matches the selected player, use it directly
				resolvedPlayerName = userContext;
				loggingService.log(`✅ Using selected player directly: ${resolvedPlayerName} (matched ${playerName})`, null, "log");
			} else if (userContext && userContextNormalized && userContextNormalized.includes(playerNameNormalized) && playerNameNormalized.length >= 2) {
				// Player name is a partial match of the selected player (e.g., "Luke" matches "Luke Bangs")
				// Use the full selected player name
				resolvedPlayerName = userContext;
				loggingService.log(`✅ Using selected player for partial match: ${resolvedPlayerName} (matched partial ${playerName})`, null, "log");
			} else {
				// Resolve player name with fuzzy matching
				const fuzzyResolved = await EntityResolutionUtils.resolvePlayerName(playerName);
				
				if (!fuzzyResolved) {
					loggingService.log(`❌ Player not found: ${playerName}`, null, "error");
					return {
						type: "player_not_found",
						data: [],
						message: `I couldn't find a player named "${playerName}". Please check the spelling or try a different player name.`,
						playerName,
					};
				}
				
				resolvedPlayerName = fuzzyResolved;
				loggingService.log(`🔍 Resolved player name via fuzzy matching: ${playerName} → ${resolvedPlayerName}`, null, "log");
			}

			loggingService.log(`🔍 Querying most appearances season for ${resolvedPlayerName}`, null, "log");
			// Use MostAppearancesSeason metric to trigger the special case query
			const query = PlayerQueryBuilder.buildPlayerQuery(resolvedPlayerName, "MostAppearancesSeason", analysis);
			
			try {
				const chatbotService = ChatbotService.getInstance();
				chatbotService.lastExecutedQueries.push(`MOST_APPEARANCES_SEASON: ${query}`);
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
						message: `I couldn't find any season appearances data for ${resolvedPlayerName}.`,
					};
				}

				return {
					type: "specific_player",
					playerName: resolvedPlayerName,
					metric: "MostAppearancesSeason",
					data: result,
				};
			} catch (error) {
				loggingService.log(`❌ Error querying most appearances season:`, error, "error");
				return {
					type: "error",
					data: [],
					error: error instanceof Error ? error.message : String(error),
				};
			}
		}

		// Check for "which season did I record my highest combined goals + assists total" questions
		const detectHighestGoalsAssistsSeasonPattern = (q: string): boolean => {
			const lower = q.toLowerCase();
			// Pattern: "which season did I record my highest combined goals + assists total"
			if ((lower.includes("which season") || lower.includes("what season")) && 
				lower.includes("record") && 
				lower.includes("highest") && 
				(lower.includes("combined") || lower.includes("goals") && lower.includes("assists")) &&
				(lower.includes("total") || lower.includes("goals") && lower.includes("assists"))) {
				return true;
			}
			// Pattern: "season I recorded highest goals + assists" / "season did I record highest combined"
			if (lower.includes("season") && lower.includes("record") && 
				lower.includes("highest") && 
				(lower.includes("combined") || (lower.includes("goals") && lower.includes("assists")))) {
				return true;
			}
			return false;
		};

		const isHighestGoalsAssistsSeasonQuestion = 
			detectHighestGoalsAssistsSeasonPattern(questionLower) &&
			(questionLower.includes("what") || questionLower.includes("which") || questionLower.includes("my") || questionLower.includes("your") || questionLower.includes("i ") || questionLower.includes(" did"));

		if (isHighestGoalsAssistsSeasonQuestion && (entities.length > 0 || userContext)) {
			// Resolve player name - prioritize explicit player entities from question over userContext
			let playerName = "";
			const firstPersonPronouns = ["i", "my", "me", "myself", "i've"];
			const invalidPlayerNamePatterns = ["season", "goals", "assists", "combined", "highest", "record", "total"];
			const playerEntities = analysis.extractionResult?.entities?.filter(e => {
				if (e.type !== "player") return false;
				const lowerValue = e.value.toLowerCase();
				if (firstPersonPronouns.includes(lowerValue)) return false;
				if (invalidPlayerNamePatterns.some(pattern => lowerValue.includes(pattern))) return false;
				return true;
			}) || [];
			if (playerEntities.length > 0) {
				playerName = playerEntities[0].value;
			} else {
				if (entities.length > 0) {
					playerName = entities[0];
					if ((playerName.toLowerCase() === "i" || playerName.toLowerCase() === "my") && userContext) {
						playerName = userContext;
					}
				} else if (userContext) {
					playerName = userContext;
				}
			}
			
			if (!playerName) {
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

			loggingService.log(`🔍 Querying highest goals+assists season for ${resolvedPlayerName}`, null, "log");
			// Use HighestGoalsAssistsSeason metric to trigger the special case query
			const query = PlayerQueryBuilder.buildPlayerQuery(resolvedPlayerName, "HighestGoalsAssistsSeason", analysis);
			
			try {
				const chatbotService = ChatbotService.getInstance();
				chatbotService.lastExecutedQueries.push(`HIGHEST_GOALS_ASSISTS_SEASON: ${query}`);
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
						message: `I couldn't find any season goals+assists data for ${resolvedPlayerName}.`,
					};
				}

				return {
					type: "specific_player",
					playerName: resolvedPlayerName,
					metric: "HighestGoalsAssistsSeason",
					data: result,
				};
			} catch (error) {
				loggingService.log(`❌ Error querying highest goals+assists season:`, error, "error");
				return {
					type: "error",
					data: [],
					error: error instanceof Error ? error.message : String(error),
				};
			}
		}

		// Check for "how many goals have I scored in matches played on Sundays only" questions
		const detectSundayGoalsPattern = (q: string): boolean => {
			const lower = q.toLowerCase();
			// Pattern: "how many goals" + "sunday" or "sundays"
			if (lower.includes("how many goals") && (lower.includes("sunday") || lower.includes("sundays"))) {
				return true;
			}
			// Pattern: "goals" + "sunday" + ("only" or "matches")
			if (lower.includes("goals") && lower.includes("sunday") && 
				(lower.includes("only") || lower.includes("matches") || lower.includes("played"))) {
				return true;
			}
			// Pattern: "scored" + "sunday"
			if (lower.includes("scored") && lower.includes("sunday")) {
				return true;
			}
			return false;
		};

		const isSundayGoalsQuestion = 
			detectSundayGoalsPattern(questionLower) &&
			(questionLower.includes("how many") || questionLower.includes("i ") || questionLower.includes("my") || questionLower.includes("your") || questionLower.includes(" have"));

		if (isSundayGoalsQuestion && (entities.length > 0 || userContext)) {
			// Resolve player name - prioritize explicit player entities from question over userContext
			let playerName = "";
			const firstPersonPronouns = ["i", "my", "me", "myself", "i've"];
			const invalidPlayerNamePatterns = ["sunday", "sundays", "goals", "matches", "only"];
			const playerEntities = analysis.extractionResult?.entities?.filter(e => {
				if (e.type !== "player") return false;
				const lowerValue = e.value.toLowerCase();
				if (firstPersonPronouns.includes(lowerValue)) return false;
				if (invalidPlayerNamePatterns.some(pattern => lowerValue.includes(pattern))) return false;
				return true;
			}) || [];
			if (playerEntities.length > 0) {
				playerName = playerEntities[0].value;
			} else {
				if (entities.length > 0) {
					playerName = entities[0];
					if ((playerName.toLowerCase() === "i" || playerName.toLowerCase() === "my") && userContext) {
						playerName = userContext;
					}
				} else if (userContext) {
					playerName = userContext;
				}
			}
			
			if (!playerName) {
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

			loggingService.log(`🔍 Querying Sunday goals for ${resolvedPlayerName}`, null, "log");
			
			// Build Cypher query to get goals + penaltiesScored from MatchDetail nodes
			// connected to Fixture nodes where the date is a Sunday (dayOfWeek = 7 in Neo4j, where 1 = Monday, 7 = Sunday)
			const graphLabel = neo4jService.getGraphLabel();
			const query = `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
				WHERE date(f.date).dayOfWeek = 7
				RETURN sum(coalesce(md.goals, 0) + coalesce(md.penaltiesScored, 0)) as totalGoals
			`;
			
			try {
				const chatbotService = ChatbotService.getInstance();
				chatbotService.lastExecutedQueries.push(`SUNDAY_GOALS: ${query}`);
				chatbotService.lastExecutedQueries.push(`PARAMS: ${JSON.stringify({ playerName: resolvedPlayerName, graphLabel })}`);

				const result = await QueryExecutionUtils.executeQueryWithProfiling(query, {
					playerName: resolvedPlayerName,
					graphLabel,
				});

				if (!result || !Array.isArray(result) || result.length === 0) {
					return {
						type: "specific_player",
						playerName: resolvedPlayerName,
						data: [{ totalGoals: 0 }],
						message: `I couldn't find any Sunday match data for ${resolvedPlayerName}.`,
					};
				}

				const totalGoals = result[0]?.totalGoals || 0;

				return {
					type: "specific_player",
					playerName: resolvedPlayerName,
					metric: "SundayGoals",
					data: [{ totalGoals }],
				};
			} catch (error) {
				loggingService.log(`❌ Error querying Sunday goals:`, error, "error");
				return {
					type: "error",
					data: [],
					error: error instanceof Error ? error.message : String(error),
				};
			}
		}

		// Check for "how many appearances did I make on Saturdays in 2022" questions
		const detectSaturdayAppearancesPattern = (q: string): boolean => {
			const lower = q.toLowerCase();
			// Pattern: "appearances" or "app" + "saturday" or "saturdays" + year "2022"
			if ((lower.includes("appearance") || lower.includes("app")) && 
				(lower.includes("saturday") || lower.includes("saturdays")) &&
				lower.includes("2022")) {
				return true;
			}
			return false;
		};

		const isSaturdayAppearancesQuestion = 
			detectSaturdayAppearancesPattern(questionLower) &&
			(questionLower.includes("how many") || questionLower.includes("i ") || questionLower.includes("my") || questionLower.includes("your") || questionLower.includes(" have"));

		if (isSaturdayAppearancesQuestion && (entities.length > 0 || userContext)) {
			// Resolve player name - prioritize explicit player entities from question over userContext
			let playerName = "";
			const firstPersonPronouns = ["i", "my", "me", "myself", "i've"];
			const invalidPlayerNamePatterns = ["saturday", "saturdays", "appearances", "app", "matches", "2022"];
			const playerEntities = analysis.extractionResult?.entities?.filter(e => {
				if (e.type !== "player") return false;
				const lowerValue = e.value.toLowerCase();
				if (firstPersonPronouns.includes(lowerValue)) return false;
				if (invalidPlayerNamePatterns.some(pattern => lowerValue.includes(pattern))) return false;
				return true;
			}) || [];
			if (playerEntities.length > 0) {
				playerName = playerEntities[0].value;
			} else {
				if (entities.length > 0) {
					playerName = entities[0];
					if ((playerName.toLowerCase() === "i" || playerName.toLowerCase() === "my") && userContext) {
						playerName = userContext;
					}
				} else if (userContext) {
					playerName = userContext;
				}
			}
			
			if (!playerName) {
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

			loggingService.log(`🔍 Querying Saturday appearances in 2022 for ${resolvedPlayerName}`, null, "log");
			
			// Build Cypher query to count MatchDetail nodes attached to the selected player
			// that are from a Fixture in the year 2022 and were played on a Saturday
			// Saturday = dayOfWeek = 6 in Neo4j (1=Monday, 7=Sunday, so 6=Saturday)
			const graphLabel = neo4jService.getGraphLabel();
			const query = `
				MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
				MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
				WHERE date(f.date).dayOfWeek = 6
				  AND f.date >= '2022-01-01' 
				  AND f.date <= '2022-12-31'
				RETURN count(md) as appearances
			`;
			
			try {
				const chatbotService = ChatbotService.getInstance();
				chatbotService.lastExecutedQueries.push(`SATURDAY_APPEARANCES_2022: ${query}`);
				chatbotService.lastExecutedQueries.push(`PARAMS: ${JSON.stringify({ playerName: resolvedPlayerName, graphLabel })}`);

				const result = await QueryExecutionUtils.executeQueryWithProfiling(query, {
					playerName: resolvedPlayerName,
					graphLabel,
				});

				if (!result || !Array.isArray(result) || result.length === 0) {
					return {
						type: "specific_player",
						playerName: resolvedPlayerName,
						data: [{ appearances: 0 }],
						message: `I couldn't find any Saturday match data for ${resolvedPlayerName} in 2022.`,
					};
				}

				const appearances = result[0]?.appearances || 0;

				return {
					type: "specific_player",
					playerName: resolvedPlayerName,
					metric: "SaturdayAppearances2022",
					data: [{ appearances }],
				};
			} catch (error) {
				loggingService.log(`❌ Error querying Saturday appearances in 2022:`, error, "error");
				return {
					type: "error",
					data: [],
					error: error instanceof Error ? error.message : String(error),
				};
			}
		}

		// CRITICAL: Skip season comparison check if this is a "best season for stat" question
		// These questions need special handling via BEST_SEASON_FOR_STAT metric, not generic season comparison
		const isBestSeasonForStatQuestion = metrics.length > 0 && (
			metrics[0].toUpperCase() === "BEST_SEASON_FOR_STAT" ||
			metrics[0].toUpperCase() === "BESTSEASONFORSTAT"
		);
		
		// Check for season comparison questions (but exclude "best season for [stat]" questions)
		const isSeasonComparisonQuestion = !isBestSeasonForStatQuestion && (
			(questionLower.includes("compare") && questionLower.includes("season")) ||
			(questionLower.includes("vs") && (questionLower.includes("season") || /\d{4}[\/\-]\d{2}/.test(questionLower))) ||
			(questionLower.includes("versus") && (questionLower.includes("season") || /\d{4}[\/\-]\d{2}/.test(questionLower))) ||
			(questionLower.includes("best season") || questionLower.includes("worst season"))
		);

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

			// CRITICAL: Check if originalMetric is already a percentage metric - if so, don't override it
			const isPercentageMetric = originalMetric && (
				originalMetric.includes("%") || 
				originalMetric.includes("Percentage") ||
				originalMetric.includes("Games % Won") ||
				originalMetric.includes("Games % Lost") ||
				originalMetric.includes("Games % Drawn")
			);

			if (!isPercentageMetric) {
				// Check for per-appearance metrics FIRST (before general goals check)
				const hasPerAppearancePhrase = questionLower.includes("per appearance") || 
					questionLower.includes("per app") || 
					questionLower.includes("per game") || 
					questionLower.includes("per match") ||
					(questionLower.includes("on average") && questionLower.includes("per"));
				
				if (questionLower.includes("yellow card") || questionLower.includes("yelow card") || questionLower.includes("booking") || questionLower.includes("yellows")) {
					// Handle typo "yelow" as well as correct "yellow"
					detectedMetricFromQuestion = "Y";
				} else if (questionLower.includes("red card") || questionLower.includes("reds")) {
					detectedMetricFromQuestion = "R";
				} else if (questionLower.includes("assist")) {
					detectedMetricFromQuestion = "A";
				} else if (questionLower.includes("own goal") || questionLower.includes("own goals")) {
					// Check for own goals BEFORE general goals to ensure correct metric
					detectedMetricFromQuestion = "OG";
				} else if (questionLower.includes("conceded") && hasPerAppearancePhrase) {
					// Check for conceded per appearance BEFORE general conceded
					detectedMetricFromQuestion = "CperAPP";
				} else if (questionLower.includes("conceded")) {
					// Check for goals conceded BEFORE general goals to ensure correct metric
					detectedMetricFromQuestion = "C";
				} else if (questionLower.includes("penalt") && (questionLower.includes("scored") || questionLower.includes("score"))) {
					// Check for penalties scored BEFORE general goals to ensure correct metric
					detectedMetricFromQuestion = "PSC";
				} else if ((questionLower.includes("open play") || questionLower.includes("openplay")) && questionLower.includes("goal")) {
					// Check for open play goals BEFORE general goals to ensure correct metric
					detectedMetricFromQuestion = "OPENPLAYGOALS";
				} else if (questionLower.includes("fantasy points") && hasPerAppearancePhrase) {
					// Check for fantasy points per appearance BEFORE general fantasy points
					detectedMetricFromQuestion = "FTPperAPP";
				} else if (questionLower.includes("goal") && hasPerAppearancePhrase && !questionLower.includes("assist")) {
					// Check for goals per appearance BEFORE general goals
					detectedMetricFromQuestion = "GperAPP";
				} else if (questionLower.includes("goal") && !questionLower.includes("assist")) {
					detectedMetricFromQuestion = "G";
				} else if ((questionLower.includes("home games") || questionLower.includes("home game")) && 
					(questionLower.includes("played") || questionLower.includes("won") || questionLower.includes("lost") || questionLower.includes("drawn"))) {
					// Check for home games queries BEFORE general appearance check
					detectedMetricFromQuestion = "HomeGames";
				} else if ((questionLower.includes("away games") || questionLower.includes("away game")) && 
					(questionLower.includes("played") || questionLower.includes("won") || questionLower.includes("lost") || questionLower.includes("drawn"))) {
					// Check for away games queries BEFORE general appearance check
					detectedMetricFromQuestion = "AwayGames";
				} else if (questionLower.includes("appearance") || questionLower.includes("app") || questionLower.includes("game")) {
					// Only detect appearances if assists/goals/yellow cards/red cards are NOT mentioned
					if (!questionLower.includes("assist") && !questionLower.includes("goal") && 
						!questionLower.includes("yellow") && !questionLower.includes("red card")) {
						detectedMetricFromQuestion = "APP";
					}
				}
			}
			
			// CRITICAL: Don't override team-specific metrics (e.g., "4th XI Apps", "3sApps") with generic "APP"
			// Check if originalMetric is a team-specific metric before using detectedMetricFromQuestion
			const isTeamSpecificMetric = originalMetric && (
				originalMetric.match(/^\d+sApps$/i) ||
				originalMetric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i) ||
				originalMetric.match(/^\d+sGoals$/i) ||
				originalMetric.match(/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i)
			);
			
			// CRITICAL: Don't override special case metrics (e.g., "BestSeasonForStat", "MostProlificSeason", per-appearance metrics, home/away games) with detected metrics
			// These metrics have custom query builders and should be preserved
			const isSpecialCaseMetric = originalMetric && (
				originalMetric.toUpperCase() === "BEST_SEASON_FOR_STAT" ||
				originalMetric.toUpperCase() === "BESTSEASONFORSTAT" ||
				originalMetric.toUpperCase() === "MOSTPROLIFICSEASON" ||
				originalMetric.toUpperCase() === "MOSTMINUTESSEASON" ||
				originalMetric.toUpperCase() === "MOSTAPPEARANCESSEASON" ||
				originalMetric.toUpperCase() === "HIGHESTGOALSASSISTSSEASON" ||
				originalMetric.toUpperCase() === "GPERAPP" ||
				originalMetric.toUpperCase() === "CPERAPP" ||
				originalMetric.toUpperCase() === "FTPPERAPP" ||
				originalMetric.toUpperCase() === "MPERG" ||
				originalMetric.toUpperCase() === "MPERCLS" ||
				originalMetric.toUpperCase() === "HOMEGAMES" ||
				originalMetric.toUpperCase() === "AWAYGAMES" ||
				originalMetric.toUpperCase() === "HOME" ||
				originalMetric.toUpperCase() === "AWAY"
			);
			
			// CRITICAL: If question explicitly mentions assists/goals/yellow cards/red cards, prioritize that over team-specific metrics
			// This fixes cases like "How many assists has Luke Bangs got when not playing for the 3s?"
			// where the analysis incorrectly identifies "3sApps" but the question clearly asks for assists
			// BUT: Don't override per-appearance metrics or home/away games with general goals/appearances
			const hasExplicitMetricRequest = detectedMetricFromQuestion && 
				(detectedMetricFromQuestion === "A" || detectedMetricFromQuestion === "G" || 
				 detectedMetricFromQuestion === "Y" || detectedMetricFromQuestion === "R");
			const isHomeAwayGamesMetric = originalMetric && (
				originalMetric.toUpperCase() === "HOMEGAMES" ||
				originalMetric.toUpperCase() === "AWAYGAMES" ||
				originalMetric.toUpperCase() === "HOME" ||
				originalMetric.toUpperCase() === "AWAY"
			);
			
			// Use detected metric from question if available, but preserve team-specific metrics and special case metrics
			// UNLESS question explicitly requests a different metric (and it's not a special case)
			// CRITICAL: If originalMetric is a per-appearance metric (GperAPP, CperAPP, FTPperAPP) or home/away games, preserve it
			const isPerAppearanceMetric = originalMetric && (
				originalMetric.toUpperCase() === "GPERAPP" ||
				originalMetric.toUpperCase() === "CPERAPP" ||
				originalMetric.toUpperCase() === "FTPPERAPP"
			);
			// If detected metric is HomeGames/AwayGames, use it (it was detected from question)
			// If original metric is HomeGames/AwayGames, preserve it
			const metricToUse = (isTeamSpecificMetric && !hasExplicitMetricRequest) || isSpecialCaseMetric || isPerAppearanceMetric || isHomeAwayGamesMetric
				? originalMetric 
				: (detectedMetricFromQuestion || originalMetric);

			// Normalize metric names before uppercase conversion
			let normalizedMetric = metricToUse;
			if (metricToUse === "Home Games % Won") {
				normalizedMetric = "HomeGames%Won";
			} else if (metricToUse === "Away Games % Won") {
				normalizedMetric = "AwayGames%Won";
			} else if (metricToUse === "Games % Won") {
				normalizedMetric = "Games%Won";
			} else if (metricToUse === "Home Games % Lost") {
				normalizedMetric = "HomeGames%Lost";
			} else if (metricToUse === "Away Games % Lost") {
				normalizedMetric = "AwayGames%Lost";
			} else if (metricToUse === "Games % Lost") {
				normalizedMetric = "Games%Lost";
			} else if (metricToUse === "Home Games % Drawn") {
				normalizedMetric = "HomeGames%Drawn";
			} else if (metricToUse === "Away Games % Drawn") {
				normalizedMetric = "AwayGames%Drawn";
			} else if (metricToUse === "Games % Drawn") {
				normalizedMetric = "Games%Drawn";
			} else if (metricToUse === "Home Games") {
				normalizedMetric = "HomeGames";
			} else if (metricToUse === "Away Games") {
				normalizedMetric = "AwayGames";
			}

			const metric = normalizedMetric.toUpperCase();

			// Check if this is a team-specific question
			if (playerName.match(/^\d+(?:st|nd|rd|th)?$/)) {
				return await PlayerDataQueryHandler.queryTeamSpecificPlayerData(playerName, metric);
			}

			// Check for partial name that needs clarification BEFORE resolving
			const partialNameCheck = PlayerDataQueryHandler.checkPartialNameClarification(playerName, userContext);
			if (partialNameCheck && partialNameCheck.needsClarification && partialNameCheck.message) {
				loggingService.log(`⚠️ Partial player name detected: ${playerName}`, null, "warn");
				return {
					type: "clarification_needed",
					data: [],
					message: partialNameCheck.message,
					answerValue: "Clarification needed",
				};
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
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'playerDataQueryHandler.ts:2497',message:'BEFORE buildPlayerQuery',data:{metric,analysisResults:analysis.results,playerName:actualPlayerName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'P'})}).catch(()=>{});
			// #endregion
			const query = PlayerQueryBuilder.buildPlayerQuery(actualPlayerName, metric, analysis);
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'playerDataQueryHandler.ts:2498',message:'AFTER buildPlayerQuery',data:{query,metric},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'P'})}).catch(()=>{});
			// #endregion

			try {
				// Store query for debugging - add to chatbotService for client visibility
				// Security: Only log in development mode and sanitize input to prevent log injection
				const isDevelopment = process.env.NODE_ENV === 'development';
				const chatbotService = ChatbotService.getInstance();
				
				if (isDevelopment) {
					// Sanitize playerName to prevent log injection (escape single quotes and special characters)
					const sanitizedPlayerName = JSON.stringify(actualPlayerName).slice(1, -1); // Remove outer quotes from JSON.stringify
					const sanitizedGraphLabel = JSON.stringify(neo4jService.getGraphLabel()).slice(1, -1);
					
					// Create query with real values for client console display (development only)
					const readyToExecuteQuery = query
						.replace(/\$playerName/g, `'${sanitizedPlayerName}'`)
						.replace(/\$graphLabel/g, `'${sanitizedGraphLabel}'`);
					chatbotService.lastExecutedQueries.push(`READY_TO_EXECUTE: ${readyToExecuteQuery}`);
				}

			const result = await QueryExecutionUtils.executeQueryWithProfiling(query, {
				playerName: actualPlayerName,
				graphLabel: neo4jService.getGraphLabel(),
			});
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'playerDataQueryHandler.ts:2517',message:'QUERY RESULT',data:{metric,metricToUse,resultLength:result?.length,result:result,playerName:actualPlayerName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'M'})}).catch(()=>{});
			// #endregion

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
				
				// Check if this is a home/away games metric that should return 0 if no results
				const isHomeAwayGamesMetric = metricToUse && (
					metricToUse.toUpperCase() === "HOMEGAMES" ||
					metricToUse.toUpperCase() === "AWAYGAMES" ||
					metricToUse.toUpperCase() === "HOME" ||
					metricToUse.toUpperCase() === "AWAY"
				);
				
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

				if ((!result || !Array.isArray(result) || result.length === 0) && isHomeAwayGamesMetric) {
					// #region agent log
					fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'playerDataQueryHandler.ts:2555',message:'HOME/AWAY GAMES EMPTY RESULT',data:{metricToUse,playerName:actualPlayerName,hasResultFilter:!!(analysis.results && analysis.results.length > 0)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'N'})}).catch(()=>{});
					// #endregion
					
					// If there's a result filter (e.g., "won"), check if player has any games at all
					// to distinguish between "no games played" vs "no games won"
					const hasResultFilter = analysis.results && analysis.results.length > 0;
					if (hasResultFilter) {
						const graphLabel = neo4jService.getGraphLabel();
						const isHome = metricToUse.toUpperCase() === "HOMEGAMES" || metricToUse.toUpperCase() === "HOME";
						const locationFilter = isHome ? "f.homeOrAway = 'Home'" : "f.homeOrAway = 'Away'";
						
						const totalGamesQuery = `
							MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
							MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
							WHERE ${locationFilter}
							RETURN count(DISTINCT md) as totalGames
						`;
						
						try {
							const totalGamesResult = await neo4jService.executeQuery(totalGamesQuery, { playerName: actualPlayerName, graphLabel });
							const totalGames = totalGamesResult && totalGamesResult.length > 0 ? (totalGamesResult[0].totalGames || 0) : 0;
							
							// #region agent log
							fetch('http://127.0.0.1:7242/ingest/c6deae9c-4dd4-4650-bd6a-0838bce2f6d8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'playerDataQueryHandler.ts:2575',message:'TOTAL GAMES CHECK',data:{totalGames,metricToUse,playerName:actualPlayerName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'N'})}).catch(()=>{});
							// #endregion
							
							// If player has games but 0 wins, include totalGames in the response for response generation
							if (totalGames > 0) {
								return { 
									type: "specific_player", 
									data: [{ playerName: actualPlayerName, value: 0, totalGames }], 
									playerName: actualPlayerName, 
									metric: metricToUse, 
									cypherQuery: query 
								};
							}
						} catch (error) {
							loggingService.log(`⚠️ Error checking total games for ${actualPlayerName}:`, error, "warn");
						}
					}
					
					loggingService.log(`⚠️ No results found for ${actualPlayerName} with metric ${metricToUse}, returning 0`, null, "warn");
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

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`HIGHEST_WEEKLY_SCORE_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`HIGHEST_WEEKLY_SCORE_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

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

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`PENALTIES_TAKEN_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`PENALTIES_TAKEN_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

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

				// Push query to chatbotService for extraction (only for first query to avoid duplicates)
				if (playerWins.length === 0) {
					try {
						const chatbotService = ChatbotService.getInstance();
						const readyToExecuteQuery = playerQuery
							.replace(/\$graphLabel/g, `'${graphLabel}'`)
							.replace(/\$playerName/g, `'${playerName}'`)
							.replace(/\$team/g, `'${mappedTeam}'`)
							.replace(/\$season/g, `'${season}'`);
						chatbotService.lastExecutedQueries.push(`LEAGUE_WINS_COUNT_QUERY: ${playerQuery}`);
						chatbotService.lastExecutedQueries.push(`LEAGUE_WINS_COUNT_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
					} catch (error) {
						// Ignore if chatbotService not available
					}
				}

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
		// Security: Only log in development mode and sanitize input to prevent log injection
		const isDevelopment = process.env.NODE_ENV === 'development';
		const chatbotService = ChatbotService.getInstance();
		
		if (isDevelopment) {
			chatbotService.lastExecutedQueries.push(`HOME_AWAY_COMPARISON: ${query}`);
			chatbotService.lastExecutedQueries.push(`PARAMS: ${JSON.stringify({ playerName, graphLabel })}`);

			// Sanitize inputs to prevent log injection
			const sanitizedPlayerName = JSON.stringify(playerName).slice(1, -1);
			const sanitizedGraphLabel = JSON.stringify(graphLabel).slice(1, -1);
			
			// Log copyable query for debugging (development only)
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${sanitizedGraphLabel}'`)
				.replace(/\$playerName/g, `'${sanitizedPlayerName}'`);
			chatbotService.lastExecutedQueries.push(`READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		}

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

	/**
	 * Query hat-tricks for a player (matches where player scored 3+ goals including penalties)
	 */
	static async queryPlayerHatTricks(
		playerName: string,
		analysis: EnhancedQuestionAnalysis,
	): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying hat-tricks for player: ${playerName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();

		const query = `
			MATCH (p:Player {graphLabel: $graphLabel})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WHERE toLower(trim(p.playerName)) = toLower(trim($playerName))
				AND (coalesce(md.goals, 0) + coalesce(md.penaltiesScored, 0)) >= 3
			RETURN count(md) as value
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`PLAYER_HATTRICKS_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`PLAYER_HATTRICKS_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			const count = result && result.length > 0 && result[0].value !== undefined
				? (typeof result[0].value === 'number' 
					? result[0].value 
					: (result[0].value?.low || 0) + (result[0].value?.high || 0) * 4294967296)
				: 0;
			
			return { 
				type: "hattrick_count", 
				data: [{ value: count }], 
				isHatTrickQuery: true,
				playerName 
			};
		} catch (error) {
			loggingService.log(`❌ Error in player hat-tricks query:`, error, "error");
			return { type: "error", data: [], error: "Error querying player hat-tricks data" };
		}
	}

	/**
	 * Query seasons with goal counts for a player
	 * Returns count of distinct seasons where player played but scored 0 goals and 0 penalties
	 */
	static async querySeasonsWithGoalCounts(playerName: string): Promise<Record<string, unknown>> {
		const graphLabel = neo4jService.getGraphLabel();
		
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			WHERE f.season IS NOT NULL
			WITH f.season as season, sum(coalesce(md.goals, 0) + coalesce(md.penaltiesScored, 0)) as totalGoals
			WHERE totalGoals = 0
			RETURN count(DISTINCT season) as seasonsWithNoGoals
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`SEASONS_GOAL_COUNTS_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`SEASONS_GOAL_COUNTS_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { graphLabel, playerName });
			
			// Extract the count from the result
			let seasonsWithNoGoals = 0;
			if (result && Array.isArray(result) && result.length > 0) {
				const record = result[0];
				if (record && typeof record === "object" && "seasonsWithNoGoals" in record) {
					let count = record.seasonsWithNoGoals;
					
					// Handle Neo4j Integer objects
					if (count !== null && count !== undefined) {
						if (typeof count === "number") {
							seasonsWithNoGoals = count;
						} else if (typeof count === "object") {
							if ("toNumber" in count && typeof count.toNumber === "function") {
								seasonsWithNoGoals = (count as { toNumber: () => number }).toNumber();
							} else if ("low" in count && "high" in count) {
								const neo4jInt = count as { low?: number; high?: number };
								seasonsWithNoGoals = (neo4jInt.low || 0) + (neo4jInt.high || 0) * 4294967296;
							} else {
								seasonsWithNoGoals = Number(count) || 0;
							}
						} else {
							seasonsWithNoGoals = Number(count) || 0;
						}
					}
				}
			}
			
			return { 
				type: "seasons_goal_counts", 
				data: seasonsWithNoGoals,
				playerName 
			};
		} catch (error) {
			loggingService.log(`❌ Error in querySeasonsWithGoalCounts:`, error, "error");
			return { type: "error", data: [], error: error instanceof Error ? error.message : String(error) };
		}
	}

	/**
	 * Query player goals (including penalties) for last season
	 * Returns total goals + penaltiesScored from MatchDetail nodes in the last season
	 */
	static async queryPlayerGoalsLastSeason(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying player goals last season for: ${playerName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		// Resolve "last season" using the same logic as TeamDataQueryHandler
		let lastSeason: string | null = null;
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
					lastSeason = `${lastStartYear}/${String(lastEndYearShort).padStart(2, '0')}`;
					loggingService.log(`🔍 Resolved "last season" to: ${lastSeason} (current: ${currentSeason})`, null, "log");
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
						lastSeason = recentResult[0].seasons[1];
						loggingService.log(`🔍 Resolved "last season" from fixtures: ${lastSeason}`, null, "log");
					}
				}
			}
		} catch (error) {
			loggingService.log(`⚠️ Error resolving last season:`, error, "warn");
		}

		if (!lastSeason) {
			loggingService.log(`❌ Could not resolve last season`, null, "error");
			return { 
				type: "error", 
				data: [], 
				error: "Could not determine last season" 
			};
		}

		// Query MatchDetail nodes for goals and penalties in last season
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			WHERE f.season = $lastSeason
			RETURN sum(coalesce(md.goals, 0) + coalesce(md.penaltiesScored, 0)) as totalGoals
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`)
				.replace(/\$lastSeason/g, `'${lastSeason}'`);
			chatbotService.lastExecutedQueries.push(`PLAYER_GOALS_LAST_SEASON_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`PLAYER_GOALS_LAST_SEASON_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { graphLabel, playerName, lastSeason });
			
			// Extract the total goals from the result
			let totalGoals = 0;
			if (result && Array.isArray(result) && result.length > 0) {
				const record = result[0];
				if (record && typeof record === "object" && "totalGoals" in record) {
					let goals = record.totalGoals;
					
					// Handle Neo4j Integer objects and null values
					if (goals !== null && goals !== undefined) {
						if (typeof goals === "number") {
							totalGoals = goals;
						} else if (typeof goals === "object") {
							if ("toNumber" in goals && typeof goals.toNumber === "function") {
								totalGoals = (goals as { toNumber: () => number }).toNumber();
							} else if ("low" in goals && "high" in goals) {
								const neo4jInt = goals as { low?: number; high?: number };
								totalGoals = (neo4jInt.low || 0) + (neo4jInt.high || 0) * 4294967296;
							} else {
								totalGoals = Number(goals) || 0;
							}
						} else {
							totalGoals = Number(goals) || 0;
						}
					}
				}
			}
			
			return { 
				type: "player_goals_last_season", 
				data: totalGoals,
				playerName,
				totalGoals,
				lastSeason
			};
		} catch (error) {
			loggingService.log(`❌ Error in queryPlayerGoalsLastSeason:`, error, "error");
			return { type: "error", data: [], error: error instanceof Error ? error.message : String(error) };
		}
	}

	/**
	 * Query players with most clean sheet appearances in a specific season
	 * Clean sheet = MatchDetail in season connected to Fixture with conceded = 0
	 */
	static async queryCleanSheetAppearancesBySeason(season: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying clean sheet appearances by season: ${season}`, null, "log");

		const graphLabel = neo4jService.getGraphLabel();
		
		// Normalize season format to slash format (e.g., "2021/22")
		const { normalizeSeasonFormat } = await import("../leagueTableService");
		const normalizedSeason = normalizeSeasonFormat(season, 'slash');
		
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel})
			WHERE p.allowOnSite = true
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			WHERE md.season = $season AND coalesce(f.conceded, 0) = 0
			WITH p.playerName as playerName, count(DISTINCT md) as cleanSheetAppearances
			RETURN playerName, cleanSheetAppearances
			ORDER BY cleanSheetAppearances DESC, playerName ASC
			LIMIT 10
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$season/g, `'${normalizedSeason}'`);
			chatbotService.lastExecutedQueries.push(`CLEAN_SHEET_APPEARANCES_SEASON_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`CLEAN_SHEET_APPEARANCES_SEASON_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { graphLabel, season: normalizedSeason });
			return { 
				type: "clean_sheet_appearances_season", 
				data: result || [], 
				season: normalizedSeason 
			};
		} catch (error) {
			loggingService.log(`❌ Error in queryCleanSheetAppearancesBySeason:`, error, "error");
			return { type: "error", data: [], error: error instanceof Error ? error.message : String(error) };
		}
	}
}
