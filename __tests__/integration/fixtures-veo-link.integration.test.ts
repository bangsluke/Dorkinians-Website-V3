import { NextRequest } from "next/server";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn(),
		runQuery: jest.fn(),
		getGraphLabel: jest.fn(() => "test-graph"),
	},
}));

describe("fixture APIs expose veoLink", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test("league-fixtures returns veoLink when present and null when blank", async () => {
		const { neo4jService } = require("@/lib/neo4j");
		neo4jService.connect.mockResolvedValue(true);
		neo4jService.runQuery.mockResolvedValue({
			records: [
				{
					get: (key: string) => {
						const row: Record<string, unknown> = {
							fixtureId: "f-1",
							date: "2026-03-01",
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
							goalscorers: [],
							momPlayers: [],
						};
						return row[key];
					},
				},
				{
					get: (key: string) => {
						const row: Record<string, unknown> = {
							fixtureId: "f-2",
							date: "2026-03-08",
							opposition: "Opposition B",
							homeOrAway: "Away",
							result: "D",
							homeScore: 2,
							awayScore: 2,
							dorkiniansGoals: 2,
							conceded: 2,
							compType: "League",
							oppoOwnGoals: 0,
							veoLink: "   ",
							goalscorers: [],
							momPlayers: [],
						};
						return row[key];
					},
				},
			],
		});

		const { GET } = await import("../../app/api/league-fixtures/route");
		const req = { url: "http://localhost/api/league-fixtures?team=1s&season=2025-26" } as NextRequest;
		const res = await GET(req);
		const json = await res.json();

		expect(res.status).toBe(200);
		expect(json.fixtures).toHaveLength(2);
		expect(json.fixtures[0]).toEqual(
			expect.objectContaining({
				fixtureId: "f-1",
				veoLink: "https://app.veo.co/matches/abc123",
			}),
		);
		expect(json.fixtures[1]).toEqual(
			expect.objectContaining({
				fixtureId: "f-2",
				veoLink: null,
			}),
		);
	});

	test("team-recent-fixtures returns veoLink field in response payload", async () => {
		const { neo4jService } = require("@/lib/neo4j");
		neo4jService.connect.mockResolvedValue(true);
		neo4jService.runQuery.mockResolvedValue({
			records: [
				{
					get: (key: string) => {
						const row: Record<string, unknown> = {
							result: "W",
							date: "2026-03-15",
							opposition: "Opposition C",
							homeOrAway: "Home",
							goalsScored: 4,
							goalsConceded: 0,
							compType: "Cup",
							veoLink: "https://app.veo.co/matches/xyz987",
						};
						return row[key];
					},
				},
			],
		});

		const { POST } = await import("../../app/api/team-recent-fixtures/route");
		const req = new Request("http://localhost/api/team-recent-fixtures", {
			method: "POST",
			body: JSON.stringify({ teamName: "1st XI", filters: {} }),
		});
		const res = await POST(req as NextRequest);
		const json = await res.json();

		expect(res.status).toBe(200);
		expect(json.fixtures).toHaveLength(1);
		expect(json.fixtures[0]).toEqual(
			expect.objectContaining({
				result: "W",
				veoLink: "https://app.veo.co/matches/xyz987",
			}),
		);
	});
});
