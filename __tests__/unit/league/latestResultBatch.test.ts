import { fetchLeagueLatestResultsForTeams } from "@/lib/league/latestResult";

jest.mock("@/lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn(),
		runQuery: jest.fn(),
		getGraphLabel: jest.fn(() => "test-graph"),
	},
}));

describe("fetchLeagueLatestResultsForTeams", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test("returns a result entry per team key", async () => {
		const { neo4jService } = require("@/lib/neo4j");
		neo4jService.runQuery.mockResolvedValue({ records: [] });

		const results = await fetchLeagueLatestResultsForTeams(["1s", "2s"], "2025-26");
		expect(Object.keys(results).sort()).toEqual(["1s", "2s"]);
		expect(results["1s"]).toEqual({ fixture: null, lineup: [] });
		expect(results["2s"]).toEqual({ fixture: null, lineup: [] });
		expect(neo4jService.runQuery).toHaveBeenCalledTimes(2);
	});
});
