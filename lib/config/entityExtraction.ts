import nlp from "compromise";
import { EntityNameResolver } from "../services/entityNameResolver";

export interface EntityExtractionResult {
	entities: EntityInfo[];
	statTypes: StatTypeInfo[];
	statIndicators: StatIndicatorInfo[];
	questionTypes: QuestionTypeInfo[];
	negativeClauses: NegativeClauseInfo[];
	locations: LocationInfo[];
	timeFrames: TimeFrameInfo[];
	goalInvolvements: boolean;
}

export interface EntityInfo {
	value: string;
	type: 'player' | 'team' | 'fixture' | 'weeklyTOTW' | 'seasonTOTW' | 'playersOfTheMonth' | 'captainAndAwards' | 'league' | 'opposition';
	originalText: string;
	position: number;
}

export interface StatTypeInfo {
	value: string;
	originalText: string;
	position: number;
}

export interface StatIndicatorInfo {
	value: 'highest' | 'lowest' | 'longest' | 'shortest' | 'most' | 'least' | 'average';
	originalText: string;
	position: number;
}

export interface QuestionTypeInfo {
	value: 'how' | 'how_many' | 'where' | 'where_did' | 'what' | 'whats' | 'who' | 'who_did' | 'which';
	originalText: string;
	position: number;
}

export interface NegativeClauseInfo {
	value: string;
	originalText: string;
	position: number;
}

export interface LocationInfo {
	value: string;
	type: 'home' | 'away' | 'ground';
	originalText: string;
	position: number;
}

export interface TimeFrameInfo {
	value: string;
	type: 'date' | 'season' | 'weekend' | 'gameweek' | 'consecutive' | 'range';
	originalText: string;
	position: number;
}

// Entity pseudonyms and antonyms
export const ENTITY_PSEUDONYMS = {
	// Player references
	'I': ['i', 'i\'ve', 'me', 'my', 'myself'],
	'Pixham': ['pixham', 'home ground', 'our ground'],
	
	// Teams
	'1s': ['1s', '1st', 'first team', 'firsts', '1st team'],
	'2s': ['2s', '2nd', 'second team', 'seconds', '2nd team'],
	'3s': ['3s', '3rd', 'third team', 'thirds', '3rd team'],
	'4s': ['4s', '4th', 'fourth team', 'fourths', '4th team'],
	'5s': ['5s', '5th', 'fifth team', 'fifths', '5th team'],
	'6s': ['6s', '6th', 'sixth team', 'sixths', '6th team'],
	'7s': ['7s', '7th', 'seventh team', 'sevenths', '7th team'],
	'8s': ['8s', '8th', 'eighth team', 'eighths', '8th team'],
	
	// Leagues
	'Premier': ['premier', 'premier league', 'prem'],
	'Intermediate South': ['intermediate'],
	'League One': ['league one', 'league 1', 'l1'],
	'League Two': ['league two', 'league 2', 'l2'],
	'Conference': ['conference', 'conf'],
	'National League': ['national league', 'national'],
};

