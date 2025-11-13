import { EnhancedQuestionAnalysis } from "../config/enhancedQuestionAnalysis";

export interface SimilarQuestion {
	pattern: string;
	response: string;
	confidence: number;
}

export class QuestionSimilarityMatcher {
	private static instance: QuestionSimilarityMatcher;
	private fallbackPatterns: SimilarQuestion[] = [];

	private constructor() {
		this.initializeFallbackPatterns();
	}

	public static getInstance(): QuestionSimilarityMatcher {
		if (!QuestionSimilarityMatcher.instance) {
			QuestionSimilarityMatcher.instance = new QuestionSimilarityMatcher();
		}
		return QuestionSimilarityMatcher.instance;
	}

	/**
	 * Initialize fallback response patterns
	 */
	private initializeFallbackPatterns(): void {
		this.fallbackPatterns = [
			{
				pattern: "goals",
				response: "I can help you find information about goals. Could you be more specific? For example, 'How many goals has [player] scored?'",
				confidence: 0.6,
			},
			{
				pattern: "appearances|apps",
				response: "I can help you find information about appearances. Try asking 'How many appearances has [player] made?'",
				confidence: 0.6,
			},
			{
				pattern: "assists",
				response: "I can help you find information about assists. Try asking 'How many assists has [player] made?'",
				confidence: 0.6,
			},
			{
				pattern: "player|who",
				response: "I can help you find information about players. Try asking 'Who is the top goal scorer?' or 'How many goals has [player] scored?'",
				confidence: 0.5,
			},
			{
				pattern: "team",
				response: "I can help you find information about teams. Try asking 'Which team has scored the most goals?'",
				confidence: 0.5,
			},
		];
	}

	/**
	 * Calculate Levenshtein distance between two strings
	 */
	private levenshteinDistance(str1: string, str2: string): number {
		const matrix: number[][] = [];

		for (let i = 0; i <= str2.length; i++) {
			matrix[i] = [i];
		}

		for (let j = 0; j <= str1.length; j++) {
			matrix[0][j] = j;
		}

		for (let i = 1; i <= str2.length; i++) {
			for (let j = 1; j <= str1.length; j++) {
				if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
					matrix[i][j] = matrix[i - 1][j - 1];
				} else {
					matrix[i][j] = Math.min(
						matrix[i - 1][j - 1] + 1,
						matrix[i][j - 1] + 1,
						matrix[i - 1][j] + 1,
					);
				}
			}
		}

		return matrix[str2.length][str1.length];
	}

	/**
	 * Calculate similarity score between two strings (0-1)
	 */
	private calculateSimilarity(str1: string, str2: string): number {
		const maxLen = Math.max(str1.length, str2.length);
		if (maxLen === 0) return 1.0;
		const distance = this.levenshteinDistance(str1, str2);
		return 1 - distance / maxLen;
	}

	/**
	 * Find best matching fallback response
	 */
	public findBestMatch(question: string, analysis: EnhancedQuestionAnalysis): SimilarQuestion | null {
		const lowerQuestion = question.toLowerCase();

		// Check if any extracted entities or metrics match fallback patterns
		let bestMatch: SimilarQuestion | null = null;
		let bestScore = 0;

		for (const pattern of this.fallbackPatterns) {
			const regex = new RegExp(pattern.pattern, "i");
			if (regex.test(lowerQuestion)) {
				const score = pattern.confidence;
				if (score > bestScore) {
					bestScore = score;
					bestMatch = pattern;
				}
			}
		}

		// Also check extracted metrics
		for (const metric of analysis.metrics) {
			const metricLower = metric.toLowerCase();
			for (const pattern of this.fallbackPatterns) {
				const regex = new RegExp(pattern.pattern, "i");
				if (regex.test(metricLower)) {
					const score = pattern.confidence * 0.8;
					if (score > bestScore) {
						bestScore = score;
						bestMatch = pattern;
					}
				}
			}
		}

		return bestMatch;
	}

	/**
	 * Generate a fallback response with suggestions
	 */
	public generateFallbackResponse(question: string, analysis: EnhancedQuestionAnalysis): string {
		const bestMatch = this.findBestMatch(question, analysis);

		if (bestMatch) {
			return bestMatch.response;
		}

		// Generic fallback
		if (analysis.entities.length > 0 && analysis.metrics.length === 0) {
			return `I found ${analysis.entities.join(", ")} in your question, but I'm not sure what statistic you're looking for. Try asking something like 'How many goals has ${analysis.entities[0]} scored?'`;
		}

		if (analysis.metrics.length > 0 && analysis.entities.length === 0) {
			return `I found ${analysis.metrics.join(", ")} in your question, but I'm not sure which player or team you're asking about. Try asking something like 'How many ${analysis.metrics[0]} has [player name] scored?'`;
		}

		return "I'm not sure I understand your question. Try asking something like 'How many goals has [player name] scored?' or 'Who is the top goal scorer?'";
	}
}

export const questionSimilarityMatcher = QuestionSimilarityMatcher.getInstance();

