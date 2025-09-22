import { EntityExtractor, EntityExtractionResult } from './entityExtraction';
import { QuestionType } from '../../config/config';

export interface EnhancedQuestionAnalysis {
	type: QuestionType;
	entities: string[];
	metrics: string[];
	timeRange?: string;
	teamEntities?: string[];
	oppositionEntities?: string[];
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
		
		// Extract metrics for backward compatibility
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

		return {
			type,
			entities,
			metrics,
			timeRange,
			teamEntities,
			oppositionEntities,
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

		return (hasNoEntities && !isRankingQuestion) || hasNoStatTypes || (complexity === 'complex');
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

		if (namedEntities.length === 0) {
			return "I need to know which player, team, or other entity you're asking about. Please specify who or what you want to know about. For example: 'How many goals has Luke Bangs scored?' or 'What are the 3rd XI stats?'";
		}

		if (extractionResult.statTypes.length === 0) {
			return "I need to know what statistic you're asking about. Please specify what information you want. Examples: 'goals', 'appearances', 'assists', 'yellow cards', 'clean sheets', 'minutes played', etc.";
		}

		if (complexity === 'complex') {
			return "This question is quite complex with multiple entities or conditions. I'll try to answer it, but you might get better results by breaking it down into simpler questions. For example: 'How many goals has Luke Bangs scored?' instead of asking about multiple players, teams, or stats at once.";
		}

		return "I'm not sure what you're asking about. Please be more specific about which player, team, or statistic you want to know about. For example: 'How many goals has Luke Bangs scored?' or 'What are the 3rd XI stats?'";
	}

	// Determine the question type based on the extracted entities and content
	private determineQuestionType(extractionResult: EntityExtractionResult): QuestionType {
		const lowerQuestion = this.question.toLowerCase();

		// Check for clarification needed first
		if (this.checkClarificationNeeded(extractionResult, this.assessComplexity(extractionResult))) {
			return "clarification_needed";
		}

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
		// Convert extracted stat types to legacy format with priority handling
		const statTypes = extractionResult.statTypes.map(stat => stat.value);
		
		// Priority order: more specific stat types should take precedence
		const priorityOrder = [
			'Open Play Goals',  // More specific than 'Goals'
			'Penalties Scored', // More specific than 'Goals'
			'Goals',            // General goals
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

	private mapStatTypeToKey(statType: string): string {
		// Map extracted stat types to their corresponding keys
		const statTypeMapping: { [key: string]: string } = {
			'Apps': 'APP',
            'Minutes': 'MIN',
            'Man of the Match': 'MOM',
            'Goals': 'AllGSC',
			'Open Play Goals': 'G',
			'Assists': 'A',
			'Yellow Cards': 'Y',
			'Red Cards': 'R',
			'Saves': 'SAVES',
			'Own Goals': 'OG',
			'Goals Conceded': 'C',
			'Clean Sheets': 'CLS',
			'Penalties Scored': 'PSC',
			'Penalties Missed': 'PM',
            'Penalties Conceded': 'PCO',
			'Penalties Saved': 'PSV',
            'Fantasy Points': 'FTP',
			'Goal Involvements': 'GI',
			'Goals Per Appearance': 'GperAPP',
			'Conceded Per Appearance': 'CperAPP',
			'Minutes Per Goal': 'MperG',
			'Team of the Week': 'TOTW',
			'Season Team of the Week': 'SEASON_TOTW',
			'Player of the Month': 'POTM',
			'Captain Awards': 'CAPTAIN',
			'Co Players': 'CO_PLAYERS',
			'Opponents': 'OPPONENTS',
			'Most Prolific Season': 'MOST_PROLIFIC_SEASON',
			'Team Analysis': 'TEAM_ANALYSIS',
			'Season Analysis': 'SEASON_ANALYSIS',
			'Home': 'HOME',
			'Away': 'AWAY'
		};

		return statTypeMapping[statType] || statType;
	}

	private extractLegacyTimeRange(extractionResult: EntityExtractionResult): string | undefined {
		// Convert extracted time frames to legacy format
		console.log("🔍 Time frames extracted:", extractionResult.timeFrames);
		
		// Look for range type first (e.g., "20/03/2022 to 21/10/24")
		const rangeFrame = extractionResult.timeFrames.find(tf => tf.type === 'range' && tf.value.includes(' to '));
		if (rangeFrame) {
			console.log("🔍 Using range time frame:", rangeFrame.value);
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
