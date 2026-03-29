import { NextRequest } from "next/server";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn(),
		runQuery: jest.fn(),
		getGraphLabel: jest.fn(() => "test-graph"),
	},
}));

describe("league latest result API integration", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test("returns latest fixture with veoLink and lineup match ratings", async () => {
		const { neo4jService } = require("@/lib/neo4j");
		neo4jService.connect.mockResolvedValue(true);
		neo4jService.runQuery
			.mockResolvedValueOnce({
				records: [
					{
						get: (key: string) => {
							const row: Record<string, unknown> = {
								fixtureId: "fx-123",
								date: "2026-03-20",
								opposition: "Opposition A",
								homeOrAway: "Home",
								result: "W",
								homeScore: 3,
								awayScore: 1,
								dorkiniansGoals: 3,
								conceded: 1,
								compType: "League",
								oppoOwnGoals: 0,
								veoLink: "https://app.veo.co/matches/abc123",
								goalscorers: [{ playerName: "Luke", goals: 2 }],
								momPlayers: ["Luke"],
							};
							return row[key];
						},
					},
				],
			})
			.mockResolvedValueOnce({
				records: [
					{
						get: (key: string) => {
							const row: Record<string, unknown> = {
								playerName: "Luke",
								position: "MID",
								minutes: 90,
								goals: 2,
								assists: 1,
								mom: 1,
								yellowCards: 0,
								redCards: 0,
								saves: 0,
								cleanSheets: 0,
								conceded: 1,
								ownGoals: 0,
								penaltiesScored: 0,
								penaltiesMissed: 0,
								penaltiesConceded: 0,
								penaltiesSaved: 0,
								matchRating: 9.2,
								started: true,
							};
							return row[key];
						},
					},
				],
			});

		const { GET } = await import("../../app/api/league-latest-result/route");
		const req = { url: "http://localhost/api/league-latest-result?team=1s&season=2025-26" } as NextRequest;
		const res = await GET(req);
		const json = await res.json();

		expect(res.status).toBe(200);
		expect(json.fixture).toEqual(
			expect.objectContaining({
				fixtureId: "fx-123",
				veoLink: "https://app.veo.co/matches/abc123",
				momPlayerName: "Luke",
			}),
		);
		expect(json.lineup).toHaveLength(1);
		expect(json.lineup[0]).toEqual(
			expect.objectContaining({
				playerName: "Luke",
				matchRating: 9.2,
				started: true,
			}),
		);
	});
});
