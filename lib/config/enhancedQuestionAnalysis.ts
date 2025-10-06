import { EntityExtractor, EntityExtractionResult, StatTypeInfo } from './entityExtraction';
import { QuestionType } from '../../config/config';

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
	complexity: 'simple' | 'moderate' | 'complex';
	requiresClarification: boolean;
	clarificationMessage?: string;
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
		const teamEntities = extractionResult.entities
			.filter(e => e.type === 'team')
			.map(e => e.value);

		// Extract opposition entities for opposition-specific queries
		const oppositionEntities = extractionResult.entities
			.filter(e => e.type === 'opposition')
			.map(e => e.value);

		// Extract competition types for competition-specific queries
		const competitionTypes = extractionResult.competitionTypes
			.map(ct => ct.value);

		// Extract competitions for competition-specific queries
		const competitions = extractionResult.competitions
			.map(c => c.value);

		// Extract results for result-specific queries
		const results = extractionResult.results
			.map(r => r.value);

		// Extract opponent own goals flag
		const opponentOwnGoals = extractionResult.opponentOwnGoals;

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
		};
	}

	// Assess the complexity of the question based on the number of entities and stat types
	private assessComplexity(extractionResult: EntityExtractionResult): 'simple' | 'moderate' | 'complex' {
		// Only count actual named entities (players, teams, oppositions, leagues), not locations/timeframes
		const namedEntities = extractionResult.entities.filter(e => 
			e.type === 'player' || e.type === 'team' || e.type === 'opposition' || e.type === 'league'
		);
		
		// Count entities by type
		const playerCount = namedEntities.filter(e => e.type === 'player').length;
		const teamCount = namedEntities.filter(e => e.type === 'team').length;
		const oppositionCount = namedEntities.filter(e => e.type === 'opposition').length;
		const leagueCount = namedEntities.filter(e => e.type === 'league').length;
		
		const statTypeCount = extractionResult.statTypes.length;
		const hasMultipleTimeFrames = extractionResult.timeFrames.length > 1;
		const hasNegativeClauses = extractionResult.negativeClauses.length > 0;
		const hasMultipleLocations = extractionResult.locations.length > 1;

		// Check if any single entity type exceeds 3 (this is what should trigger clarification)
		const hasTooManyOfOneType = playerCount > 3 || teamCount > 3 || oppositionCount > 3 || leagueCount > 3;
		
		// Check total named entities (should be more lenient)
		const totalNamedEntities = namedEntities.length;

		if (hasTooManyOfOneType || statTypeCount > 3) {
			return 'complex';
		}

		if (totalNamedEntities > 1 || statTypeCount > 1 || hasMultipleTimeFrames || hasNegativeClauses || hasMultipleLocations) {
			return 'moderate';
		}

		return 'simple';
	}

	// Check if clarification is needed based on the number of entities and stat types
	private checkClarificationNeeded(extractionResult: EntityExtractionResult, complexity: 'simple' | 'moderate' | 'complex'): boolean {
		// Only count actual named entities (players, teams, oppositions, leagues), not locations/timeframes
		const namedEntities = extractionResult.entities.filter(e => 
			e.type === 'player' || e.type === 'team' || e.type === 'opposition' || e.type === 'league'
		);
		
		// Count entities by type
		const playerCount = namedEntities.filter(e => e.type === 'player').length;
		const teamCount = namedEntities.filter(e => e.type === 'team').length;
		const oppositionCount = namedEntities.filter(e => e.type === 'opposition').length;
		const leagueCount = namedEntities.filter(e => e.type === 'league').length;

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
		const playerEntities = extractionResult.entities.filter(e => e.type === 'player');
		const hasAmbiguousPlayerRef = playerEntities.some(e => e.value === 'I') && this.userContext;

		// Check for missing critical information
		const hasNoEntities = namedEntities.length === 0;
		const hasNoStatTypes = extractionResult.statTypes.length === 0;

		// Check if this is a "which" or "who" ranking question - these are valid even without specific entities
		const lowerQuestion = this.question.toLowerCase();
		const isRankingQuestion = (lowerQuestion.includes('which') || lowerQuestion.includes('who')) && 
			(lowerQuestion.includes('highest') || lowerQuestion.includes('most') || 
			 lowerQuestion.includes('best') || lowerQuestion.includes('top'));

		// Don't require entities for ranking questions
		if (isRankingQuestion && hasNoStatTypes) {
			return true; // Still need stat types
		}

		// FIXED: Only require clarification if BOTH entities AND stat types are missing (not either/or)
		// This allows valid questions like "How many goals has Luke Bangs scored from open play?" to proceed
		const needsClarification = (hasNoEntities && hasNoStatTypes && !isRankingQuestion) || 
								   (complexity === 'complex' && hasNoEntities && hasNoStatTypes);

		return needsClarification;
	}

	// Generate a clarification message based on the number of entities and stat types
	private generateClarificationMessage(extractionResult: EntityExtractionResult, complexity: 'simple' | 'moderate' | 'complex'): string {
		// Only count actual named entities (players, teams, oppositions, leagues), not locations/timeframes
		const namedEntities = extractionResult.entities.filter(e => 
			e.type === 'player' || e.type === 'team' || e.type === 'opposition' || e.type === 'league'
		);
		
		// Count entities by type
		const playerCount = namedEntities.filter(e => e.type === 'player').length;
		const teamCount = namedEntities.filter(e => e.type === 'team').length;
		const oppositionCount = namedEntities.filter(e => e.type === 'opposition').length;
		const leagueCount = namedEntities.filter(e => e.type === 'league').length;

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
			const statTypes = extractionResult.statTypes.map(s => s.value).join(', ');
			return `I can see you're asking about ${statTypes}, but I need to know which player, team, or other entity you're asking about. Please specify who or what you want to know about. For example: 'How many ${statTypes} has Luke Bangs scored?' or 'What are the 3rd XI ${statTypes}?'`;
		}

		if (extractionResult.statTypes.length === 0) {
			const entities = namedEntities.map(e => e.value).join(', ');
			return `I can see you're asking about ${entities}, but I need to know what statistic you want to know about. Please specify what information you want. Examples: 'goals', 'appearances', 'assists', 'yellow cards', 'clean sheets', 'minutes played', etc. For example: 'How many goals has ${entities} scored?'`;
		}

		if (complexity === 'complex') {
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
		const hasPlayerEntities = extractionResult.entities.some(e => e.type === 'player');
		const hasTeamEntities = extractionResult.entities.some(e => e.type === 'team');
		const hasMultipleEntities = extractionResult.entities.length > 1;
		const hasTimeFrames = extractionResult.timeFrames.length > 0;

		// Check for player-specific queries first (even with time frames)
		if (hasPlayerEntities) {
			return "player";
		}

		// Check for temporal queries (time-based questions without specific players)
		if (hasTimeFrames || lowerQuestion.includes('since') || lowerQuestion.includes('before') || 
			lowerQuestion.includes('between') || lowerQuestion.includes('during') || 
			lowerQuestion.includes('in the') || lowerQuestion.includes('from') || 
			lowerQuestion.includes('until') || lowerQuestion.includes('after')) {
			return "temporal";
		}

		// Check for percentage queries
		if (lowerQuestion.includes('percentage') || lowerQuestion.includes('percent') || lowerQuestion.includes('%')) {
			return "player";
		}

		// Check for specific question patterns
		if (lowerQuestion.includes('streak') || lowerQuestion.includes('consecutive') || lowerQuestion.includes('in a row')) {
			return "streak";
		}

		if (lowerQuestion.includes('double game') || lowerQuestion.includes('double game week')) {
			return "double_game";
		}

		// Check for ranking queries (which player/team has the highest/most...)
		if ((lowerQuestion.includes('which') || lowerQuestion.includes('who')) && 
			(lowerQuestion.includes('highest') || lowerQuestion.includes('most') || 
			 lowerQuestion.includes('best') || lowerQuestion.includes('top'))) {
			return "ranking";
		}

		// Check for comparison queries (most, least, highest, etc.)
		if (lowerQuestion.includes('most') || lowerQuestion.includes('least') || 
			lowerQuestion.includes('highest') || lowerQuestion.includes('lowest') || 
			lowerQuestion.includes('best') || lowerQuestion.includes('worst') || 
			lowerQuestion.includes('top') || lowerQuestion.includes('who has') || 
			lowerQuestion.includes('penalty record') || lowerQuestion.includes('conversion rate')) {
			return "comparison";
		}

		if (hasTeamEntities && (lowerQuestion.includes('finish') || lowerQuestion.includes('league position') || lowerQuestion.includes('position') || lowerQuestion.includes('table'))) {
			return "team";
		}

		if (lowerQuestion.includes('club') || lowerQuestion.includes('captain') || lowerQuestion.includes('award')) {
			return "club";
		}

		if (lowerQuestion.includes('fixture') || lowerQuestion.includes('match') || lowerQuestion.includes('game')) {
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
			'scored', 'goals', 'assists', 'appearances', 'minutes', 'man of the match',
			'yellow', 'red', 'saves', 'own goals', 'conceded', 'clean sheets',
			'penalties', 'fantasy', 'away games', 'home games', 'most prolific season',
			'most common position', 'played', 'won', 'received', 'kept', 'missed'
		];

		return playerIndicators.some(indicator => lowerQuestion.includes(indicator));
	}

	private extractLegacyEntities(extractionResult: EntityExtractionResult): string[] {
		// Convert extracted entities to legacy format
		const entities: string[] = [];

		extractionResult.entities.forEach(entity => {
			if (entity.type === 'player' && entity.value === 'I' && this.userContext) {
				entities.push(this.userContext);
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
		// CRITICAL FIX: Detect penalty phrases that were incorrectly broken down
		const correctedStatTypes = this.correctPenaltyPhrases(extractionResult.statTypes);
		
		// CRITICAL FIX: Detect most prolific season queries
		const prolificCorrectedStats = this.correctMostProlificSeasonQueries(correctedStatTypes);
		
		// CRITICAL FIX: Detect season-specific queries
		const seasonCorrectedStats = this.correctSeasonSpecificQueries(prolificCorrectedStats);
		
		// CRITICAL FIX: Detect team-specific appearance queries
		const teamAppearanceCorrectedStats = this.correctTeamSpecificAppearanceQueries(seasonCorrectedStats);
		
		// CRITICAL FIX: Detect season-specific appearance queries
		const appearanceCorrectedStats = this.correctSeasonSpecificAppearanceQueries(teamAppearanceCorrectedStats);
		
		// CRITICAL FIX: Detect open play goals queries
		const openPlayCorrectedStats = this.correctOpenPlayGoalsQueries(appearanceCorrectedStats);
		
		// CRITICAL FIX: Detect percentage queries
		const percentageCorrectedStats = this.correctPercentageQueries(openPlayCorrectedStats);
		
		// Convert extracted stat types to legacy format with priority handling
		const statTypes = percentageCorrectedStats.map(stat => stat.value);
		
		// Priority order: more specific stat types should take precedence
		const priorityOrder = [
			'Own Goals',          // Most specific - own goals - helps stop the chatbot returning goals
			'Goals Conceded Per Appearance', // Most specific - average calculation metrics
			'Conceded Per Appearance', // Most specific - average calculation metrics (alternative naming)
			'Minutes Per Goal',   // More specific than general minutes
			'Minutes Per Clean Sheet', // More specific than general minutes
			'Minutes Per Appearance',   // More specific than general minutes - MOVED UP to test priority
			'Man of the Match Per Appearance', // More specific than general MOM
			'Fantasy Points Per Appearance', // MOVED UP to take priority over Goals Per Appearance
			'Goals Per Appearance',     // Average calculation metrics - MOVED DOWN to test priority
			'Assists Per Appearance',
			'Yellow Cards Per Appearance', // More specific than general yellow cards
			'Red Cards Per Appearance', // More specific than general red cards
			'Saves Per Appearance', // More specific than general saves
			'Own Goals Per Appearance', // More specific than general own goals
			'Clean Sheets Per Appearance', // More specific than general clean sheets
			'Penalties Scored Per Appearance', // More specific than general penalties scored
			'Penalties Missed Per Appearance', // More specific than general penalties missed
			'Penalties Conceded Per Appearance', // More specific than general penalties conceded
			'Penalties Saved Per Appearance', // More specific than general penalties saved
			'Goals Conceded',     // More specific than general goals
			'Open Play Goals',    // More specific than general goals
			'Penalties Scored',   // More specific than general goals
			'Penalties Missed',   // More specific than general goals
			'Penalties Conceded', // More specific than general goals
			'Penalties Saved',    // More specific than general goals
			'2021/22 Goals',      // Season-specific goals (most specific)
			'2020/21 Goals',
			'2019/20 Goals',
			'2018/19 Goals',
			'2017/18 Goals',
			'2016/17 Goals',
		'1st XI Apps',        // Team-specific appearances (most specific)
		'2nd XI Apps',
		'3rd XI Apps',
		'4th XI Apps',
		'5th XI Apps',
		'6th XI Apps',
		'7th XI Apps',
		'8th XI Apps',
		'2021/22 Apps',       // Season-specific appearances
		'2020/21 Apps',
		'2019/20 Apps',
		'2018/19 Apps',
		'2017/18 Apps',
		'2016/17 Apps',
			'Goalkeeper Appearances', // Position-specific stats
			'Defender Appearances',
			'Midfielder Appearances',
			'Forward Appearances',
			'Most Common Position',
			'Goals',              // General goals (lower priority)
			'Assists',
			'Apps',
			'Minutes',
			// ... other stat types
		];
		
		// Find the highest priority stat type that was detected
		for (const priorityType of priorityOrder) {
			if (statTypes.includes(priorityType)) {
				return [this.mapStatTypeToKey(priorityType)];
			}
		}
		
		// Fallback to all detected stat types if no priority match
		return statTypes.map(stat => this.mapStatTypeToKey(stat));
	}

	/**
	 * Maps stat type display names to their corresponding database keys
	 */
	private mapStatTypeToKey(statType: string): string {
		const mapping: { [key: string]: string } = {
		// Basic stats
		'Goals': 'G',
		'Assists': 'A',
		'Apps': 'APP',
		'Appearances': 'APP',
		'Minutes': 'MIN',
			'Yellow Cards': 'Y',
			'Red Cards': 'R',
			'Saves': 'SAVES',
			'Clean Sheets': 'CLS',
			'Own Goals': 'OG',
			'Goals Conceded': 'C',
			'Fantasy Points': 'FTP',
			'Distance Travelled': 'DIST',
			
			// Penalty stats
			'Penalties Scored': 'PSC',
			'Penalties Missed': 'PM',
			'Penalties Conceded': 'PCO',
			'Penalties Saved': 'PSV',
			
			// Position stats
			'Goalkeeper Appearances': 'GK',
			'Defender Appearances': 'DEF',
			'Midfielder Appearances': 'MID',
			'Forward Appearances': 'FWD',
			'Most Common Position': 'MostCommonPosition',
			
			// Calculated stats
			'Goal Involvements': 'GI',
			'All Goals Scored': 'ALLGSC',
			
			// Location stats
			'Home': 'HOME',
			'Away': 'AWAY',
			'Home Games': 'HomeGames',
			'Away Games': 'AwayGames',
			'Home Wins': 'HomeWins',
			'Away Wins': 'AwayWins',
			'Home Games % Won': 'HomeGames%Won',
			'Away Games % Won': 'AwayGames%Won',
			'Games % Won': 'Games%Won',
			
			// Team-specific stats
			'1st XI Apps': '1sApps',
			'2nd XI Apps': '2sApps',
			'3rd XI Apps': '3sApps',
			'4th XI Apps': '4sApps',
			'5th XI Apps': '5sApps',
			'6th XI Apps': '6sApps',
			'7th XI Apps': '7sApps',
			'8th XI Apps': '8sApps',
			'Most Played For Team': 'MostPlayedForTeam',
			'Number Teams Played For': 'NumberTeamsPlayedFor',
			
			'1st XI Goals': '1sGoals',
			'2nd XI Goals': '2sGoals',
			'3rd XI Goals': '3sGoals',
			'4th XI Goals': '4sGoals',
			'5th XI Goals': '5sGoals',
			'6th XI Goals': '6sGoals',
			'7th XI Goals': '7sGoals',
			'8th XI Goals': '8sGoals',
			'Most Scored For Team': 'MostScoredForTeam',
			
			// Season-specific stats (dynamic)
			'Number Seasons Played For': 'NumberSeasonsPlayedFor',
			'Most Prolific Season': 'MostProlificSeason',
			
			// Average calculation metrics
			'Goals Per Appearance': 'GperAPP',
			'Conceded Per Appearance': 'CperAPP',
			'Minutes Per Goal': 'MperG',
			'Minutes Per Clean Sheet': 'MperCLS',
			'Assists Per Appearance': 'AperAPP',
			'Fantasy Points Per Appearance': 'FTPperAPP',
			'Goals Conceded Per Appearance': 'CperAPP',
			
			// Additional Per Appearance metrics
			'Minutes Per Appearance': 'MINperAPP',
			'Man of the Match Per Appearance': 'MOMperAPP',
			'Yellow Cards Per Appearance': 'YperAPP',
			'Red Cards Per Appearance': 'RperAPP',
			'Saves Per Appearance': 'SAVESperAPP',
			'Own Goals Per Appearance': 'OGperAPP',
			'Clean Sheets Per Appearance': 'CLSperAPP',
			'Penalties Scored Per Appearance': 'PSCperAPP',
			'Penalties Missed Per Appearance': 'PMperAPP',
			'Penalties Conceded Per Appearance': 'PCOperAPP',
			'Penalties Saved Per Appearance': 'PSVperAPP',
			
			// Awards and special stats
			'Man of the Match': 'MOM',
			'Team of the Week': 'TOTW',
			'Season Team of the Week': 'SEASON_TOTW',
			'Player of the Month': 'POTM',
			'Captain Awards': 'CAPTAIN',
			'Co Players': 'CO_PLAYERS',
			'Opponents': 'OPPONENTS',
			
			// Other stats
			'Open Play Goals': 'OPENPLAYGOALS',
			'Score': 'G',
			'Awards': 'MOM',
			'Leagues': 'TOTW',
			'Penalty record': 'PSC',
			'Team Analysis': 'TEAM_ANALYSIS',
			'Season Analysis': 'SEASON_ANALYSIS',
			'Double Game Weeks': 'DOUBLE_GAME_WEEKS',
		};
		
		// Handle dynamic seasonal metrics
		if (statType.includes(' Apps') && statType.match(/\d{4}\/\d{2}/)) {
			// Convert "2018/19 Apps" to "2018/19Apps"
			return statType.replace(' Apps', 'Apps');
		}
		
		if (statType.includes(' Goals') && statType.match(/\d{4}\/\d{2}/)) {
			// Convert "2018/19 Goals" to "2018/19Goals"
			return statType.replace(' Goals', 'Goals');
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
			const fullEndYear = endYear.startsWith('20') ? endYear : `20${endYear}`;
			return `${startYear}/${endYear}`;
		}
		
		// Pattern 2: Full year format with hyphen (2018-19, 2019-20, etc.)
		const fullYearHyphenMatch = question.match(/(\d{4})-(\d{2})/);
		if (fullYearHyphenMatch) {
			const startYear = fullYearHyphenMatch[1];
			const endYear = fullYearHyphenMatch[2];
			const fullEndYear = endYear.startsWith('20') ? endYear : `20${endYear}`;
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
		
		// Pattern 4: Short year format with slash (18/19, 19/20, etc.)
		const shortYearSlashMatch = question.match(/(\d{2})\/(\d{2})/);
		if (shortYearSlashMatch) {
			const startYear = shortYearSlashMatch[1];
			const endYear = shortYearSlashMatch[2];
			const fullStartYear = startYear.startsWith('20') ? startYear : `20${startYear}`;
			const fullEndYear = endYear.startsWith('20') ? endYear : `20${endYear}`;
			return `${fullStartYear}/${endYear}`;
		}
		
		// Pattern 4: Full year format with full end year (2018/2019, 2019/2020, etc.)
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
		if (lowerQuestion.includes('goals')) {
			const seasonMatch = this.extractSeasonFromQuestion();
			if (seasonMatch) {
				const filteredStats = statTypes.filter(stat => 
					!['All Goals Scored', 'Goals', 'Score'].includes(stat.value)
				);
				filteredStats.push({
					value: `${seasonMatch} Goals`,
					originalText: `goals in ${seasonMatch}`,
					position: lowerQuestion.indexOf('goals')
				});
				return filteredStats;
			}
		}
		
		return statTypes;
	}

	/**
	 * Corrects team-specific appearance queries
	 */
	private correctTeamSpecificAppearanceQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();
		
		// Check for team-specific appearance patterns
		if (lowerQuestion.includes('appearances') && lowerQuestion.includes('1s')) {
			const filteredStats = statTypes.filter(stat => 
				!['Appearances', 'Apps', 'Games'].includes(stat.value)
			);
			filteredStats.push({
				value: '1st XI Apps',
				originalText: 'appearances for 1s',
				position: lowerQuestion.indexOf('appearances')
			});
			return filteredStats;
		}
		
		if (lowerQuestion.includes('appearances') && lowerQuestion.includes('2s')) {
			const filteredStats = statTypes.filter(stat => 
				!['Appearances', 'Apps', 'Games'].includes(stat.value)
			);
			filteredStats.push({
				value: '2nd XI Apps',
				originalText: 'appearances for 2s',
				position: lowerQuestion.indexOf('appearances')
			});
			return filteredStats;
		}
		
		if (lowerQuestion.includes('appearances') && lowerQuestion.includes('3s')) {
			const filteredStats = statTypes.filter(stat => 
				!['Appearances', 'Apps', 'Games'].includes(stat.value)
			);
			filteredStats.push({
				value: '3rd XI Apps',
				originalText: 'appearances for 3s',
				position: lowerQuestion.indexOf('appearances')
			});
			return filteredStats;
		}
		
		if (lowerQuestion.includes('appearances') && lowerQuestion.includes('4s')) {
			const filteredStats = statTypes.filter(stat => 
				!['Appearances', 'Apps', 'Games'].includes(stat.value)
			);
			filteredStats.push({
				value: '4th XI Apps',
				originalText: 'appearances for 4s',
				position: lowerQuestion.indexOf('appearances')
			});
			return filteredStats;
		}
		
		if (lowerQuestion.includes('appearances') && lowerQuestion.includes('5s')) {
			const filteredStats = statTypes.filter(stat => 
				!['Appearances', 'Apps', 'Games'].includes(stat.value)
			);
			filteredStats.push({
				value: '5th XI Apps',
				originalText: 'appearances for 5s',
				position: lowerQuestion.indexOf('appearances')
			});
			return filteredStats;
		}
		
		if (lowerQuestion.includes('appearances') && lowerQuestion.includes('6s')) {
			const filteredStats = statTypes.filter(stat => 
				!['Appearances', 'Apps', 'Games'].includes(stat.value)
			);
			filteredStats.push({
				value: '6th XI Apps',
				originalText: 'appearances for 6s',
				position: lowerQuestion.indexOf('appearances')
			});
			return filteredStats;
		}
		
		if (lowerQuestion.includes('appearances') && lowerQuestion.includes('7s')) {
			const filteredStats = statTypes.filter(stat => 
				!['Appearances', 'Apps', 'Games'].includes(stat.value)
			);
			filteredStats.push({
				value: '7th XI Apps',
				originalText: 'appearances for 7s',
				position: lowerQuestion.indexOf('appearances')
			});
			return filteredStats;
		}
		
		if (lowerQuestion.includes('appearances') && lowerQuestion.includes('8s')) {
			const filteredStats = statTypes.filter(stat => 
				!['Appearances', 'Apps', 'Games'].includes(stat.value)
			);
			filteredStats.push({
				value: '8th XI Apps',
				originalText: 'appearances for 8s',
				position: lowerQuestion.indexOf('appearances')
			});
			return filteredStats;
		}
		
		return statTypes;
	}

	private correctSeasonSpecificAppearanceQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();
		
		// Dynamic season detection for appearances, apps, and games
		if (lowerQuestion.includes('appearances') || lowerQuestion.includes('apps') || lowerQuestion.includes('games')) {
			const seasonMatch = this.extractSeasonFromQuestion();
			if (seasonMatch) {
				const filteredStats = statTypes.filter(stat => 
					!['Appearances', 'Apps', 'Games'].includes(stat.value)
				);
				filteredStats.push({
					value: `${seasonMatch} Apps`,
					originalText: `appearances in ${seasonMatch}`,
					position: lowerQuestion.indexOf('appearances') || lowerQuestion.indexOf('apps') || lowerQuestion.indexOf('games')
				});
				return filteredStats;
			}
		}
		
		return statTypes;
	}

	private correctMostProlificSeasonQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();
		
		// Check for most prolific season phrases that were incorrectly broken down
		if (lowerQuestion.includes('most') && lowerQuestion.includes('prolific') && lowerQuestion.includes('season')) {
			// Remove incorrect "Goals", "G", "Season" mappings
			const filteredStats = statTypes.filter(stat => 
				!['Goals', 'G', 'Season', 'Season Analysis'].includes(stat.value)
			);
			
			// Add correct "Most Prolific Season" mapping
			filteredStats.push({
				value: 'Most Prolific Season',
				originalText: 'most prolific season',
				position: lowerQuestion.indexOf('most')
			});
			
			return filteredStats;
		}
		
		return statTypes;
	}

	private correctPenaltyPhrases(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();
		
		// Check for penalty phrases that were incorrectly broken down
		if (lowerQuestion.includes('penalties') && lowerQuestion.includes('scored')) {
			// Remove incorrect "Home", "Penalties Saved", "Score" mappings
			const filteredStats = statTypes.filter(stat => 
				!['Home', 'Penalties Saved', 'Score', 'Goals Conceded'].includes(stat.value)
			);
			
			// Add correct "Penalties Scored" mapping
			filteredStats.push({
				value: 'Penalties Scored',
				originalText: 'penalties scored',
				position: lowerQuestion.indexOf('penalties')
			});
			
			return filteredStats;
		}
		
		if (lowerQuestion.includes('penalties') && lowerQuestion.includes('missed')) {
			// Remove incorrect mappings and add correct "Penalties Missed"
			const filteredStats = statTypes.filter(stat => 
				!['Home', 'Penalties Saved', 'Score', 'Goals Conceded'].includes(stat.value)
			);
			
			filteredStats.push({
				value: 'Penalties Missed',
				originalText: 'penalties missed',
				position: lowerQuestion.indexOf('penalties')
			});
			
			return filteredStats;
		}
		
		if (lowerQuestion.includes('penalties') && lowerQuestion.includes('conceded')) {
			// Remove incorrect mappings and add correct "Penalties Conceded"
			const filteredStats = statTypes.filter(stat => 
				!['Home', 'Penalties Saved', 'Score', 'Goals Conceded'].includes(stat.value)
			);
			
			filteredStats.push({
				value: 'Penalties Conceded',
				originalText: 'penalties conceded',
				position: lowerQuestion.indexOf('penalties')
			});
			
			return filteredStats;
		}
		
		if (lowerQuestion.includes('penalties') && lowerQuestion.includes('saved')) {
			// This should already be correct, but ensure it's properly detected
			const hasCorrectMapping = statTypes.some(stat => stat.value === 'Penalties Saved');
			if (!hasCorrectMapping) {
				const filteredStats = statTypes.filter(stat => 
					!['Home', 'Score', 'Goals Conceded'].includes(stat.value)
				);
				
				filteredStats.push({
					value: 'Penalties Saved',
					originalText: 'penalties saved',
					position: lowerQuestion.indexOf('penalties')
				});
				
				return filteredStats;
			}
		}
		
		return statTypes;
	}

	private correctOpenPlayGoalsQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();
		
		// Check for open play goals phrases that were incorrectly broken down
		if (lowerQuestion.includes('goals') && lowerQuestion.includes('open play')) {
			// Remove incorrect "Goals", "G", "AllGSC" mappings
			const filteredStats = statTypes.filter(stat => 
				!['Goals', 'G', 'AllGSC', 'All Goals Scored'].includes(stat.value)
			);
			
			// Add correct "Open Play Goals" mapping
			filteredStats.push({
				value: 'Open Play Goals',
				originalText: 'goals from open play',
				position: lowerQuestion.indexOf('goals')
			});
			
			return filteredStats;
		}
		
		return statTypes;
	}

	private correctPercentageQueries(statTypes: StatTypeInfo[]): StatTypeInfo[] {
		const lowerQuestion = this.question.toLowerCase();
		
		// Check for percentage queries and map to correct metrics
		if (lowerQuestion.includes('percentage') || lowerQuestion.includes('percent') || lowerQuestion.includes('%')) {
			// Remove any existing stat types that might be incorrect
			const filteredStats = statTypes.filter(stat => 
				!['Home', 'Away', 'Games', 'Wins'].includes(stat.value)
			);
			
			// Add correct percentage metric based on context
			if (lowerQuestion.includes('home games') && lowerQuestion.includes('won')) {
				filteredStats.push({
					value: 'Home Games % Won',
					originalText: 'percentage of home games won',
					position: lowerQuestion.indexOf('percentage') || lowerQuestion.indexOf('percent') || lowerQuestion.indexOf('%')
				});
			} else if (lowerQuestion.includes('away games') && lowerQuestion.includes('won')) {
				filteredStats.push({
					value: 'Away Games % Won',
					originalText: 'percentage of away games won',
					position: lowerQuestion.indexOf('percentage') || lowerQuestion.indexOf('percent') || lowerQuestion.indexOf('%')
				});
			} else if (lowerQuestion.includes('games') && lowerQuestion.includes('won')) {
				filteredStats.push({
					value: 'Games % Won',
					originalText: 'percentage of games won',
					position: lowerQuestion.indexOf('percentage') || lowerQuestion.indexOf('percent') || lowerQuestion.indexOf('%')
				});
			}
			
			return filteredStats;
		}
		
		return statTypes;
	}


	private extractLegacyTimeRange(extractionResult: EntityExtractionResult): string | undefined {
		// Convert extracted time frames to legacy format
		// Debug logging - only show in debug mode
		if (process.env.DEBUG_MODE === 'true') {
			console.log("🔍 Time frames extracted:", extractionResult.timeFrames);
		}
		
		// Look for range type first (e.g., "20/03/2022 to 21/10/24")
		const rangeFrame = extractionResult.timeFrames.find(tf => tf.type === 'range' && tf.value.includes(' to '));
		if (rangeFrame) {
			if (process.env.DEBUG_MODE === 'true') {
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
}