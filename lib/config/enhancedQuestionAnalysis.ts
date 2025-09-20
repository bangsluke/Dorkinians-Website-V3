import { EntityExtractor, EntityExtractionResult } from './entityExtraction';

export interface EnhancedQuestionAnalysis {
	type: "player" | "team" | "club" | "fixture" | "comparison" | "streak" | "double_game" | "temporal" | "general" | "clarification_needed";
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

export class EnhancedQuestionAnalyzer {
	private question: string;
	private userContext?: string;
	private extractor: EntityExtractor;

	constructor(question: string, userContext?: string) {
		this.question = question;
		this.userContext = userContext;
		this.extractor = new EntityExtractor(question);
	}

	analyze(): EnhancedQuestionAnalysis {
		const extractionResult = this.extractor.extractEntities();
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

	private assessComplexity(extractionResult: EntityExtractionResult): 'simple' | 'moderate' | 'complex' {
		const entityCount = extractionResult.entities.length;
		const statTypeCount = extractionResult.statTypes.length;
		const hasMultipleTimeFrames = extractionResult.timeFrames.length > 1;
		const hasNegativeClauses = extractionResult.negativeClauses.length > 0;
		const hasMultipleLocations = extractionResult.locations.length > 1;

		if (entityCount > 3 || statTypeCount > 3) {
			return 'complex';
		}

		if (entityCount > 1 || statTypeCount > 1 || hasMultipleTimeFrames || hasNegativeClauses || hasMultipleLocations) {
			return 'moderate';
		}

		return 'simple';
	}

	private checkClarificationNeeded(extractionResult: EntityExtractionResult, complexity: 'simple' | 'moderate' | 'complex'): boolean {
		// Check for too many entities
		if (extractionResult.entities.length > 3) {
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
		const hasNoEntities = extractionResult.entities.length === 0;
		const hasNoStatTypes = extractionResult.statTypes.length === 0;

		return hasNoEntities || hasNoStatTypes || (complexity === 'complex');
	}

	private generateClarificationMessage(extractionResult: EntityExtractionResult, complexity: 'simple' | 'moderate' | 'complex'): string {
		if (extractionResult.entities.length > 3) {
			return "I can handle questions about up to 3 entities at once. Please simplify your question to focus on fewer players, teams, or other entities.";
		}

		if (extractionResult.statTypes.length > 3) {
			return "I can handle questions about up to 3 different statistics at once. Please simplify your question to focus on fewer stat types.";
		}

		if (extractionResult.entities.length === 0) {
			return "I need to know which player, team, or other entity you're asking about. Please specify who or what you want to know about.";
		}

		if (extractionResult.statTypes.length === 0) {
			return "I need to know what statistic you're asking about. Please specify what information you want (goals, appearances, etc.).";
		}

		if (complexity === 'complex') {
			return "This question is quite complex. I'll try to answer it, but you might get better results by breaking it down into simpler questions.";
		}

		return "Please clarify your question so I can provide a better answer.";
	}

	private determineQuestionType(extractionResult: EntityExtractionResult): "player" | "team" | "club" | "fixture" | "comparison" | "streak" | "double_game" | "temporal" | "general" | "clarification_needed" {
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

		// Check for temporal queries first (time-based questions)
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

		// Check for comparison queries (most, least, highest, etc.)
		if (lowerQuestion.includes('most') || lowerQuestion.includes('least') || 
			lowerQuestion.includes('highest') || lowerQuestion.includes('lowest') || 
			lowerQuestion.includes('best') || lowerQuestion.includes('worst') || 
			lowerQuestion.includes('top') || lowerQuestion.includes('who has') || 
			lowerQuestion.includes('which') || lowerQuestion.includes('penalty record') ||
			lowerQuestion.includes('conversion rate')) {
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
		// Convert extracted stat types to legacy format
		return extractionResult.statTypes.map(stat => this.mapStatTypeToKey(stat.value));
	}

	private mapStatTypeToKey(statType: string): string {
		// Map extracted stat types to their corresponding keys
		const statTypeMapping: { [key: string]: string } = {
			'Apps': 'APP',
            'Minutes': 'MIN',
            'Man of the Match': 'MOM',
            'Goals': 'G',
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
		if (extractionResult.timeFrames.length > 0) {
			return extractionResult.timeFrames[0].value;
		}
		return undefined;
	}
}
