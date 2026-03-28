import { classifyPlayerType } from "@/lib/wrapped/classifyPlayerType";

describe("classifyPlayerType", () => {
	it("returns Sharpshooter when goalsPer90 percentile is high", () => {
		const r = classifyPlayerType({
			numberTeamsPlayedFor: 1,
			percentiles: {
				goalsPer90: 85,
				assistsPer90: 10,
				appearances: 50,
				minutes: 50,
				cleanSheetsPer90: 10,
			},
		});
		expect(r.type).toBe("The Sharpshooter");
	});

	it("returns Creator when assistsPer90 percentile is high and goals not", () => {
		const r = classifyPlayerType({
			numberTeamsPlayedFor: 1,
			percentiles: {
				goalsPer90: 10,
				assistsPer90: 82,
				appearances: 50,
				minutes: 50,
				cleanSheetsPer90: 10,
			},
		});
		expect(r.type).toBe("The Creator");
	});

	it("returns Ironman when appearances and minutes percentiles are very high", () => {
		const r = classifyPlayerType({
			numberTeamsPlayedFor: 1,
			percentiles: {
				goalsPer90: 10,
				assistsPer90: 10,
				appearances: 92,
				minutes: 91,
				cleanSheetsPer90: 10,
			},
		});
		expect(r.type).toBe("The Ironman");
	});

	it("returns Journeyman when many teams", () => {
		const r = classifyPlayerType({
			numberTeamsPlayedFor: 5,
			percentiles: {
				goalsPer90: 10,
				assistsPer90: 10,
				appearances: 20,
				minutes: 20,
				cleanSheetsPer90: 10,
			},
		});
		expect(r.type).toBe("The Journeyman");
	});

	it("defaults to Squad Player", () => {
		const r = classifyPlayerType({
			numberTeamsPlayedFor: 1,
			percentiles: {
				goalsPer90: 10,
				assistsPer90: 10,
				appearances: 20,
				minutes: 20,
				cleanSheetsPer90: 10,
			},
		});
		expect(r.type).toBe("The Squad Player");
	});
});
