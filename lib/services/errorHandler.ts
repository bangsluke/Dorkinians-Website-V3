import { EntityNameResolver } from "./entityNameResolver";
import { EnhancedQuestionAnalysis } from "../config/enhancedQuestionAnalysis";
import { allExampleQuestions } from "@/config/config";

export interface ErrorSuggestion {
	type: "entity_not_found" | "invalid_metric" | "query_failed" | "ambiguous_query";
	message: string;
	suggestions: string[];
	originalError?: string;
}

export class ErrorHandler {
	private static instance: ErrorHandler;
	private entityResolver: EntityNameResolver;

	private constructor() {
		this.entityResolver = EntityNameResolver.getInstance();
	}

	public static getInstance(): ErrorHandler {
		if (!ErrorHandler.instance) {
			ErrorHandler.instance = new ErrorHandler();
		}
		return ErrorHandler.instance;
	}

	/**
	 * Handle entity not found errors with suggestions
	 */
	async handleEntityNotFound(
		entityName: string,
		entityType: "player" | "team" | "opposition" | "league",
		analysis?: EnhancedQuestionAnalysis,
	): Promise<ErrorSuggestion> {
		// Get suggestions from entity resolver
		const resolutionResult = await this.entityResolver.resolveEntityName(entityName, entityType);
		const suggestions = resolutionResult.suggestions.slice(0, 3);

		// More specific and actionable message
		let message = `We couldn't find a ${entityType} named "${entityName}" in our database.`;
		
		if (suggestions.length > 0) {
			message += ` Did you mean ${suggestions[0]}${suggestions.length > 1 ? `, ${suggestions[1]}` : ""}${suggestions.length > 2 ? `, or ${suggestions[2]}` : ""}?`;
			message += ` Please check the spelling or try one of these suggestions.`;
		} else {
			message += ` This might be because: the name is misspelled, the ${entityType} isn't in our records, or you're using a nickname.`;
			message += ` Please check the spelling or try searching for a similar name.`;
		}

		return {
			type: "entity_not_found",
			message,
			suggestions,
		};
	}

	/**
	 * Handle invalid metric errors with available metrics
	 */
	async handleInvalidMetric(
		metric: string,
		entityName?: string,
		analysis?: EnhancedQuestionAnalysis,
	): Promise<ErrorSuggestion> {
		// Get valid metrics for the entity type
		const validMetrics = await this.getValidMetricsForEntity(entityName, analysis);

		// More specific and actionable message
		let message = `We couldn't find a statistic called "${metric}".`;
		if (validMetrics.length > 0) {
			message += ` Available statistics for ${entityName || "this entity"} include: ${validMetrics.slice(0, 5).join(", ")}.`;
			message += ` Try asking about one of these instead.`;
		} else {
			message += ` Please try using a different statistic name or rephrase your question.`;
		}

		return {
			type: "invalid_metric",
			message,
			suggestions: validMetrics.slice(0, 5),
		};
	}

	/**
	 * Handle query execution failures
	 */
	handleQueryFailed(error: Error, query?: string): ErrorSuggestion {
		let message = "We encountered an error while processing your question.";
		let suggestions: string[] = [];

		// Provide more specific error messages based on error type
		if (error.message.includes("timeout") || error.message.includes("time out")) {
			message = "This query is taking longer than expected to process.";
			message += " This usually happens when the question is very complex or requests a lot of data.";
			message += " Try narrowing your question by: filtering by a specific season, asking about fewer players, or breaking it into smaller parts.";
			suggestions = [
				"Filter by a specific season (e.g., 'this season' or '2023-24')",
				"Ask about fewer players or teams at once",
				"Simplify your question or break it into smaller parts",
			];
		} else if (error.message.includes("syntax") || error.message.includes("SyntaxError")) {
			message = "There was an error processing your question.";
			message += " This might be because the question format isn't recognized.";
			message += " Try rephrasing your question using simpler language or check that all names are spelled correctly.";
			suggestions = [
				"Rephrase your question using simpler language",
				"Check that all player, team, or entity names are spelled correctly",
				"Try asking about one thing at a time",
			];
		} else if (error.message.includes("not found") || error.message.includes("does not exist")) {
			message = "The requested information was not found in the database.";
			message += " This could mean: the player/team doesn't exist in our records, the name is misspelled, or the data isn't available.";
			message += " Please check your question and try again with a different name or rephrased question.";
			suggestions = [
				"Check that all names are spelled correctly",
				"Try searching for a similar name",
				"Rephrase your question with different wording",
			];
		} else {
			message += " This might be due to a temporary issue or an unrecognized question format.";
			message += " Please try rephrasing your question or check that all names are spelled correctly.";
			suggestions = [
				"Try rephrasing your question",
				"Check that all names are spelled correctly",
				"Simplify your question if it's complex",
			];
		}

		return {
			type: "query_failed",
			message,
			suggestions,
			originalError: error.message,
		};
	}

