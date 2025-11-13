import * as natural from "natural";
import { EntityNameResolver } from "./entityNameResolver";

export interface SpellingCorrection {
	original: string;
	corrected: string;
	confidence: number;
}

export class SpellingCorrector {
	private static instance: SpellingCorrector;
	private entityResolver: EntityNameResolver;
	private dictionary: Set<string> = new Set();
	private dictionaryLoaded: boolean = false;

	private constructor() {
		this.entityResolver = EntityNameResolver.getInstance();
	}

	public static getInstance(): SpellingCorrector {
		if (!SpellingCorrector.instance) {
			SpellingCorrector.instance = new SpellingCorrector();
		}
		return SpellingCorrector.instance;
	}

	/**
	 * Load dictionary from database entities and common terms
	 */
	private async loadDictionary(): Promise<void> {
		if (this.dictionaryLoaded) return;

		try {
			// Use entity resolver to get entities by attempting resolution
			// The resolver will cache entities internally
			const playerResult = await this.entityResolver.resolveEntityName("test", "player").catch(() => ({ allEntities: [] }));
			const teamResult = await this.entityResolver.resolveEntityName("test", "team").catch(() => ({ allEntities: [] }));
			const oppositionResult = await this.entityResolver.resolveEntityName("test", "opposition").catch(() => ({ allEntities: [] }));
			const statTypeResult = await this.entityResolver.resolveEntityName("test", "stat_type").catch(() => ({ allEntities: [] }));

			const players = playerResult.allEntities || [];
			const teams = teamResult.allEntities || [];
			const oppositions = oppositionResult.allEntities || [];
			const statTypes = statTypeResult.allEntities || [];

			players.forEach((p) => this.dictionary.add(p.toLowerCase()));
			teams.forEach((t) => this.dictionary.add(t.toLowerCase()));
			oppositions.forEach((o) => this.dictionary.add(o.toLowerCase()));
			statTypes.forEach((s) => this.dictionary.add(s.toLowerCase()));

			const commonTerms = [
				"goals",
				"assists",
				"appearances",
				"apps",
				"minutes",
				"yellow",
				"red",
				"cards",
				"saves",
				"clean",
				"sheets",
				"penalties",
				"scored",
				"missed",
				"conceded",
				"saved",
				"fantasy",
				"points",
				"home",
				"away",
				"team",
				"player",
				"season",
				"league",
				"cup",
				"friendly",
				"how",
				"many",
				"what",
				"which",
				"who",
				"where",
				"when",
				"top",
				"best",
				"most",
				"least",
				"highest",
				"lowest",
			];

			commonTerms.forEach((term) => this.dictionary.add(term.toLowerCase()));

			this.dictionaryLoaded = true;
		} catch (error) {
			console.error("❌ Failed to load spelling dictionary:", error);
		}
	}

	/**
	 * Calculate Levenshtein distance between two strings
	 */
	private levenshteinDistance(str1: string, str2: string): number {
		const matrix: number[][] = [];

		for (let i = 0; i <= str2.length; i++) {
			matrix[i] = [i];
		}

		for (let j = 0; j <= str1.length; j++) {
			matrix[0][j] = j;
		}

		for (let i = 1; i <= str2.length; i++) {
			for (let j = 1; j <= str1.length; j++) {
				if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
					matrix[i][j] = matrix[i - 1][j - 1];
				} else {
					matrix[i][j] = Math.min(
						matrix[i - 1][j - 1] + 1,
						matrix[i][j - 1] + 1,
						matrix[i - 1][j] + 1,
					);
				}
			}
		}

		return matrix[str2.length][str1.length];
	}

	/**
	 * Calculate similarity score between two strings (0-1)
	 */
	private calculateSimilarity(str1: string, str2: string): number {
		const maxLen = Math.max(str1.length, str2.length);
		if (maxLen === 0) return 1.0;
		const distance = this.levenshteinDistance(str1, str2);
		return 1 - distance / maxLen;
	}

	/**
	 * Find best match for a word in the dictionary
	 */
	private findBestMatch(word: string, minSimilarity: number = 0.7): string | null {
		let bestMatch: string | null = null;
		let bestScore = 0;

		for (const dictWord of this.dictionary) {
			const similarity = this.calculateSimilarity(word.toLowerCase(), dictWord);
			if (similarity > bestScore && similarity >= minSimilarity) {
				bestScore = similarity;
				bestMatch = dictWord;
			}
		}

		return bestMatch;
	}

	/**
	 * Correct spelling in a question while preserving context
	 */
	public async correctSpelling(question: string): Promise<{ corrected: string; corrections: SpellingCorrection[] }> {
		await this.loadDictionary();

		const words = question.split(/\s+/);
		const corrections: SpellingCorrection[] = [];
		const correctedWords: string[] = [];

		for (const word of words) {
			const cleanWord = word.replace(/[^\w]/g, "").toLowerCase();

			if (cleanWord.length < 3) {
				correctedWords.push(word);
				continue;
			}

			if (this.dictionary.has(cleanWord)) {
				correctedWords.push(word);
				continue;
			}

			const bestMatch = this.findBestMatch(cleanWord, 0.7);
			if (bestMatch) {
				const similarity = this.calculateSimilarity(cleanWord, bestMatch);
				corrections.push({
					original: word,
					corrected: bestMatch,
					confidence: similarity,
				});

				const correctedWord = word.replace(/[^\w]/g, "") === cleanWord ? bestMatch : word.replace(cleanWord, bestMatch);
				correctedWords.push(correctedWord);
			} else {
				correctedWords.push(word);
			}
		}

		const corrected = correctedWords.join(" ");

		return {
			corrected: corrected !== question ? corrected : question,
			corrections,
		};
	}

	/**
	 * Quick check if word needs correction (for performance)
	 */
	public async needsCorrection(word: string): Promise<boolean> {
		await this.loadDictionary();
		const cleanWord = word.replace(/[^\w]/g, "").toLowerCase();
		return cleanWord.length >= 3 && !this.dictionary.has(cleanWord);
	}
}

export const spellingCorrector = SpellingCorrector.getInstance();

