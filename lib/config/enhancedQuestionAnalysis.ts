import { EntityExtractor, EntityExtractionResult, StatTypeInfo } from "./entityExtraction";
import { QuestionType } from "../../config/config";
import { DateUtils } from "../services/chatbotUtils/dateUtils";
import { TeamMappingUtils } from "../services/chatbotUtils/teamMappingUtils";

export interface EnhancedQuestionAnalysis {
	type: QuestionType;
	entities: string[];
	metrics: string[];
	timeRange?: string;
	teamEntities?: string[];
	teamExclusions?: string[]; // Teams to exclude (e.g., "not playing for the 3s")
	oppositionEntities?: string[];
	competitionTypes?: string[];
	competitions?: string[];
	results?: string[];
	opponentOwnGoals?: boolean;
	message?: string;
	// Enhanced fields
	extractionResult: EntityExtractionResult;
	complexity: "simple" | "moderate" | "complex";
	requiresClarification: boolean;
	clarificationMessage?: string;
	question: string;
	// New fields for improvements
	confidence?: number;
	resultQuantity?: "singular" | "plural";
}

// EnhancedQuestionAnalyzer class processes the question and returns an EnhancedQuestionAnalysis object
export class EnhancedQuestionAnalyzer {
	private question: string;
	private userContext?: string;
	private extractor: EntityExtractor;
	private static metricCorrectionCache: Map<string, StatTypeInfo[]> = new Map();
	private static readonly METRIC_CACHE_MAX_SIZE = 500;

	constructor(question: string, userContext?: string) {
		this.question = question;
		this.userContext = userContext;
		this.extractor = new EntityExtractor(question);
	}

