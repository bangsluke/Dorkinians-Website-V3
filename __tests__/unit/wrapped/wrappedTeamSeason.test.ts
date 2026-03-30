import {
	fixtureDisplayTeamToLeagueTableKey,
	isCupTieAdvanced,
} from "@/lib/wrapped/wrappedTeamSeason";

describe("fixtureDisplayTeamToLeagueTableKey", () => {
	test("maps XI labels to league table keys", () => {
		expect(fixtureDisplayTeamToLeagueTableKey("1st XI")).toBe("1s");
		expect(fixtureDisplayTeamToLeagueTableKey("7th XI")).toBe("7s");
	});

	test("passes through existing short keys", () => {
		expect(fixtureDisplayTeamToLeagueTableKey("1s")).toBe("1s");
	});
});

describe("isCupTieAdvanced", () => {
	test("win advances", () => {
		expect(isCupTieAdvanced("W", "")).toBe(true);
		expect(isCupTieAdvanced("Win", "")).toBe(true);
	});

	test("loss does not advance", () => {
		expect(isCupTieAdvanced("L", "")).toBe(false);
	});

	test("draw without penalty context does not advance", () => {
		expect(isCupTieAdvanced("D", "1-1 at full time")).toBe(false);
	});

	test("draw with penalty win heuristic advances", () => {
		expect(isCupTieAdvanced("D", "Dorkinians won 4-3 on penalties")).toBe(true);
		expect(isCupTieAdvanced("D", "1-1, won on pens")).toBe(true);
	});
});
