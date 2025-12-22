import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { queryProfiler } from "../queryProfiler";
import { loggingService } from "../loggingService";

export class QueryExecutionUtils {
	private static readonly ENABLE_QUERY_PROFILING = process.env.ENABLE_QUERY_PROFILING === "true";

	/**
	 * Execute a query with optional profiling for slow queries
	 */
	static async executeQueryWithProfiling(
		query: string,
		params: Record<string, unknown> = {},
	): Promise<unknown> {
		const startTime = Date.now();

		try {
			const result = await neo4jService.executeQuery(query, params);
			const executionTime = Date.now() - startTime;

			// Profile slow queries or if profiling is enabled
			if (QueryExecutionUtils.ENABLE_QUERY_PROFILING || executionTime > 1000) {
				const { profile } = await queryProfiler.executeWithProfiling(query, params, true);
				if (profile) {
					loggingService.log(
						`⏱️ Query executed in ${executionTime}ms${profile.optimizationSuggestions?.length ? ` - Suggestions: ${profile.optimizationSuggestions.join(", ")}` : ""}`,
						null,
						executionTime > 2000 ? "warn" : "log",
					);
				}
			}

			return result;
		} catch (error) {
			const executionTime = Date.now() - startTime;
			loggingService.log(`❌ Query failed after ${executionTime}ms: ${error}`, null, "error");
			throw error;
		}
	}
}
