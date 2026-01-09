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
	pendingClarification?: {
		originalQuestion: string;
		clarificationType: string;
		timestamp: Date;
		originalAnalysis?: EnhancedQuestionAnalysis;
		partialName?: string;
		userContext?: string;
	};
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

		// Store pending clarification if analysis requires clarification
		// Only set if not already set (preserve existing pending clarification from setPendingClarification)
		if (analysis.requiresClarification && analysis.type === "clarification_needed" && !context.pendingClarification) {
			// Extract partial name from clarification message if it's a partial name clarification
			let partialName: string | undefined = undefined;
			const clarificationMsg = analysis.clarificationMessage || analysis.message || "";
			if (clarificationMsg.includes("Please provide clarification on who")) {
				const match = clarificationMsg.match(/who (\w+) is/);
				if (match) {
					partialName = match[1];
				}
			}
			
			// Extract userContext from analysis if available (stored in extractionResult or elsewhere)
			const userContext = (analysis as any).userContext || undefined;
			context.pendingClarification = {
				originalQuestion: question,
				clarificationType: clarificationMsg || "general",
				timestamp: new Date(),
				originalAnalysis: analysis,
				partialName: partialName,
				userContext: userContext,
			};
		} else if (!analysis.requiresClarification || analysis.type !== "clarification_needed") {
			// Clear pending clarification when a non-clarification question is successfully processed
			context.pendingClarification = undefined;
		}
	}

	/**
	 * Get pending clarification for a session
	 */
	public getPendingClarification(sessionId: string): { originalQuestion: string; clarificationType: string; timestamp: Date; originalAnalysis?: EnhancedQuestionAnalysis; partialName?: string; userContext?: string } | undefined {
		const context = this.getContext(sessionId);
		return context.pendingClarification;
	}

	/**
	 * Set pending clarification for a session
	 */
	public setPendingClarification(sessionId: string, originalQuestion: string, clarificationMessage?: string, originalAnalysis?: EnhancedQuestionAnalysis, partialName?: string, userContext?: string): void {
		const context = this.getContext(sessionId);
		context.pendingClarification = {
			originalQuestion,
			clarificationType: clarificationMessage || "general",
			timestamp: new Date(),
			originalAnalysis: originalAnalysis,
			partialName: partialName,
			userContext: userContext,
		};
	}

	/**
	 * Clear pending clarification for a session
	 */
	public clearPendingClarification(sessionId: string): void {
		const context = this.getContext(sessionId);
		context.pendingClarification = undefined;
	}

	/**
	 * Merge previous context into current question analysis
	 */
	public async mergeContext(sessionId: string, currentAnalysis: EnhancedQuestionAnalysis): Promise<EnhancedQuestionAnalysis> {
		const context = this.getContext(sessionId);

		// Check if there's a pending clarification that needs to be merged
		const pendingClarification = context.pendingClarification;
		if (pendingClarification && pendingClarification.originalAnalysis) {
			// Check if current question looks like a player name clarification (single or two-word name)
			const currentQuestion = currentAnalysis.question.trim();
			const words = currentQuestion.split(/\s+/);
			const isLikelyPlayerName = words.length <= 3 && words.length >= 1 && 
				words.every(word => /^[A-Z][a-z]+$/.test(word) || /^[A-Z]\.$/.test(word)); // Capitalized words or initials
			
			if (isLikelyPlayerName && pendingClarification.partialName) {
				// This is a follow-up with a full player name to replace the partial name
				const fullPlayerName = currentQuestion;
				const originalQuestion = pendingClarification.originalQuestion;
				
				// Replace the partial name in the original question with the full name
				const partialNameLower = pendingClarification.partialName.toLowerCase();
				const originalQuestionLower = originalQuestion.toLowerCase();
				const partialNameIndex = originalQuestionLower.indexOf(partialNameLower);
				
				if (partialNameIndex !== -1) {
					// Replace the partial name with the full name, preserving case of surrounding text
					const beforePartial = originalQuestion.substring(0, partialNameIndex);
					const afterPartial = originalQuestion.substring(partialNameIndex + pendingClarification.partialName.length);
					const mergedQuestion = beforePartial + fullPlayerName + afterPartial;
					
					// Create merged analysis with the original analysis structure but updated question
					// Re-analyze the merged question to get correct entities and type (not clarification_needed)
					const { EnhancedQuestionAnalyzer } = await import("../config/enhancedQuestionAnalysis");
					// Get userContext from pending clarification or current analysis
					const userContext = pendingClarification.userContext || 
						(currentAnalysis as any).userContext || undefined;
					const analyzer = new EnhancedQuestionAnalyzer(mergedQuestion, userContext);
					const reanalyzedAnalysis = await analyzer.analyze();
					
					// Clear the pending clarification since we've merged it
					context.pendingClarification = undefined;
					
					return reanalyzedAnalysis;
				}
			}
		}

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

