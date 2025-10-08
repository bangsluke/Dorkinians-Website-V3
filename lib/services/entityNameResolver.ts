import * as natural from "natural";
import { neo4jService } from "../../netlify/functions/lib/neo4j.js";

export interface EntityMatch {
	entityName: string;
	confidence: number;
	originalInput: string;
	entityType: "player" | "team" | "opposition" | "league" | "stat_type";
}

export interface EntityResolutionResult {
	exactMatch?: string;
	fuzzyMatches: EntityMatch[];
	suggestions: string[];
	allEntities: string[];
	entityType: "player" | "team" | "opposition" | "league" | "stat_type";
}

export class EntityNameResolver {
	private static instance: EntityNameResolver;
	private entityCache: Map<string, { entities: string[]; timestamp: number }> = new Map();
	private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
	private readonly MIN_CONFIDENCE = 0.6; // Minimum confidence for fuzzy matches
	private readonly MAX_SUGGESTIONS = 3;

	private constructor() {}

	public static getInstance(): EntityNameResolver {
		if (!EntityNameResolver.instance) {
			EntityNameResolver.instance = new EntityNameResolver();
		}
		return EntityNameResolver.instance;
	}

	/**
	 * Resolve any entity name input to the best matching entity in the database
	 */
	public async resolveEntityName(
		input: string,
		entityType: "player" | "team" | "opposition" | "league" | "stat_type",
	): Promise<EntityResolutionResult> {
		// Normalize input
		const normalizedInput = this.normalizeEntityName(input);

		// Get all entities from database
		const allEntities = await this.getAllEntities(entityType);

		// Check for exact match first
		const exactMatch = this.findExactMatch(normalizedInput, allEntities);
		if (exactMatch) {
			return {
				exactMatch,
				fuzzyMatches: [],
				suggestions: [],
				allEntities,
				entityType,
			};
		}

		// Find fuzzy matches
		const fuzzyMatches = this.findFuzzyMatches(normalizedInput, allEntities, entityType);

		// Generate suggestions
		const suggestions = this.generateSuggestions(normalizedInput, allEntities);

		return {
			exactMatch: undefined,
			fuzzyMatches,
			suggestions,
			allEntities,
			entityType,
		};
	}

	/**
	 * Get all entities of a specific type from the database
	 */
	private async getAllEntities(entityType: "player" | "team" | "opposition" | "league" | "stat_type"): Promise<string[]> {
		const cacheKey = entityType;
		const now = Date.now();

		// Return cached data if still valid
		const cached = this.entityCache.get(cacheKey);
		if (cached && now - cached.timestamp < this.CACHE_TTL) {
			return cached.entities;
		}

		try {
			let query = "";
			let propertyName = "";

			switch (entityType) {
				case "player":
					query = `
						MATCH (p:Player)
						WHERE p.graphLabel = "dorkiniansWebsite"
						RETURN DISTINCT p.playerName as entityName
						ORDER BY p.playerName
					`;
					propertyName = "entityName";
					break;
				case "team":
					query = `
						MATCH (t:Team)
						WHERE t.graphLabel = "dorkiniansWebsite"
						RETURN DISTINCT t.teamName as entityName
						ORDER BY t.teamName
					`;
					propertyName = "entityName";
					break;
				case "opposition":
					query = `
						MATCH (o:Opposition)
						WHERE o.graphLabel = "dorkiniansWebsite"
						RETURN DISTINCT o.oppositionName as entityName
						ORDER BY o.oppositionName
					`;
					propertyName = "entityName";
					break;
				case "league":
					query = `
						MATCH (l:League)
						WHERE l.graphLabel = "dorkiniansWebsite"
						RETURN DISTINCT l.leagueName as entityName
						ORDER BY l.leagueName
					`;
					propertyName = "entityName";
					break;
				case "stat_type":
					// For stat types, return the stat type names from config
					const statTypeNames = [
						"Apps",
						"Minutes",
						"Man of the Match",
						"Goals",
						"Open Play Goals",
						"Assists",
						"Yellow Cards",
						"Red Cards",
						"Saves",
						"Own Goals",
						"Goals Conceded",
						"Clean Sheets",
						"Penalties Scored",
						"Penalties Missed",
						"Penalties Conceded",
						"Penalties Saved",
						"Fantasy Points",
						"Goal Involvements",
						"Goals Per Appearance",
						"Conceded Per Appearance",
						"Minutes Per Goal",
						"Team of the Week",
						"Season Team of the Week",
						"Player of the Month",
						"Captain",
						"Captain Awards",
						"Home",
						"Away",
					];
					this.entityCache.set(cacheKey, { entities: statTypeNames, timestamp: now });
					return statTypeNames;
			}

			const result = await neo4jService.executeQuery(query, {});

			if (result && Array.isArray(result)) {
				const entities = result.map((row) => row[propertyName]).filter((name) => name);
				this.entityCache.set(cacheKey, { entities, timestamp: now });
				return entities;
			}
		} catch (error) {
			console.error(`Error fetching ${entityType} entities from database:`, error);
		}

		// Fallback to empty array if database query fails
		return [];
	}

