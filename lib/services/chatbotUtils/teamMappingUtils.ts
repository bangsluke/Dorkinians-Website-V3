export class TeamMappingUtils {
	private static teamNameMappingCache: Map<string, string> = new Map();

	/**
	 * Map common team name variations to database format
	 */
	static mapTeamName(teamName: string): string {
		// Check cache first
		const cacheKey = teamName.toLowerCase();
		if (TeamMappingUtils.teamNameMappingCache.has(cacheKey)) {
			return TeamMappingUtils.teamNameMappingCache.get(cacheKey)!;
		}

		// Map common team name variations to database format
		const teamMapping: { [key: string]: string } = {
			"1s": "1st XI",
			"2s": "2nd XI",
			"3s": "3rd XI",
			"4s": "4th XI",
			"5s": "5th XI",
			"6s": "6th XI",
			"7s": "7th XI",
			"8s": "8th XI",
			"1st": "1st XI",
			"2nd": "2nd XI",
			"3rd": "3rd XI",
			"4th": "4th XI",
			"5th": "5th XI",
			"6th": "6th XI",
			"7th": "7th XI",
			"8th": "8th XI",
			first: "1st XI",
			second: "2nd XI",
			third: "3rd XI",
			fourth: "4th XI",
			fifth: "5th XI",
			sixth: "6th XI",
			seventh: "7th XI",
			eighth: "8th XI",
		};

		const result = teamMapping[cacheKey] || teamName;
		// Cache the result
		TeamMappingUtils.teamNameMappingCache.set(cacheKey, result);
		return result;
	}

	/**
	 * Check if question is asking about team count
	 */
	static isTeamCountQuestion(question?: string): boolean {
		if (!question) return false;
		const q = question.toLowerCase();
		const mentionsClubTeams =
			q.includes("how many of the club's teams") ||
			q.includes("how many of the clubs teams") ||
			q.includes("how many of the club teams") ||
			q.includes("how many of the club's team") ||
			q.includes("how many of the clubs team") ||
			q.includes("how many of the club team") ||
			q.includes("how many of the teams has") ||
			q.includes("how many of the teams have");

		const genericHowManyTeams = q.includes("how many teams") || q.includes("how many team");
		const mentionsPlayed = q.includes("played for") || q.includes("played in");

		return (mentionsClubTeams && mentionsPlayed) || (genericHowManyTeams && mentionsPlayed);
	}

	/**
	 * Get team priority (lower number = higher team)
	 * 1st XI = 1 (highest), 2nd XI = 2, etc.
	 * Unknown teams = 999 (lowest)
	 */
	static getTeamPriority(team: string): number {
		if (!team) return 999;
		const teamLower = team.toLowerCase().trim();
		const priorityMap: { [key: string]: number } = {
			"1st xi": 1,
			"2nd xi": 2,
			"3rd xi": 3,
			"4th xi": 4,
			"5th xi": 5,
			"6th xi": 6,
			"7th xi": 7,
			"8th xi": 8,
			"1s": 1,
			"2s": 2,
			"3s": 3,
			"4s": 4,
			"5s": 5,
			"6s": 6,
			"7s": 7,
			"8s": 8,
		};
		return priorityMap[teamLower] || 999;
	}
}
