import { createHash, randomUUID } from "crypto";
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
	 * Generate SHA-256 hash of normalized question for deduplication
	 */
	private generateQuestionHash(question: string): string {
		const normalized = question.toLowerCase().trim().replace(/\s+/g, " ");
		return createHash("sha256").update(normalized).digest("hex");
	}

	/**
	 * Log an unanswered question to Neo4J (fire-and-forget, non-blocking)
	 */
	public async log(data: UnansweredQuestionData): Promise<void> {
		try {
			const questionHash = this.generateQuestionHash(data.originalQuestion);
			const id = randomUUID();
			const timestamp = data.timestamp || new Date();

			const nodeProperties = {
				id,
				questionHash,
				originalQuestion: data.originalQuestion,
				correctedQuestion: data.correctedQuestion || null,
				analysis: JSON.stringify({
					type: data.analysis.type,
					entities: data.analysis.entities,
					metrics: data.analysis.metrics,
					complexity: data.analysis.complexity,
					requiresClarification: data.analysis.requiresClarification,
				}),
				confidence: data.confidence ?? (data.analysis.complexity === "complex" ? 0.3 : data.analysis.complexity === "moderate" ? 0.6 : 0.8),
				timestamp: timestamp.toISOString(),
				userContext: data.userContext || null,
				handled: false,
				graphLabel: "dorkiniansWebsite",
			};

			const query = `
				MERGE (uq:UnansweredQuestion {questionHash: $questionHash, graphLabel: $graphLabel})
				ON CREATE SET 
					uq.id = $id,
					uq.originalQuestion = $originalQuestion,
					uq.correctedQuestion = $correctedQuestion,
					uq.analysis = $analysis,
					uq.confidence = $confidence,
					uq.timestamp = datetime($timestamp),
					uq.userContext = $userContext,
					uq.handled = $handled,
					uq.graphLabel = $graphLabel
				ON MATCH SET
					uq.timestamp = datetime($timestamp),
					uq.count = COALESCE(uq.count, 0) + 1
				RETURN uq
			`;

			await neo4jService.executeQuery(query, {
				...nodeProperties,
				timestamp: timestamp.toISOString(),
			});
		} catch (error) {
			console.error("❌ Failed to log unanswered question:", error);
		}
	}

	/**
	 * Get all unanswered questions with optional filters
	 */
	public async getUnansweredQuestions(filters?: {
		handled?: boolean;
		confidenceMin?: number;
		confidenceMax?: number;
		dateFrom?: Date;
		dateTo?: Date;
		limit?: number;
		offset?: number;
	}): Promise<any[]> {
		try {
			const whereClauses: string[] = ['uq.graphLabel = $graphLabel'];
			const params: any = { graphLabel: "dorkiniansWebsite" };

			if (filters?.handled !== undefined) {
				whereClauses.push("uq.handled = $handled");
				params.handled = filters.handled;
			}

			if (filters?.confidenceMin !== undefined) {
				whereClauses.push("uq.confidence >= $confidenceMin");
				params.confidenceMin = filters.confidenceMin;
			}

			if (filters?.confidenceMax !== undefined) {
				whereClauses.push("uq.confidence <= $confidenceMax");
				params.confidenceMax = filters.confidenceMax;
			}

			if (filters?.dateFrom) {
				whereClauses.push("uq.timestamp >= datetime($dateFrom)");
				params.dateFrom = filters.dateFrom.toISOString();
			}

			if (filters?.dateTo) {
				whereClauses.push("uq.timestamp <= datetime($dateTo)");
				params.dateTo = filters.dateTo.toISOString();
			}

			const limit = filters?.limit || 100;
			const offset = filters?.offset || 0;

			const query = `
				MATCH (uq:UnansweredQuestion)
				WHERE ${whereClauses.join(" AND ")}
				RETURN uq
				ORDER BY uq.timestamp DESC
				SKIP $offset
				LIMIT $limit
			`;

			params.offset = offset;
			params.limit = limit;

			const results = await neo4jService.executeQuery(query, params);
			return results.map((record: any) => {
				const uq = record.uq.properties || record.uq;
				return {
					id: uq.id,
					questionHash: uq.questionHash,
					originalQuestion: uq.originalQuestion,
					correctedQuestion: uq.correctedQuestion,
					analysis: typeof uq.analysis === "string" ? JSON.parse(uq.analysis) : uq.analysis,
					confidence: uq.confidence,
					timestamp: uq.timestamp,
					userContext: uq.userContext,
					handled: uq.handled,
					count: uq.count || 1,
				};
			});
		} catch (error) {
			console.error("❌ Failed to get unanswered questions:", error);
			throw error;
		}
	}

	/**
	 * Mark a question as handled
	 */
	public async markAsHandled(questionHash: string): Promise<void> {
		try {
			const query = `
				MATCH (uq:UnansweredQuestion {questionHash: $questionHash, graphLabel: $graphLabel})
				SET uq.handled = true
				RETURN uq
			`;

			await neo4jService.executeQuery(query, {
				questionHash,
				graphLabel: "dorkiniansWebsite",
			});
		} catch (error) {
			console.error("❌ Failed to mark question as handled:", error);
			throw error;
		}
	}

	/**
	 * Delete handled questions older than specified days
	 */
	public async deleteHandledQuestions(olderThanDays: number = 30): Promise<number> {
		try {
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

			const query = `
				MATCH (uq:UnansweredQuestion {graphLabel: $graphLabel})
				WHERE uq.handled = true AND uq.timestamp < datetime($cutoffDate)
				DELETE uq
				RETURN count(uq) as deleted
			`;

			const results = await neo4jService.executeQuery(query, {
				graphLabel: "dorkiniansWebsite",
				cutoffDate: cutoffDate.toISOString(),
			});

			return results[0]?.deleted || 0;
		} catch (error) {
			console.error("❌ Failed to delete handled questions:", error);
			throw error;
		}
	}
}

export const unansweredQuestionLogger = UnansweredQuestionLogger.getInstance();

