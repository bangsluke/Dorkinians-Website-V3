import { NextResponse } from "next/server";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn(),
		runQuery: jest.fn(),
		getGraphLabel: jest.fn(() => "test-graph"),
	},
}));

describe("API contract integration", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test("totw seasons returns expected keys", async () => {
		const { neo4jService } = require("@/lib/neo4j");
		neo4jService.connect.mockResolvedValue(true);
		neo4jService.runQuery
			.mockResolvedValueOnce({ records: [{ get: (k: string) => (k === "season" ? "2025/26" : null) }] })
			.mockResolvedValueOnce({ records: [] })
			.mockResolvedValueOnce({ records: [{ get: (k: string) => (k === "currentSeason" ? "2025/26" : "10") }] });
		const { GET } = await import("../../app/api/totw/seasons/route");
		const res = await GET({} as any);
		const json = await res.json();
		expect(json).toEqual(expect.objectContaining({ seasons: expect.any(Array) }));
	});

	test("players-of-month seasons handles db failure", async () => {
		const { neo4jService } = require("@/lib/neo4j");
		neo4jService.connect.mockResolvedValue(false);
		const { GET } = await import("../../app/api/players-of-month/seasons/route");
		const res = await GET({} as any);
		expect(res.status).toBe(500);
	});

	test("seasons route returns shaped seasons payload", async () => {
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
		const res = await GET({} as any);
		const json = await res.json();
		expect(json.seasons[0]).toEqual(
			expect.objectContaining({ season: "2025/26", startDate: expect.any(String), endDate: expect.any(String) })
		);
	});
});
