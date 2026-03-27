import { NextResponse } from "next/server";

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