	async analyze(): Promise<EnhancedQuestionAnalysis> {
		const extractionResult = await this.extractor.resolveEntitiesWithFuzzyMatching();
		
		// Early detection: Check for "most prolific season", "highest scoring season", or "season I scored the most goals" pattern and add to statTypes if found
		// This must happen before the early exit check to ensure the question is properly recognized
		const lowerQuestion = this.question.toLowerCase();
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
		
		const isMostProlificSeasonQuestion = detectMostGoalsSeasonPattern(lowerQuestion);
		
		if (isMostProlificSeasonQuestion) {
			// Check if "Most Prolific Season" is already in statTypes
			const hasMostProlificSeason = extractionResult.statTypes.some(
				(stat) => stat.value === "Most Prolific Season"
			);
			
			if (!hasMostProlificSeason) {
				// Add "Most Prolific Season" to statTypes early so it passes the early exit check
				extractionResult.statTypes.push({
					value: "Most Prolific Season",
					originalText: "most prolific season",
					position: lowerQuestion.indexOf("most"),
				});
			}
		}

		// Early detection: Check for percentage queries and add to statTypes if found
		// This must happen before the early exit check to ensure the question is properly recognized
		const isPercentageQuestion = 
			lowerQuestion.includes("percentage") || 
			lowerQuestion.includes("percent") || 
			lowerQuestion.includes("%");
		
		if (isPercentageQuestion && (lowerQuestion.includes("games") || lowerQuestion.includes("game"))) {
			// Check if a percentage stat type is already in statTypes
			const hasPercentageStat = extractionResult.statTypes.some(
				(stat) => stat.value.includes("%") || stat.value.includes("Percentage")
			);
			
			if (!hasPercentageStat) {
				// Determine which percentage metric to add based on context
				let percentageStatValue = "";
				let percentageStatText = "";
				
				if (lowerQuestion.includes("home games")) {
					if (lowerQuestion.includes("won") || lowerQuestion.includes("win")) {
						percentageStatValue = "Home Games % Won";
						percentageStatText = "percentage of home games won";
					} else if (lowerQuestion.includes("lost") || lowerQuestion.includes("lose")) {
						percentageStatValue = "Home Games % Lost";
						percentageStatText = "percentage of home games lost";
					} else if (lowerQuestion.includes("drawn") || lowerQuestion.includes("draw")) {
						percentageStatValue = "Home Games % Drawn";
						percentageStatText = "percentage of home games drawn";
					}
				} else if (lowerQuestion.includes("away games")) {
					if (lowerQuestion.includes("won") || lowerQuestion.includes("win")) {
						percentageStatValue = "Away Games % Won";
						percentageStatText = "percentage of away games won";
					} else if (lowerQuestion.includes("lost") || lowerQuestion.includes("lose")) {
						percentageStatValue = "Away Games % Lost";
						percentageStatText = "percentage of away games lost";
					} else if (lowerQuestion.includes("drawn") || lowerQuestion.includes("draw")) {
						percentageStatValue = "Away Games % Drawn";
						percentageStatText = "percentage of away games drawn";
					}
				} else if (lowerQuestion.includes("games") || lowerQuestion.includes("game")) {
					if (lowerQuestion.includes("won") || lowerQuestion.includes("win")) {
						percentageStatValue = "Games % Won";
						percentageStatText = "percentage of games won";
					} else if (lowerQuestion.includes("lost") || lowerQuestion.includes("lose")) {
						percentageStatValue = "Games % Lost";
						percentageStatText = "percentage of games lost";
					} else if (lowerQuestion.includes("drawn") || lowerQuestion.includes("draw")) {
						percentageStatValue = "Games % Drawn";
						percentageStatText = "percentage of games drawn";
					}
				}
				
				if (percentageStatValue) {
					extractionResult.statTypes.push({
						value: percentageStatValue,
						originalText: percentageStatText,
						position: lowerQuestion.indexOf("percentage") >= 0 
							? lowerQuestion.indexOf("percentage")
							: (lowerQuestion.indexOf("percent") >= 0 
								? lowerQuestion.indexOf("percent")
								: lowerQuestion.indexOf("%")),
					});
				}
			}
		}
		
		// CRITICAL: Apply stat type corrections
		// This prevents false positives from duplicate or incorrect stat type extractions
		const correctedStatTypes = this.applyStatTypeCorrections(extractionResult.statTypes);
		const correctedExtractionResult = {
			...extractionResult,
			statTypes: correctedStatTypes
		};
		
		const complexity = this.assessComplexity(correctedExtractionResult);
		
		// Don't set clarification at analysis time - let queries run first
		// Clarification will be requested only if queries return no data
		const requiresClarification = false;

		// Determine question type based on extracted entities and content
		const type = this.determineQuestionType(extractionResult);

		// Extract entities for backward compatibility
		const entities = this.extractLegacyEntities(extractionResult);

		// Extract metrics for backward compatibility with penalty phrase fixes
		const metrics = this.extractLegacyMetrics(extractionResult);

		// Extract time range for backward compatibility
		const timeRange = this.extractLegacyTimeRange(extractionResult);

		// Extract team exclusions for "not playing for" patterns FIRST (before team entities)
		// This ensures excluded teams are not treated as regular team entities
		const teamExclusions: string[] = [];
		const exclusionPatterns = [
			/\b(?:not|excluding|except)\s+(?:playing\s+)?for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th)\b/i,
			/\bwhen\s+not\s+(?:playing\s+)?for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th)\b/i,
			// More flexible pattern to catch variations like "got when not playing for the 3s"
			/\b(?:got|has|have|had)\s+.*?\s+when\s+not\s+(?:playing\s+)?for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th)\b/i,
			// Pattern for "not for the 3s" (without "playing")
			/\b(?:not|excluding|except)\s+for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th)\b/i,
		];
		
		for (const pattern of exclusionPatterns) {
			const match = lowerQuestion.match(pattern);
			if (match && match[1]) {
				teamExclusions.push(match[1]);
			}
		}

		// Extract team entities for team-specific queries, but exclude teams that are in exclusions
		const allTeamEntities = extractionResult.entities.filter((e) => e.type === "team").map((e) => e.value);
		const teamEntities = allTeamEntities.filter((team) => {
			// Remove teams that are in exclusions (normalize for comparison using TeamMappingUtils)
			const mappedTeam = TeamMappingUtils.mapTeamName(team);
			return !teamExclusions.some((excluded) => {
				const mappedExcluded = TeamMappingUtils.mapTeamName(excluded);
				// Check if the mapped team names match (handles variations like "3s" vs "3rd" -> both map to "3rd XI")
				return mappedTeam === mappedExcluded;
			});
		});

		// Extract opposition entities for opposition-specific queries
		// But exclude them if team exclusions are present (exclusions indicate player queries, not opposition queries)
		const allOppositionEntities = extractionResult.entities.filter((e) => e.type === "opposition").map((e) => e.value);
		const oppositionEntities = teamExclusions.length > 0 ? [] : allOppositionEntities;

		// Extract competition types for competition-specific queries
		const competitionTypes = extractionResult.competitionTypes.map((ct) => ct.value);

		// Extract competitions for competition-specific queries
		const competitions = extractionResult.competitions.map((c) => c.value);

		// Extract results for result-specific queries
		// BUT: Exclude results if this is a percentage query (percentage queries handle results internally)
		// Reuse lowerQuestion from earlier in the method
		const isPercentageQueryForResults = 
			(lowerQuestion.includes("percentage") || lowerQuestion.includes("percent") || lowerQuestion.includes("%")) &&
			(lowerQuestion.includes("games") || lowerQuestion.includes("game"));
		const results = isPercentageQueryForResults ? [] : extractionResult.results.map((r) => r.value);

		// Extract opponent own goals flag
		const opponentOwnGoals = extractionResult.opponentOwnGoals;

		// Calculate confidence score
		const confidence = this.calculateConfidence(extractionResult, complexity, requiresClarification);

		// Detect result quantity (singular vs plural)
		const resultQuantity = this.detectResultQuantity();

		return {
			type,
			entities,
			metrics,
			timeRange,
			teamEntities,
			teamExclusions: teamExclusions.length > 0 ? teamExclusions : undefined,
			oppositionEntities,
			competitionTypes,
			competitions,
			results,
			opponentOwnGoals,
			extractionResult,
			complexity,
			requiresClarification,
			clarificationMessage: requiresClarification ? this.generateClarificationMessage(extractionResult, complexity) : undefined,
			question: this.question,
			confidence,
			resultQuantity,
		};
	}

	// Assess the complexity of the question based on the number of entities and stat types
	private assessComplexity(extractionResult: EntityExtractionResult): "simple" | "moderate" | "complex" {
		// Only count actual named entities (players, teams, oppositions, leagues), not locations/timeframes
		const namedEntities = extractionResult.entities.filter(
			(e) => e.type === "player" || e.type === "team" || e.type === "opposition" || e.type === "league",
		);

		// Count entities by type
		const playerCount = namedEntities.filter((e) => e.type === "player").length;
		const teamCount = namedEntities.filter((e) => e.type === "team").length;
		const oppositionCount = namedEntities.filter((e) => e.type === "opposition").length;
		const leagueCount = namedEntities.filter((e) => e.type === "league").length;

		const statTypeCount = extractionResult.statTypes.length;
		const hasMultipleTimeFrames = extractionResult.timeFrames.length > 1;
		const hasNegativeClauses = extractionResult.negativeClauses.length > 0;
		const hasMultipleLocations = extractionResult.locations.length > 1;

		// Check if any single entity type exceeds 3 (this is what should trigger clarification)
		const hasTooManyOfOneType = playerCount > 3 || teamCount > 3 || oppositionCount > 3 || leagueCount > 3;

		// Check total named entities (should be more lenient)
		const totalNamedEntities = namedEntities.length;

		if (hasTooManyOfOneType || statTypeCount > 3) {
			return "complex";
		}

		if (totalNamedEntities > 1 || statTypeCount > 1 || hasMultipleTimeFrames || hasNegativeClauses || hasMultipleLocations) {
			return "moderate";
		}

		return "simple";
	}

	// Check if any extracted player name partially matches the selected player (userContext)
	private checkPartialPlayerNameMatch(extractionResult: EntityExtractionResult): string | null {
		if (!this.userContext) {
			return null;
		}

		const playerEntities = extractionResult.entities.filter((e) => e.type === "player");
		if (playerEntities.length === 0) {
			return null;
		}

		const selectedPlayerLower = this.userContext.toLowerCase().trim();
		
		// Check if any extracted player name is contained within the selected player name
		// Use originalText to check the text before fuzzy matching resolved it
		for (const entity of playerEntities) {
			// Check originalText first (the text as extracted from the question)
			const originalText = entity.originalText.toLowerCase().trim();
			// Remove any "(resolved to: ...)" suffix that might be added during fuzzy matching
			const cleanOriginalText = originalText.replace(/\s*\(resolved to:.*?\)$/i, "").trim();
			
			// Skip "I" references as they're handled separately
			if (cleanOriginalText === "i" || cleanOriginalText === "i've" || cleanOriginalText === "me" || cleanOriginalText === "my" || cleanOriginalText === "myself") {
				continue;
			}
			
			// Check if the original extracted text is contained in the selected player name
			// Example: "Luke" (originalText) should match "Luke Bangs" (selectedPlayer)
			if (selectedPlayerLower.includes(cleanOriginalText) && cleanOriginalText.length >= 2) {
				return this.userContext;
			}
			
			// Also check the resolved value as a fallback (in case originalText wasn't preserved correctly)
			const entityValue = entity.value.toLowerCase().trim();
			if (entityValue !== cleanOriginalText) {
				// Only check if it's different from originalText
				if (entityValue !== "i" && entityValue !== "i've" && entityValue !== "me" && entityValue !== "my" && entityValue !== "myself") {
					if (selectedPlayerLower.includes(entityValue) && entityValue.length >= 2) {
						return this.userContext;
					}
				}
			}
		}

		return null;
	}

	// Check if clarification is needed based on the number of entities and stat types
	private checkClarificationNeeded(extractionResult: EntityExtractionResult, complexity: "simple" | "moderate" | "complex"): boolean {
		// Only count actual named entities (players, teams, oppositions, leagues), not locations/timeframes
		const namedEntities = extractionResult.entities.filter(
			(e) => e.type === "player" || e.type === "team" || e.type === "opposition" || e.type === "league",
		);

		// Count entities by type
		const playerCount = namedEntities.filter((e) => e.type === "player").length;
		const teamCount = namedEntities.filter((e) => e.type === "team").length;
		const oppositionCount = namedEntities.filter((e) => e.type === "opposition").length;
		const leagueCount = namedEntities.filter((e) => e.type === "league").length;

		// Check if any single entity type exceeds 3 (this should trigger clarification)
		const hasTooManyOfOneType = playerCount > 3 || teamCount > 3 || oppositionCount > 3 || leagueCount > 3;

		if (hasTooManyOfOneType) {
			return true;
		}

		// Check for too many stat types
		if (extractionResult.statTypes.length > 3) {
			return true;
		}

		// Check for ambiguous entity references
		const playerEntities = extractionResult.entities.filter((e) => e.type === "player");
		const hasAmbiguousPlayerRef = playerEntities.some((e) => e.value === "I") && this.userContext;

		// Check for ambiguous player names that don't match the selected player
		// If we have player entities, userContext exists, but none of the player entities match the selected player
		let hasAmbiguousPlayerName = false;
		if (playerEntities.length > 0 && this.userContext) {
			const matchedPlayerName = this.checkPartialPlayerNameMatch(extractionResult);
			// If no match found and we have player entities that aren't "I" references, we may need clarification
			if (!matchedPlayerName) {
				const nonIPlayerEntities = playerEntities.filter((e) => {
					// Check originalText (the text before fuzzy matching)
					const originalText = e.originalText.toLowerCase().trim().replace(/\s*\(resolved to:.*?\)$/i, "").trim();
					return originalText !== "i" && 
						originalText !== "i've" && 
						originalText !== "me" && 
						originalText !== "my" && 
						originalText !== "myself";
				});
				// If we have player entities that don't match the selected player, flag for clarification
				if (nonIPlayerEntities.length > 0) {
					hasAmbiguousPlayerName = true;
				}
			}
		}

		// Check for missing critical information
		const hasNoEntities = namedEntities.length === 0;
		const hasNoStatTypes = extractionResult.statTypes.length === 0;

		// Check if this is a "which" or "who" ranking question - these are valid even without specific entities
		const lowerQuestion = this.question.toLowerCase();
		const isRankingQuestion =
			(lowerQuestion.includes("which") || lowerQuestion.includes("who")) &&
			(lowerQuestion.includes("highest") || lowerQuestion.includes("most") || lowerQuestion.includes("best") || lowerQuestion.includes("top"));

		// Check for "most prolific season" questions - these are valid with userContext even without entities
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
		
		const isMostProlificSeasonQuestion = detectMostGoalsSeasonPattern(lowerQuestion);
		
		// Don't require entities for "most prolific season", "highest scoring season", or "season I scored the most goals" questions if userContext exists
		if (isMostProlificSeasonQuestion && this.userContext && hasNoStatTypes) {
			return true; // Still need stat types
		}
		
		if (isMostProlificSeasonQuestion && this.userContext) {
			return false; // "most prolific season" with userContext doesn't need clarification
		}

		// Don't require entities for ranking questions
		if (isRankingQuestion && hasNoStatTypes) {
			return true; // Still need stat types
		}

		// FIXED: Only require clarification if BOTH entities AND stat types are missing (not either/or)
		// This allows valid questions like "How many goals has Luke Bangs scored from open play?" to proceed
		// Note: Player name mismatch clarification is now handled post-query (see ChatbotService.generateResponse)
		// to allow queries to attempt first before asking for clarification
		// CRITICAL FIX: If "I" is the only player entity and userContext exists, don't require clarification
		const needsClarification =
			(hasNoEntities && hasNoStatTypes && !isRankingQuestion) || 
			(complexity === "complex" && hasNoEntities && hasNoStatTypes) ||
			(hasAmbiguousPlayerName && !hasAmbiguousPlayerRef); // Don't require clarification if "I" + userContext exists

		return needsClarification;
	}

	// Generate a clarification message based on the number of entities and stat types
	private generateClarificationMessage(extractionResult: EntityExtractionResult, complexity: "simple" | "moderate" | "complex"): string {
		// Only count actual named entities (players, teams, oppositions, leagues), not locations/timeframes
		const namedEntities = extractionResult.entities.filter(
			(e) => e.type === "player" || e.type === "team" || e.type === "opposition" || e.type === "league",
		);

		// Count entities by type
		const playerCount = namedEntities.filter((e) => e.type === "player").length;
		const teamCount = namedEntities.filter((e) => e.type === "team").length;
		const oppositionCount = namedEntities.filter((e) => e.type === "opposition").length;
		const leagueCount = namedEntities.filter((e) => e.type === "league").length;

		// Check for ambiguous player names that don't match the selected player
		const playerEntities = extractionResult.entities.filter((e) => e.type === "player");
		if (playerCount > 0 && this.userContext) {
			const matchedPlayerName = this.checkPartialPlayerNameMatch(extractionResult);
			if (!matchedPlayerName) {
				const nonIPlayerEntities = playerEntities.filter((e) => {
					const originalText = e.originalText.toLowerCase().trim().replace(/\s*\(resolved to:.*?\)$/i, "").trim();
					return originalText !== "i" && 
						originalText !== "i've" && 
						originalText !== "me" && 
						originalText !== "my" && 
						originalText !== "myself";
				});
				if (nonIPlayerEntities.length > 0) {
					// Use originalText for the clarification message to show what was actually extracted
					const playerNames = nonIPlayerEntities.map((e) => {
						const originalText = e.originalText.replace(/\s*\(resolved to:.*?\)$/i, "").trim();
						return originalText;
					}).join(", ");
					// Check if it's a single first name (likely needs surname clarification)
					const isSingleFirstName = nonIPlayerEntities.length === 1 && 
						!playerNames.includes(" ") && 
						playerNames.length > 0 && 
						playerNames.length < 15; // Reasonable first name length
					
					if (isSingleFirstName) {
						return `Please clarify which ${playerNames} you are asking about.`;
					}
					return `I found a player name "${playerNames}" in your question, but it doesn't match the selected player "${this.userContext}". Please provide the full player name you're asking about, or confirm if you meant "${this.userContext}".`;
				}
			}
		}

		// Check if any single entity type exceeds 3
		if (playerCount > 3) {
			return `I can handle questions about up to 3 players at once. You mentioned ${playerCount} players. Please simplify your question to focus on fewer players. For example: 'How many goals has Luke Bangs scored?' instead of asking about multiple players.`;
		}

		if (teamCount > 3) {
			return `I can handle questions about up to 3 teams at once. You mentioned ${teamCount} teams. Please simplify your question to focus on fewer teams. For example: 'What are the 3rd XI stats?' instead of asking about multiple teams.`;
		}

		if (oppositionCount > 3) {
			return `I can handle questions about up to 3 opposition teams at once. You mentioned ${oppositionCount} opposition teams. Please simplify your question to focus on fewer opposition teams. For example: 'How many goals against Arsenal?' instead of asking about multiple oppositions.`;
		}

		if (leagueCount > 3) {
			return `I can handle questions about up to 3 leagues at once. You mentioned ${leagueCount} leagues. Please simplify your question to focus on fewer leagues. For example: 'Premier League stats' instead of asking about multiple leagues.`;
		}

		if (extractionResult.statTypes.length > 3) {
			return "I can handle questions about up to 3 different statistics at once. Please simplify your question to focus on fewer stat types. For example: 'How many goals has Luke Bangs scored?' instead of asking about multiple stats.";
		}

		// IMPROVED: More specific guidance based on what's missing
		if (namedEntities.length === 0 && extractionResult.statTypes.length === 0) {
			return "I need more information to help you. Please specify both who/what you're asking about AND what statistic you want to know. For example: 'How many goals has Luke Bangs scored?' or 'What are the 3rd XI stats?'";
		}

		if (namedEntities.length === 0) {
			const statTypes = extractionResult.statTypes.map((s) => s.value).join(", ");
			return `I can see you're asking about ${statTypes}, but I need to know which player, team, or other entity you're asking about. Please specify who or what you want to know about. For example: 'How many ${statTypes} has Luke Bangs scored?' or 'What are the 3rd XI ${statTypes}?'`;
		}

		if (extractionResult.statTypes.length === 0) {
			const entities = namedEntities.map((e) => e.value).join(", ");
			return `I can see you're asking about ${entities}, but I need to know what statistic you want to know about. Please specify what information you want. Examples: 'goals', 'appearances', 'assists', 'yellow cards', 'clean sheets', 'minutes played', etc. For example: 'How many goals has ${entities} scored?'`;
		}

		if (complexity === "complex") {
			return "This question is quite complex with multiple entities or conditions. I'll try to answer it, but you might get better results by breaking it down into simpler questions. For example: 'How many goals has Luke Bangs scored?' instead of asking about multiple players, teams, or stats at once.";
		}

		// IMPROVED: More helpful fallback message
		return "I'm not sure what you're asking about. Please be more specific about which player, team, or statistic you want to know about. You can ask questions like: 'How many goals has Luke Bangs scored?', 'What are the 3rd XI stats?', or 'Who has the most assists?'";
	}

	// Determine the question type based on the extracted entities and content
	private determineQuestionType(extractionResult: EntityExtractionResult): QuestionType {
		const lowerQuestion = this.question.toLowerCase();

		// Note: Clarification check is already done in the main analyze() method
		// No need to check again here

		// Determine type based on entities and content
		const hasPlayerEntities = extractionResult.entities.some((e) => e.type === "player");
		const hasTeamEntities = extractionResult.entities.some((e) => e.type === "team");
		const hasMultipleEntities = extractionResult.entities.length > 1;
		const hasTimeFrames = extractionResult.timeFrames.length > 0;

		// Check for streak patterns FIRST (before player check) - highest priority for streak questions
		if (
			lowerQuestion.includes("streak") || 
			lowerQuestion.includes("consecutive") || 
			lowerQuestion.includes("in a row") ||
			(lowerQuestion.includes("longest") && (lowerQuestion.includes("scoring") || lowerQuestion.includes("goal") || lowerQuestion.includes("assist") || lowerQuestion.includes("clean sheet")))
		) {
			return "streak";
		}

		// Check for highest league finish queries (highest priority for league position queries)
		if (
			(lowerQuestion.includes("highest league finish") ||
				lowerQuestion.includes("best league position") ||
				lowerQuestion.includes("best league finish") ||
				(lowerQuestion.includes("highest") && lowerQuestion.includes("league") && lowerQuestion.includes("finish")) ||
				(lowerQuestion.includes("highest") && lowerQuestion.includes("position") && lowerQuestion.includes("league")) ||
				(lowerQuestion.includes("my") && lowerQuestion.includes("highest") && (lowerQuestion.includes("finish") || lowerQuestion.includes("position"))))
		) {
			return "league_table";
		}

		// Check for "which season did [team] concede the most goals" queries
		if (
			hasTeamEntities &&
			(lowerQuestion.includes("which season") || lowerQuestion.includes("what season")) &&
			lowerQuestion.includes("concede") &&
			(lowerQuestion.includes("most goals") || lowerQuestion.includes("most") && lowerQuestion.includes("goals"))
		) {
			return "league_table";
		}

		// Check for "which team had the best defensive record" queries
		if (
			(lowerQuestion.includes("which team") || lowerQuestion.includes("what team")) &&
			(lowerQuestion.includes("best defensive record") || 
			 (lowerQuestion.includes("best") && lowerQuestion.includes("defensive") && lowerQuestion.includes("record")))
		) {
			return "league_table";
		}

		// Check for goal difference queries (must be before general league table check)
		if (
			hasTeamEntities &&
			(lowerQuestion.includes("goal difference") ||
				lowerQuestion.includes("goals difference") ||
				lowerQuestion.includes("goal diff"))
		) {
			return "league_table";
		}

		// Check for league table/position queries BEFORE temporal queries
		// This ensures questions like "Where did the 2s finish in 2017/18?" are classified correctly
		// Check for team entities AND finish/position keywords, even if timeframes are present
		if (
			hasTeamEntities &&
			(lowerQuestion.includes("league position") ||
				lowerQuestion.includes("league table") ||
				lowerQuestion.includes("finished") ||
				lowerQuestion.includes("finish") ||
				lowerQuestion.includes("position") ||
				lowerQuestion.includes("table"))
		) {
			return "league_table";
		}

		// Also check for league table queries with explicit team mentions in question
		if (
			(lowerQuestion.includes("league position") ||
				lowerQuestion.includes("league table") ||
				lowerQuestion.includes("finished") ||
				lowerQuestion.includes("finish") ||
				(lowerQuestion.includes("position") && lowerQuestion.includes("league"))) &&
			(lowerQuestion.includes("2s") || lowerQuestion.includes("1s") || lowerQuestion.includes("3s") || lowerQuestion.includes("4s") || lowerQuestion.includes("5s") || lowerQuestion.includes("6s") || lowerQuestion.includes("7s") || lowerQuestion.includes("8s") ||
			 lowerQuestion.includes("1st") || lowerQuestion.includes("2nd") || lowerQuestion.includes("3rd") || lowerQuestion.includes("4th") || lowerQuestion.includes("5th") || lowerQuestion.includes("6th") || lowerQuestion.includes("7th") || lowerQuestion.includes("8th"))
		) {
			return "league_table";
		}

		// Check for highest scoring game queries (before player check)
		if (
			lowerQuestion.includes("highest scoring game") ||
			(lowerQuestion.includes("highest scoring") && lowerQuestion.includes("game")) ||
			(lowerQuestion.includes("most goals") && lowerQuestion.includes("game")) ||
			(lowerQuestion.includes("highest total") && lowerQuestion.includes("game"))
		) {
			return "fixture";
		}

		// Check for double game weeks queries (before player check)
		if (lowerQuestion.includes("double game") || lowerQuestion.includes("double game week")) {
			return "double_game";
		}

		// Check for milestone questions (who will reach next X milestone, closest to X goals/apps/assists/moms)
		// This must be checked BEFORE player entity check to avoid misclassification
		if (
			(lowerQuestion.includes("who will reach") || lowerQuestion.includes("who is closest") || lowerQuestion.includes("closest to")) &&
			(lowerQuestion.includes("milestone") || lowerQuestion.includes("goal") || lowerQuestion.includes("app") || lowerQuestion.includes("appearance") || lowerQuestion.includes("assist") || lowerQuestion.includes("mom"))
		) {
			return "milestone";
		}

		// Check for milestone questions with "next" pattern
		if (
			lowerQuestion.includes("next") &&
			(lowerQuestion.includes("milestone") || (lowerQuestion.includes("goal") && /\d+/.test(lowerQuestion)) || (lowerQuestion.includes("app") && /\d+/.test(lowerQuestion)) || (lowerQuestion.includes("assist") && /\d+/.test(lowerQuestion)) || (lowerQuestion.includes("mom") && /\d+/.test(lowerQuestion)))
		) {
			return "milestone";
		}

		// Check for team exclusion patterns - if present, this should be a player query
		// (exclusions only make sense for player queries, not team queries)
		const hasExclusionPattern = 
			lowerQuestion.includes("not playing for") ||
			lowerQuestion.includes("when not") ||
			lowerQuestion.includes("excluding") ||
			lowerQuestion.includes("except for");
		
		// Check for player-specific queries (but not if it's a streak, milestone, or other special question)
		// Also prioritize player type if exclusion patterns are detected
		if (hasPlayerEntities || hasExclusionPattern) {
			return "player";
		}

		// Check for temporal queries (time-based questions without specific players or team entities with league keywords)
		// Only classify as temporal if we don't have team entities with finish/position keywords
		if (
			!hasTeamEntities &&
			(hasTimeFrames ||
			lowerQuestion.includes("since") ||
			lowerQuestion.includes("before") ||
			lowerQuestion.includes("between") ||
			lowerQuestion.includes("during") ||
			lowerQuestion.includes("in the") ||
			lowerQuestion.includes("from") ||
			lowerQuestion.includes("until") ||
			lowerQuestion.includes("after"))
		) {
			return "temporal";
		}

		// Check for percentage queries
		if (lowerQuestion.includes("percentage") || lowerQuestion.includes("percent") || lowerQuestion.includes("%")) {
			return "player";
		}

		// Check for team ranking queries (which team has fewest/most...) - BEFORE general ranking check
		// This must be checked early to avoid misclassification as player due to "conceded" being a player indicator
		if (
			(lowerQuestion.includes("which team") || lowerQuestion.includes("what team")) &&
			(lowerQuestion.includes("fewest") || lowerQuestion.includes("most") || lowerQuestion.includes("least") || 
			 lowerQuestion.includes("highest") || lowerQuestion.includes("lowest")) &&
			(lowerQuestion.includes("conceded") || lowerQuestion.includes("scored") || lowerQuestion.includes("goals") || lowerQuestion.includes("history"))
		) {
			return "club";
		}

		// Check for ranking queries (which player/team has the highest/most/fewest/least/worst...)
		// Special case: "worst penalty record" questions should be routed to ranking handler
		const isWorstPenaltyRecord = lowerQuestion.includes("worst") && 
			(lowerQuestion.includes("penalty") || lowerQuestion.includes("penalties")) && 
			(lowerQuestion.includes("record") || lowerQuestion.includes("conversion"));
		
		if (
			(lowerQuestion.includes("which") || lowerQuestion.includes("who")) &&
			(lowerQuestion.includes("highest") || lowerQuestion.includes("most") || lowerQuestion.includes("best") || lowerQuestion.includes("top") || 
			 lowerQuestion.includes("fewest") || lowerQuestion.includes("least") || lowerQuestion.includes("lowest") || lowerQuestion.includes("worst"))
		) {
			// If it's asking about teams specifically, route to club handler
			if (lowerQuestion.includes("team") && (lowerQuestion.includes("conceded") || lowerQuestion.includes("scored") || lowerQuestion.includes("goals"))) {
				return "club";
			}
			return "ranking";
		}
		
		// Also check for "worst penalty record" questions that might not have "which" or "who"
		if (isWorstPenaltyRecord) {
			return "ranking";
		}

		// Check for competition-specific queries (cup vs league, etc.)
		const hasCompetitionTypes = extractionResult.competitionTypes.length > 0;
		const hasCompetitions = extractionResult.competitions.length > 0;
		if (
			(hasCompetitionTypes || hasCompetitions) &&
			(lowerQuestion.includes("in") || lowerQuestion.includes("cup") || lowerQuestion.includes("league") || lowerQuestion.includes("friendly"))
		) {
			// If it's a player question with competition filter, keep it as player type
			if (hasPlayerEntities) {
				return "player";
			}
			// Otherwise, could be team/club question
		}

		// Check for result-based queries (goals in wins, win rate, etc.)
		const hasResults = extractionResult.results.length > 0;
		if (
			hasResults &&
			(lowerQuestion.includes("in") || lowerQuestion.includes("win") || lowerQuestion.includes("draw") || lowerQuestion.includes("loss") || lowerQuestion.includes("won") || lowerQuestion.includes("lost"))
		) {
			// If it's a player question with result filter, keep it as player type
			if (hasPlayerEntities) {
				return "player";
			}
		}

		// Check for comparison queries (most, least, highest, etc.)
		if (
			lowerQuestion.includes("most") ||
			lowerQuestion.includes("least") ||
			lowerQuestion.includes("highest") ||
			lowerQuestion.includes("lowest") ||
			lowerQuestion.includes("best") ||
			lowerQuestion.includes("worst") ||
			lowerQuestion.includes("top") ||
			lowerQuestion.includes("who has") ||
			lowerQuestion.includes("penalty record") ||
			lowerQuestion.includes("conversion rate")
		) {
			return "comparison";
		}

		// Check for opposition-specific queries (goals against opposition, record vs opposition, etc.)
		// This must be checked BEFORE general team queries to avoid false positives
		const hasOppositionEntities = extractionResult.entities.some((e) => e.type === "opposition");
		if (
			hasOppositionEntities &&
			((lowerQuestion.includes("against") && (lowerQuestion.includes("scored") || lowerQuestion.includes("goals") || lowerQuestion.includes("record") || lowerQuestion.includes("played"))) ||
				(lowerQuestion.includes("vs") && (lowerQuestion.includes("scored") || lowerQuestion.includes("goals") || lowerQuestion.includes("record"))) ||
				(lowerQuestion.includes("versus") && (lowerQuestion.includes("scored") || lowerQuestion.includes("goals") || lowerQuestion.includes("record"))) ||
				(lowerQuestion.includes("opposition") && (lowerQuestion.includes("scored") || lowerQuestion.includes("goals") || lowerQuestion.includes("record"))) ||
				(lowerQuestion.includes("win rate") && lowerQuestion.includes("against")) ||
				(lowerQuestion.includes("record") && lowerQuestion.includes("against")))
		) {
			return "player"; // Route to player handler for opposition-specific player stats
		}

		// Check for opposition name queries (who did [team] play, opposition queries)
		// This must be checked BEFORE general team queries to avoid false positives
		// CRITICAL: Exclude player stat questions (e.g., "did [player] get...playing") from fixture queries
		const isPlayerStatQuestion = hasPlayerEntities && (
			lowerQuestion.includes("get") || 
			lowerQuestion.includes("got") || 
			lowerQuestion.includes("scored") || 
			lowerQuestion.includes("goals") ||
			lowerQuestion.includes("assists") ||
			lowerQuestion.includes("how many")
		);
		
		if (
			hasTeamEntities &&
			!isPlayerStatQuestion &&
			((lowerQuestion.includes("who did") && (lowerQuestion.includes("play") || lowerQuestion.includes("played"))) ||
				(lowerQuestion.includes("who") && lowerQuestion.includes("play") && (lowerQuestion.includes("against") || lowerQuestion.includes("opposition"))) ||
				(lowerQuestion.includes("opposition") && (lowerQuestion.includes("play") || lowerQuestion.includes("played"))) ||
				(lowerQuestion.includes("did") && lowerQuestion.includes("play") && !lowerQuestion.includes("get") && !lowerQuestion.includes("got")))
		) {
			return "fixture";
		}

		// Check for general team queries (without league position context)
		// BUT: If there are player entities AND the question asks about a player's stats (has...got, did...get, scored, etc.),
		// prioritize player query over team query
		// CRITICAL: Also check for player stat phrases even without extracted player entities (e.g., misspelled names)
		const hasPlayerStatPhrases = 
			(lowerQuestion.includes("has") && (lowerQuestion.includes("got") || lowerQuestion.includes("scored") || lowerQuestion.includes("assists") || lowerQuestion.includes("goals"))) ||
			(lowerQuestion.includes("did") && (lowerQuestion.includes("get") || lowerQuestion.includes("got") || lowerQuestion.includes("scored"))) ||
			lowerQuestion.includes("scored") ||
			lowerQuestion.includes("got") ||
			(lowerQuestion.includes("how many") && (lowerQuestion.includes("goals") || lowerQuestion.includes("assists") || lowerQuestion.includes("appearances") || lowerQuestion.includes("yellow") || lowerQuestion.includes("red") || lowerQuestion.includes("mom")));
		
		// Check if question contains a potential player name pattern (even if not extracted)
		// This helps catch misspelled names like "Kieran MCkrell" that might not be extracted
		const hasPotentialPlayerName = /\b([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+)+)\b/.test(this.question);
		
		if (
			hasTeamEntities &&
			!lowerQuestion.includes("finish") &&
			!lowerQuestion.includes("position") &&
			!lowerQuestion.includes("table") &&
			!lowerQuestion.includes("league") &&
			!(hasPlayerEntities && hasPlayerStatPhrases) &&
			!(hasPotentialPlayerName && hasPlayerStatPhrases) // Also prioritize if there's a potential player name + stat phrases
		) {
			return "team";
		}

		if (
			lowerQuestion.includes("club") ||
			lowerQuestion.includes("dorkinians") ||
			lowerQuestion.includes("captain") ||
			lowerQuestion.includes("award")
		) {
			return "club";
		}

		if (lowerQuestion.includes("fixture") || lowerQuestion.includes("match") || lowerQuestion.includes("game")) {
			return "fixture";
		}

		// Default to player if we have player entities or player-related content
		if (hasPlayerEntities || this.hasPlayerRelatedContent()) {
			return "player";
		}

		return "general";
	}

	private hasPlayerRelatedContent(): boolean {
		const lowerQuestion = this.question.toLowerCase();
		const playerIndicators = [
			"scored",
			"goals",
			"assists",
			"appearances",
			"minutes",
			"man of the match",
			"yellow",
			"red",
			"saves",
			"own goals",
			"conceded",
			"clean sheets",
			"penalties",
			"fantasy",
			"away games",
			"home games",
			"most prolific season",
			"most common position",
			"played",
			"won",
			"received",
			"kept",
			"missed",
		];

		return playerIndicators.some((indicator) => lowerQuestion.includes(indicator));
	}

	private extractLegacyEntities(extractionResult: EntityExtractionResult): string[] {
		// Convert extracted entities to legacy format
		const entities: string[] = [];

		// Phrases that should not be treated as player names
		const invalidPlayerNames = ["goal count", "goal stats", "goal stat", "stats", "stat", "count"];

		// Check if any extracted player name partially matches the selected player
		const matchedPlayerName = this.checkPartialPlayerNameMatch(extractionResult);
		let hasMatchedPlayer = false;

		extractionResult.entities.forEach((entity) => {
			if (entity.type === "player") {
				const lowerValue = entity.value.toLowerCase();
				// Skip if this is an invalid player name (likely a mis-extracted phrase)
				if (invalidPlayerNames.includes(lowerValue)) {
					return;
				}
				// Skip if this is a team number (3s, 3rd, etc.) - these should never be player entities
				if (lowerValue.match(/^\d+(st|nd|rd|th|s)?$/)) {
					return;
				}
				if (entity.value === "I" && this.userContext) {
					entities.push(this.userContext);
					hasMatchedPlayer = true;
				} else if (entity.value === "I" && !this.userContext) {
					// Skip "I" references when userContext is missing - they can't be resolved
					// This prevents "I" from being added to entities when userContext is not available
					return;
				} else if (matchedPlayerName && this.userContext) {
					// matchedPlayerName is not null, meaning we found a partial match
					// Use originalText to check the text before fuzzy matching
					const originalText = entity.originalText.toLowerCase().trim();
					const cleanOriginalText = originalText.replace(/\s*\(resolved to:.*?\)$/i, "").trim();
					const selectedPlayerLower = this.userContext.toLowerCase().trim();
					
					// If the original extracted text is contained in the selected player name, use the full selected player name
					// This ensures we use the selected player even if fuzzy matching resolved to a different player
					if (selectedPlayerLower.includes(cleanOriginalText) && cleanOriginalText.length >= 2 && 
						cleanOriginalText !== "i" && cleanOriginalText !== "i've" && cleanOriginalText !== "me" && cleanOriginalText !== "my" && cleanOriginalText !== "myself") {
						entities.push(matchedPlayerName); // Use the matched player name (which is this.userContext)
						hasMatchedPlayer = true;
					} else {
						entities.push(entity.value);
					}
				} else {
					entities.push(entity.value);
				}
			} else {
				entities.push(entity.value);
			}
		});

		// Add user context if no entities found and we have user context
		if (entities.length === 0 && this.userContext) {
			entities.push(this.userContext);
		}

		return entities;
	}

	/**
	 * Applies all stat type corrections - extracted for reuse before clarification check
	 */
	private applyStatTypeCorrections(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		// CRITICAL FIX: Detect "games" questions and map to "Apps" (HIGHEST PRIORITY)
		const gamesCorrectedStats = this.correctGamesQueries(statTypes);

		// CRITICAL FIX: Detect goals queries with location filters (e.g., "away from home") and remove Home/Away stat types
		const locationGoalsCorrectedStats = this.correctLocationGoalsQueries(gamesCorrectedStats);

		// CRITICAL FIX: Detect home/away games queries and convert Home/Away to Home Games/Away Games
		const homeAwayGamesCorrectedStats = this.correctHomeAwayGamesQueries(locationGoalsCorrectedStats);

		// CRITICAL FIX: Detect team-specific appearance queries (HIGHEST PRIORITY)
		const teamAppearanceCorrectedStats = this.correctTeamSpecificAppearanceQueries(homeAwayGamesCorrectedStats);

		// CRITICAL FIX: Detect penalty conversion rate queries (must run before other penalty corrections)
		const penaltyConversionCorrectedStats = this.correctPenaltyConversionRateQueries(teamAppearanceCorrectedStats);

		// CRITICAL FIX: Detect penalty phrases that were incorrectly broken down
		const correctedStatTypes = this.correctPenaltyPhrases(penaltyConversionCorrectedStats);

		// CRITICAL FIX: Detect most prolific season queries
		const prolificCorrectedStats = this.correctMostProlificSeasonQueries(correctedStatTypes);

		// CRITICAL FIX: Detect season-specific queries
		const seasonCorrectedStats = this.correctSeasonSpecificQueries(prolificCorrectedStats);

		// CRITICAL FIX: Detect season-specific appearance queries
		const appearanceCorrectedStats = this.correctSeasonSpecificAppearanceQueries(seasonCorrectedStats);

		// CRITICAL FIX: Detect fantasy points queries (must run before open play goals correction)
		const fantasyPointsCorrectedStats = this.correctFantasyPointsQueries(appearanceCorrectedStats);

		// CRITICAL FIX: Detect minutes per goal queries (must run before open play goals correction to filter out "score" matches)
		const minutesPerGoalCorrectedStats = this.correctMinutesPerGoalQueries(fantasyPointsCorrectedStats);

		// CRITICAL FIX: Detect open play goals queries
		const openPlayCorrectedStats = this.correctOpenPlayGoalsQueries(minutesPerGoalCorrectedStats);

		// CRITICAL FIX: Detect team-specific goals queries
		const teamGoalsCorrectedStats = this.correctTeamSpecificGoalsQueries(openPlayCorrectedStats);

		// CRITICAL FIX: Detect distance/travel queries
		const distanceCorrectedStats = this.correctDistanceTravelQueries(teamGoalsCorrectedStats);

		// CRITICAL FIX: Detect percentage queries
		const percentageCorrectedStats = this.correctPercentageQueries(distanceCorrectedStats);

		// CRITICAL FIX: Detect "most appearances for team" queries
		const mostAppearancesCorrectedStats = this.correctMostAppearancesForTeamQueries(percentageCorrectedStats);

		// CRITICAL FIX: Detect "most scored for team" queries
		const mostScoredForTeamCorrectedStats = this.correctMostScoredForTeamQueries(mostAppearancesCorrectedStats);

		// CRITICAL FIX: Prioritize "Goals" over "Assists" when "goals" is explicitly mentioned (both have "got" as pseudonym)
		const goalsAssistsCorrectedStats = this.correctGoalsAssistsConfusion(mostScoredForTeamCorrectedStats);

		// CRITICAL FIX: Remove "Saves" when "Goals" is explicitly mentioned (both have "got" as pseudonym)
		const goalsSavesCorrectedStats = this.correctGoalsSavesConfusion(goalsAssistsCorrectedStats);

		// Apply additional metric correction patterns (without caching for clarification check)
		const cacheKey = `${this.question.toLowerCase()}:${statTypes.map(s => s.value).join(',')}`;
		const fullyCorrectedStats = this.applyMetricCorrections(goalsSavesCorrectedStats, cacheKey);

		return fullyCorrectedStats;
	}

	private extractLegacyMetrics(extractionResult: EntityExtractionResult): string[] {
		// Check cache first (cache key based on question and stat types)
		const cacheKey = `${this.question.toLowerCase()}:${extractionResult.statTypes.map(s => s.value).join(',')}`;
		const cached = EnhancedQuestionAnalyzer.metricCorrectionCache.get(cacheKey);
		if (cached) {
			// Apply priority logic even when returning from cache
			const cachedStatTypes = cached.map((stat) => stat.value);
			// Use the same priority order as the main logic - include all percentage variations
			const percentagePriorityOrder = [
				"Home Games % Won",
				"Away Games % Won",
				"Games % Won",
				"Home Games % Lost",
				"Away Games % Lost",
				"Games % Lost",
				"Home Games % Drawn",
				"Away Games % Drawn",
				"Games % Drawn",
			];
			
			// Find the highest priority percentage stat type in the cached results
			for (const priorityType of percentagePriorityOrder) {
				if (cachedStatTypes.includes(priorityType)) {
					return [this.mapStatTypeToKey(priorityType)];
				}
			}
			
			// Fallback: return all cached stats mapped to keys (original behavior)
			return cached.map((stat) => this.mapStatTypeToKey(stat.value));
		}

		// Use the shared correction method
		const fullyCorrectedStats = this.applyStatTypeCorrections(extractionResult.statTypes);

		// Convert extracted stat types to legacy format with priority handling
		let statTypes = fullyCorrectedStats.map((stat) => stat.value);

		// CRITICAL FIX: Filter out non-percentage home/away games stats if percentage versions exist
		const hasPercentageGamesStat = statTypes.some((stat) => 
			stat.includes("Games %") || stat.includes("Games%")
		);
		if (hasPercentageGamesStat) {
			statTypes = statTypes.filter((stat) => 
				stat !== "Home Games" && stat !== "Away Games" && stat !== "Home" && stat !== "Away"
			);
		}

		// CRITICAL FIX: Filter out Home/Away metrics when question asks for total games/appearances without location qualifier
		const lowerQuestion = this.question.toLowerCase();
		const hasGamesOrAppearances =
			lowerQuestion.includes("games") ||
			lowerQuestion.includes("appearances") ||
			lowerQuestion.includes("apps") ||
			lowerQuestion.includes("played");
		const hasExplicitHome = lowerQuestion.includes("home games") || lowerQuestion.includes("home matches") || lowerQuestion.includes("at home");
		const hasExplicitAway = lowerQuestion.includes("away games") || lowerQuestion.includes("away matches") || lowerQuestion.includes("away from home") || lowerQuestion.includes("on the road");
		
		if (hasGamesOrAppearances && !hasExplicitHome && !hasExplicitAway) {
			// Question asks for total games/appearances, filter out Home and Away metrics
			const filteredStatTypes = statTypes.filter((stat) => stat !== "Home" && stat !== "Away" && stat !== "Home Games" && stat !== "Away Games");
			if (filteredStatTypes.length > 0) {
				// Use filtered stats for priority check
				const seasonGoalsPattern = /^\d{4}\/\d{2}\s+Goals$/;
				const seasonGoalsMatch = filteredStatTypes.find((stat) => seasonGoalsPattern.test(stat));
				if (seasonGoalsMatch) {
					return [this.mapStatTypeToKey(seasonGoalsMatch)];
				}
				
				// Continue with filtered stats
				const priorityOrder = [
					"Number Teams Played For",
					"Number Seasons Played For",
					"Season Count With Total",
					"Season Count Simple",
					"Own Goals",
					"Goals Conceded Per Appearance",
					"Conceded Per Appearance",
					"Minutes Per Goal",
					"Minutes Per Clean Sheet",
					"Minutes Per Appearance",
					"Man of the Match Per Appearance",
					"Fantasy Points Per Appearance",
					"Goals Per Appearance",
					"Assists Per Appearance",
					"Yellow Cards Per Appearance",
					"Red Cards Per Appearance",
					"Saves Per Appearance",
					"Own Goals Per Appearance",
					"Clean Sheets Per Appearance",
					"Penalties Scored Per Appearance",
					"Penalties Missed Per Appearance",
					"Penalties Conceded Per Appearance",
					"Penalties Saved Per Appearance",
					"Penalty Conversion Rate", // More specific than general penalty stats
					"Distance Travelled",
					"Home Games % Won",
					"Away Games % Won",
					"Games % Won",
					"Home Games % Lost",
					"Away Games % Lost",
					"Games % Lost",
					"Home Games % Drawn",
					"Away Games % Drawn",
					"Games % Drawn",
					"Home Wins",
					"Away Wins",
					"Home Games", // Location-specific games (higher priority than general Apps/Games)
					"Away Games", // Location-specific games (higher priority than general Apps/Games)
					"Goals Conceded",
					"Open Play Goals",
					"Penalties Scored",
					"Penalties Missed",
					"Penalties Conceded",
					"Penalties Saved",
					"2021/22 Goals",
					"2020/21 Goals",
					"2019/20 Goals",
					"2018/19 Goals",
					"2017/18 Goals",
					"2016/17 Goals",
					"1st XI Apps",
					"2nd XI Apps",
					"3rd XI Apps",
					"4th XI Apps",
					"5th XI Apps",
					"6th XI Apps",
					"7th XI Apps",
					"8th XI Apps",
					"1st XI Goals",
					"2nd XI Goals",
					"3rd XI Goals",
					"4th XI Goals",
					"5th XI Goals",
					"6th XI Goals",
					"7th XI Goals",
					"8th XI Goals",
					"2021/22 Apps",
					"2020/21 Apps",
					"2019/20 Apps",
					"2018/19 Apps",
					"2017/18 Apps",
					"2016/17 Apps",
					"Goalkeeper Appearances",
					"Defender Appearances",
					"Midfielder Appearances",
					"Forward Appearances",
					"Most Common Position",
					"Most Scored For Team",
					"Most Played For Team",
					"Number Teams Played For",
					"Goals",
					"Assists",
					"Apps",
					"Minutes",
				];
				
				for (const priorityType of priorityOrder) {
					if (filteredStatTypes.includes(priorityType)) {
						return [this.mapStatTypeToKey(priorityType)];
					}
				}
				
				return filteredStatTypes.map((stat) => this.mapStatTypeToKey(stat));
			}
		}

		// Check for dynamic season-specific goals first (highest priority)
		// This ensures any season-specific goals query takes precedence over general goals/assists
		const seasonGoalsPattern = /^\d{4}\/\d{2}\s+Goals$/;
		const seasonGoalsMatch = statTypes.find((stat) => seasonGoalsPattern.test(stat));
		if (seasonGoalsMatch) {
			return [this.mapStatTypeToKey(seasonGoalsMatch)];
		}

		// Priority order: more specific stat types should take precedence
		const priorityOrder = [
			"Number Teams Played For", // Team count queries
			"Number Seasons Played For", // Season count queries
			"Season Count With Total", // Most specific season counting
			"Season Count Simple", // Simple season counting
			"Own Goals", // Most specific - own goals - helps stop the chatbot returning goals
			"Goals Conceded Per Appearance", // Most specific - average calculation metrics
			"Conceded Per Appearance", // Most specific - average calculation metrics (alternative naming)
			"Minutes Per Goal", // More specific than general minutes
			"Minutes Per Clean Sheet", // More specific than general minutes
			"Minutes Per Appearance", // More specific than general minutes - MOVED UP to test priority
			"Man of the Match Per Appearance", // More specific than general MOM
			"Fantasy Points Per Appearance", // MOVED UP to take priority over Goals Per Appearance
			"Goals Per Appearance", // Average calculation metrics - MOVED DOWN to test priority
			"Assists Per Appearance",
			"Yellow Cards Per Appearance", // More specific than general yellow cards
			"Red Cards Per Appearance", // More specific than general red cards
			"Saves Per Appearance", // More specific than general saves
			"Own Goals Per Appearance", // More specific than general own goals
			"Clean Sheets Per Appearance", // More specific than general clean sheets
			"Penalties Scored Per Appearance", // More specific than general penalties scored
			"Penalties Missed Per Appearance", // More specific than general penalties missed
			"Penalties Conceded Per Appearance", // More specific than general penalties conceded
			"Penalties Saved Per Appearance", // More specific than general penalties saved
			"Penalty Conversion Rate", // More specific than general penalty stats - must be before "Penalties Scored"
			"Distance Travelled", // More specific - distance/travel queries (HIGH PRIORITY)
			"Fantasy Points", // More specific - fantasy points queries (HIGH PRIORITY)
			"Home Games % Won",
			"Away Games % Won",
			"Games % Won",
			"Home Games % Lost",
			"Away Games % Lost",
			"Games % Lost",
			"Home Games % Drawn",
			"Away Games % Drawn",
			"Games % Drawn",
			"Home Wins",
			"Away Wins",
			"Home Games", // Location-specific games (higher priority than general Apps/Games)
			"Away Games", // Location-specific games (higher priority than general Apps/Games)
			"Goals Conceded", // More specific than general goals
			"Open Play Goals", // More specific than general goals
			"Penalties Scored", // More specific than general goals
			"Penalties Missed", // More specific than general goals
			"Penalties Conceded", // More specific than general goals
			"Penalties Saved", // More specific than general goals
			"2021/22 Goals", // Season-specific goals (most specific)
			"2020/21 Goals",
			"2019/20 Goals",
			"2018/19 Goals",
			"2017/18 Goals",
			"2016/17 Goals",
			"1st XI Apps", // Team-specific appearances (most specific)
			"2nd XI Apps",
			"3rd XI Apps",
			"4th XI Apps",
			"5th XI Apps",
			"6th XI Apps",
			"7th XI Apps",
			"8th XI Apps",
			"1st XI Goals", // Team-specific goals (most specific)
			"2nd XI Goals",
			"3rd XI Goals",
			"4th XI Goals",
			"5th XI Goals",
			"6th XI Goals",
			"7th XI Goals",
			"8th XI Goals",
			"2021/22 Apps", // Season-specific appearances
			"2020/21 Apps",
			"2019/20 Apps",
			"2018/19 Apps",
			"2017/18 Apps",
			"2016/17 Apps",
			"Goalkeeper Appearances", // Position-specific stats
			"Defender Appearances",
			"Midfielder Appearances",
			"Forward Appearances",
			"Most Common Position",
			"Most Scored For Team", // Higher priority than "Most Played For Team"
			"Most Played For Team", // Lower priority than "Most Scored For Team"
			"Number Teams Played For",
			"Goals", // General goals (lower priority)
			"Assists",
			"Apps",
			"Games", // Map "Games" to "Apps" - should have same priority as Apps
			"Minutes",
			"Saves", // Lower priority than Apps/Games
			// ... other stat types
		];

		// Find the highest priority stat type that was detected
		for (const priorityType of priorityOrder) {
			if (statTypes.includes(priorityType)) {
				return [this.mapStatTypeToKey(priorityType)];
			}
		}

		// Fallback to all detected stat types if no priority match
		return statTypes.map((stat) => this.mapStatTypeToKey(stat));
	}

	/**
	 * Maps stat type display names to their corresponding database keys
	 */
	private mapStatTypeToKey(statType: string): string {
		const mapping: { [key: string]: string } = {
		// Basic stats
		Goals: "G",
		Assists: "A",
		Apps: "APP",
		Appearances: "APP",
		Games: "APP", // Map "Games" to "APP" (appearances)
		Minutes: "MIN",
			"Yellow Cards": "Y",
			"Red Cards": "R",
			Saves: "SAVES",
			"Clean Sheets": "CLS",
			"Own Goals": "OG",
			"Goals Conceded": "C",
			"Fantasy Points": "FTP",
			"Distance Travelled": "DIST",

			// Penalty stats
			"Penalties Scored": "PSC",
			"Penalties Missed": "PM",
			"Penalties Conceded": "PCO",
			"Penalties Saved": "PSV",
			"Penalty Conversion Rate": "PENALTY_CONVERSION_RATE",

			// Position stats
			"Goalkeeper Appearances": "GK",
			"Defender Appearances": "DEF",
			"Midfielder Appearances": "MID",
			"Forward Appearances": "FWD",
			"Most Common Position": "MostCommonPosition",

			// Calculated stats
			"Goal Involvements": "GI",
			"All Goals Scored": "ALLGSC",

			// Location stats
			Home: "HOME",
			Away: "AWAY",
			"Home Games": "HomeGames",
			"Away Games": "AwayGames",
			"Home Wins": "HomeWins",
			"Away Wins": "AwayWins",
			"Home Games % Won": "HomeGames%Won",
			"Away Games % Won": "AwayGames%Won",
			"Games % Won": "Games%Won",
			"Home Games % Lost": "HomeGames%Lost",
			"Away Games % Lost": "AwayGames%Lost",
			"Games % Lost": "Games%Lost",
			"Home Games % Drawn": "HomeGames%Drawn",
			"Away Games % Drawn": "AwayGames%Drawn",
			"Games % Drawn": "Games%Drawn",

			// Team-specific stats (keep the full format for proper response generation)
			// "1st XI Apps": "1sApps",  // Commented out to preserve full format
			// "2nd XI Apps": "2sApps",
			// "3rd XI Apps": "3sApps",
			// "4th XI Apps": "4sApps",
			// "5th XI Apps": "5sApps",
			// "6th XI Apps": "6sApps",
			// "7th XI Apps": "7sApps",
			// "8th XI Apps": "8sApps",
			"Most Played For Team": "MostPlayedForTeam",
			"Number Teams Played For": "NumberTeamsPlayedFor",

			"1st XI Goals": "1sGoals",
			"2nd XI Goals": "2sGoals",
			"3rd XI Goals": "3sGoals",
			"4th XI Goals": "4sGoals",
			"5th XI Goals": "5sGoals",
			"6th XI Goals": "6sGoals",
			"7th XI Goals": "7sGoals",
			"8th XI Goals": "8sGoals",
			"Most Scored For Team": "MostScoredForTeam",

			// Season-specific stats (dynamic)
			"Number Seasons Played For": "NumberSeasonsPlayedFor",
			"Most Prolific Season": "MostProlificSeason",

			// Average calculation metrics
			"Goals Per Appearance": "GperAPP",
			"Conceded Per Appearance": "CperAPP",
			"Minutes Per Goal": "MperG",
			"Minutes Per Clean Sheet": "MperCLS",
			"Assists Per Appearance": "AperAPP",
			"Fantasy Points Per Appearance": "FTPperAPP",
			"Goals Conceded Per Appearance": "CperAPP",

			// Additional Per Appearance metrics
			"Minutes Per Appearance": "MINperAPP",
			"Man of the Match Per Appearance": "MOMperAPP",
			"Yellow Cards Per Appearance": "YperAPP",
			"Red Cards Per Appearance": "RperAPP",
			"Saves Per Appearance": "SAVESperAPP",
			"Own Goals Per Appearance": "OGperAPP",
			"Clean Sheets Per Appearance": "CLSperAPP",
			"Penalties Scored Per Appearance": "PSCperAPP",
			"Penalties Missed Per Appearance": "PMperAPP",
			"Penalties Conceded Per Appearance": "PCOperAPP",
			"Penalties Saved Per Appearance": "PSVperAPP",

			// Awards and special stats
			"Man of the Match": "MOM",
			"Team of the Week": "TOTW",
			"Season Team of the Week": "SEASON_TOTW",
			"Player of the Month": "POTM",
			"Captain Awards": "CAPTAIN",
			"Co Players": "CO_PLAYERS",
			Opponents: "OPPONENTS",

			// Other stats
			"Open Play Goals": "OPENPLAYGOALS",
			Score: "G",
			Awards: "MOM",
			Leagues: "TOTW",
			"Penalty record": "PSC",
			"Team Analysis": "TEAM_ANALYSIS",
			"Season Analysis": "SEASON_ANALYSIS",
			"Season Count With Total": "SEASON_COUNT_WITH_TOTAL",
			"Season Count Simple": "SEASON_COUNT_SIMPLE",
			"Double Game Weeks": "DOUBLE_GAME_WEEKS",
		};

		// Handle dynamic seasonal metrics
		if (statType.includes(" Apps") && statType.match(/\d{4}\/\d{2}/)) {
			// Convert "2018/19 Apps" to "2018/19Apps"
			return statType.replace(" Apps", "Apps");
		}

		if (statType.includes(" Goals") && statType.match(/\d{4}\/\d{2}/)) {
			// Convert "2018/19 Goals" to "2018/19Goals"
			return statType.replace(" Goals", "Goals");
		}

		if (statType.includes(" Assists") && statType.match(/\d{4}\/\d{2}/)) {
			// Convert "2018/19 Assists" to "2018/19Assists"
			return statType.replace(" Assists", "Assists");
		}

		if (statType.includes(" Clean Sheets") && statType.match(/\d{4}\/\d{2}/)) {
			// Convert "2018/19 Clean Sheets" to "2018/19CleanSheets"
			return statType.replace(" Clean Sheets", "CleanSheets");
		}

		if (statType.includes(" Saves") && statType.match(/\d{4}\/\d{2}/)) {
			// Convert "2018/19 Saves" to "2018/19Saves"
			return statType.replace(" Saves", "Saves");
		}

		// Handle team-specific appearance metrics in "3rd XI Apps" format
		const teamAppsPattern = /^(\d+)(?:st|nd|rd|th)\s+XI\s+Apps$/i;
		const teamAppsMatch = statType.match(teamAppsPattern);
		if (teamAppsMatch) {
			const teamNum = teamAppsMatch[1];
			return `${teamNum}sApps`; // Convert "3rd XI Apps" -> "3sApps"
		}

		// Handle team-specific appearance metrics (3sApps, 4sApps, etc.)
		if (/^\d+sApps$/i.test(statType)) {
			return statType; // Return as-is (e.g., "3sApps" -> "3sApps")
		}

		return mapping[statType] || statType;
	}

	/**
	 * Corrects season-specific queries that were incorrectly mapped
	 */
	/**
	 * Pattern-based metric correction system with early exit
	 * Replaces 12 sequential correction functions with priority-based pattern matching
	 */
	private applyMetricCorrections(statTypes: StatTypeInfo[], cacheKey: string): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();
		
		// Define correction patterns in priority order (highest priority first)
		// When a pattern matches, apply correction and return early
		const correctionPatterns: Array<{
			priority: number;
			test: (question: string, stats: StatTypeInfo[]) => boolean;
			apply: (question: string, stats: StatTypeInfo[]) => StatTypeInfo[];
		}> = [
			// Priority 0: Club team count questions ("How many of the club's teams...")
			{
				priority: 0,
				test: (q) => {
					const lowerQ = q.toLowerCase();
					return (
						lowerQ.includes("how many of the club's teams") ||
						lowerQ.includes("how many of the clubs teams") ||
						lowerQ.includes("how many of the club teams") ||
						lowerQ.includes("how many of the club's team") ||
						lowerQ.includes("how many of the clubs team") ||
						lowerQ.includes("how many of the club team") ||
						(lowerQ.includes("how many team") && (lowerQ.includes("played for") || lowerQ.includes("played in")))
					);
				},
				apply: (q, _stats) => {
					const lowerQ = q.toLowerCase();
					const clubIndex = lowerQ.indexOf("club");
					const teamIndex = lowerQ.indexOf("team");
					const position = clubIndex !== -1 ? clubIndex : teamIndex;
					return [
						{
							value: "Number Teams Played For",
							originalText: "club teams played for",
							position: position >= 0 ? position : 0,
						},
					];
				},
			},
			// Priority 0: Season count questions ("How many seasons has ... played in?")
			{
				priority: 0,
				test: (q) => {
					const normalized = q.toLowerCase();
					const seasonPhrase =
						normalized.includes("how many seasons") ||
						normalized.includes("how many season") ||
						normalized.includes("seasons has") ||
						normalized.includes("season has") ||
						normalized.includes("seasons did") ||
						normalized.includes("season did");
					const playedPhrase =
						normalized.includes("played in") ||
						normalized.includes("played for") ||
						normalized.includes("played with") ||
						normalized.includes("played");
					return seasonPhrase && playedPhrase;
				},
				apply: (q, _stats) => {
					let position = q.indexOf("seasons");
					if (position === -1) {
						position = q.indexOf("season");
					}
					return [
						{
							value: "Season Count Simple",
							originalText: "season count simple",
							position: position >= 0 ? position : 0,
						},
					];
				},
			},
			// Priority 1: Goalkeeper/Defender/Midfielder/Forward position queries
			{
				priority: 1,
				test: (q) => q.includes("goalkeeper"),
				apply: (q, stats) => {
					const filtered = stats.filter(
						(stat) => !["Goals", "All Goals Scored", "Apps", "Appearances"].includes(stat.value),
					);
					filtered.push({
						value: "Goalkeeper Appearances",
						originalText: "goalkeeper",
						position: q.indexOf("goalkeeper"),
					});
					return filtered;
				},
			},
			{
				priority: 1,
				test: (q) => q.includes("defender"),
				apply: (q, stats) => {
					const filtered = stats.filter(
						(stat) => !["Goals", "All Goals Scored", "Apps", "Appearances"].includes(stat.value),
					);
					filtered.push({
						value: "Defender Appearances",
						originalText: "defender",
						position: q.indexOf("defender"),
					});
					return filtered;
				},
			},
			{
				priority: 1,
				test: (q) => q.includes("midfielder") || q.includes("midfield"),
				apply: (q, stats) => {
					const filtered = stats.filter(
						(stat) => !["Goals", "All Goals Scored", "Apps", "Appearances"].includes(stat.value),
					);
					const position = q.indexOf("midfielder") !== -1 ? q.indexOf("midfielder") : q.indexOf("midfield");
					filtered.push({
						value: "Midfielder Appearances",
						originalText: "midfielder",
						position: position >= 0 ? position : 0,
					});
					return filtered;
				},
			},
			{
				priority: 1,
				test: (q) => q.includes("forward") || q.includes("striker"),
				apply: (q, stats) => {
					const filtered = stats.filter(
						(stat) => !["Goals", "All Goals Scored", "Apps", "Appearances"].includes(stat.value),
					);
					const position = q.indexOf("forward") !== -1 ? q.indexOf("forward") : q.indexOf("striker");
					filtered.push({
						value: "Forward Appearances",
						originalText: "forward",
						position: position >= 0 ? position : 0,
					});
					return filtered;
				},
			},
			// Priority 1: Team-specific appearances (highest priority)
			{
				priority: 1,
				test: (q, stats) => {
					const patterns = [
						/(appearances?|apps?|games?)\s+.*?\s+(?:for\s+(?:the\s+)?)(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)/i,
						/(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)(?:\s+(?:team|teams?))?\s+(appearances?|apps?|games?)/i,
						/(?:how\s+many\s+times|times).*?(?:played|playing)\s+for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)/i,
						/(?:what\s+is\s+the\s+)?(appearance\s+count|count)\s+(?:for\s+[^f]+?\s+)?(?:playing\s+for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)|for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth))/i,
						/(?:provide|give).*?(?:appearance\s+count|apps?|appearances?).*?for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)/i,
					];
					return patterns.some(p => p.test(q));
				},
				apply: (q, stats) => this.correctTeamSpecificAppearanceQueries(stats),
			},
			// Priority 2: Team-specific goals
			{
				priority: 2,
				test: (q, stats) => {
					const patterns = [
						/(goals?)\s+.*?\s+(?:for\s+(?:the\s+)?)(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)/i,
						/(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)(?:\s+(?:team|teams?|xi))?\s+(goals?)/i,
					];
					return patterns.some(p => p.test(q));
				},
				apply: (q, stats) => this.correctTeamSpecificGoalsQueries(stats),
			},
			// Priority 3: Most prolific season
			{
				priority: 3,
				test: (q, stats) => q.includes("most") && q.includes("prolific") && q.includes("season"),
				apply: (q, stats) => this.correctMostProlificSeasonQueries(stats),
			},
			// Priority 4: Season-specific goals
			{
				priority: 4,
				test: (q, stats) => q.includes("goals") && this.extractSeasonFromQuestion() !== null,
				apply: (q, stats) => this.correctSeasonSpecificQueries(stats),
			},
			// Priority 5: Season-specific appearances
			{
				priority: 5,
				test: (q, stats) => (q.includes("appearances") || q.includes("apps") || q.includes("games")) && this.extractSeasonFromQuestion() !== null,
				apply: (q, stats) => this.correctSeasonSpecificAppearanceQueries(stats),
			},
			// Priority 6: Open play goals
			{
				priority: 6,
				test: (q, stats) => q.includes("goals") && q.includes("open play"),
				apply: (q, stats) => this.correctOpenPlayGoalsQueries(stats),
			},
			// Priority 7: Penalty phrases
			{
				priority: 7,
				test: (q, stats) => q.includes("penalties") && (q.includes("scored") || q.includes("missed") || q.includes("conceded") || q.includes("saved")),
				apply: (q, stats) => this.correctPenaltyPhrases(stats),
			},
			// Priority 8: Distance/travel
			{
				priority: 8,
				test: (q, stats) => ["how far", "distance travelled", "distance traveled", "travelled", "traveled"].some(p => q.includes(p)),
				apply: (q, stats) => this.correctDistanceTravelQueries(stats),
			},
			// Priority 9: Percentage queries
			{
				priority: 9,
				test: (q, stats) => q.includes("percentage") || q.includes("percent") || q.includes("%"),
				apply: (q, stats) => this.correctPercentageQueries(stats),
			},
			// Priority 10: Most appearances for team
			{
				priority: 10,
				test: (q, stats) => /(?:what\s+team\s+has|which\s+team\s+has).*?(?:most\s+appearances\s+for|played\s+for\s+most)/i.test(q),
				apply: (q, stats) => this.correctMostAppearancesForTeamQueries(stats),
			},
			// Priority 11: Most scored for team
			{
				priority: 11,
				test: (q, stats) => /(?:what\s+team\s+has|which\s+team\s+has).*?(?:scored\s+(?:the\s+)?most|most\s+goals?\s+for)/i.test(q),
				apply: (q, stats) => this.correctMostScoredForTeamQueries(stats),
			},
			// Priority 12: Games queries (lowest priority, catch-all)
			{
				priority: 12,
				test: (q, stats) => /(?:how\s+many\s+games?|games?\s+(?:have|has|did)\s+.*?\s+(?:played|made|appeared))/i.test(q) || (q.includes("games") && q.includes("played")),
				apply: (q, stats) => this.correctGamesQueries(stats),
			},
		];

		// Sort by priority (lowest number = highest priority)
		correctionPatterns.sort((a, b) => a.priority - b.priority);

		// Apply first matching pattern and return early
		for (const pattern of correctionPatterns) {
			if (pattern.test(lowerQuestion, statTypes)) {
				const result = pattern.apply(lowerQuestion, statTypes);
				// Cache the result
				EnhancedQuestionAnalyzer.metricCorrectionCache.set(cacheKey, result);
				return result;
			}
		}

		// No pattern matched, return original stats
		return statTypes;
	}

	/**
	 * Dynamically extracts season from question text using regex patterns
	 * Supports various formats: 2018/19, 2018-19, 18/19, 2018/2019, etc.
	 */
	private extractSeasonFromQuestion(): string | null {
		const question = this.question;

		// Pattern 1: Full year format with full end year (2018/2019, 2019/2020, etc.)
		const fullYearFullMatch = question.match(/(\d{4})\/(\d{4})/);
		if (fullYearFullMatch) {
			const startYear = fullYearFullMatch[1];
			const endYear = fullYearFullMatch[2];
			const shortEndYear = endYear.substring(2);
			return `${startYear}/${shortEndYear}`;
		}

		// Pattern 2: Full year format with full end year hyphenated (2018-2019, 2019-2020, etc.)
		const fullYearFullHyphenMatch = question.match(/(\d{4})-(\d{4})/);
		if (fullYearFullHyphenMatch) {
			const startYear = fullYearFullHyphenMatch[1];
			const endYear = fullYearFullHyphenMatch[2];
			const shortEndYear = endYear.substring(2);
			return `${startYear}/${shortEndYear}`;
		}

		// Pattern 3: Full year format with slash (2018/19, 2019/20, etc.)
		const fullYearSlashMatch = question.match(/(\d{4})\/(\d{2})/);
		if (fullYearSlashMatch) {
			const startYear = fullYearSlashMatch[1];
			const endYear = fullYearSlashMatch[2];
			return `${startYear}/${endYear}`;
		}

		// Pattern 4: Full year format with hyphen (2018-19, 2019-20, etc.)
		const fullYearHyphenMatch = question.match(/(\d{4})-(\d{2})/);
		if (fullYearHyphenMatch) {
			const startYear = fullYearHyphenMatch[1];
			const endYear = fullYearHyphenMatch[2];
			return `${startYear}/${endYear}`;
		}

		// Pattern 5: Full year range format (2021 to 2022, 2018 to 2019, etc.)
		const fullYearRangeMatch = question.match(/(\d{4})\s+to\s+(\d{4})/);
		if (fullYearRangeMatch) {
			const startYear = fullYearRangeMatch[1];
			const endYear = fullYearRangeMatch[2];
			// Convert second year to 2-digit format for season notation
			const shortEndYear = endYear.substring(2);
			return `${startYear}/${shortEndYear}`;
		}

		// Pattern 6: Short year format with slash (18/19, 19/20, 20/21, 21/22, etc.)
		// BUT: Exclude if it's part of a date (DD/MM/YYYY or MM/DD/YYYY format)
		const shortYearSlashMatch = question.match(/(\d{2})\/(\d{2})/);
		if (shortYearSlashMatch) {
			const matchIndex = shortYearSlashMatch.index || 0;
			const matchText = shortYearSlashMatch[0];
			
			// Check if this is part of a date pattern (DD/MM/YYYY or MM/DD/YYYY)
			// Look for date patterns around this match (before or after)
			const beforeText = question.substring(Math.max(0, matchIndex - 10), matchIndex);
			const afterText = question.substring(matchIndex + matchText.length, Math.min(question.length, matchIndex + matchText.length + 10));
			const isPartOfDate = 
				// Check if followed by another date component (like "/2022" or "/24")
				/\/\d{2,4}/.test(afterText) ||
				// Check if preceded by a date component (like "20/" or "03/")
				/\d{1,2}\//.test(beforeText);
			
			// Also check if the second number is > 12 (months can't be > 12, so this is likely a season)
			// But if it's clearly a date format (has 3 parts), exclude it
			const endYearNum = parseInt(shortYearSlashMatch[2], 10);
			const isLikelyDate = isPartOfDate && (endYearNum <= 12 || /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(question.substring(Math.max(0, matchIndex - 5), matchIndex + matchText.length + 5)));
			
			if (!isLikelyDate) {
				const startYear = shortYearSlashMatch[1];
				const endYear = shortYearSlashMatch[2];
				// Check if it's already a 4-digit year (length check), not just if it starts with "20"
				const fullStartYear = startYear.length === 4 ? startYear : `20${startYear}`;
				// Keep end year as 2-digit format for season notation (YYYY/YY)
				return `${fullStartYear}/${endYear}`;
			}
		}

		return null;
	}

	private correctSeasonSpecificQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

		// Dynamic season detection for goals
		// Check for "goals" in question (even if "get" is also present, goals should take precedence)
		if (lowerQuestion.includes("goals")) {
			const seasonMatch = this.extractSeasonFromQuestion();
			if (seasonMatch) {
				// Filter out general goals, assists (if "get" was matched), and other conflicting stats
				const filteredStats = statTypes.filter((stat) => 
					!["All Goals Scored", "Goals", "Score", "Assists"].includes(stat.value)
				);
				// Add season-specific goals with high priority
				filteredStats.push({
					value: `${seasonMatch} Goals`,
					originalText: `goals in ${seasonMatch}`,
					position: lowerQuestion.indexOf("goals"),
				});
				return filteredStats;
			}
		}

		return statTypes;
	}

	/**
	 * Corrects "games" questions to map to "Apps" instead of "Saves"
	 */
	private correctGamesQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

		// Pattern to detect "games" questions (e.g., "How many games have I played?")
		// This should map to "Apps" not "Saves"
		const gamesPattern = /(?:how\s+many\s+games?|games?\s+(?:have|has|did)\s+.*?\s+(?:played|made|appeared))/i;
		
		// Pattern to detect "how many times has X played" questions (e.g., "How many times has Luke played?")
		// This should map to "Apps" (appearances)
		const timesPlayedPattern = /(?:how\s+many\s+times|times)\s+(?:has|have|did)\s+.*?\s+played/i;

		if (gamesPattern.test(lowerQuestion) || (lowerQuestion.includes("games") && lowerQuestion.includes("played")) || timesPlayedPattern.test(lowerQuestion)) {
			// Remove "Saves" if it was incorrectly detected
			const filteredStats = statTypes.filter((stat) => stat.value !== "Saves" && stat.value !== "Saves Per Appearance");

			// Add "Games" if not already present (which will map to "Apps")
			const hasGames = filteredStats.some((stat) => stat.value === "Games" || stat.value === "Apps" || stat.value === "Appearances");
			if (!hasGames) {
				// Determine the original text based on which pattern matched
				let originalText = "games";
				let position = lowerQuestion.indexOf("games");
				if (timesPlayedPattern.test(lowerQuestion)) {
					originalText = "times played";
					position = lowerQuestion.indexOf("times");
				}
				
				filteredStats.push({
					value: "Games",
					originalText: originalText,
					position: position !== -1 ? position : 0,
				});
			}

			return filteredStats;
		}

		return statTypes;
	}

	/**
	 * Corrects home/away games queries - converts "Home" to "Home Games" and "Away" to "Away Games"
	 */
	private correctHomeAwayGamesQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

		// Skip if this is a percentage query - percentage stats should take precedence
		const hasPercentageStat = statTypes.some(
			(stat) => stat.value.includes("%") || stat.value.includes("Percentage")
		);
		if (hasPercentageStat) {
			return statTypes;
		}

		// Patterns to detect home games queries
		const homeGamesPatterns = [
			/(?:how\s+many\s+)?home\s+games?\s+(?:has|have|did)\s+.*?\s+(?:played|made|appeared)/i,
			/home\s+games?\s+.*?\s+(?:has|have|did)\s+.*?\s+(?:played|made|appeared)/i,
			/games?\s+at\s+home/i,
			/games?\s+played\s+at\s+home/i,
		];

		// Patterns to detect away games queries
		const awayGamesPatterns = [
			/(?:how\s+many\s+)?away\s+games?\s+(?:has|have|did)\s+.*?\s+(?:played|made|appeared)/i,
			/away\s+games?\s+.*?\s+(?:has|have|did)\s+.*?\s+(?:played|made|appeared)/i,
			/games?\s+away/i,
			/games?\s+played\s+away/i,
		];

		const isHomeGamesQuery = homeGamesPatterns.some(pattern => pattern.test(lowerQuestion));
		const isAwayGamesQuery = awayGamesPatterns.some(pattern => pattern.test(lowerQuestion));

		if (isHomeGamesQuery || isAwayGamesQuery) {
			// Filter out "Home", "Away", "Apps", "Games", "Appearances" if present
			const filteredStats = statTypes.filter((stat) => 
				!["Home", "Away", "Apps", "Games", "Appearances"].includes(stat.value)
			);

			// Add the correct metric
			if (isHomeGamesQuery) {
				filteredStats.push({
					value: "Home Games",
					originalText: "home games",
					position: lowerQuestion.indexOf("home games") !== -1 ? lowerQuestion.indexOf("home games") : lowerQuestion.indexOf("home"),
				});
			} else if (isAwayGamesQuery) {
				filteredStats.push({
					value: "Away Games",
					originalText: "away games",
					position: lowerQuestion.indexOf("away games") !== -1 ? lowerQuestion.indexOf("away games") : lowerQuestion.indexOf("away"),
				});
			}

			return filteredStats;
		}

		return statTypes;
	}

	/**
	 * Corrects goals queries with location filters - removes Home/Away stat types when location is specified
	 * Example: "How many goals have I scored away from home?" should only have "Goals" stat type, not "Away" and "Home"
	 */
	private correctLocationGoalsQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

		// Check if question asks about goals with location phrases
		const hasGoals = lowerQuestion.includes("goals") || lowerQuestion.includes("scored") || lowerQuestion.includes("goal");
		const hasLocationPhrase = 
			lowerQuestion.includes("away from home") ||
			lowerQuestion.includes("on the road") ||
			lowerQuestion.includes("at home") ||
			lowerQuestion.includes("home game") ||
			lowerQuestion.includes("away game");

		if (hasGoals && hasLocationPhrase) {
			// Filter out "Home" and "Away" stat types (they should be locations, not stat types)
			const filteredStats = statTypes.filter((stat) => 
				stat.value !== "Home" && stat.value !== "Away"
			);

			// Deduplicate "Goals" entries - keep only one
			const goalsStats = filteredStats.filter((stat) => stat.value === "Goals");
			const nonGoalsStats = filteredStats.filter((stat) => stat.value !== "Goals");
			
			const result = goalsStats.length > 0 ? [goalsStats[0], ...nonGoalsStats] : filteredStats;

			return result;
		}

		return statTypes;
	}

	/**
	 * Corrects Goals/Assists confusion - prioritizes "Goals" over "Assists" when "goals" is explicitly mentioned
	 * Both have "got" as a pseudonym, so "got" can incorrectly match "Assists" when the question is about goals
	 */
	private correctGoalsAssistsConfusion(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

		// Check if question explicitly mentions "goals" or "goal"
		const hasExplicitGoals = lowerQuestion.includes("goals") || lowerQuestion.includes("goal");
		
		// Check if both "Goals" and "Assists" are in the stat types
		const hasGoals = statTypes.some((stat) => stat.value === "Goals");
		const hasAssists = statTypes.some((stat) => stat.value === "Assists");

		// If goals is explicitly mentioned and both are present, remove "Assists"
		// (Assists was likely matched from "got" which is a pseudonym for both)
		if (hasExplicitGoals && hasGoals && hasAssists) {
			return statTypes.filter((stat) => stat.value !== "Assists");
		}

		return statTypes;
	}

	/**
	 * Corrects Goals/Saves confusion - removes "Saves" when "Goals" is explicitly mentioned
	 * Both have "got" as a pseudonym, so "got" can incorrectly match "Saves" when the question is about goals
	 */
	private correctGoalsSavesConfusion(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

		// Check if question explicitly mentions "goals" or "goal"
		const hasExplicitGoals = lowerQuestion.includes("goals") || lowerQuestion.includes("goal");
		
		// Check if both "Goals" and "Saves" are in the stat types
		const hasGoals = statTypes.some((stat) => stat.value === "Goals");
		const hasSaves = statTypes.some((stat) => stat.value === "Saves");

		// If goals is explicitly mentioned and both are present, remove "Saves"
		// (Saves was likely matched from "got" which is a pseudonym for both)
		if (hasExplicitGoals && hasGoals && hasSaves) {
			return statTypes.filter((stat) => stat.value !== "Saves" && stat.value !== "Saves Per Appearance");
		}

		return statTypes;
	}

	/**
	 * Corrects team-specific appearance queries
	 */
	private correctTeamSpecificAppearanceQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

		// Enhanced team-specific appearance patterns to handle all variations
		// Pattern 1: "appearances/apps/games for Xs" or "Xs appearances/apps/games"
		const teamAppearancePattern1 = /(appearances?|apps?|games?)\s+.*?\s+(?:for\s+(?:the\s+)?)(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)(?:\s+(?:team|teams?))?/i;
		// Pattern 2: "Xs appearances/apps/games" (team first)
		const teamAppearancePattern2 = /(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)(?:\s+(?:team|teams?))?\s+(appearances?|apps?|games?)/i;
		// Pattern 3: "appearance count for Xs" or "Xs appearance count" or "appearance count for X playing for Ys"
		const teamAppearancePattern3 = /(?:what\s+is\s+the\s+)?(appearance\s+count|count)\s+(?:for\s+[^f]+?\s+)?(?:playing\s+for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)|for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth))/i;
		// Pattern 4: "how many times...played for Xs"
		const teamAppearancePattern4 = /(?:how\s+many\s+times|times).*?(?:played|playing)\s+for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)/i;
		// Pattern 5: "games for Xs has...played"
		const teamAppearancePattern5 = /(?:games?|appearances?|apps?)\s+for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth).*?(?:played|made|achieved)/i;
		// Pattern 6: "appearances for Xs...made/achieved"
		const teamAppearancePattern6 = /(appearances?|apps?)\s+for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth).*?(?:made|achieved|has)/i;
		// Pattern 7: "provide...appearance count for Xs" or "provide me with [player] appearance count for Xs"
		const teamAppearancePattern7 = /(?:provide|give).*?(?:appearance\s+count|apps?|appearances?).*?for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)/i;
		// Pattern 8: "how many times has X played for Ys"
		const teamAppearancePattern8 = /(?:how\s+many\s+times|times)\s+has\s+.*?\s+(?:played|playing)\s+for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)/i;
		// Pattern 9: direct "played/playing/appeared for Xs"
		const teamAppearancePattern9 = /(played|playing|appeared|appearing)\s+(?:.*?\s+)?for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)/i;

		let match = lowerQuestion.match(teamAppearancePattern1);
		let teamReference: string | undefined;
		let appearanceTerm: string | undefined;

		if (match) {
			teamReference = match[2].toLowerCase();
			appearanceTerm = match[1];
		} else {
			match = lowerQuestion.match(teamAppearancePattern2);
			if (match) {
				teamReference = match[1].toLowerCase();
				appearanceTerm = match[2];
			} else {
				match = lowerQuestion.match(teamAppearancePattern3);
				if (match) {
					// Pattern 3 has team reference in match[2] (playing for) or match[3] (for)
					teamReference = (match[2] || match[3]).toLowerCase();
					appearanceTerm = "appearances";
				} else {
					match = lowerQuestion.match(teamAppearancePattern4);
					if (match) {
						teamReference = match[1].toLowerCase();
						appearanceTerm = "times played";
					} else {
						match = lowerQuestion.match(teamAppearancePattern5);
						if (match) {
							teamReference = match[1].toLowerCase();
							appearanceTerm = "games";
						} else {
							match = lowerQuestion.match(teamAppearancePattern6);
							if (match) {
								teamReference = match[2].toLowerCase();
								appearanceTerm = match[1];
							} else {
								match = lowerQuestion.match(teamAppearancePattern7);
								if (match) {
									teamReference = match[1].toLowerCase();
									appearanceTerm = "appearances";
								} else {
									match = lowerQuestion.match(teamAppearancePattern8);
									if (match) {
										teamReference = match[1].toLowerCase();
										appearanceTerm = "times played";
									} else {
										match = lowerQuestion.match(teamAppearancePattern9);
										if (match) {
											teamReference = match[2].toLowerCase();
											appearanceTerm = match[1];
										}
									}
								}
							}
						}
					}
				}
			}
		}

		if (match && teamReference) {
			const teamInfo = this.mapTeamReference(teamReference);
			if (teamInfo) {
				// Filter out ALL appearance-related metrics, per-appearance metrics, and Home/Away metrics
				// Home/Away should never be included in team-specific appearance queries
				const filteredStats = statTypes.filter((stat) =>
					![
						"Appearances",
						"Apps",
						"Games",
						"Home",
						"Away",
						"Home Games",
						"Away Games",
						"Goals Per Appearance",
						"GperAPP",
						"Assists Per Appearance",
						"APperAPP",
						"Minutes Per Appearance",
						"Saves Per Appearance",
						"Clean Sheets Per Appearance",
						"Yellow Cards Per Appearance",
						"Red Cards Per Appearance",
						"Own Goals Per Appearance",
						"Conceded Per Appearance",
						"Penalties Scored Per Appearance",
						"Penalties Missed Per Appearance",
						"Penalties Conceded Per Appearance",
						"Penalties Saved Per Appearance",
						"Fantasy Points Per Appearance",
						"Man of the Match Per Appearance",
					].includes(stat.value),
				);

				const canonicalMetric = `${teamInfo.xiName} Apps`;
				const appearanceKeyword = appearanceTerm ? appearanceTerm.split(/\s+/)[0] : "played";
				const appearancePosition = lowerQuestion.indexOf(appearanceKeyword);
				const metricPosition =
					appearancePosition >= 0 ? appearancePosition : lowerQuestion.indexOf("appearances") >= 0 ? lowerQuestion.indexOf("appearances") : 0;

				filteredStats.push({
					value: canonicalMetric,
					originalText: match[0] || `${appearanceTerm || "appearances"} for ${teamInfo.xiName}`,
					position: metricPosition,
				});
				return filteredStats;
			}
		}

		return statTypes;
	}

	private mapTeamReference(teamReference: string): { xiName: string; shortCode: string } | null {
		const normalizedReference = teamReference.trim().toLowerCase();
		const wordToNumber: Record<string, string> = {
			first: "1",
			second: "2",
			third: "3",
			fourth: "4",
			fifth: "5",
			sixth: "6",
			seventh: "7",
			eighth: "8",
		};
		const ordinalMap: Record<string, string> = {
			"1": "1st",
			"2": "2nd",
			"3": "3rd",
			"4": "4th",
			"5": "5th",
			"6": "6th",
			"7": "7th",
			"8": "8th",
		};

		let teamNumber = normalizedReference.match(/\d+/)?.[0];
		if (!teamNumber) {
			const wordMatch = normalizedReference.match(/(first|second|third|fourth|fifth|sixth|seventh|eighth)/);
			if (wordMatch) {
				teamNumber = wordToNumber[wordMatch[1]];
			}
		}

		if (!teamNumber || !ordinalMap[teamNumber]) {
			return null;
		}

		const ordinalName = ordinalMap[teamNumber];
		return {
			xiName: `${ordinalName} XI`,
			shortCode: `${teamNumber}s`,
		};
	}

	private correctSeasonSpecificAppearanceQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

		// Dynamic season detection for appearances, apps, and games
		if (lowerQuestion.includes("appearances") || lowerQuestion.includes("apps") || lowerQuestion.includes("games")) {
			const seasonMatch = this.extractSeasonFromQuestion();
			if (seasonMatch) {
				const filteredStats = statTypes.filter((stat) => !["Appearances", "Apps", "Games"].includes(stat.value));
				filteredStats.push({
					value: `${seasonMatch} Apps`,
					originalText: `appearances in ${seasonMatch}`,
					position: lowerQuestion.indexOf("appearances") || lowerQuestion.indexOf("apps") || lowerQuestion.indexOf("games"),
				});
				return filteredStats;
			}
		}

		return statTypes;
	}

	private correctMostProlificSeasonQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

		// Helper function to detect various patterns
		const detectMostGoalsSeasonPattern = (q: string): { detected: boolean; originalText: string; position: number } => {
			const lower = q.toLowerCase();
			// Pattern 1: "most prolific season"
			if (lower.includes("most prolific season")) {
				return { detected: true, originalText: "most prolific season", position: lower.indexOf("most prolific season") };
			}
			// Pattern 2: "highest scoring season"
			if (lower.includes("highest scoring season")) {
				return { detected: true, originalText: "highest scoring season", position: lower.indexOf("highest scoring season") };
			}
			// Pattern 3: "season I scored the most goals" / "season I scored most goals"
			if (lower.includes("season") && lower.includes("scored") && 
				(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
				const pos = Math.max(lower.indexOf("season"), lower.indexOf("scored"), lower.indexOf("most"));
				return { detected: true, originalText: "season I scored the most goals", position: pos };
			}
			// Pattern 4: "season did I score the most goals" / "season did I score most goals"
			if (lower.includes("season") && lower.includes("did") && lower.includes("score") && 
				(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
				const pos = Math.max(lower.indexOf("season"), lower.indexOf("did"), lower.indexOf("most"));
				return { detected: true, originalText: "season did I score the most goals", position: pos };
			}
			// Pattern 5: "when did I score the most goals" / "when did I score most goals"
			if (lower.includes("when") && lower.includes("did") && lower.includes("score") && 
				(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
				const pos = Math.max(lower.indexOf("when"), lower.indexOf("did"), lower.indexOf("most"));
				return { detected: true, originalText: "when did I score the most goals", position: pos };
			}
			// Pattern 6: "season with the most goals" / "season with most goals"
			if (lower.includes("season") && lower.includes("with") && 
				(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
				const pos = Math.max(lower.indexOf("season"), lower.indexOf("with"), lower.indexOf("most"));
				return { detected: true, originalText: "season with the most goals", position: pos };
			}
			// Pattern 7: "which season" + "most goals" / "what season" + "most goals"
			if ((lower.includes("which season") || lower.includes("what season")) && 
				(lower.includes("most goals") || (lower.includes("most") && lower.includes("goals")))) {
				const pos = lower.includes("which season") ? lower.indexOf("which season") : lower.indexOf("what season");
				return { detected: true, originalText: "which season most goals", position: pos };
			}
			// Pattern 8: "prolific season" (without "most")
			if (lower.includes("prolific") && lower.includes("season")) {
				return { detected: true, originalText: "prolific season", position: lower.indexOf("prolific") };
			}
			// Pattern 9: "highest" + "scoring" + "season" (separate words)
			if (lower.includes("highest") && lower.includes("scoring") && lower.includes("season")) {
				return { detected: true, originalText: "highest scoring season", position: lower.indexOf("highest") };
			}
			return { detected: false, originalText: "", position: -1 };
		};

		const pattern = detectMostGoalsSeasonPattern(lowerQuestion);
		
		if (pattern.detected) {
			// Remove incorrect "Goals", "G", "Season" mappings
			const filteredStats = statTypes.filter((stat) => !["Goals", "G", "Season", "Season Analysis"].includes(stat.value));

			// Add correct "Most Prolific Season" mapping (same for all variations)
			filteredStats.push({
				value: "Most Prolific Season",
				originalText: pattern.originalText,
				position: pattern.position,
			});

			return filteredStats;
		}

		return statTypes;
	}

	/**
	 * Corrects penalty conversion rate queries - maps to "Penalty Conversion Rate" instead of "Penalties Scored"
	 */
	private correctPenaltyConversionRateQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

		// Check for penalty conversion rate queries - require "conversion rate" together for specificity
		const hasPenalty = lowerQuestion.includes("penalty") || lowerQuestion.includes("penalties");
		const hasConversionRate = lowerQuestion.includes("conversion rate") || 
			(lowerQuestion.includes("conversion") && lowerQuestion.includes("rate"));

		if (hasPenalty && hasConversionRate) {
			// Remove ALL penalty-related mappings to ensure clean slate
			const filteredStats = statTypes.filter(
				(stat) => !["Penalties Scored", "PSC", "Penalties Missed", "PM", "Penalties Conceded", "PCO", 
					"Penalties Saved", "PSV", "Home", "Score", "Goals Conceded"].includes(stat.value)
			);

			// Add correct "Penalty Conversion Rate" mapping
			filteredStats.push({
				value: "Penalty Conversion Rate",
				originalText: "penalty conversion rate",
				position: lowerQuestion.indexOf("conversion") !== -1 ? lowerQuestion.indexOf("conversion") : lowerQuestion.indexOf("penalty"),
			});

			return filteredStats;
		}

		return statTypes;
	}

	private correctPenaltyPhrases(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

		// CRITICAL: Skip penalty phrases correction if this is a conversion rate query
		// This prevents "penalties scored" from overriding "penalty conversion rate"
		if (
			(lowerQuestion.includes("penalty") || lowerQuestion.includes("penalties")) &&
			(lowerQuestion.includes("conversion rate") || lowerQuestion.includes("conversion") || lowerQuestion.includes("rate"))
		) {
			// This is a conversion rate query, don't apply penalty phrase corrections
			return statTypes;
		}

		// Check for penalty phrases that were incorrectly broken down
		if (lowerQuestion.includes("penalties") && lowerQuestion.includes("scored")) {
			// Remove incorrect "Home", "Penalties Saved", "Score" mappings
			const filteredStats = statTypes.filter((stat) => !["Home", "Penalties Saved", "Score", "Goals Conceded"].includes(stat.value));

			// Add correct "Penalties Scored" mapping
			filteredStats.push({
				value: "Penalties Scored",
				originalText: "penalties scored",
				position: lowerQuestion.indexOf("penalties"),
			});

			return filteredStats;
		}

		if (lowerQuestion.includes("penalties") && lowerQuestion.includes("missed")) {
			// Remove incorrect mappings and add correct "Penalties Missed"
			const filteredStats = statTypes.filter((stat) => !["Home", "Penalties Saved", "Score", "Goals Conceded"].includes(stat.value));

			filteredStats.push({
				value: "Penalties Missed",
				originalText: "penalties missed",
				position: lowerQuestion.indexOf("penalties"),
			});

			return filteredStats;
		}

		if (lowerQuestion.includes("penalties") && lowerQuestion.includes("conceded")) {
			// Remove incorrect mappings and add correct "Penalties Conceded"
			const filteredStats = statTypes.filter((stat) => !["Home", "Penalties Saved", "Score", "Goals Conceded"].includes(stat.value));

			filteredStats.push({
				value: "Penalties Conceded",
				originalText: "penalties conceded",
				position: lowerQuestion.indexOf("penalties"),
			});

			return filteredStats;
		}

		if (lowerQuestion.includes("penalties") && lowerQuestion.includes("saved")) {
			// This should already be correct, but ensure it's properly detected
			const hasCorrectMapping = statTypes.some((stat) => stat.value === "Penalties Saved");
			if (!hasCorrectMapping) {
				const filteredStats = statTypes.filter((stat) => !["Home", "Score", "Goals Conceded"].includes(stat.value));

				filteredStats.push({
					value: "Penalties Saved",
					originalText: "penalties saved",
					position: lowerQuestion.indexOf("penalties"),
				});

				return filteredStats;
			}
		}

		return statTypes;
	}

	private correctFantasyPointsQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

		const hasFantasyKeyword =
			lowerQuestion.includes("fantasy points") ||
			lowerQuestion.includes("fantasy point") ||
			lowerQuestion.includes("ftp") ||
			(lowerQuestion.includes("points") && lowerQuestion.includes("fantasy"));
		const perAppearanceIndicators = [
			"per appearance",
			"per app",
			"per game",
			"per match",
			"per outing",
			"per performance",
			"per fixture",
			"average",
			"on average",
		];
		const hasPerAppearancePhrase = perAppearanceIndicators.some((phrase) => lowerQuestion.includes(phrase));

		// Check for fantasy points phrases - must run before open play goals correction
		if (hasFantasyKeyword) {
			// Remove incorrect "Goals", "G", "AllGSC", "Open Play Goals", "Saves", "Saves Per Appearance" mappings
			const filteredStats = statTypes.filter((stat) => !["Goals", "G", "AllGSC", "All Goals Scored", "Open Play Goals", "Saves", "Saves Per Appearance"].includes(stat.value));

			// Check if "Fantasy Points" is already in the stats
			const hasFantasyPointsStat = filteredStats.some((stat) => stat.value === "Fantasy Points");

			let fantasyPosition = lowerQuestion.indexOf("fantasy points");
			if (fantasyPosition === -1) {
				fantasyPosition =
					lowerQuestion.indexOf("fantasy point") !== -1
						? lowerQuestion.indexOf("fantasy point")
						: lowerQuestion.indexOf("ftp") !== -1
							? lowerQuestion.indexOf("ftp")
							: lowerQuestion.indexOf("points");
			}
			if (!hasFantasyPointsStat) {
				// Add correct "Fantasy Points" mapping
				filteredStats.push({
					value: "Fantasy Points",
					originalText: "fantasy points",
					position: fantasyPosition !== -1 ? fantasyPosition : 0,
				});
			}

			const hasFantasyPointsPerApp = filteredStats.some((stat) => stat.value === "Fantasy Points Per Appearance");
			if (hasPerAppearancePhrase && !hasFantasyPointsPerApp) {
				const perAppearancePosition =
					lowerQuestion.indexOf("per appearance") !== -1
						? lowerQuestion.indexOf("per appearance")
						: fantasyPosition;
				filteredStats.push({
					value: "Fantasy Points Per Appearance",
					originalText: "fantasy points per appearance",
					position: perAppearancePosition !== -1 ? perAppearancePosition : 0,
				});
			}

			return filteredStats;
		}

		return statTypes;
	}

	/**
	 * Corrects minutes per goal queries by filtering out incorrect "Goals" or "Score" matches
	 * when the question is clearly asking about minutes per goal
	 */
	private correctMinutesPerGoalQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

		// Check for minutes per goal phrases
		const hasMinutesPerGoalPhrase =
			(lowerQuestion.includes("minutes") && lowerQuestion.includes("take") && (lowerQuestion.includes("average") || lowerQuestion.includes("score"))) ||
			lowerQuestion.includes("minutes per goal") ||
			lowerQuestion.includes("mins per goal") ||
			lowerQuestion.includes("time per goal") ||
			(lowerQuestion.includes("minutes") && lowerQuestion.includes("average") && lowerQuestion.includes("score"));

		if (hasMinutesPerGoalPhrase) {
			// Check if "Minutes Per Goal" is already in the stats
			const hasMinutesPerGoalStat = statTypes.some((stat) => stat.value === "Minutes Per Goal");

			// Remove incorrect "Goals", "G", "AllGSC", "Score", "Open Play Goals" mappings
			const filteredStats = statTypes.filter(
				(stat) => !["Goals", "G", "AllGSC", "All Goals Scored", "Score", "Open Play Goals"].includes(stat.value),
			);

			// Add correct "Minutes Per Goal" mapping if not already present
			if (!hasMinutesPerGoalStat) {
				const minutesPosition = lowerQuestion.indexOf("minutes");
				filteredStats.push({
					value: "Minutes Per Goal",
					originalText: "minutes per goal",
					position: minutesPosition !== -1 ? minutesPosition : 0,
				});
			}

			return filteredStats;
		}

		return statTypes;
	}

	private correctOpenPlayGoalsQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

		// Check for open play goals phrases that were incorrectly broken down
		if (lowerQuestion.includes("goals") && lowerQuestion.includes("open play")) {
			// Remove incorrect "Goals", "G", "AllGSC" mappings
			const filteredStats = statTypes.filter((stat) => !["Goals", "G", "AllGSC", "All Goals Scored"].includes(stat.value));

			// Add correct "Open Play Goals" mapping
			filteredStats.push({
				value: "Open Play Goals",
				originalText: "goals from open play",
				position: lowerQuestion.indexOf("goals"),
			});

			return filteredStats;
		}

		return statTypes;
	}

	/**
	 * Corrects team-specific goals queries
	 */
	private correctTeamSpecificGoalsQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

		// Enhanced team-specific goals patterns to handle all variations
		// Pattern 1: "goals for the Xs" or "goals for Xs"
		const teamGoalsPattern1 = /(goals?)\s+.*?\s+(?:for\s+(?:the\s+)?)(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)(?:\s+(?:team|teams?|xi))?/i;
		// Pattern 2: "Xs goals" (team first)
		const teamGoalsPattern2 = /(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)(?:\s+(?:team|teams?|xi))?\s+(goals?)/i;
		// Pattern 3: "goal count of/for [player] for Xs" or "Xs goal count"
		const teamGoalsPattern3 = /(?:what\s+is\s+the\s+)?(goal\s+count|count)\s+(?:of|for)\s+.*?\s+(?:for\s+(?:the\s+)?)(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)(?:\s+(?:team|teams?|xi))?/i;
		// Pattern 4: "how many goals...scored for Xs"
		const teamGoalsPattern4 = /(?:how\s+many\s+goals?|goals?).*?(?:scored|got|have|has)\s+(?:for\s+(?:the\s+)?)(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)/i;
		// Pattern 5: "goals for Xs has...scored"
		const teamGoalsPattern5 = /(?:goals?)\s+for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth).*?(?:scored|got|has)/i;
		// Pattern 6: "goals for Xs...scored/got"
		const teamGoalsPattern6 = /(goals?)\s+for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth).*?(?:scored|got|have|has)/i;
		// Pattern 7: "provide...goal count for Xs"
		const teamGoalsPattern7 = /(?:provide|give).*?(?:goal\s+count|goals?).*?for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)/i;
		// Pattern 8: "what are the goal stats for [player] for Xs"
		const teamGoalsPattern8 = /(?:what\s+are\s+the\s+)?(goal\s+stats?|stats?)\s+(?:for\s+.*?\s+)?(?:for\s+(?:the\s+)?)(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)(?:\s+(?:team|teams?|xi))?/i;

		let match = lowerQuestion.match(teamGoalsPattern1);
		let teamReference: string | undefined;
		let goalTerm: string | undefined;

		if (match) {
			teamReference = match[2].toLowerCase();
			goalTerm = match[1];
		} else {
			match = lowerQuestion.match(teamGoalsPattern2);
			if (match) {
				teamReference = match[1].toLowerCase();
				goalTerm = match[2];
			} else {
				match = lowerQuestion.match(teamGoalsPattern3);
				if (match) {
					teamReference = match[2].toLowerCase();
					goalTerm = "goals";
				} else {
					match = lowerQuestion.match(teamGoalsPattern4);
					if (match) {
						teamReference = match[1].toLowerCase();
						goalTerm = "goals";
					} else {
						match = lowerQuestion.match(teamGoalsPattern5);
						if (match) {
							teamReference = match[1].toLowerCase();
							goalTerm = "goals";
						} else {
							match = lowerQuestion.match(teamGoalsPattern6);
							if (match) {
								teamReference = match[2].toLowerCase();
								goalTerm = match[1];
							} else {
								match = lowerQuestion.match(teamGoalsPattern7);
								if (match) {
									teamReference = match[1].toLowerCase();
									goalTerm = "goals";
								} else {
									match = lowerQuestion.match(teamGoalsPattern8);
									if (match) {
										teamReference = match[2].toLowerCase();
										goalTerm = "goals";
									}
								}
							}
						}
					}
				}
			}
		}

		if (match && teamReference && goalTerm) {
			// Map team reference to database format
			const teamMapping: { [key: string]: string } = {
				"1s": "1st XI",
				"2s": "2nd XI",
				"3s": "3rd XI",
				"4s": "4th XI",
				"5s": "5th XI",
				"6s": "6th XI",
				"7s": "7th XI",
				"8s": "8th XI",
				"1st": "1st XI",
				"2nd": "2nd XI",
				"3rd": "3rd XI",
				"4th": "4th XI",
				"5th": "5th XI",
				"6th": "6th XI",
				"7th": "7th XI",
				"8th": "8th XI",
				"first": "1st XI",
				"second": "2nd XI",
				"third": "3rd XI",
				"fourth": "4th XI",
				"fifth": "5th XI",
				"sixth": "6th XI",
				"seventh": "7th XI",
				"eighth": "8th XI"
			};

			const mappedTeam = teamMapping[teamReference];
			if (mappedTeam) {
				// Filter out general goals, open play goals, and other conflicting stats
				const filteredStats = statTypes.filter((stat) =>
					!["Goals", "G", "AllGSC", "All Goals Scored", "Open Play Goals", "Goals Per Appearance", "GperAPP"].includes(stat.value)
				);
				const newMetric = `${mappedTeam} Goals`;
				// Add the new metric to the filtered stats
				filteredStats.push({
					value: newMetric,
					originalText: `${goalTerm} for ${teamReference}`,
					position: lowerQuestion.indexOf(goalTerm || "goals"),
				});
				return filteredStats;
			}
		}

		return statTypes;
	}

	private correctDistanceTravelQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

		// Check for distance/travel phrases - prioritize these over other metrics
		const distancePatterns = [
			"how far",
			"distance travelled",
			"distance traveled",
			"travelled to get",
			"traveled to get",
			"travelled to",
			"traveled to",
			"miles travelled",
			"miles traveled",
		];

		const hasDistancePattern = distancePatterns.some((pattern) => lowerQuestion.includes(pattern));

		if (hasDistancePattern) {
			// Remove incorrect mappings that might be detected (goals, assists, etc.)
			const filteredStats = statTypes.filter(
				(stat) =>
					!["Goals", "G", "AllGSC", "All Goals Scored", "Assists", "A", "Apps", "Appearances", "Games"].includes(stat.value),
			);

			// Check if "Distance Travelled" is already in the stats
			const hasDistanceStat = filteredStats.some((stat) => stat.value === "Distance Travelled");

			if (!hasDistanceStat) {
				// Add correct "Distance Travelled" mapping
				const distancePosition = lowerQuestion.indexOf("far") !== -1 ? lowerQuestion.indexOf("far") : lowerQuestion.indexOf("distance") !== -1 ? lowerQuestion.indexOf("distance") : lowerQuestion.indexOf("travelled") !== -1 ? lowerQuestion.indexOf("travelled") : lowerQuestion.indexOf("traveled") !== -1 ? lowerQuestion.indexOf("traveled") : 0;

				filteredStats.push({
					value: "Distance Travelled",
					originalText: "distance travelled",
					position: distancePosition,
				});
			}

			return filteredStats;
		}

		return statTypes;
	}

	private correctPercentageQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

		// Check for percentage queries and map to correct metrics
		if (lowerQuestion.includes("percentage") || lowerQuestion.includes("percent") || lowerQuestion.includes("%")) {
			// Remove any existing stat types that might be incorrect
			const filteredStats = statTypes.filter((stat) => !["Home", "Away", "Games", "Wins", "Losses", "Draws"].includes(stat.value));

			// Check if a percentage stat type already exists (added during early detection)
			const hasPercentageStat = filteredStats.some(
				(stat) => stat.value.includes("%") || stat.value.includes("Percentage")
			);

			// Only add if it doesn't already exist
			if (!hasPercentageStat) {
				// Check for "won" results
				if (lowerQuestion.includes("home games") && (lowerQuestion.includes("won") || lowerQuestion.includes("win"))) {
					filteredStats.push({
						value: "Home Games % Won",
						originalText: "percentage of home games won",
						position: lowerQuestion.indexOf("percentage") >= 0 ? lowerQuestion.indexOf("percentage") : (lowerQuestion.indexOf("percent") >= 0 ? lowerQuestion.indexOf("percent") : lowerQuestion.indexOf("%")),
					});
				} else if (lowerQuestion.includes("away games") && (lowerQuestion.includes("won") || lowerQuestion.includes("win"))) {
					filteredStats.push({
						value: "Away Games % Won",
						originalText: "percentage of away games won",
						position: lowerQuestion.indexOf("percentage") >= 0 ? lowerQuestion.indexOf("percentage") : (lowerQuestion.indexOf("percent") >= 0 ? lowerQuestion.indexOf("percent") : lowerQuestion.indexOf("%")),
					});
				} else if (lowerQuestion.includes("games") && (lowerQuestion.includes("won") || lowerQuestion.includes("win"))) {
					filteredStats.push({
						value: "Games % Won",
						originalText: "percentage of games won",
						position: lowerQuestion.indexOf("percentage") >= 0 ? lowerQuestion.indexOf("percentage") : (lowerQuestion.indexOf("percent") >= 0 ? lowerQuestion.indexOf("percent") : lowerQuestion.indexOf("%")),
					});
				}
				// Check for "lost" results (handles both "lost" and "lose")
				else if (lowerQuestion.includes("home games") && (lowerQuestion.includes("lost") || lowerQuestion.includes("lose"))) {
					filteredStats.push({
						value: "Home Games % Lost",
						originalText: "percentage of home games lost",
						position: lowerQuestion.indexOf("percentage") >= 0 ? lowerQuestion.indexOf("percentage") : (lowerQuestion.indexOf("percent") >= 0 ? lowerQuestion.indexOf("percent") : lowerQuestion.indexOf("%")),
					});
				} else if (lowerQuestion.includes("away games") && (lowerQuestion.includes("lost") || lowerQuestion.includes("lose"))) {
					filteredStats.push({
						value: "Away Games % Lost",
						originalText: "percentage of away games lost",
						position: lowerQuestion.indexOf("percentage") >= 0 ? lowerQuestion.indexOf("percentage") : (lowerQuestion.indexOf("percent") >= 0 ? lowerQuestion.indexOf("percent") : lowerQuestion.indexOf("%")),
					});
				} else if (lowerQuestion.includes("games") && (lowerQuestion.includes("lost") || lowerQuestion.includes("lose"))) {
					filteredStats.push({
						value: "Games % Lost",
						originalText: "percentage of games lost",
						position: lowerQuestion.indexOf("percentage") >= 0 ? lowerQuestion.indexOf("percentage") : (lowerQuestion.indexOf("percent") >= 0 ? lowerQuestion.indexOf("percent") : lowerQuestion.indexOf("%")),
					});
				}
				// Check for "drawn" results (handles both "drawn" and "draw")
				else if (lowerQuestion.includes("home games") && (lowerQuestion.includes("drawn") || lowerQuestion.includes("draw"))) {
					filteredStats.push({
						value: "Home Games % Drawn",
						originalText: "percentage of home games drawn",
						position: lowerQuestion.indexOf("percentage") >= 0 ? lowerQuestion.indexOf("percentage") : (lowerQuestion.indexOf("percent") >= 0 ? lowerQuestion.indexOf("percent") : lowerQuestion.indexOf("%")),
					});
				} else if (lowerQuestion.includes("away games") && (lowerQuestion.includes("drawn") || lowerQuestion.includes("draw"))) {
					filteredStats.push({
						value: "Away Games % Drawn",
						originalText: "percentage of away games drawn",
						position: lowerQuestion.indexOf("percentage") >= 0 ? lowerQuestion.indexOf("percentage") : (lowerQuestion.indexOf("percent") >= 0 ? lowerQuestion.indexOf("percent") : lowerQuestion.indexOf("%")),
					});
				} else if (lowerQuestion.includes("games") && (lowerQuestion.includes("drawn") || lowerQuestion.includes("draw"))) {
					filteredStats.push({
						value: "Games % Drawn",
						originalText: "percentage of games drawn",
						position: lowerQuestion.indexOf("percentage") >= 0 ? lowerQuestion.indexOf("percentage") : (lowerQuestion.indexOf("percent") >= 0 ? lowerQuestion.indexOf("percent") : lowerQuestion.indexOf("%")),
					});
				}
			}

			return filteredStats;
		}

		return statTypes;
	}

	/**
	 * Corrects "most appearances for team" queries
	 */
	private correctMostAppearancesForTeamQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

		// Pattern to detect "most appearances for team" questions
		const mostAppearancesPattern = /(?:what\s+team\s+has|which\s+team\s+has|what\s+team\s+did|which\s+team\s+did).*?(?:made\s+the\s+most\s+appearances\s+for|made\s+most\s+appearances\s+for|most\s+appearances\s+for|played\s+for\s+most|played\s+most\s+for)/i;

		if (mostAppearancesPattern.test(lowerQuestion)) {
			// Remove any existing stat types that might be incorrect
			const filteredStats = statTypes.filter((stat) => !["Appearances", "Apps", "Games"].includes(stat.value));

			// Add the correct metric
			filteredStats.push({
				value: "Most Played For Team",
				originalText: "most appearances for team",
				position: lowerQuestion.indexOf("most appearances") || lowerQuestion.indexOf("most played"),
			});

			return filteredStats;
		}

		return statTypes;
	}

	/**
	 * Corrects "most scored for team" queries
	 */
	private correctMostScoredForTeamQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

		// Pattern to detect "which team has [player] scored the most goals/assists/etc for?" questions
		// Updated pattern to match "scored the most goals for" or "scored most goals for" or "most goals for"
		// Made more specific to ensure it matches correctly and doesn't conflict with "most appearances for"
		const mostScoredPattern = /(?:what\s+team\s+has|which\s+team\s+has|what\s+team\s+did|which\s+team\s+did).*?(?:scored\s+(?:the\s+)?most\s+(?:goals?|assists?|.*?)\s+for|scored\s+the\s+most|scored\s+most|most\s+goals?\s+for)/i;

		if (mostScoredPattern.test(lowerQuestion)) {
			// Remove any existing stat types that might be incorrect (Goals, Assists, Most Played For Team, etc.)
			const filteredStats = statTypes.filter((stat) => !["Goals", "Assists", "Yellow Cards", "Red Cards", "Saves", "Own Goals", "Conceded", "Clean Sheets", "Penalties Scored", "Penalties Missed", "Penalties Conceded", "Penalties Saved", "Most Played For Team"].includes(stat.value));

			// Add the correct metric
			filteredStats.push({
				value: "Most Scored For Team",
				originalText: "most scored for team",
				position: lowerQuestion.indexOf("most") !== -1 ? lowerQuestion.indexOf("most") : 0,
			});

			return filteredStats;
		}

		return statTypes;
	}

	private extractLegacyTimeRange(extractionResult: EntityExtractionResult): string | undefined {
		// Convert extracted time frames to legacy format
		// Debug logging - only show in debug mode
		if (process.env.DEBUG_MODE === "true") {
			console.log("🔍 Time frames extracted:", extractionResult.timeFrames);
		}

		// Look for "since" type first (e.g., "since 2020")
		const sinceFrame = extractionResult.timeFrames.find((tf) => tf.type === "since");
		if (sinceFrame) {
			const year = parseInt(sinceFrame.value, 10);
			if (!isNaN(year)) {
				const startDate = DateUtils.convertSinceYearToDate(year);
				// Format as DD/MM/YYYY for legacy format
				const formattedDate = DateUtils.formatDate(startDate);
				if (process.env.DEBUG_MODE === "true") {
					console.log("🔍 Using since time frame:", sinceFrame.value, "→", formattedDate);
				}
				// Return in format that can be parsed as date range: "01/01/2021 to [future date]"
				// For "since" queries, we only need the start date, end date will be handled in query builder
				return formattedDate;
			}
		}

		// Look for range type (e.g., "20/03/2022 to 21/10/24")
		const rangeFrame = extractionResult.timeFrames.find((tf) => tf.type === "range" && tf.value.includes(" to "));
		if (rangeFrame) {
			if (process.env.DEBUG_MODE === "true") {
				console.log("🔍 Using range time frame:", rangeFrame.value);
			}
			return rangeFrame.value;
		}

		// Fallback to first time frame if no range found, but only if it's a valid date format
		if (extractionResult.timeFrames.length > 0) {
			const firstFrame = extractionResult.timeFrames[0];
			// Only return if it's a valid date format (not a pseudonym key like "between_dates")
			const isValidDateValue = firstFrame.value && 
				firstFrame.value !== "between_dates" && 
				firstFrame.value !== "before" && 
				firstFrame.value !== "since" &&
				(firstFrame.value.includes(" to ") || 
				 firstFrame.value.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/) || 
				 firstFrame.value.match(/^\d{4}[\/\-]\d{2,4}$/) ||
				 firstFrame.value.match(/^\d{4}$/));
			
			if (isValidDateValue) {
				if (process.env.DEBUG_MODE === "true") {
					console.log("🔍 Using first time frame:", firstFrame.value);
				}
				return firstFrame.value;
			}
		}
		return undefined;
	}

	/**
	 * Calculate confidence score based on extraction quality
	 */
	private calculateConfidence(
		extractionResult: EntityExtractionResult,
		complexity: "simple" | "moderate" | "complex",
		requiresClarification: boolean,
	): number {
		if (requiresClarification) {
			return 0.2;
		}

		const namedEntities = extractionResult.entities.filter(
			(e) => e.type === "player" || e.type === "team" || e.type === "opposition" || e.type === "league",
		);

		let confidence = 0.5;

		if (namedEntities.length > 0) {
			confidence += 0.2;
		}

		if (extractionResult.statTypes.length > 0) {
			confidence += 0.2;
		}

		if (complexity === "simple") {
			confidence += 0.1;
		} else if (complexity === "moderate") {
			confidence += 0.05;
		}

		return Math.min(confidence, 1.0);
	}

	/**
	 * Detect if question expects singular or plural results
	 */
	private detectResultQuantity(): "singular" | "plural" {
		const lowerQuestion = this.question.toLowerCase();

		const singularIndicators = [
			/\bthe\s+top\b/,
			/\bwhich\s+player\b/,
			/\bwho\s+is\b/,
			/\bthe\s+best\b/,
			/\bthe\s+highest\b/,
			/\bthe\s+most\s+.*\?$/,
			/\bwho\s+has\s+the\b/,
		];

		const pluralIndicators = [
			/\btop\s+\d+/,
			/\bwho\s+are\b/,
			/\blist\s+of\b/,
			/\ball\s+the\b/,
			/\bthe\s+top\s+\d+/,
			/\bhow\s+many\s+.*\s+are\b/,
		];

		for (const pattern of singularIndicators) {
			if (pattern.test(lowerQuestion)) {
				return "singular";
			}
		}

		for (const pattern of pluralIndicators) {
			if (pattern.test(lowerQuestion)) {
				return "plural";
			}
		}

		return "plural";
	}
}
