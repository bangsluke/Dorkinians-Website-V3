import { Record as Neo4jRecord } from "neo4j-driver";

jest.mock("../../lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn(),
		runQuery: jest.fn(),
		getGraphLabel: jest.fn(() => "test-graph"),
	},
}));

const mocked = () => require("../../lib/neo4j") as {
	neo4jService: { connect: jest.Mock; runQuery: jest.Mock; getGraphLabel: jest.Mock };
};

function fakeRecord(row: Record<string, unknown>): Neo4jRecord {
	return {
		get: (k: string) => row[k],
	} as Neo4jRecord;
}

describe("player-data API mostConnected integration", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("returns at most 5 mostConnected entries with connection counts", async () => {
		const { neo4jService } = mocked();
		neo4jService.connect.mockResolvedValue(true);
		neo4jService.runQuery.mockResolvedValue({
			records: [
				fakeRecord({
					id: "p1",
					playerName: "Luke Bangs",
					allowOnSite: true,
					graphLabel: "test-graph",
					partnershipsTopJson: JSON.stringify([
						{ name: "Conn B", matches: 7, winRate: 50.2 },
						{ name: "Conn A", matches: 12, winRate: 55.1 },
						{ name: "Conn D", matches: 4, winRate: 40.0 },
						{ name: "Conn F", matches: 9, winRate: 62.0 },
						{ name: "Conn E", matches: 8, winRate: 57.0 },
						{ name: "Conn C", matches: 8, winRate: 60.0 },
					]),
				}),
			],
		});

		const { GET } = await import("../../app/api/player-data/route");
		const req = new Request("http://localhost/api/player-data?playerName=Luke%20Bangs");
		const res = await GET(req as any);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(Array.isArray(json.playerData.mostConnected)).toBe(true);
		expect(json.playerData.mostConnected).toHaveLength(5);
		expect(json.playerData.mostConnected[0]).toEqual(
			expect.objectContaining({ name: "Conn A", timesPlayed: 12 }),
		);
		expect(json.playerData.mostConnected[1]).toEqual(
			expect.objectContaining({ name: "Conn F", timesPlayed: 9 }),
		);
		expect(json.playerData.mostConnected[2]).toEqual(
			expect.objectContaining({ name: "Conn C", timesPlayed: 8 }),
		);
	});
});