	/**
	 * Normalize entity name input for better matching
	 */
	private normalizeEntityName(input: string): string {
		return input
			.trim()
			.replace(/\s+/g, " ") // Normalize whitespace
			.replace(/[^\w\s]/g, "") // Remove special characters except spaces
			.toLowerCase();
	}

	/**
	 * Find exact match for entity name
	 */
	private findExactMatch(input: string, entities: string[]): string | undefined {
		// Check for exact match (case insensitive)
		const exactMatch = entities.find((entity) => entity.toLowerCase() === input.toLowerCase());

		if (exactMatch) {
			return exactMatch;
		}

		// Check for exact match with normalized input
		const normalizedMatch = entities.find((entity) => this.normalizeEntityName(entity) === input);

		return normalizedMatch;
	}

	/**
	 * Find fuzzy matches using multiple algorithms
	 */
	private findFuzzyMatches(
		input: string,
		entities: string[],
		entityType: "player" | "team" | "opposition" | "league" | "stat_type",
	): EntityMatch[] {
		const matches: EntityMatch[] = [];

		for (const entity of entities) {
			const normalizedEntity = this.normalizeEntityName(entity);

			// Use Jaro-Winkler distance (good for names)
			const jaroWinklerDistance = natural.JaroWinklerDistance(input, normalizedEntity);

			// Use Levenshtein distance
			const levenshteinDistance = natural.LevenshteinDistance(input, normalizedEntity);
			const maxLength = Math.max(input.length, normalizedEntity.length);
			const levenshteinSimilarity = maxLength > 0 ? 1 - levenshteinDistance / maxLength : 0;

			// Use Dice coefficient for partial matches
			const diceCoefficient = this.calculateDiceCoefficient(input, normalizedEntity);

			// Combine scores with weights
			const combinedScore = jaroWinklerDistance * 0.4 + levenshteinSimilarity * 0.4 + diceCoefficient * 0.2;

			if (combinedScore >= this.MIN_CONFIDENCE) {
				matches.push({
					entityName: entity,
					confidence: combinedScore,
					originalInput: input,
					entityType,
				});
			}
		}

		// Sort by confidence (highest first) and limit results
		return matches.sort((a, b) => b.confidence - a.confidence).slice(0, this.MAX_SUGGESTIONS);
	}

	/**
	 * Calculate Dice coefficient for partial string matching
	 */
	private calculateDiceCoefficient(str1: string, str2: string): number {
		const bigrams1 = this.getBigrams(str1);
		const bigrams2 = this.getBigrams(str2);

		const intersection = bigrams1.filter((bigram) => bigrams2.includes(bigram));
		const unionSet = new Set([...bigrams1, ...bigrams2]);
		const union = Array.from(unionSet);

		return union.length > 0 ? (2 * intersection.length) / union.length : 0;
	}

	/**
	 * Get bigrams (2-character sequences) from a string
	 */
	private getBigrams(str: string): string[] {
		const bigrams: string[] = [];
		for (let i = 0; i < str.length - 1; i++) {
			bigrams.push(str.substring(i, i + 2));
		}
		return bigrams;
	}

	/**
	 * Generate suggestions for similar entity names
	 */
	private generateSuggestions(input: string, entities: string[]): string[] {
		const suggestions: string[] = [];

		// Find entities that start with the same letters
		const startsWithMatches = entities.filter(
			(entity) => entity.toLowerCase().startsWith(input.toLowerCase()) || input.toLowerCase().startsWith(entity.toLowerCase()),
		);

		suggestions.push(...startsWithMatches.slice(0, this.MAX_SUGGESTIONS));

		// If we don't have enough suggestions, add partial matches
		if (suggestions.length < this.MAX_SUGGESTIONS) {
			const partialMatches = entities.filter(
				(entity) => entity.toLowerCase().includes(input.toLowerCase()) || input.toLowerCase().includes(entity.toLowerCase()),
			);

			const additionalSuggestions = partialMatches
				.filter((entity) => !suggestions.includes(entity))
				.slice(0, this.MAX_SUGGESTIONS - suggestions.length);

			suggestions.push(...additionalSuggestions);
		}

		return suggestions.slice(0, this.MAX_SUGGESTIONS);
	}

	/**
	 * Get the best match for an entity name input
	 */
	public async getBestMatch(input: string, entityType: "player" | "team" | "opposition" | "league" | "stat_type"): Promise<string | null> {
		const result = await this.resolveEntityName(input, entityType);

		if (result.exactMatch) {
			return result.exactMatch;
		}

		if (result.fuzzyMatches.length > 0) {
			return result.fuzzyMatches[0].entityName;
		}

		return null;
	}

	/**
	 * Check if an entity name exists (exact or fuzzy match)
	 */
	public async entityExists(input: string, entityType: "player" | "team" | "opposition" | "league" | "stat_type"): Promise<boolean> {
		const result = await this.resolveEntityName(input, entityType);
		return !!(result.exactMatch || result.fuzzyMatches.length > 0);
	}

	/**
	 * Clear the entity cache (useful for testing or when entities are added)
	 */
	public clearCache(): void {
		this.entityCache.clear();
	}

	/**
	 * Clear cache for a specific entity type
	 */
	public clearCacheForType(entityType: "player" | "team" | "opposition" | "league"): void {
		this.entityCache.delete(entityType);
	}
}
