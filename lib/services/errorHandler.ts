import { EntityNameResolver } from "./entityNameResolver";
import { EnhancedQuestionAnalysis } from "../config/enhancedQuestionAnalysis";

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

		let message = `I couldn't find a ${entityType} named "${entityName}" in the database.`;
		if (suggestions.length > 0) {
			message += ` Did you mean: ${suggestions.join(", ")}?`;
		} else {
			message += " Please check the spelling or try a different name.";
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

		let message = `I couldn't find a statistic called "${metric}".`;
		if (validMetrics.length > 0) {
			message += ` Available statistics include: ${validMetrics.slice(0, 5).join(", ")}.`;
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
		let message = "I encountered an error while processing your question.";

		// Provide more specific error messages based on error type
		if (error.message.includes("timeout") || error.message.includes("time out")) {
			message = "Your query took too long to process. Please try simplifying your question or breaking it into smaller parts.";
		} else if (error.message.includes("syntax") || error.message.includes("SyntaxError")) {
			message = "There was an error in the query syntax. Please try rephrasing your question.";
		} else if (error.message.includes("not found") || error.message.includes("does not exist")) {
			message = "The requested information was not found in the database. Please check your question and try again.";
		}

		return {
			type: "query_failed",
			message,
			suggestions: [
				"Try rephrasing your question",
				"Check that all names are spelled correctly",
				"Simplify your question if it's complex",
			],
			originalError: error.message,
		};
	}

	/**
	 * Handle ambiguous queries
	 */
	handleAmbiguousQuery(analysis: EnhancedQuestionAnalysis): ErrorSuggestion {
		const suggestions: string[] = [];

		if (analysis.entities.length === 0) {
			suggestions.push("Please specify which player, team, or entity you're asking about");
		}

		if (analysis.metrics.length === 0) {
			suggestions.push("Please specify what statistic you want to know (e.g., goals, appearances, assists)");
		}

		if (analysis.entities.length > 3) {
			suggestions.push("Please limit your question to 3 or fewer entities at once");
		}

		if (analysis.metrics.length > 3) {
			suggestions.push("Please limit your question to 3 or fewer statistics at once");
		}

		return {
			type: "ambiguous_query",
			message: analysis.clarificationMessage || "Your question needs more clarity. " + suggestions.join(". "),
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
	 * Generate a user-friendly error response
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
	): Promise<string> {
		// Check error type and handle accordingly
		if (error.message.includes("not found") || error.message.includes("does not exist")) {
			if (context.entityName && context.entityType) {
				const suggestion = await this.handleEntityNotFound(
					context.entityName,
					context.entityType,
					context.analysis,
				);
				return suggestion.message;
			}
		}

		if (error.message.includes("metric") || error.message.includes("statistic")) {
			if (context.metric) {
				const suggestion = await this.handleInvalidMetric(
					context.metric,
					context.entityName,
					context.analysis,
				);
				return suggestion.message;
			}
		}

		// Default error handling
		const suggestion = this.handleQueryFailed(error);
		return suggestion.message;
	}
}

export const errorHandler = ErrorHandler.getInstance();

