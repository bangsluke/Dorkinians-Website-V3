// Centralized response template system with caching
import { LRUCache } from "../utils/lruCache";

export interface ResponseTemplate {
	template: string;
	variables: string[];
}

export class ResponseTemplateManager {
	private static instance: ResponseTemplateManager;
	private templateCache: LRUCache<string, string> = new LRUCache(500);

	private constructor() {}

	public static getInstance(): ResponseTemplateManager {
		if (!ResponseTemplateManager.instance) {
			ResponseTemplateManager.instance = new ResponseTemplateManager();
		}
		return ResponseTemplateManager.instance;
	}

	/**
	 * Get a formatted response using a template
	 */
	public formatResponse(templateKey: string, variables: Record<string, string | number | undefined>): string {
		const cacheKey = `${templateKey}:${JSON.stringify(variables)}`;
		
		// Check cache first
		const cached = this.templateCache.get(cacheKey);
		if (cached) {
			return cached;
		}

		// Get template
		const template = this.getTemplate(templateKey);
		if (!template) {
			return `Template not found: ${templateKey}`;
		}

		// Format template with variables
		let formatted = template;
		for (const [key, value] of Object.entries(variables)) {
			formatted = formatted.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
		}

		// Cache the result
		this.templateCache.set(cacheKey, formatted);
		return formatted;
	}

	/**
	 * Get template by key
	 */
	private getTemplate(key: string): string | null {
		const templates: Record<string, string> = {
			"player_metric": "{{playerName}} has {{value}} {{metric}}.",
			"player_metric_with_context": "{{playerName}} has {{value}} {{metric}}{{context}}.",
			"player_not_found": "Player not found: I couldn't find a player named \"{{playerName}}\" in the database. Please check the spelling or try a different player name.",
			"team_not_found": "Team not found: I couldn't find the team \"{{teamName}}\". Available teams are: {{availableTeams}}.",
			"no_data": "No data found: I couldn't find any {{metric}} information for {{playerName}}.",
			"zero_appearances": "{{playerName}} has made 0 appearances for the {{teamName}}.",
			"zero_goals": "{{playerName}} has not scored any goals for the {{teamName}}.",
			"database_error": "Database connection error: Unable to connect to the club's database. Please try again later.",
			"query_error": "Database error: {{error}}",
			"clarification_needed": "Please clarify your question with more specific details.",
			"most_played_team": "{{playerName}} has made the most appearances for the {{teamName}}",
			"most_scored_team": "{{playerName}} has scored the most {{statType}} for the {{teamName}}",
			"most_prolific_season": "{{season}} was {{playerName}}'s most prolific season.",
			"zero_goals_team": "{{playerName}} has not scored any goals for the {{teamName}}.",
			"teams_played_count": "{{playerName}} has played for {{count}} of the club's 9 teams.",
			"distance_travelled": "{{playerName}} has travelled {{distance}} miles to games.",
		};

		return templates[key] || null;
	}

	/**
	 * Clear template cache
	 */
	public clearCache(): void {
		this.templateCache.clear();
	}
}

export const responseTemplateManager = ResponseTemplateManager.getInstance();

