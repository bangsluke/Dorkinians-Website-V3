import { neo4jService } from "../../netlify/functions/lib/neo4j.js";
import { EnhancedQuestionAnalysis } from "../config/enhancedQuestionAnalysis";

export interface UnansweredQuestionData {
	originalQuestion: string;
	correctedQuestion?: string;
	analysis: EnhancedQuestionAnalysis;
	confidence?: number;
	userContext?: string;
	timestamp?: Date;
}

export class UnansweredQuestionLogger {
	private static instance: UnansweredQuestionLogger;

	private constructor() {}

	public static getInstance(): UnansweredQuestionLogger {
		if (!UnansweredQuestionLogger.instance) {
			UnansweredQuestionLogger.instance = new UnansweredQuestionLogger();
		}
		return UnansweredQuestionLogger.instance;
	}

	/**
	 * Log an unanswered question to Neo4J (fire-and-forget, non-blocking)
	 * Stores all questions in a single UnansweredQuestions node with timestamp as key
	 */
	public async log(data: UnansweredQuestionData): Promise<void> {
		try {
			// Skip logging if running under test:chatbot-report or test:questions-report npm commands
			const npmLifecycleEvent = process.env.npm_lifecycle_event;
			if (npmLifecycleEvent === "test:chatbot-report" || npmLifecycleEvent === "test:questions-report") {
				return;
			}

			const timestamp = data.timestamp || new Date();
			const timestampKey = timestamp.toISOString();
			const questionText = data.originalQuestion;

			// First, get the current node to merge the new question
			const getQuery = `
				MATCH (uq:UnansweredQuestions {id: $id, graphLabel: $graphLabel})
				RETURN uq.questions as questions
			`;

			const existingResult = await neo4jService.executeQuery(getQuery, {
				id: "unanswered_questions",
				graphLabel: "dorkiniansWebsite",
			});

			let questionsMap: Record<string, string> = {};
			if (existingResult && existingResult.length > 0 && existingResult[0]?.questions) {
				// Parse existing questions (stored as JSON string in Neo4j)
				const questionsData = existingResult[0].questions;
				if (typeof questionsData === "string") {
					questionsMap = JSON.parse(questionsData);
				} else if (typeof questionsData === "object") {
					questionsMap = questionsData;
				}
			}

			// Add new question with timestamp as key
			questionsMap[timestampKey] = questionText;

			// Update or create the node
			const updateQuery = `
				MERGE (uq:UnansweredQuestions {id: $id, graphLabel: $graphLabel})
				ON CREATE SET 
					uq.id = $id,
					uq.graphLabel = $graphLabel,
					uq.questions = $questions
				ON MATCH SET
					uq.questions = $questions
				RETURN uq
			`;

			await neo4jService.executeQuery(updateQuery, {
				id: "unanswered_questions",
				graphLabel: "dorkiniansWebsite",
				questions: JSON.stringify(questionsMap),
			});
		} catch (error) {
			console.error("❌ Failed to log unanswered question:", error);
		}
	}

	/**
	 * Get all unanswered questions from the single node
	 * Returns array of { timestamp, question } objects sorted by timestamp (newest first)
	 */
	public async getUnansweredQuestions(): Promise<Array<{ timestamp: string; question: string }>> {
		try {
			const query = `
				MATCH (uq:UnansweredQuestions {id: $id, graphLabel: $graphLabel})
				RETURN uq.questions as questions
			`;

			const results = await neo4jService.executeQuery(query, {
				id: "unanswered_questions",
				graphLabel: "dorkiniansWebsite",
			});

			if (!results || results.length === 0 || !results[0]?.questions) {
				return [];
			}

			const questionsData = results[0].questions;
			let questionsMap: Record<string, string> = {};

			if (typeof questionsData === "string") {
				questionsMap = JSON.parse(questionsData);
			} else if (typeof questionsData === "object") {
				questionsMap = questionsData;
			}

			// Convert map to array and sort by timestamp (newest first)
			const questionsArray = Object.entries(questionsMap)
				.map(([timestamp, question]) => ({
					timestamp,
					question: question as string,
				}))
				.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

			return questionsArray;
		} catch (error) {
			console.error("❌ Failed to get unanswered questions:", error);
			throw error;
		}
	}

	/**
	 * Clear all questions from the UnansweredQuestions node
	 */
	public async clearAllQuestions(): Promise<void> {
		try {
			const query = `
				MATCH (uq:UnansweredQuestions {id: $id, graphLabel: $graphLabel})
				SET uq.questions = $emptyQuestions
				RETURN uq
			`;

			await neo4jService.executeQuery(query, {
				id: "unanswered_questions",
				graphLabel: "dorkiniansWebsite",
				emptyQuestions: JSON.stringify({}),
			});
		} catch (error) {
			console.error("❌ Failed to clear unanswered questions:", error);
			throw error;
		}
	}
}

export const unansweredQuestionLogger = UnansweredQuestionLogger.getInstance();

