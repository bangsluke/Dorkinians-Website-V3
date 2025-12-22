import { EntityNameResolver } from "../entityNameResolver";
import { loggingService } from "../loggingService";

export class EntityResolutionUtils {
	private static entityResolver: EntityNameResolver = EntityNameResolver.getInstance();

	/**
	 * Resolve player name using fuzzy matching
	 */
	static async resolvePlayerName(playerName: string): Promise<string | null> {
		try {
			const result = await EntityResolutionUtils.entityResolver.resolveEntityName(playerName, "player");

			if (result.exactMatch) {
				loggingService.log(`✅ Exact match found: ${playerName} → ${result.exactMatch}`, null, "log");
				return result.exactMatch;
			}

			if (result.fuzzyMatches.length > 0) {
				const bestMatch = result.fuzzyMatches[0];
				loggingService.log(
					`🔍 Fuzzy match found: ${playerName} → ${bestMatch.entityName} (confidence: ${bestMatch.confidence.toFixed(2)})`,
					null,
					"log",
				);
				return bestMatch.entityName;
			}

			loggingService.log(`❌ No match found for player: ${playerName}`, null, "warn");
			return null;
		} catch (error) {
			loggingService.log(`❌ Error resolving player name: ${error}`, null, "error");
			return null;
		}
	}
}
