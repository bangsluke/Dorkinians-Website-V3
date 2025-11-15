import { neo4jService } from "../../netlify/functions/lib/neo4j.js";

export interface QueryProfile {
	query: string;
	executionTime: number;
	dbHits?: number;
	rows?: number;
	plan?: unknown;
	optimizationSuggestions?: string[];
}

export class QueryProfiler {
	private static instance: QueryProfiler;
	private profileCache: Map<string, QueryProfile> = new Map();
	private readonly PROFILE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

	private constructor() {}

	public static getInstance(): QueryProfiler {
		if (!QueryProfiler.instance) {
			QueryProfiler.instance = new QueryProfiler();
		}
		return QueryProfiler.instance;
	}

	/**
	 * Execute a query with profiling enabled
	 */
	async executeWithProfiling(
		query: string,
		params: Record<string, unknown>,
		enableProfiling: boolean = false,
	): Promise<{ result: unknown; profile?: QueryProfile }> {
		const startTime = Date.now();

		try {
			// Execute the query
			const result = await neo4jService.executeQuery(query, params);
			const executionTime = Date.now() - startTime;

			// If profiling is enabled and query is slow, profile it
			if (enableProfiling || executionTime > 1000) {
				const profile = await this.profileQuery(query, params, executionTime);
				profile.executionTime = executionTime;
				profile.rows = Array.isArray(result) ? result.length : 1;

				// Generate optimization suggestions
				profile.optimizationSuggestions = this.generateOptimizationSuggestions(profile);

				return { result, profile };
			}

			return { result };
		} catch (error) {
			const executionTime = Date.now() - startTime;
			console.error(`Query execution failed after ${executionTime}ms:`, error);
			throw error;
		}
	}

	/**
	 * Profile a query using Neo4j's PROFILE command for slow queries, EXPLAIN for others
	 */
	private async profileQuery(query: string, params: Record<string, unknown>, executionTime?: number): Promise<QueryProfile> {
		const cacheKey = this.generateCacheKey(query, params);
		const cached = this.profileCache.get(cacheKey);
		if (cached) {
			return cached;
		}

		try {
			// Use PROFILE for slow queries (>1000ms) to get actual execution stats
			// Use EXPLAIN for faster queries to avoid double execution
			const useProfile = executionTime !== undefined && executionTime > 1000;
			const profileQuery = useProfile ? `PROFILE ${query}` : `EXPLAIN ${query}`;
			
			const profileResult = await neo4jService.executeQuery(profileQuery, params);

			// Extract dbHits from PROFILE result if available
			let dbHits: number | undefined;
			if (useProfile && Array.isArray(profileResult) && profileResult.length > 0) {
				// Try to extract dbHits from profile result
				const firstResult = profileResult[0];
				if (firstResult && typeof firstResult === 'object') {
					dbHits = (firstResult as any).dbHits || (firstResult as any).plan?.dbHits;
				}
			}

			const profile: QueryProfile = {
				query,
				executionTime: executionTime || 0,
				plan: profileResult,
				dbHits,
			};

			// Log execution plan for slow queries
			if (useProfile) {
				console.log(`🔍 PROFILE Query Plan:`, JSON.stringify(profileResult, null, 2));
				console.log(`🔍 Query: ${query.substring(0, 200)}...`);
				console.log(`🔍 Execution Time: ${executionTime}ms`);
				if (dbHits) {
					console.log(`🔍 DB Hits: ${dbHits}`);
				}
			}

			// Cache the profile
			if (this.profileCache.size < 100) {
				this.profileCache.set(cacheKey, profile);
			}

			return profile;
		} catch (error) {
			console.error("Error profiling query:", error);
			return {
				query,
				executionTime: executionTime || 0,
			};
		}
	}

	/**
	 * Generate optimization suggestions based on query profile
	 */
	private generateOptimizationSuggestions(profile: QueryProfile): string[] {
		const suggestions: string[] = [];

		if (profile.executionTime > 2000) {
			suggestions.push("Query execution time exceeds 2 seconds - consider adding indexes or optimizing the query");
		}

		if (profile.dbHits && profile.dbHits > 10000) {
			suggestions.push(`High database hits (${profile.dbHits}) - query may benefit from index optimization`);
		}

		// Check for common anti-patterns in the query
		if (profile.query.includes("OPTIONAL MATCH") && !profile.query.includes("WHERE")) {
			suggestions.push("OPTIONAL MATCH without WHERE clause may return unnecessary data");
		}

		if (profile.query.match(/MATCH.*MATCH/g)?.length && profile.query.match(/MATCH.*MATCH/g)!.length > 3) {
			suggestions.push("Multiple MATCH clauses detected - consider using relationship patterns for better performance");
		}

		return suggestions;
	}

	/**
	 * Generate cache key for query
	 */
	private generateCacheKey(query: string, params: Record<string, unknown>): string {
		const normalizedQuery = query.replace(/\s+/g, " ").trim();
		const paramsKey = JSON.stringify(params);
		return `${normalizedQuery}:${paramsKey}`;
	}

	/**
	 * Clear profile cache
	 */
	public clearCache(): void {
		this.profileCache.clear();
	}
}

export const queryProfiler = QueryProfiler.getInstance();

