import { NextRequest } from "next/server";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn(),
		runQuery: jest.fn(),
		getGraphLabel: jest.fn(() => "test-graph"),
	},
}));

// Contract-style checks for read-only API routes with Neo4j fully mocked; verifies JSON shapes and failure codes.
// Each test configures runQuery/connect behavior then dynamically imports the target route handler.
// No outbound network; mismatches usually mean handler response mapping changed versus these fixtures.

describe("API contract integration", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test("totw seasons returns expected keys", async () => {
		// Arrange: sequence of mocked Neo4j reads for TOTW seasons handler
		const { neo4jService } = require("@/lib/neo4j");
		neo4jService.connect.mockResolvedValue(true);
		neo4jService.runQuery
			.mockResolvedValueOnce({ records: [{ get: (k: string) => (k === "season" ? "2025/26" : null) }] })
			.mockResolvedValueOnce({ records: [] })
			.mockResolvedValueOnce({ records: [{ get: (k: string) => (k === "currentSeason" ? "2025/26" : "10") }] });
		const { GET } = await import("../../app/api/totw/seasons/route");
		// Act & assert: payload includes seasons array
		const res = await GET({} as any);
		const json = await res.json();
		expect(json).toEqual(expect.objectContaining({ seasons: expect.any(Array) }));
	});

	test("players-of-month seasons handles db failure", async () => {
		// Arrange: connection refused path
		const { neo4jService } = require("@/lib/neo4j");
		neo4jService.connect.mockResolvedValue(false);
		const { GET } = await import("../../app/api/players-of-month/seasons/route");
		// Act & assert: 500 on connect failure
		const res = await GET({} as any);
		expect(res.status).toBe(500);
	});

	test("players-of-month player-stats goals include penalties scored in filtered window", async () => {
		const { neo4jService } = require("@/lib/neo4j");
		neo4jService.connect.mockResolvedValue(true);
		// Two April fixtures: open-play + PSC, and PSC-only; March row must be excluded by month filter.
		const mdProps = (overrides: Record<string, unknown>) => ({
			team: "1st Team",
			playerName: "Test Player",
			date: "2026-04-10",
			seasonMonth: "2025/26-April",
			min: 90,
			class: "FWD",
			mom: false,
			goals: 0,
			assists: 0,
			yellowCards: 0,
			redCards: 0,
			saves: 0,
			ownGoals: 0,
			conceded: 0,
			cleanSheets: 0,
			penaltiesScored: 0,
			penaltiesMissed: 0,
			penaltiesConceded: 0,
			penaltiesSaved: 0,
			...overrides,
		});
		neo4jService.runQuery.mockResolvedValue({
			records: [
				{
					get: (key: string) => {
						if (key === "md") return { properties: mdProps({ goals: 2, penaltiesScored: 1 }) };
						if (key === "matchSummary") return null;
						if (key === "opposition") return null;
						if (key === "result") return null;
						return null;
					},
				},
				{
					get: (key: string) => {
						if (key === "md") return { properties: mdProps({ goals: 0, penaltiesScored: 2, date: "2026-04-20" }) };
						if (key === "matchSummary") return null;
						if (key === "opposition") return null;
						if (key === "result") return null;
						return null;
					},
				},
				{
					get: (key: string) => {
						if (key === "md")
							return {
								properties: mdProps({
									goals: 5,
									penaltiesScored: 9,
									date: "2026-03-01",
									seasonMonth: "2025/26-March",
								}),
							};
						if (key === "matchSummary") return null;
						if (key === "opposition") return null;
						if (key === "result") return null;
						return null;
					},
				},
			],
		});
		const { GET } = await import("../../app/api/players-of-month/player-stats/route");
		const req = new NextRequest(
			"http://localhost/api/players-of-month/player-stats?season=2025%2F26&month=April&playerName=Test%20Player",
		);
		const res = await GET(req);
		expect(res.status).toBe(200);
		const json = await res.json();
		// April only: (2+1) + (0+2) = 5; PSC-only row still counts toward Goals.
		expect(json.goals).toBe(5);
		expect(json.penaltiesScored).toBe(3);
		expect(json.appearances).toBe(2);
	});

	test("seasons route returns shaped seasons payload", async () => {
		// Arrange: single-record season metadata
		const { neo4jService } = require("@/lib/neo4j");
		neo4jService.connect.mockResolvedValue(true);
		neo4jService.runQuery.mockResolvedValue({
			records: [
				{
					get: (key: string) => {
						if (key === "seasonName") return "2025/26";
						if (key === "seasonStartDate") return "2025-01-01";
						if (key === "seasonEndDate") return "2025-12-31";
						return null;
					},
				},
			],
		});
		const { GET } = await import("../../app/api/seasons/route");
		// Act & assert: normalized season objects
		const res = await GET({} as any);
		const json = await res.json();
		expect(json.seasons[0]).toEqual(
			expect.objectContaining({ season: "2025/26", startDate: expect.any(String), endDate: expect.any(String) })
		);
	});
});