// Stat type pseudonyms and antonyms
export const STAT_TYPE_PSEUDONYMS = {
	'Own Goals': ['own goals scored', 'own goal scored', 'own goals', 'own goal', 'og'],
	'Goals Conceded': ['goals conceded', 'conceded goals', 'goals against', 'conceded'],
	'Goals': ['goals', 'scoring', 'prolific', 'strikes', 'finishes', 'netted'],
	'Open Play Goals': ['open play goals', 'open play goal', 'goals from open play', 'goals in open play', 'goals scored from open play', 'goals scored in open play', 'scored from open play', 'scored in open play', 'non-penalty goals', 'non penalty goals'],
	'Assists': ['assists made', 'assists provided', 'assists', 'assist', 'assisting', 'assisted'],
	'Apps': ['apps', 'appearances', 'played in', 'played with'],
	'Minutes': ['minutes of football', 'minutes played', 'playing time', 'time played', 'minutes', 'minute', 'mins'],
	'Yellow Cards': ['yellow cards', 'yellow card', 'yellows', 'bookings', 'cautions'],
	'Red Cards': ['red cards', 'red card', 'reds', 'dismissals', 'sendings off'],
	'Saves': ['goalkeeper saves', 'saves made', 'saves', 'save', 'saved'],
	'Clean Sheets': ['clean sheet kept', 'clean sheets', 'clean sheet', 'shutouts'],
	'Penalties Scored': ['penalties have scored', 'penalties has scored', 'penalties scored', 'penalty scored', 'penalty goals', 'pen scored'],
	'Penalties Missed': ['penalties have missed', 'penalties has missed', 'penalties missed', 'penalty missed', 'missed penalties', 'pen missed'],
	'Penalties Conceded': ['penalties conceded', 'penalty conceded', 'pen conceded', 'conceded penalties', 'penalties has conceded', 'penalties have conceded'],
	'Penalties Saved': ['penalties have saved', 'penalties has saved', 'penalties saved', 'penalty saved', 'saved penalties', 'pen saved'],
	'Goal Involvements': ['goal involvements', 'goal involvement', 'goals and assists', 'contributions'],
	'Man of the Match': ['man of the match', 'player of the match', 'best player', 'mom', 'moms'],
	'Double Game Weeks': ['double game weeks', 'double games', 'dgw', 'double weeks'],
	'Team of the Week': ['team of the week', 'totw', 'weekly selection', 'weekly team'],
	'Season Team of the Week': ['season team of the week', 'season totw', 'seasonal selection'],
	'Player of the Month': ['player of the month', 'potm', 'monthly award'],
	'Captain Awards': ['captain awards', 'captain honors', 'captaincy', 'captain'],
	'Co Players': ['co players', 'teammates', 'played with', 'team mates'],
	'Opponents': ['opponents', 'played against', 'faced', 'versus'],
	'Fantasy Points': ['fantasy points', 'fantasy score', 'fantasy point', 'points', 'ftp', 'fp'],
	'Goals Per Appearance': ['goals on average does', 'goals on average has', 'goals per appearance', 'goals per app', 'goals per game', 'goals per match', 'goals on average', 'average goals'],
	'Conceded Per Appearance': ['conceded on average does', 'conceded per appearance', 'conceded per app', 'conceded per game', 'conceded per match', 'conceded on average', 'average conceded'],
	'Minutes Per Goal': ['minutes does it take on average', 'minutes does it take', 'minutes per goal', 'mins per goal', 'time per goal', 'minutes on average', 'average minutes'],
	'Score': ['goals scored', 'score', 'scores', 'scoring'],
	'Awards': ['awards', 'prizes', 'honors', 'honours', 'recognition'],
	'Leagues': ['leagues', 'league titles', 'championships', 'titles'],
	'Penalty record': ['penalty conversion rate', 'penalty record', 'spot kick record', 'pen conversion'],
	'Home': ['home games', 'home matches', 'at home', 'home'],
	'Away': ['away games', 'away matches', 'away from home', 'on the road', 'away'],
	'Most Prolific Season': ['most prolific season', 'best season', 'top season', 'highest scoring season'],
	'Team Analysis': ['most appearances for', 'most goals for', 'played for', 'teams played for'],
	'Season Analysis': ['seasons played in', 'seasons', 'years played'],
};

// Stat indicator pseudonyms and antonyms
export const STAT_INDICATOR_PSEUDONYMS = {
	'highest': ['highest', 'most', 'maximum', 'top', 'best', 'greatest', 'peak'],
	'lowest': ['lowest', 'least', 'minimum', 'bottom', 'worst', 'smallest', 'fewest'],
	'longest': ['longest', 'most', 'maximum', 'greatest', 'biggest'],
	'shortest': ['shortest', 'least', 'minimum', 'smallest', 'briefest'],
	'average': ['average', 'mean', 'typical', 'normal', 'regular'],
};

// Question type pseudonyms
export const QUESTION_TYPE_PSEUDONYMS = {
	'how': ['how', 'how do', 'how does', 'how did', 'how can', 'how will'],
	'how_many': ['how many', 'how much', 'how often', 'how frequently'],
	'where': ['where', 'where do', 'where does', 'where did'],
	'where_did': ['where did', 'where have', 'where has'],
	'what': ['what', 'what do', 'what does', 'what did', 'what have', 'what has'],
	'whats': ['what\'s', 'what is', 'what are', 'what was', 'what were'],
	'who': ['who', 'who do', 'who does', 'who did', 'who have', 'who has'],
	'who_did': ['who did', 'who have', 'who has', 'who made', 'who created'],
	'which': ['which', 'which do', 'which does', 'which did', 'which have', 'which has'],
};

