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
			// Skip logging if running under test:chatbot-players-report or test:questions-report npm commands
			const npmLifecycleEvent = process.env.npm_lifecycle_event;
			if (npmLifecycleEvent === "test:chatbot-players-report" || npmLifecycleEvent === "test:questions-report") {
				return;
			}

			const timestamp = data.timestamp || new Date();
			const timestampKey = timestamp.toISOString();
			const questionText = data.originalQuestion;
			// Extract player name from userContext, use "Blank" if undefined/empty
			const playerName = data.userContext && data.userContext.trim() ? data.userContext.trim() : "Blank";

			// First, get the current node to merge the new question
			const getQuery = `
				MATCH (uq:UnansweredQuestions {id: $id, graphLabel: $graphLabel})
				RETURN uq.questions as questions
			`;

			const existingResult = await neo4jService.executeQuery(getQuery, {
				id: "unanswered_questions",
				graphLabel: "dorkiniansWebsite",
			});

			// Support both old format (string) and new format (object)
			type QuestionEntry = string | { question: string; playerName: string; timestamp: string };
			let questionsMap: Record<string, QuestionEntry> = {};
			if (existingResult && existingResult.length > 0 && existingResult[0]?.questions) {
				// Parse existing questions (stored as JSON string in Neo4j)
				const questionsData = existingResult[0].questions;
				if (typeof questionsData === "string") {
					questionsMap = JSON.parse(questionsData);
				} else if (typeof questionsData === "object") {
					questionsMap = questionsData;
				}
			}

			// Add new question with timestamp as key in new format
			questionsMap[timestampKey] = {
				question: questionText,
				playerName: playerName,
				timestamp: timestampKey,
			};

			// Update or create the node with noDelete label to prevent deletion during seeding
			const updateQuery = `
				MERGE (uq:UnansweredQuestions {id: $id, graphLabel: $graphLabel})
				ON CREATE SET 
					uq.id = $id,
					uq.graphLabel = $graphLabel,
					uq.questions = $questions,
					uq:noDelete
				ON MATCH SET
					uq.questions = $questions,
					uq:noDelete
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
	 * Returns array of { timestamp, question, playerName } objects sorted by timestamp (newest first)
	 * Handles backward compatibility with old format (string) and new format (object)
	 */
	public async getUnansweredQuestions(): Promise<Array<{ timestamp: string; question: string; playerName: string }>> {
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
			// Support both old format (string) and new format (object)
			type QuestionEntry = string | { question: string; playerName: string; timestamp: string };
			let questionsMap: Record<string, QuestionEntry> = {};

			if (typeof questionsData === "string") {
				questionsMap = JSON.parse(questionsData);
			} else if (typeof questionsData === "object") {
				questionsMap = questionsData;
			}

			// Convert map to array and handle both old and new formats
			const questionsArray = Object.entries(questionsMap)
				.map(([timestamp, entry]) => {
					// Handle old format (string) - backward compatibility
					if (typeof entry === "string") {
						return {
							timestamp,
							question: entry,
							playerName: "Blank", // Default for old format entries
						};
					}
					// Handle new format (object)
					return {
						timestamp: entry.timestamp || timestamp,
						question: entry.question,
						playerName: entry.playerName || "Blank",
					};
				})
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

	/**
	 * Clear a single question by timestamp from the UnansweredQuestions node
	 */
	public async clearQuestion(timestamp: string): Promise<void> {
		try {
			// First, get the current questions
			const getQuery = `
				MATCH (uq:UnansweredQuestions {id: $id, graphLabel: $graphLabel})
				RETURN uq.questions as questions
			`;

			const existingResult = await neo4jService.executeQuery(getQuery, {
				id: "unanswered_questions",
				graphLabel: "dorkiniansWebsite",
			});

			if (!existingResult || existingResult.length === 0 || !existingResult[0]?.questions) {
				throw new Error("No unanswered questions found");
			}

			const questionsData = existingResult[0].questions;
			type QuestionEntry = string | { question: string; playerName: string; timestamp: string };
			let questionsMap: Record<string, QuestionEntry> = {};

			if (typeof questionsData === "string") {
				questionsMap = JSON.parse(questionsData);
			} else if (typeof questionsData === "object") {
				questionsMap = questionsData;
			}

			// Remove the question with the specified timestamp
			if (!questionsMap[timestamp]) {
				throw new Error(`Question with timestamp ${timestamp} not found`);
			}

			delete questionsMap[timestamp];

			// Update the node with the modified questions
			const updateQuery = `
				MATCH (uq:UnansweredQuestions {id: $id, graphLabel: $graphLabel})
				SET uq.questions = $questions
				RETURN uq
			`;

			await neo4jService.executeQuery(updateQuery, {
				id: "unanswered_questions",
				graphLabel: "dorkiniansWebsite",
				questions: JSON.stringify(questionsMap),
			});
		} catch (error) {
			console.error("❌ Failed to clear unanswered question:", error);
			throw error;
		}
	}

	/**
	 * Ensure all existing UnansweredQuestions nodes have the noDelete label
	 * This method migrates existing nodes to include the noDelete label for protection
	 */
	public async ensureNoDeleteLabel(): Promise<void> {
		try {
			const query = `
				MATCH (uq:UnansweredQuestions {id: $id, graphLabel: $graphLabel})
				WHERE NOT uq:noDelete
				SET uq:noDelete
				RETURN count(uq) as updatedCount
			`;

			const result = await neo4jService.executeQuery(query, {
				id: "unanswered_questions",
				graphLabel: "dorkiniansWebsite",
			});

			const updatedCount = result && result.length > 0 && result[0]?.updatedCount ? result[0].updatedCount : 0;
			if (updatedCount > 0) {
				console.log(`✅ Added noDelete label to ${updatedCount} existing UnansweredQuestions node(s)`);
			}
		} catch (error) {
			console.error("❌ Failed to ensure noDelete label:", error);
			throw error;
		}
	}
}

export const unansweredQuestionLogger = UnansweredQuestionLogger.getInstance();

