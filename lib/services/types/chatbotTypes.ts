import type { VisualizationType } from "../../../config/config";
import type { EnhancedQuestionAnalysis } from "../../config/enhancedQuestionAnalysis";

export interface ChatbotResponse {
	answer: string;
	data?: unknown;
	visualization?: {
		type: VisualizationType;
		data: unknown;
		config?: Record<string, unknown>;
	};
	sources: string[];
	cypherQuery?: string;
	answerValue?: number | string | null;
	suggestions?: string[]; // Suggested similar questions when chatbot fails
	debug?: {
		question?: string;
		userContext?: string;
		timestamp?: string;
		serverLogs?: string;
		processingDetails?: {
			questionAnalysis?: EnhancedQuestionAnalysis | null;
			cypherQueries?: string[];
			processingSteps?: string[];
			queryBreakdown?: Record<string, unknown> | null;
			error?: string;
			errorStack?: string;
		};
	};
}

export interface QuestionContext {
	question: string;
	userContext?: string;
	dataSources?: string[];
	sessionId?: string;
	conversationHistory?: Array<{
		question: string;
		entities: string[];
		metrics: string[];
		timestamp: string;
	}>;
}

export interface ProcessingDetails {
	questionAnalysis: EnhancedQuestionAnalysis | null;
	cypherQueries: string[];
	processingSteps: string[];
	queryBreakdown: Record<string, unknown> | null;
}

// Specific interfaces for better type safety
export interface PlayerData {
	playerName: string;
	value: number | string;
	[key: string]: unknown;
}

export interface TeamData {
	teamName: string;
	value: number | string;
	[key: string]: unknown;
}

export interface StreakData {
	date: string;
	goals?: number;
	assists?: number;
	[key: string]: unknown;
}

export interface CoPlayerData {
	coPlayerName: string;
	gamesPlayedTogether: number;
	[key: string]: unknown;
}

export interface OpponentData {
	opponent: string;
	gamesPlayed: number;
	[key: string]: unknown;
}

export interface RankingData {
	playerName?: string;
	teamName?: string;
	value: number;
	[key: string]: unknown;
}