	/**
	 * Handle ambiguous queries
	 */
	handleAmbiguousQuery(analysis: EnhancedQuestionAnalysis): ErrorSuggestion {
		const suggestions: string[] = [];
		let message = "Your question needs more clarity to provide an accurate answer.";

		if (analysis.entities.length === 0) {
			suggestions.push("Specify which player, team, or entity you're asking about (e.g., 'Luke Bangs', '1st Team')");
			message += " Please specify which player, team, or entity you're asking about.";
		}

		if (analysis.metrics.length === 0) {
			suggestions.push("Specify what statistic you want (e.g., 'goals', 'appearances', 'assists')");
			if (!message.includes("Please specify")) {
				message += " Please specify what statistic you want to know (e.g., goals, appearances, assists).";
			} else {
				message += " Also specify what statistic you want to know (e.g., goals, appearances, assists).";
			}
		}

		if (analysis.entities.length > 3) {
			suggestions.push("Limit your question to 3 or fewer players/teams at once");
			message += " Please limit your question to 3 or fewer entities at once for better results.";
		}

		if (analysis.metrics.length > 3) {
			suggestions.push("Limit your question to 3 or fewer statistics at once");
			message += " Please limit your question to 3 or fewer statistics at once.";
		}

		return {
			type: "ambiguous_query",
			message: analysis.clarificationMessage || message,
			suggestions,
		};
	}

	/**
	 * Get valid metrics for an entity
	 */
	private async getValidMetricsForEntity(
		entityName?: string,
		analysis?: EnhancedQuestionAnalysis,
	): Promise<string[]> {
		// Common metrics available for most entities
		const commonMetrics = [
			"Goals",
			"Assists",
			"Appearances",
			"Minutes",
			"Yellow Cards",
			"Red Cards",
			"Clean Sheets",
			"Saves",
		];

		// If we have entity type information, we can be more specific
		if (analysis) {
			if (analysis.type === "player") {
				return [
					...commonMetrics,
					"Goals Per Appearance",
					"Assists Per Appearance",
					"Man of the Match",
					"Fantasy Points",
					"Distance Travelled",
				];
			} else if (analysis.type === "team") {
				return [
					"Games Played",
					"Wins",
					"Draws",
					"Losses",
					"Goals Scored",
					"Goals Conceded",
					"Win Percentage",
				];
			}
		}

		return commonMetrics;
	}

	/**
	 * Get similar questions based on original question and error type
	 */
	getSimilarQuestions(question: string, errorType?: string): string[] {
		if (!question || question.trim().length === 0) {
			return allExampleQuestions.slice(0, 5);
		}

		const questionLower = question.toLowerCase().trim();
		const questionWords = questionLower.split(/\s+/).filter(word => word.length > 2);

		// Score questions based on keyword matches
		const scoredQuestions = allExampleQuestions
			.filter(example => {
				// Filter out the current question (case-insensitive comparison)
				const exampleLower = example.toLowerCase().trim();
				return exampleLower !== questionLower;
			})
			.map(example => {
				const exampleLower = example.toLowerCase();
				let score = 0;

				// Count matching words
				questionWords.forEach(word => {
					if (exampleLower.includes(word)) {
						score += 1;
					}
				});

				// Boost score for questions with similar structure
				if (errorType === "entity_not_found") {
					// Prefer questions about goals, appearances, stats
					if (exampleLower.includes("goal") || exampleLower.includes("appearance") || exampleLower.includes("stat")) {
						score += 0.5;
					}
				}

				return { question: example, score };
			});

		// Sort by score and return top 5
		return scoredQuestions
			.sort((a, b) => b.score - a.score)
			.filter(item => item.score > 0)
			.slice(0, 5)
			.map(item => item.question);
	}

	/**
	 * Generate a user-friendly error response with suggestions
	 */
	async generateErrorResponse(
		error: Error,
		context: {
			question?: string;
			analysis?: EnhancedQuestionAnalysis;
			entityName?: string;
			entityType?: "player" | "team" | "opposition" | "league";
			metric?: string;
		},
	): Promise<{ message: string; suggestions?: string[] }> {
		let errorType: string | undefined;
		let suggestions: string[] = [];

		// Check error type and handle accordingly
		if (error.message.includes("not found") || error.message.includes("does not exist")) {
			errorType = "entity_not_found";
			if (context.entityName && context.entityType) {
				const suggestion = await this.handleEntityNotFound(
					context.entityName,
					context.entityType,
					context.analysis,
				);
				suggestions = this.getSimilarQuestions(context.question || "", errorType);
				return { message: suggestion.message, suggestions };
			}
		}

		if (error.message.includes("metric") || error.message.includes("statistic")) {
			errorType = "invalid_metric";
			if (context.metric) {
				const suggestion = await this.handleInvalidMetric(
					context.metric,
					context.entityName,
					context.analysis,
				);
				suggestions = this.getSimilarQuestions(context.question || "", errorType);
				return { message: suggestion.message, suggestions };
			}
		}

		// Default error handling
		const suggestion = this.handleQueryFailed(error);
		suggestions = this.getSimilarQuestions(context.question || "", "query_failed");
		return { message: suggestion.message, suggestions };
	}
}

export const errorHandler = ErrorHandler.getInstance();