// Negative clause pseudonyms
export const NEGATIVE_CLAUSE_PSEUDONYMS = {
	'not': ['not', 'no', 'never', 'none', 'nobody', 'nothing'],
	'excluding': ['excluding', 'except', 'apart from', 'other than', 'besides'],
	'without': ['without', 'lacking', 'missing', 'devoid of'],
};

// Location pseudonyms
export const LOCATION_PSEUDONYMS = {
	'home': ['home', 'at home', 'home ground', 'our ground', 'pixham'],
	'away': ['away', 'away from home', 'on the road', 'away ground', 'their ground'],
	'Pixham': ['pixham', 'home ground', 'our ground', 'the ground'],
};

// Time frame pseudonyms
export const TIME_FRAME_PSEUDONYMS = {
	'week': ['week', 'weekly', 'a week'],
	'month': ['month', 'monthly', 'a month'],
	'game': ['game', 'match', 'a game', 'a match'],
	'weekend': ['weekend', 'a weekend', 'weekends'],
	'season': ['season', 'yearly', 'annual', 'a season'],
	'consecutive': ['consecutive', 'in a row', 'straight', 'running'],
	'first_week': ['first week', 'opening week', 'week one'],
	'second_week': ['second week', 'week two'],
	'between_dates': ['between', 'from', 'to', 'until', 'since'],
};

export class EntityExtractor {
	private question: string;
	private lowerQuestion: string;
	private nlpDoc: any;
	private entityResolver: EntityNameResolver;

	constructor(question: string) {
		this.question = question;
		this.lowerQuestion = question.toLowerCase();
		this.nlpDoc = nlp(question);
		this.entityResolver = EntityNameResolver.getInstance();
	}

	async extractEntities(): Promise<EntityExtractionResult> {
		return {
			entities: this.extractEntityInfo(),
			statTypes: await this.extractStatTypes(),
			statIndicators: this.extractStatIndicators(),
			questionTypes: this.extractQuestionTypes(),
			negativeClauses: this.extractNegativeClauses(),
			locations: this.extractLocations(),
			timeFrames: this.extractTimeFrames(),
			goalInvolvements: this.detectGoalInvolvements(),
		};
	}

