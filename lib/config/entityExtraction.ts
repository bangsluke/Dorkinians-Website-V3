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
	type: 'player' | 'team' | 'fixture' | 'weeklyTOTW' | 'seasonTOTW' | 'playersOfTheMonth' | 'captainAndAwards' | 'league';
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
	'Goals': ['goals', 'scoring', 'prolific', 'strikes', 'finishes', 'netted'],
	'Assists': ['assists', 'assist', 'assisting', 'assisted', 'assists made', 'assists provided'],
	'Apps': ['apps', 'appearances', 'played', 'played with', 'games', 'matches'],
	'Minutes': ['minutes', 'minute', 'mins', 'time played', 'playing time'],
	'Yellow Cards': ['yellow cards', 'yellow card', 'yellows', 'bookings', 'cautions'],
	'Red Cards': ['red cards', 'red card', 'reds', 'dismissals', 'sendings off'],
	'Saves': ['saves', 'save', 'saved', 'saves made', 'goalkeeper saves'],
	'Own Goals': ['own goals', 'own goal', 'og', 'own goal scored'],
	'Goals Conceded': ['goals conceded', 'conceded', 'goals against', 'conceded goals'],
	'Clean Sheets': ['clean sheets', 'clean sheet', 'shutouts', 'clean sheet kept'],
	'Penalties Scored': ['penalties scored', 'penalty scored', 'pen scored', 'penalty goals'],
	'Penalties Missed': ['penalties missed', 'penalty missed', 'pen missed', 'missed penalties'],
	'Penalties Saved': ['penalties saved', 'penalty saved', 'pen saved', 'saved penalties'],
	'Goal Involvements': ['goal involvements', 'goal involvement', 'goals and assists', 'contributions'],
	'Man of the Match': ['man of the match', 'mom', 'player of the match', 'best player'],
	'Double Game Weeks': ['double game weeks', 'double games', 'dgw', 'double weeks'],
	'Team of the Week': ['team of the week', 'totw', 'weekly selection', 'weekly team'],
	'Season Team of the Week': ['season team of the week', 'season totw', 'seasonal selection'],
	'Player of the Month': ['player of the month', 'potm', 'monthly award'],
	'Captain Awards': ['captain awards', 'captain', 'captaincy', 'captain honors'],
	'Co Players': ['co players', 'teammates', 'played with', 'team mates'],
	'Opponents': ['opponents', 'played against', 'faced', 'versus'],
	'Score': ['score', 'scores', 'scoring', 'goals scored'],
	'Awards': ['awards', 'prizes', 'honors', 'honours', 'recognition'],
	'Leagues': ['leagues', 'league titles', 'championships', 'titles'],
	'Penalty record': ['penalty record', 'penalty conversion rate', 'pen conversion', 'spot kick record'],
	'Home': ['home', 'at home', 'home games', 'home matches'],
	'Away': ['away', 'away from home', 'away games', 'away matches', 'on the road'],
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

	constructor(question: string) {
		this.question = question;
		this.lowerQuestion = question.toLowerCase();
	}

	extractEntities(): EntityExtractionResult {
		return {
			entities: this.extractEntityInfo(),
			statTypes: this.extractStatTypes(),
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

		// Extract player names (capitalized words)
		const playerMatches = this.findMatches(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
		playerMatches.forEach(match => {
			// Skip common words that aren't player names
			const commonWords = ['how', 'what', 'where', 'when', 'why', 'which', 'who', 'the', 'and', 'or', 'but', 'for', 'with', 'from', 'to', 'in', 'on', 'at', 'by', 'of', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall'];
			if (!commonWords.includes(match.text.toLowerCase())) {
				entities.push({
					value: match.text,
					type: 'player',
					originalText: match.text,
					position: match.position
				});
			}
		});

		// Extract team references
		const teamMatches = this.findMatches(/\b(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)\s+(team|teams)\b/gi);
		teamMatches.forEach(match => {
			entities.push({
				value: match.text,
				type: 'team',
				originalText: match.text,
				position: match.position
			});
		});

		// Extract league references
		const leagueMatches = this.findMatches(/\b(premier|championship|league\s+one|league\s+two|conference|national\s+league)\b/gi);
		leagueMatches.forEach(match => {
			entities.push({
				value: match.text,
				type: 'league',
				originalText: match.text,
				position: match.position
			});
		});

		return entities;
	}

	private extractStatTypes(): StatTypeInfo[] {
		const statTypes: StatTypeInfo[] = [];
		
		// Check for goal involvements first
		if (this.lowerQuestion.includes('goal involvements') || this.lowerQuestion.includes('goal involvement')) {
			statTypes.push({
				value: 'goal involvements',
				originalText: 'goal involvements',
				position: this.lowerQuestion.indexOf('goal involvements')
			});
		}

		// Extract other stat types
		Object.entries(STAT_TYPE_PSEUDONYMS).forEach(([key, pseudonyms]) => {
			pseudonyms.forEach(pseudonym => {
				const regex = new RegExp(`\\b${pseudonym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
				const matches = this.findMatches(regex);
				matches.forEach(match => {
					statTypes.push({
						value: key,
						originalText: match.text,
						position: match.position
					});
				});
			});
		});

		return statTypes;
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

		// Extract date references
		const dateMatches = this.findMatches(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})\b/gi);
		dateMatches.forEach(match => {
			timeFrames.push({
				value: match.text,
				type: 'date',
				originalText: match.text,
				position: match.position
			});
		});

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
}
