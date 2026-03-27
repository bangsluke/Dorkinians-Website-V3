import { Record as Neo4jRecord } from "neo4j-driver";

jest.mock("../../lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn(),
		runQuery: jest.fn(),
		getGraphLabel: jest.fn(() => "test-graph"),
	},
}));

jest.mock("../../app/api/player-data/route", () => ({
	buildFilterConditions: jest.fn().mockReturnValue([]),
}));

const mocked = () => require("../../lib/neo4j") as {
	neo4jService: { connect: jest.Mock; runQuery: jest.Mock; getGraphLabel: jest.Mock };
};

function fakeRecord(row: Record<string, unknown>): Neo4jRecord {
	return {
		get: (k: string) => row[k],
	} as Neo4jRecord;
}

describe("top-players-stats API (POST)", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		const playerDataRoute = jest.requireMock("../../app/api/player-data/route") as {
			buildFilterConditions: jest.Mock;
		};
		playerDataRoute.buildFilterConditions.mockReturnValue([]);
	});

	it("accepts statType avgMatchRating and returns players with averageMatchRating", async () => {
		const { neo4jService } = mocked();
		neo4jService.connect.mockResolvedValue(true);
		neo4jService.runQuery.mockResolvedValue({
			records: [
				fakeRecord({
					playerName: "Test Player",
					appearances: 5,
					goals: 0,
					assists: 0,
					cleanSheets: 0,
					mom: 0,
					penaltiesScored: 0,
					saves: 0,
					yellowCards: 0,
					redCards: 0,
					fantasyPoints: 0,
					goalInvolvements: 0,
					minutes: 400,
					ownGoals: 0,
					conceded: 0,
					penaltiesMissed: 0,
					penaltiesConceded: 0,
					penaltiesSaved: 0,
					distance: 0,
					homeGames: 2,
					awayGames: 3,
					starts: 4,
					averageMatchRating: 7.4,
					matchesRated8Plus: 1,
				}),
			],
		});

		const { POST } = await import("../../app/api/top-players-stats/route");
		const req = new Request("http://localhost/api/top-players-stats", {
			method: "POST",
			body: JSON.stringify({ filters: {}, statType: "avgMatchRating" }),
		});
		const res = await POST(req as any);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.players).toHaveLength(1);
		expect(json.players[0].playerName).toBe("Test Player");
		expect(json.players[0].averageMatchRating).toBe(7.4);
	});

	it("accepts statType matchesRated8Plus", async () => {
		const { neo4jService } = mocked();
		neo4jService.connect.mockResolvedValue(true);
		neo4jService.runQuery.mockResolvedValue({
			records: [
				fakeRecord({
					playerName: "Striker",
					appearances: 10,
					goals: 5,
					assists: 0,
					cleanSheets: 0,
					mom: 2,
					penaltiesScored: 0,
					saves: 0,
					yellowCards: 0,
					redCards: 0,
					fantasyPoints: 0,
					goalInvolvements: 5,
					minutes: 900,
					ownGoals: 0,
					conceded: 0,
					penaltiesMissed: 0,
					penaltiesConceded: 0,
					penaltiesSaved: 0,
					distance: 0,
					homeGames: 5,
					awayGames: 5,
					starts: 10,
					averageMatchRating: 8.1,
					matchesRated8Plus: 4,
				}),
			],
		});

		const { POST } = await import("../../app/api/top-players-stats/route");
		const req = new Request("http://localhost/api/top-players-stats", {
			method: "POST",
			body: JSON.stringify({ filters: {}, statType: "matchesRated8Plus" }),
		});
		const res = await POST(req as any);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.players[0].matchesRated8Plus).toBe(4);
	});

	it("rejects unknown statType", async () => {
		const { neo4jService } = mocked();
		neo4jService.connect.mockResolvedValue(true);
		const { POST } = await import("../../app/api/top-players-stats/route");
		const req = new Request("http://localhost/api/top-players-stats", {
			method: "POST",
			body: JSON.stringify({ filters: {}, statType: "notARealStat" }),
		});
		const res = await POST(req as any);
		expect(res.status).toBe(400);
	});
});
