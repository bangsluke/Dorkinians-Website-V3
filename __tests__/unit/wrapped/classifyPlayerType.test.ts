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

	it("returns Point Machine when FTP per 90 percentile is very high", () => {
		const r = classifyPlayerType({
			numberTeamsPlayedFor: 1,
			percentiles: {
				goalsPer90: 10,
				assistsPer90: 10,
				appearances: 50,
				minutes: 50,
				cleanSheetsPer90: 10,
				ftpPer90: 88,
				distance: 10,
			},
		});
		expect(r.type).toBe("The Point Machine");
	});

	it("returns MoM Magnet when mom per 90 percentile is elite", () => {
		const r = classifyPlayerType({
			numberTeamsPlayedFor: 1,
			percentiles: {
				goalsPer90: 12,
				assistsPer90: 12,
				appearances: 55,
				minutes: 55,
				cleanSheetsPer90: 12,
				ftpPer90: 50,
				distance: 20,
				momPer90: 86,
			},
		});
		expect(r.type).toBe("The MoM Magnet");
	});

	it("returns First XI Lock when start rate is very high and not Ironman tier apps", () => {
		const r = classifyPlayerType({
			numberTeamsPlayedFor: 1,
			percentiles: {
				goalsPer90: 20,
				assistsPer90: 20,
				appearances: 72,
				minutes: 70,
				cleanSheetsPer90: 15,
				startRate: 90,
			},
		});
		expect(r.type).toBe("The First XI Lock");
	});

	it("returns Bench Impact when start rate is low but attacking percentiles show", () => {
		const r = classifyPlayerType({
			numberTeamsPlayedFor: 1,
			percentiles: {
				goalsPer90: 48,
				assistsPer90: 15,
				appearances: 40,
				minutes: 45,
				cleanSheetsPer90: 20,
				startRate: 22,
			},
		});
		expect(r.type).toBe("The Bench Impact");
	});

	it("returns The Bridge for strong assists below Playmaker tier with modest goals", () => {
		const r = classifyPlayerType({
			numberTeamsPlayedFor: 1,
			percentiles: {
				goalsPer90: 45,
				assistsPer90: 58,
				appearances: 60,
				minutes: 58,
				cleanSheetsPer90: 25,
				ftpPer90: 55,
			},
		});
		expect(r.type).toBe("The Bridge");
	});
});
