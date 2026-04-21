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

	it("accepts statType goalsPer90", async () => {
		const { neo4jService } = mocked();
		neo4jService.connect.mockResolvedValue(true);
		neo4jService.runQuery.mockResolvedValue({
			records: [
				fakeRecord({
					playerName: "Clinical Forward",
					appearances: 10,
					goals: 8,
					assists: 2,
					cleanSheets: 0,
					mom: 1,
					penaltiesScored: 0,
					saves: 0,
					yellowCards: 0,
					redCards: 0,
					fantasyPoints: 0,
					goalInvolvements: 10,
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
					averageMatchRating: 7.6,
					matchesRated8Plus: 2,
					goalsPer90: 0.8,
					assistsPer90: 0.2,
					goalInvolvementsPer90: 1.0,
					ftpPer90: 6.2,
				}),
			],
		});

		const { POST } = await import("../../app/api/top-players-stats/route");
		const req = new Request("http://localhost/api/top-players-stats", {
			method: "POST",
			body: JSON.stringify({ filters: {}, statType: "goalsPer90" }),
		});
		const res = await POST(req as any);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.players[0].goalsPer90).toBe(0.8);
	});

	it("accepts statType cleanSheetsPer90", async () => {
		const { neo4jService } = mocked();
		neo4jService.connect.mockResolvedValue(true);
		neo4jService.runQuery.mockResolvedValue({
			records: [
				fakeRecord({
					playerName: "Keeper",
					appearances: 12,
					goals: 0,
					assists: 0,
					cleanSheets: 6,
					mom: 1,
					penaltiesScored: 0,
					saves: 44,
					yellowCards: 1,
					redCards: 0,
					fantasyPoints: 70,
					goalInvolvements: 0,
					minutes: 1080,
					ownGoals: 0,
					conceded: 10,
					penaltiesMissed: 0,
					penaltiesConceded: 0,
					penaltiesSaved: 1,
					distance: 0,
					homeGames: 6,
					awayGames: 6,
					starts: 12,
					averageMatchRating: 7.3,
					matchesRated8Plus: 2,
					goalsPer90: 0,
					assistsPer90: 0,
					goalInvolvementsPer90: 0,
					ftpPer90: 5.83,
					cleanSheetsPer90: 0.5,
				}),
			],
		});

		const { POST } = await import("../../app/api/top-players-stats/route");
		const req = new Request("http://localhost/api/top-players-stats", {
			method: "POST",
			body: JSON.stringify({ filters: {}, statType: "cleanSheetsPer90" }),
		});
		const res = await POST(req as any);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.players[0].cleanSheetsPer90).toBe(0.5);
	});

	it("accepts statType bestCurrentForm", async () => {
		const { neo4jService } = mocked();
		neo4jService.connect.mockResolvedValue(true);
		neo4jService.runQuery.mockResolvedValue({
			records: [
				fakeRecord({
					playerName: "In Form Player",
					appearances: 11,
					goals: 3,
					assists: 4,
					cleanSheets: 2,
					mom: 2,
					penaltiesScored: 0,
					saves: 0,
					yellowCards: 1,
					redCards: 0,
					fantasyPoints: 80,
					goalInvolvements: 7,
					minutes: 900,
					ownGoals: 0,
					conceded: 4,
					penaltiesMissed: 0,
					penaltiesConceded: 0,
					penaltiesSaved: 0,
					distance: 0,
					homeGames: 5,
					awayGames: 6,
					starts: 10,
					averageMatchRating: 7.7,
					matchesRated8Plus: 3,
					currentFormEwma: 7.9,
				}),
			],
		});

		const { POST } = await import("../../app/api/top-players-stats/route");
		const req = new Request("http://localhost/api/top-players-stats", {
			method: "POST",
			body: JSON.stringify({ filters: {}, statType: "bestCurrentForm" }),
		});
		const res = await POST(req as any);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.players[0].currentFormEwma).toBe(7.9);
	});

	it("goalInvolvements aggregate in Cypher includes open-play goals, penalties, and assists", async () => {
		const { neo4jService } = mocked();
		neo4jService.connect.mockResolvedValue(true);
		let capturedQuery = "";
		neo4jService.runQuery.mockImplementation(async (query: string) => {
			capturedQuery = query;
			return {
				records: [
					fakeRecord({
						playerName: "Test Striker",
						appearances: 26,
						goals: 8,
						assists: 8,
						cleanSheets: 0,
						mom: 0,
						penaltiesScored: 2,
						saves: 0,
						yellowCards: 0,
						redCards: 0,
						fantasyPoints: 0,
						goalInvolvements: 18,
						minutes: 2340,
						ownGoals: 0,
						conceded: 0,
						penaltiesMissed: 0,
						penaltiesConceded: 0,
						penaltiesSaved: 0,
						distance: 0,
						homeGames: 13,
						awayGames: 13,
						starts: 24,
						averageMatchRating: 7.5,
						matchesRated8Plus: 5,
						goalsPer90: 0.31,
						assistsPer90: 0.31,
						goalInvolvementsPer90: 0.69,
						ftpPer90: 5.0,
					}),
				],
			};
		});

		const { POST } = await import("../../app/api/top-players-stats/route");
		const req = new Request("http://localhost/api/top-players-stats", {
			method: "POST",
			body: JSON.stringify({ filters: {}, statType: "goalInvolvements" }),
		});
		const res = await POST(req as any);
		expect(res.status).toBe(200);
		expect(capturedQuery).toContain(
			"sum(coalesce(md.goals, 0)) + sum(coalesce(md.penaltiesScored, 0)) + sum(coalesce(md.assists, 0)) as goalInvolvements"
		);
		const json = await res.json();
		expect(json.players[0].goalInvolvements).toBe(18);
	});

	it("goalInvolvementsPer90 Cypher numerator matches goals + penalties + assists", async () => {
		const { neo4jService } = mocked();
		neo4jService.connect.mockResolvedValue(true);
		let capturedQuery = "";
		neo4jService.runQuery.mockImplementation(async (query: string) => {
			capturedQuery = query;
			return {
				records: [
					fakeRecord({
						playerName: "Per90 Player",
						appearances: 10,
						goals: 5,
						assists: 3,
						cleanSheets: 1,
						mom: 0,
						penaltiesScored: 1,
						saves: 0,
						yellowCards: 0,
						redCards: 0,
						fantasyPoints: 40,
						goalInvolvements: 9,
						minutes: 900,
						ownGoals: 0,
						conceded: 2,
						penaltiesMissed: 0,
						penaltiesConceded: 0,
						penaltiesSaved: 0,
						distance: 0,
						homeGames: 5,
						awayGames: 5,
						starts: 10,
						averageMatchRating: 7.2,
						matchesRated8Plus: 1,
						goalsPer90: 0.5,
						assistsPer90: 0.3,
						goalInvolvementsPer90: 0.9,
						ftpPer90: 4.0,
					}),
				],
			};
		});

		const { POST } = await import("../../app/api/top-players-stats/route");
		const req = new Request("http://localhost/api/top-players-stats", {
			method: "POST",
			body: JSON.stringify({ filters: {}, statType: "goalInvolvementsPer90" }),
		});
		const res = await POST(req as any);
		expect(res.status).toBe(200);
		expect(capturedQuery).toContain(
			"(sum(coalesce(md.goals, 0)) + sum(coalesce(md.penaltiesScored, 0))) + sum(coalesce(md.assists, 0)))"
		);
		expect(capturedQuery).toContain("as goalInvolvementsPer90");
		const json = await res.json();
		expect(json.players[0].goalInvolvementsPer90).toBe(0.9);
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