	private extractEntityInfo(): EntityInfo[] {
		const entities: EntityInfo[] = [];
		let position = 0;

		// Extract "I" references
		const iMatches = this.findMatches(/\b(i|i've|me|my|myself)\b/gi);
		iMatches.forEach(match => {
			entities.push({
				value: 'I',
				type: 'player',
				originalText: match.text,
				position: match.position
			});
		});

		// Extract player names using compromise NLP for better accuracy
		const playerNames = this.extractPlayerNamesWithNLP();
		const addedPlayers = new Set<string>();
		playerNames.forEach(player => {
			const normalizedName = player.text.toLowerCase();
			if (!addedPlayers.has(normalizedName)) {
				addedPlayers.add(normalizedName);
				entities.push({
					value: player.text,
					type: 'player',
					originalText: player.text,
					position: player.position
				});
			}
		});

		// Extract team references (with or without "team" word)
		const teamMatches = this.findMatches(/\b(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)(?:\s+(team|teams))?\b/gi);
		teamMatches.forEach(match => {
			// Extract just the team number/name part
			const teamName = match.text.replace(/\s+(team|teams)$/i, '');
			entities.push({
				value: teamName,
				type: 'team',
				originalText: match.text,
				position: match.position
			});
		});

		// Extract league references (detect league-related terms dynamically)
		// Look for patterns that typically indicate league names
		const leagueMatches = this.findMatches(/\b(league|premier|championship|conference|national|division|tier|level)\b/gi);
		leagueMatches.forEach(match => {
			// Extract the full league name by looking for surrounding context
			const contextStart = Math.max(0, match.position - 20);
			const contextEnd = Math.min(this.question.length, match.position + match.text.length + 20);
			const context = this.question.substring(contextStart, contextEnd);
			
			// Try to extract a more complete league name from context
			const fullLeagueMatch = context.match(/\b([A-Z][a-z]*(?:\s+[A-Z][a-z]*)*\s+(?:league|premier|championship|conference|national|division|tier|level))\b/gi);
			if (fullLeagueMatch) {
				const leagueName = fullLeagueMatch[0].trim();
				entities.push({
					value: leagueName,
					type: 'league',
					originalText: leagueName,
					position: match.position
				});
			} else {
				// Fallback to just the matched term
				entities.push({
					value: match.text,
					type: 'league',
					originalText: match.text,
					position: match.position
				});
			}
		});

		// Extract opposition team references (detect capitalized team names that aren't players)
		// This will catch any capitalized team names that appear in the question
		const oppositionMatches = this.findMatches(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
		oppositionMatches.forEach(match => {
			// Skip common words and known player names
			const commonWords = ['how', 'what', 'where', 'when', 'why', 'which', 'who', 'the', 'and', 'or', 'but', 'for', 'with', 'from', 'to', 'in', 'on', 'at', 'by', 'of', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall'];
			const knownPlayers = ['Luke', 'Bangs', 'Oli', 'Goddard', 'Kieran', 'Mackrell']; // Add more known players as needed
			
			// Check if this matches any existing player entities (to avoid duplicates)
			const isPlayerEntity = entities.some(e => 
				e.type === 'player' && 
				(e.value.toLowerCase().includes(match.text.toLowerCase()) || 
				 match.text.toLowerCase().includes(e.value.toLowerCase()))
			);
			
			if (!commonWords.includes(match.text.toLowerCase()) && 
				!knownPlayers.includes(match.text) &&
				!match.text.match(/^\d+(st|nd|rd|th)?$/) && // Skip team numbers like "3s", "4th"
				!isPlayerEntity) { // Skip if it's already a player entity
				entities.push({
					value: match.text,
					type: 'opposition',
					originalText: match.text,
					position: match.position
				});
			}
		});

		return entities;
	}

	private async extractStatTypes(): Promise<StatTypeInfo[]> {
		const statTypes: StatTypeInfo[] = [];
		
		// Debug logging
		console.log('🔍 Stat Type Debug - Question:', this.question);
		console.log('🔍 Stat Type Debug - Lower question:', this.lowerQuestion);
		
		// Check for goal involvements first
		if (this.lowerQuestion.includes('goal involvements') || this.lowerQuestion.includes('goal involvement')) {
			statTypes.push({
				value: 'goal involvements',
				originalText: 'goal involvements',
				position: this.lowerQuestion.indexOf('goal involvements')
			});
		}

		// Extract other stat types - sort pseudonyms by length (longest first) to prioritize longer matches
		Object.entries(STAT_TYPE_PSEUDONYMS).forEach(([key, pseudonyms]) => {
			// Sort pseudonyms by length (longest first) to ensure longer matches are found first
			const sortedPseudonyms = [...pseudonyms].sort((a, b) => b.length - a.length);
			
			sortedPseudonyms.forEach(pseudonym => {
				const regex = new RegExp(`\\b${pseudonym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
				const matches = this.findMatches(regex);
				if (matches.length > 0) {
					console.log(`🔍 Stat Type Debug - Found matches for "${pseudonym}":`, matches);
				}
				matches.forEach(match => {
					statTypes.push({
						value: key,
						originalText: match.text,
						position: match.position
					});
				});
			});
		});

		// Add fuzzy matching for stat types
		await this.addFuzzyStatTypeMatches(statTypes);

		console.log('🔍 Stat Type Debug - Final stat types:', statTypes);
		return statTypes;
	}

	private async addFuzzyStatTypeMatches(existingStatTypes: StatTypeInfo[]): Promise<void> {
		// Get all potential stat type words from the question
		const words = this.question.toLowerCase().split(/\s+/);
		
		// Check each word for potential stat type matches
		for (const word of words) {
			// Skip if it's already been matched exactly
			const alreadyMatched = existingStatTypes.some(stat => 
				stat.originalText.toLowerCase() === word
			);
			
			if (alreadyMatched || word.length < 3) continue;
			
			// Try to find fuzzy matches for this word
			const bestMatch = await this.findBestStatTypeMatch(word);
			if (bestMatch) {
				// Check if this word appears in the original question
				const position = this.question.toLowerCase().indexOf(word);
				if (position !== -1) {
					existingStatTypes.push({
						value: bestMatch,
						originalText: word,
						position: position
					});
				}
			}
		}
	}

	private async findBestStatTypeMatch(word: string): Promise<string | null> {
		// Get all stat type pseudonyms
		const allPseudonyms: string[] = [];
		Object.values(STAT_TYPE_PSEUDONYMS).forEach(pseudonyms => {
			allPseudonyms.push(...pseudonyms);
		});
		
		// Find the best match using the entity resolver
		const bestMatch = await this.entityResolver.getBestMatch(word, 'stat_type');
		
		// If no match found, try manual fuzzy matching
		if (!bestMatch) {
			let bestScore = 0;
			let bestStatType = null;
			
			for (const [statType, pseudonyms] of Object.entries(STAT_TYPE_PSEUDONYMS)) {
				for (const pseudonym of pseudonyms) {
					const score = this.calculateSimilarity(word, pseudonym);
					if (score > bestScore && score > 0.7) { // Threshold for fuzzy matching
						bestScore = score;
						bestStatType = statType;
					}
				}
			}
			
			return bestStatType;
		}
		
		return bestMatch;
	}

	private calculateSimilarity(str1: string, str2: string): number {
		// Simple Jaro-Winkler similarity
		const longer = str1.length > str2.length ? str1 : str2;
		const shorter = str1.length > str2.length ? str2 : str1;
		
		if (longer.length === 0) return 1.0;
		
		const distance = this.levenshteinDistance(longer, shorter);
		return (longer.length - distance) / longer.length;
	}

	private levenshteinDistance(str1: string, str2: string): number {
		const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
		
		for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
		for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
		
		for (let j = 1; j <= str2.length; j++) {
			for (let i = 1; i <= str1.length; i++) {
				const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
				matrix[j][i] = Math.min(
					matrix[j][i - 1] + 1,
					matrix[j - 1][i] + 1,
					matrix[j - 1][i - 1] + indicator
				);
			}
		}
		
		return matrix[str2.length][str1.length];
	}

	private extractStatIndicators(): StatIndicatorInfo[] {
		const indicators: StatIndicatorInfo[] = [];
		
		Object.entries(STAT_INDICATOR_PSEUDONYMS).forEach(([key, pseudonyms]) => {
			pseudonyms.forEach(pseudonym => {
				const regex = new RegExp(`\\b${pseudonym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
				const matches = this.findMatches(regex);
				matches.forEach(match => {
					indicators.push({
						value: key as any,
						originalText: match.text,
						position: match.position
					});
				});
			});
		});

		return indicators;
	}

	private extractQuestionTypes(): QuestionTypeInfo[] {
		const questionTypes: QuestionTypeInfo[] = [];
		
		Object.entries(QUESTION_TYPE_PSEUDONYMS).forEach(([key, pseudonyms]) => {
			pseudonyms.forEach(pseudonym => {
				const regex = new RegExp(`\\b${pseudonym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
				const matches = this.findMatches(regex);
				matches.forEach(match => {
					questionTypes.push({
						value: key as any,
						originalText: match.text,
						position: match.position
					});
				});
			});
		});

		return questionTypes;
	}

	private extractNegativeClauses(): NegativeClauseInfo[] {
		const clauses: NegativeClauseInfo[] = [];
		
		Object.entries(NEGATIVE_CLAUSE_PSEUDONYMS).forEach(([key, pseudonyms]) => {
			pseudonyms.forEach(pseudonym => {
				const regex = new RegExp(`\\b${pseudonym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
				const matches = this.findMatches(regex);
				matches.forEach(match => {
					clauses.push({
						value: key,
						originalText: match.text,
						position: match.position
					});
				});
			});
		});

		return clauses;
	}

	private extractLocations(): LocationInfo[] {
		const locations: LocationInfo[] = [];
		
		Object.entries(LOCATION_PSEUDONYMS).forEach(([key, pseudonyms]) => {
			pseudonyms.forEach(pseudonym => {
				const regex = new RegExp(`\\b${pseudonym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
				const matches = this.findMatches(regex);
				matches.forEach(match => {
					locations.push({
						value: key,
						type: key === 'Pixham' ? 'ground' : key as any,
						originalText: match.text,
						position: match.position
					});
				});
			});
		});

		return locations;
	}

	private extractTimeFrames(): TimeFrameInfo[] {
		const timeFrames: TimeFrameInfo[] = [];
		
		// Extract season references
		const seasonMatches = this.findMatches(/\b(20\d{2}[/-]?\d{2}|20\d{2}\s*[/-]\s*20\d{2})\b/g);
		seasonMatches.forEach(match => {
			timeFrames.push({
				value: match.text,
				type: 'season',
				originalText: match.text,
				position: match.position
			});
		});

		// Extract date references (including date ranges)
		const dateMatches = this.findMatches(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})\b/gi);
		dateMatches.forEach(match => {
			timeFrames.push({
				value: match.text,
				type: 'date',
				originalText: match.text,
				position: match.position
			});
		});

		// Extract date ranges (between X and Y)
		const dateRangeRegex = /\bbetween\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+and\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/gi;
		let dateRangeMatch;
		while ((dateRangeMatch = dateRangeRegex.exec(this.question)) !== null) {
			timeFrames.push({
				value: `${dateRangeMatch[1]} to ${dateRangeMatch[2]}`,
				type: 'range',
				originalText: dateRangeMatch[0],
				position: dateRangeMatch.index
			});
		}

		// Extract other time frame references
		Object.entries(TIME_FRAME_PSEUDONYMS).forEach(([key, pseudonyms]) => {
			pseudonyms.forEach(pseudonym => {
				const regex = new RegExp(`\\b${pseudonym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
				const matches = this.findMatches(regex);
				matches.forEach(match => {
					timeFrames.push({
						value: key,
						type: key === 'between_dates' ? 'range' : key as any,
						originalText: match.text,
						position: match.position
					});
				});
			});
		});

		return timeFrames;
	}

	private detectGoalInvolvements(): boolean {
		return this.lowerQuestion.includes('goal involvements') || this.lowerQuestion.includes('goal involvement');
	}

	private findMatches(regex: RegExp): Array<{text: string, position: number}> {
		const matches: Array<{text: string, position: number}> = [];
		let match;
		
		while ((match = regex.exec(this.question)) !== null) {
			matches.push({
				text: match[0],
				position: match.index
			});
		}
		
		return matches;
	}

	/**
	 * Extract player names using compromise NLP for better accuracy
	 */
	private extractPlayerNamesWithNLP(): Array<{text: string, position: number}> {
		const players: Array<{text: string, position: number}> = [];
		
		// Get all proper nouns (potential player names)
		const properNouns = this.nlpDoc.match('#ProperNoun+').out('array');
		
		// Get all nouns that might be player names
		const nouns = this.nlpDoc.match('#Noun+').out('array');
		
		// Debug logging
		console.log('🔍 NLP Debug - Question:', this.question);
		console.log('🔍 NLP Debug - Proper nouns:', properNouns);
		console.log('🔍 NLP Debug - Nouns:', nouns);
		
		// Combine and filter potential player names
		const potentialNames = [...properNouns, ...nouns];
		
		// Common words to exclude
		const commonWords = [
			'how', 'what', 'where', 'when', 'why', 'which', 'who', 'the', 'and', 'or', 'but', 
			'for', 'with', 'from', 'to', 'in', 'on', 'at', 'by', 'of', 'a', 'an', 'is', 'are', 
			'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 
			'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall',
			'goals', 'assists', 'appearances', 'minutes', 'cards', 'saves', 'clean', 'sheets',
			'penalties', 'fantasy', 'points', 'distance', 'miles', 'team', 'teams', 'season',
			'week', 'month', 'year', 'game', 'games', 'match', 'matches', 'league', 'premier',
			'championship', 'conference', 'national', 'division', 'tier', 'level',
			'home', 'away', 'playing', 'whilst', 'between', 'and', 'got', 'has', 'have',
			'open play goals', 'open play goal', 'play goals', 'play goal', 'football', 'soccer', 'sport', 'sports'
		];
		
		// Find positions of potential names in the original text
		for (const name of potentialNames) {
			const normalizedName = name.trim();
			
			// Skip if it's a common word or too short
			if (commonWords.includes(normalizedName.toLowerCase()) || normalizedName.length < 2) {
				continue;
			}
			
			// Skip if it's a stat type (check against all stat type pseudonyms)
			const isStatType = Object.values(STAT_TYPE_PSEUDONYMS).some(pseudonyms => 
				pseudonyms.some(pseudonym => 
					this.calculateSimilarity(normalizedName.toLowerCase(), pseudonym.toLowerCase()) > 0.7
				)
			);
			
			if (isStatType) {
				continue;
			}
			
			// Skip if it's a number or team reference
			if (normalizedName.match(/^\d+(st|nd|rd|th)?$/) || normalizedName.match(/^\d+s$/)) {
				continue;
			}
			
			// Find the position of this name in the original text
			const position = this.question.toLowerCase().indexOf(normalizedName.toLowerCase());
			if (position !== -1) {
				players.push({
					text: normalizedName,
					position: position
				});
			}
		}
		
		// Combine adjacent proper nouns to form full names (e.g., "Luke" + "Bangs" = "Luke Bangs")
		const combinedPlayers: Array<{text: string, position: number}> = [];
		const sortedPlayers = players.sort((a, b) => a.position - b.position);
		
		for (let i = 0; i < sortedPlayers.length; i++) {
			const currentPlayer = sortedPlayers[i];
			let combinedName = currentPlayer.text;
			let combinedPosition = currentPlayer.position;
			
			// Look for adjacent players (within 1 word distance)
			for (let j = i + 1; j < sortedPlayers.length; j++) {
				const nextPlayer = sortedPlayers[j];
				const distance = nextPlayer.position - (currentPlayer.position + currentPlayer.text.length);
				
				// If the next player is within 1 word distance, combine them
				if (distance <= 1) {
					combinedName += ' ' + nextPlayer.text;
					i = j; // Skip the next player since we've combined it
				} else {
					break; // No more adjacent players
				}
			}
			
			combinedPlayers.push({
				text: combinedName,
				position: combinedPosition
			});
		}
		
		// Use combined players instead of individual ones
		players.length = 0;
		players.push(...combinedPlayers);
		
		// Remove duplicates and sort by position
		const uniquePlayers = players.filter((player, index, self) => 
			index === self.findIndex(p => p.text === player.text)
		);
		
		console.log('🔍 Player Debug - Final players:', uniquePlayers);
		return uniquePlayers.sort((a, b) => a.position - b.position);
	}

	/**
	 * Resolve all entities with fuzzy matching
	 */
	public async resolveEntitiesWithFuzzyMatching(): Promise<EntityExtractionResult> {
		const baseResult = await this.extractEntities();
		const resolvedEntities: EntityInfo[] = [];

		// Process each entity with fuzzy matching
		for (const entity of baseResult.entities) {
			let resolvedName = entity.value;
			let wasResolved = false;

			// Try to resolve based on entity type
			switch (entity.type) {
				case 'player':
					const resolvedPlayer = await this.entityResolver.getBestMatch(entity.value, 'player');
					if (resolvedPlayer) {
						resolvedName = resolvedPlayer;
						wasResolved = true;
					}
					break;
				case 'team':
					const resolvedTeam = await this.entityResolver.getBestMatch(entity.value, 'team');
					if (resolvedTeam) {
						resolvedName = resolvedTeam;
						wasResolved = true;
					}
					break;
				case 'opposition':
					const resolvedOpposition = await this.entityResolver.getBestMatch(entity.value, 'opposition');
					if (resolvedOpposition) {
						resolvedName = resolvedOpposition;
						wasResolved = true;
					}
					break;
				case 'league':
					const resolvedLeague = await this.entityResolver.getBestMatch(entity.value, 'league');
					if (resolvedLeague) {
						resolvedName = resolvedLeague;
						wasResolved = true;
					}
					break;
			}

			// Add resolved entity
			resolvedEntities.push({
				...entity,
				value: resolvedName,
				originalText: wasResolved ? `${entity.originalText} (resolved to: ${resolvedName})` : entity.originalText
			});
		}

		return {
			...baseResult,
			entities: resolvedEntities
		};
	}
}
