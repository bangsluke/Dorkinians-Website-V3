/**
 * Mock Neo4j Service for Testing Chatbot Performance
 * Provides realistic data responses without requiring a live database connection
 */

export interface MockPlayerStats {
	goals: number;
	assists: number;
	appearances: number;
	yellowCards: number;
	redCards: number;
	cleanSheets: number;
	penaltiesScored: number;
	penaltiesMissed: number;
	fantasyPoints: number;
}

export interface MockMatchDetail {
	playerName: string;
	team: string;
	goals: number;
	assists: number;
	appearances: number;
	date: string;
}

// Mock player statistics data
const MOCK_PLAYER_STATS: Record<string, MockPlayerStats> = {
	"Luke Bangs": {
		goals: 29,
		assists: 7,
		appearances: 78,
		yellowCards: 5,
		redCards: 0,
		cleanSheets: 3,
		penaltiesScored: 2,
		penaltiesMissed: 1,
		fantasyPoints: 156,
	},
	"Oli Goddard": {
		goals: 15,
		assists: 12,
		appearances: 45,
		yellowCards: 3,
		redCards: 0,
		cleanSheets: 0,
		penaltiesScored: 1,
		penaltiesMissed: 0,
		fantasyPoints: 98,
	},
	"Jonny Sourris": {
		goals: 8,
		assists: 15,
		appearances: 52,
		yellowCards: 2,
		redCards: 0,
		cleanSheets: 0,
		penaltiesScored: 0,
		penaltiesMissed: 0,
		fantasyPoints: 87,
	},
};

// Mock match details for team-specific queries
const MOCK_MATCH_DETAILS: MockMatchDetail[] = [
	{
		playerName: "Luke Bangs",
		team: "3rd XI",
		goals: 8,
		assists: 2,
		appearances: 68,
		date: "2023-01-01",
	},
	{
		playerName: "Luke Bangs",
		team: "4th XI",
		goals: 12,
		assists: 3,
		appearances: 60,
		date: "2023-01-01",
	},
	{
		playerName: "Oli Goddard",
		team: "2nd XI",
		goals: 5,
		assists: 8,
		appearances: 25,
		date: "2023-01-01",
	},
	{
		playerName: "Jonny Sourris",
		team: "1st XI",
		goals: 3,
		assists: 7,
		appearances: 30,
		date: "2023-01-01",
	},
];

export class MockNeo4jService {
	private isConnected: boolean = false;

	async connect(): Promise<boolean> {
		// Simulate connection delay
		await new Promise((resolve) => setTimeout(resolve, 100));
		this.isConnected = true;
		return true;
	}

	async disconnect(): Promise<void> {
		this.isConnected = false;
	}

	async run(cypher: string, params: any = {}): Promise<any> {
		if (!this.isConnected) {
			throw new Error("Not connected to database");
		}

		// Simulate query processing delay
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Parse Cypher query to determine response
		const response = this.parseCypherQuery(cypher, params);
		return response;
	}

	private parseCypherQuery(cypher: string, params: any): any {
		const query = cypher.toLowerCase();

		// Player statistics queries
		if (query.includes("match (p:player)") && query.includes("return p")) {
			const playerName = params.playerName;
			if (playerName && MOCK_PLAYER_STATS[playerName]) {
				return {
					records: [
						{
							get: (key: string) => ({
								properties: {
									playerName,
									...MOCK_PLAYER_STATS[playerName],
								},
							}),
						},
					],
				};
			}
		}

		// Team-specific queries
		if (query.includes("match (m:matchdetail)") && query.includes("team")) {
			const playerName = params.playerName;
			const teamFilter = query.includes("3rd")
				? "3rd XI"
				: query.includes("4th")
					? "4th XI"
					: query.includes("2nd")
						? "2nd XI"
						: query.includes("1st")
							? "1st XI"
							: null;

			if (playerName && teamFilter) {
				const teamMatches = MOCK_MATCH_DETAILS.filter((m) => m.playerName === playerName && m.team === teamFilter);

				if (teamMatches.length > 0) {
					const match = teamMatches[0];
					return {
						records: [
							{
								get: (key: string) => ({
									properties: {
										playerName: match.playerName,
										team: match.team,
										goals: match.goals,
										assists: match.assists,
										appearances: match.appearances,
									},
								}),
							},
						],
					};
				}
			}
		}

		// Aggregation queries
		if (query.includes("sum(") || query.includes("count(")) {
			const playerName = params.playerName;
			if (playerName && MOCK_PLAYER_STATS[playerName]) {
				const stats = MOCK_PLAYER_STATS[playerName];

				if (query.includes("goals")) {
					return { records: [{ get: () => ({ low: stats.goals }) }] };
				}
				if (query.includes("assists")) {
					return { records: [{ get: () => ({ low: stats.assists }) }] };
				}
				if (query.includes("appearances")) {
					return { records: [{ get: () => ({ low: stats.appearances }) }] };
				}
			}
		}

		// Default empty response
		return { records: [] };
	}

	getConnectionStatus(): boolean {
		return this.isConnected;
	}
}

// Export singleton instance
export const mockNeo4jService = new MockNeo4jService();
