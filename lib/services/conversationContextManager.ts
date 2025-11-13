import { EnhancedQuestionAnalysis } from "../config/enhancedQuestionAnalysis";

export interface ConversationHistory {
	question: string;
	analysis: EnhancedQuestionAnalysis;
	entities: string[];
	metrics: string[];
	timestamp: Date;
}

export interface ConversationContext {
	sessionId?: string;
	lastQuestion?: ConversationHistory;
	history: ConversationHistory[];
}

export class ConversationContextManager {
	private static instance: ConversationContextManager;
	private contextStore: Map<string, ConversationContext> = new Map();
	private readonly MAX_HISTORY = 3;

	private constructor() {}

	public static getInstance(): ConversationContextManager {
		if (!ConversationContextManager.instance) {
			ConversationContextManager.instance = new ConversationContextManager();
		}
		return ConversationContextManager.instance;
	}

	/**
	 * Get or create context for a session
	 */
	public getContext(sessionId: string): ConversationContext {
		if (!this.contextStore.has(sessionId)) {
			this.contextStore.set(sessionId, {
				sessionId,
				history: [],
			});
		}
		return this.contextStore.get(sessionId)!;
	}

	/**
	 * Add a question to conversation history
	 */
	public addToHistory(sessionId: string, question: string, analysis: EnhancedQuestionAnalysis): void {
		const context = this.getContext(sessionId);

		const historyEntry: ConversationHistory = {
			question,
			analysis,
			entities: analysis.entities,
			metrics: analysis.metrics,
			timestamp: new Date(),
		};

		context.lastQuestion = historyEntry;
		context.history.push(historyEntry);

		// Keep only last MAX_HISTORY entries
		if (context.history.length > this.MAX_HISTORY) {
			context.history = context.history.slice(-this.MAX_HISTORY);
		}
	}

	/**
	 * Merge previous context into current question analysis
	 */
	public mergeContext(sessionId: string, currentAnalysis: EnhancedQuestionAnalysis): EnhancedQuestionAnalysis {
		const context = this.getContext(sessionId);

		if (!context.lastQuestion) {
			return currentAnalysis;
		}

		const lastQuestion = context.lastQuestion;
		const currentQuestion = currentAnalysis.question.toLowerCase();

		// Detect context references
		const hasPronoun = /\b(those|that|them|it|this|these)\b/.test(currentQuestion);
		const hasTemporalReference = /\b(in|during|for)\s+(\d{4}\/\d{2}|\d{4})\b/.test(currentQuestion);
		const hasQuantityReference = /\b(how many|how much)\b/.test(currentQuestion);

		// If question has context references, merge previous context
		if (hasPronoun || hasTemporalReference || hasQuantityReference) {
			const mergedAnalysis = { ...currentAnalysis };

			// Merge entities if current question doesn't have them
			if (mergedAnalysis.entities.length === 0 && lastQuestion.entities.length > 0) {
				mergedAnalysis.entities = [...lastQuestion.entities];
			}

			// Merge metrics if current question doesn't have them
			if (mergedAnalysis.metrics.length === 0 && lastQuestion.metrics.length > 0) {
				mergedAnalysis.metrics = [...lastQuestion.metrics];
			}

			// If temporal reference exists, add it to timeRange
			if (hasTemporalReference && !mergedAnalysis.timeRange) {
				const temporalMatch = currentQuestion.match(/\b(in|during|for)\s+(\d{4}\/\d{2}|\d{4})\b/);
				if (temporalMatch) {
					mergedAnalysis.timeRange = temporalMatch[2];
				}
			}

			return mergedAnalysis;
		}

		return currentAnalysis;
	}

	/**
	 * Clear context for a session
	 */
	public clearContext(sessionId: string): void {
		this.contextStore.delete(sessionId);
	}

	/**
	 * Clean up old contexts (older than 1 hour)
	 */
	public cleanupOldContexts(): void {
		const oneHourAgo = Date.now() - 60 * 60 * 1000;

		for (const [sessionId, context] of this.contextStore.entries()) {
			if (context.lastQuestion) {
				const lastTimestamp = context.lastQuestion.timestamp.getTime();
				if (lastTimestamp < oneHourAgo) {
					this.contextStore.delete(sessionId);
				}
			}
		}
	}
}

export const conversationContextManager = ConversationContextManager.getInstance();

