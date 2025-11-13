import { EntityExtractor, EntityExtractionResult, StatTypeInfo } from "./entityExtraction";
import { QuestionType } from "../../config/config";

export interface EnhancedQuestionAnalysis {
	type: QuestionType;
	entities: string[];
	metrics: string[];
	timeRange?: string;
	teamEntities?: string[];
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

	constructor(question: string, userContext?: string) {
		this.question = question;
		this.userContext = userContext;
		this.extractor = new EntityExtractor(question);
	}

	async analyze(): Promise<EnhancedQuestionAnalysis> {
		const extractionResult = await this.extractor.resolveEntitiesWithFuzzyMatching();
		const complexity = this.assessComplexity(extractionResult);
		const requiresClarification = this.checkClarificationNeeded(extractionResult, complexity);

		// Determine question type based on extracted entities and content
		const type = this.determineQuestionType(extractionResult);

		// Extract entities for backward compatibility
		const entities = this.extractLegacyEntities(extractionResult);

		// Extract metrics for backward compatibility with penalty phrase fixes
		const metrics = this.extractLegacyMetrics(extractionResult);

		// Extract time range for backward compatibility
		const timeRange = this.extractLegacyTimeRange(extractionResult);

		// Extract team entities for team-specific queries
		const teamEntities = extractionResult.entities.filter((e) => e.type === "team").map((e) => e.value);

		// Extract opposition entities for opposition-specific queries
		const oppositionEntities = extractionResult.entities.filter((e) => e.type === "opposition").map((e) => e.value);

		// Extract competition types for competition-specific queries
		const competitionTypes = extractionResult.competitionTypes.map((ct) => ct.value);

		// Extract competitions for competition-specific queries
		const competitions = extractionResult.competitions.map((c) => c.value);

		// Extract results for result-specific queries
		const results = extractionResult.results.map((r) => r.value);

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

		// Check for missing critical information
		const hasNoEntities = namedEntities.length === 0;
		const hasNoStatTypes = extractionResult.statTypes.length === 0;

		// Check if this is a "which" or "who" ranking question - these are valid even without specific entities
		const lowerQuestion = this.question.toLowerCase();
		const isRankingQuestion =
			(lowerQuestion.includes("which") || lowerQuestion.includes("who")) &&
			(lowerQuestion.includes("highest") || lowerQuestion.includes("most") || lowerQuestion.includes("best") || lowerQuestion.includes("top"));

		// Don't require entities for ranking questions
		if (isRankingQuestion && hasNoStatTypes) {
			return true; // Still need stat types
		}

		// FIXED: Only require clarification if BOTH entities AND stat types are missing (not either/or)
		// This allows valid questions like "How many goals has Luke Bangs scored from open play?" to proceed
		const needsClarification =
			(hasNoEntities && hasNoStatTypes && !isRankingQuestion) || (complexity === "complex" && hasNoEntities && hasNoStatTypes);

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

		// Check for player-specific queries first (even with time frames)
		if (hasPlayerEntities) {
			return "player";
		}

		// Check for temporal queries (time-based questions without specific players)
		if (
			hasTimeFrames ||
			lowerQuestion.includes("since") ||
			lowerQuestion.includes("before") ||
			lowerQuestion.includes("between") ||
			lowerQuestion.includes("during") ||
			lowerQuestion.includes("in the") ||
			lowerQuestion.includes("from") ||
			lowerQuestion.includes("until") ||
			lowerQuestion.includes("after")
		) {
			return "temporal";
		}

		// Check for percentage queries
		if (lowerQuestion.includes("percentage") || lowerQuestion.includes("percent") || lowerQuestion.includes("%")) {
			return "player";
		}

		// Check for specific question patterns
		if (lowerQuestion.includes("streak") || lowerQuestion.includes("consecutive") || lowerQuestion.includes("in a row")) {
			return "streak";
		}

		if (lowerQuestion.includes("double game") || lowerQuestion.includes("double game week")) {
			return "double_game";
		}

		// Check for ranking queries (which player/team has the highest/most...)
		if (
			(lowerQuestion.includes("which") || lowerQuestion.includes("who")) &&
			(lowerQuestion.includes("highest") || lowerQuestion.includes("most") || lowerQuestion.includes("best") || lowerQuestion.includes("top"))
		) {
			return "ranking";
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

		if (
			hasTeamEntities &&
			(lowerQuestion.includes("finish") ||
				lowerQuestion.includes("league position") ||
				lowerQuestion.includes("position") ||
				lowerQuestion.includes("table"))
		) {
			return "team";
		}

		if (lowerQuestion.includes("club") || lowerQuestion.includes("captain") || lowerQuestion.includes("award")) {
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

		extractionResult.entities.forEach((entity) => {
			if (entity.type === "player") {
				const lowerValue = entity.value.toLowerCase();
				// Skip if this is an invalid player name (likely a mis-extracted phrase)
				if (invalidPlayerNames.includes(lowerValue)) {
					return;
				}
				if (entity.value === "I" && this.userContext) {
					entities.push(this.userContext);
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

	private extractLegacyMetrics(extractionResult: EntityExtractionResult): string[] {
		// CRITICAL FIX: Detect "games" questions and map to "Apps" (HIGHEST PRIORITY)
		const gamesCorrectedStats = this.correctGamesQueries(extractionResult.statTypes);

		// CRITICAL FIX: Detect team-specific appearance queries (HIGHEST PRIORITY)
		const teamAppearanceCorrectedStats = this.correctTeamSpecificAppearanceQueries(gamesCorrectedStats);

		// CRITICAL FIX: Detect penalty phrases that were incorrectly broken down
		const correctedStatTypes = this.correctPenaltyPhrases(teamAppearanceCorrectedStats);

		// CRITICAL FIX: Detect most prolific season queries
		const prolificCorrectedStats = this.correctMostProlificSeasonQueries(correctedStatTypes);

		// CRITICAL FIX: Detect season-specific queries
		const seasonCorrectedStats = this.correctSeasonSpecificQueries(prolificCorrectedStats);

		// CRITICAL FIX: Detect season-specific appearance queries
		const appearanceCorrectedStats = this.correctSeasonSpecificAppearanceQueries(seasonCorrectedStats);

		// CRITICAL FIX: Detect open play goals queries
		const openPlayCorrectedStats = this.correctOpenPlayGoalsQueries(appearanceCorrectedStats);

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

		// Convert extracted stat types to legacy format with priority handling
		const statTypes = mostScoredForTeamCorrectedStats.map((stat) => stat.value);

		// CRITICAL FIX: Filter out Home/Away metrics when question asks for total games/appearances without location qualifier
		const lowerQuestion = this.question.toLowerCase();
		const hasGamesOrAppearances = lowerQuestion.includes("games") || lowerQuestion.includes("appearances") || lowerQuestion.includes("apps");
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
					"Distance Travelled",
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
			"Distance Travelled", // More specific - distance/travel queries (HIGH PRIORITY)
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

		return mapping[statType] || statType;
	}

	/**
	 * Corrects season-specific queries that were incorrectly mapped
	 */
	/**
	 * Dynamically extracts season from question text using regex patterns
	 * Supports various formats: 2018/19, 2018-19, 18/19, 2018/2019, etc.
	 */
	private extractSeasonFromQuestion(): string | null {
		const question = this.question;

		// Pattern 1: Full year format with slash (2018/19, 2019/20, etc.)
		const fullYearSlashMatch = question.match(/(\d{4})\/(\d{2})/);
		if (fullYearSlashMatch) {
			const startYear = fullYearSlashMatch[1];
			const endYear = fullYearSlashMatch[2];
			// Convert 2-digit end year to 4-digit if needed
			const fullEndYear = endYear.startsWith("20") ? endYear : `20${endYear}`;
			return `${startYear}/${endYear}`;
		}

		// Pattern 2: Full year format with hyphen (2018-19, 2019-20, etc.)
		const fullYearHyphenMatch = question.match(/(\d{4})-(\d{2})/);
		if (fullYearHyphenMatch) {
			const startYear = fullYearHyphenMatch[1];
			const endYear = fullYearHyphenMatch[2];
			const fullEndYear = endYear.startsWith("20") ? endYear : `20${endYear}`;
			return `${startYear}/${endYear}`;
		}

		// Pattern 3: Full year range format (2021 to 2022, 2018 to 2019, etc.)
		const fullYearRangeMatch = question.match(/(\d{4})\s+to\s+(\d{4})/);
		if (fullYearRangeMatch) {
			const startYear = fullYearRangeMatch[1];
			const endYear = fullYearRangeMatch[2];
			// Convert second year to 2-digit format for season notation
			const shortEndYear = endYear.substring(2);
			return `${startYear}/${shortEndYear}`;
		}

		// Pattern 4: Short year format with slash (18/19, 19/20, 20/21, 21/22, etc.)
		const shortYearSlashMatch = question.match(/(\d{2})\/(\d{2})/);
		if (shortYearSlashMatch) {
			const startYear = shortYearSlashMatch[1];
			const endYear = shortYearSlashMatch[2];
			// Check if it's already a 4-digit year (length check), not just if it starts with "20"
			const fullStartYear = startYear.length === 4 ? startYear : `20${startYear}`;
			// Keep end year as 2-digit format for season notation (YYYY/YY)
			return `${fullStartYear}/${endYear}`;
		}

		// Pattern 5: Full year format with full end year (2018/2019, 2019/2020, etc.)
		const fullYearFullMatch = question.match(/(\d{4})\/(\d{4})/);
		if (fullYearFullMatch) {
			const startYear = fullYearFullMatch[1];
			const endYear = fullYearFullMatch[2];
			// Convert to short format for consistency
			const shortEndYear = endYear.substring(2);
			return `${startYear}/${shortEndYear}`;
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

		if (gamesPattern.test(lowerQuestion) || (lowerQuestion.includes("games") && lowerQuestion.includes("played"))) {
			// Remove "Saves" if it was incorrectly detected
			const filteredStats = statTypes.filter((stat) => stat.value !== "Saves" && stat.value !== "Saves Per Appearance");

			// Add "Games" if not already present (which will map to "Apps")
			const hasGames = filteredStats.some((stat) => stat.value === "Games" || stat.value === "Apps" || stat.value === "Appearances");
			if (!hasGames) {
				filteredStats.push({
					value: "Games",
					originalText: "games",
					position: lowerQuestion.indexOf("games") !== -1 ? lowerQuestion.indexOf("games") : 0,
				});
			}

			return filteredStats;
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
		// Pattern 3: "appearance count for Xs" or "Xs appearance count"
		const teamAppearancePattern3 = /(?:what\s+is\s+the\s+)?(appearance\s+count|count)\s+(?:for\s+.*?\s+)?(?:playing\s+for\s+(?:the\s+)?|for\s+(?:the\s+)?)(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)/i;
		// Pattern 4: "how many times...played for Xs"
		const teamAppearancePattern4 = /(?:how\s+many\s+times|times).*?(?:played|playing)\s+for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)/i;
		// Pattern 5: "games for Xs has...played"
		const teamAppearancePattern5 = /(?:games?|appearances?|apps?)\s+for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth).*?(?:played|made|achieved)/i;
		// Pattern 6: "appearances for Xs...made/achieved"
		const teamAppearancePattern6 = /(appearances?|apps?)\s+for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth).*?(?:made|achieved|has)/i;
		// Pattern 7: "provide...appearance count for Xs"
		const teamAppearancePattern7 = /(?:provide|give).*?(?:appearance\s+count|apps?|appearances?).*?for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)/i;
		// Pattern 8: "how many times has X played for Ys" (missing pattern)
		const teamAppearancePattern8 = /(?:how\s+many\s+times|times)\s+has\s+.*?\s+(?:played|playing)\s+for\s+(?:the\s+)?(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)/i;
		
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
					teamReference = match[2].toLowerCase();
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
									}
								}
							}
						}
					}
				}
			}
		}
		
		if (match && teamReference && appearanceTerm) {
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
				// Filter out ALL appearance-related metrics and per-appearance metrics
				const filteredStats = statTypes.filter((stat) => 
					!["Appearances", "Apps", "Games", "Goals Per Appearance", "GperAPP", "Assists Per Appearance", 
					  "APperAPP", "Minutes Per Appearance", "Saves Per Appearance", "Clean Sheets Per Appearance",
					  "Yellow Cards Per Appearance", "Red Cards Per Appearance", "Own Goals Per Appearance",
					  "Conceded Per Appearance", "Penalties Scored Per Appearance", "Penalties Missed Per Appearance",
					  "Penalties Conceded Per Appearance", "Penalties Saved Per Appearance", "Fantasy Points Per Appearance",
					  "Man of the Match Per Appearance"].includes(stat.value)
				);
				const newMetric = `${mappedTeam} Apps`;
				// Add the new metric to the filtered stats
				filteredStats.push({
					value: newMetric,
					originalText: `${appearanceTerm} for ${teamReference}`,
					position: lowerQuestion.indexOf(appearanceTerm || "appearances"),
				});
				return filteredStats;
			}
		}

		return statTypes;
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

		// Check for most prolific season phrases that were incorrectly broken down
		if (lowerQuestion.includes("most") && lowerQuestion.includes("prolific") && lowerQuestion.includes("season")) {
			// Remove incorrect "Goals", "G", "Season" mappings
			const filteredStats = statTypes.filter((stat) => !["Goals", "G", "Season", "Season Analysis"].includes(stat.value));

			// Add correct "Most Prolific Season" mapping
			filteredStats.push({
				value: "Most Prolific Season",
				originalText: "most prolific season",
				position: lowerQuestion.indexOf("most"),
			});

			return filteredStats;
		}

		return statTypes;
	}

	private correctPenaltyPhrases(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();

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
			const filteredStats = statTypes.filter((stat) => !["Home", "Away", "Games", "Wins"].includes(stat.value));

			// Add correct percentage metric based on context
			if (lowerQuestion.includes("home games") && lowerQuestion.includes("won")) {
				filteredStats.push({
					value: "Home Games % Won",
					originalText: "percentage of home games won",
					position: lowerQuestion.indexOf("percentage") || lowerQuestion.indexOf("percent") || lowerQuestion.indexOf("%"),
				});
			} else if (lowerQuestion.includes("away games") && lowerQuestion.includes("won")) {
				filteredStats.push({
					value: "Away Games % Won",
					originalText: "percentage of away games won",
					position: lowerQuestion.indexOf("percentage") || lowerQuestion.indexOf("percent") || lowerQuestion.indexOf("%"),
				});
			} else if (lowerQuestion.includes("games") && lowerQuestion.includes("won")) {
				filteredStats.push({
					value: "Games % Won",
					originalText: "percentage of games won",
					position: lowerQuestion.indexOf("percentage") || lowerQuestion.indexOf("percent") || lowerQuestion.indexOf("%"),
				});
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

		// Look for range type first (e.g., "20/03/2022 to 21/10/24")
		const rangeFrame = extractionResult.timeFrames.find((tf) => tf.type === "range" && tf.value.includes(" to "));
		if (rangeFrame) {
			if (process.env.DEBUG_MODE === "true") {
				console.log("🔍 Using range time frame:", rangeFrame.value);
			}
			return rangeFrame.value;
		}

		// Fallback to first time frame if no range found
		if (extractionResult.timeFrames.length > 0) {
			console.log("🔍 Using first time frame:", extractionResult.timeFrames[0].value);
			return extractionResult.timeFrames[0].value;
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
