/**
 * Jest mirror of database-dorkinians `services/matchDerivedFields.test.js` against the same
 * implementation file (single source of truth). Keeps NEW-FEATURES “Jest unit tests” satisfied.
 */
import path from "path";

const dbRoot = path.join(__dirname, "../../../database-dorkinians/services/matchDerivedFields.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- shared CommonJS module from sibling repo
const {
	inferFormation,
	getMatchDetailFixtureGroupKey,
	assignMatchDetailStarterFields,
	calculateMatchRating,
} = require(dbRoot) as {
	inferFormation: (classes: string[]) => string;
	getMatchDetailFixtureGroupKey: (row: Record<string, unknown>) => string;
	assignMatchDetailStarterFields: (rows: Array<Record<string, unknown>>) => void;
	calculateMatchRating: (detail: Record<string, unknown>) => number;
};

describe("matchDerivedFields (shared with database-dorkinians)", () => {
	describe("inferFormation", () => {
		it("returns 4-4-2", () => {
			const classes = ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "FWD", "FWD"];
			expect(inferFormation(classes)).toBe("4-4-2");
		});
		it("returns 3-5-2", () => {
			const classes = ["GK", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "MID", "FWD", "FWD"];
			expect(inferFormation(classes)).toBe("3-5-2");
		});
	});

	describe("calculateMatchRating", () => {
		it("forward 2 goals 90m → 8.9", () => {
			expect(
				calculateMatchRating({
					class: "FWD",
					minutes: 90,
					goals: 2,
					assists: 0,
					mom: 0,
					cleanSheets: 0,
					saves: 0,
					yellowCards: 0,
					redCards: 0,
					ownGoals: 0,
					conceded: 0,
					penaltiesMissed: 0,
					penaltiesSaved: 0,
				})
			).toBe(8.9);
		});
		it("mid 1g 1a MoM 90m → 10.0", () => {
			expect(
				calculateMatchRating({
					class: "MID",
					minutes: 90,
					goals: 1,
					assists: 1,
					mom: 1,
					cleanSheets: 0,
					saves: 0,
					yellowCards: 0,
					redCards: 0,
					ownGoals: 0,
					conceded: 0,
					penaltiesMissed: 0,
					penaltiesSaved: 0,
				})
			).toBe(10.0);
		});
		it("clamps high to 10", () => {
			expect(
				calculateMatchRating({
					class: "FWD",
					minutes: 90,
					goals: 4,
					assists: 0,
					mom: 0,
					cleanSheets: 0,
					saves: 0,
					yellowCards: 0,
					redCards: 0,
					ownGoals: 0,
					conceded: 0,
					penaltiesMissed: 0,
					penaltiesSaved: 0,
				})
			).toBe(10.0);
		});
	});

	describe("assignMatchDetailStarterFields", () => {
		it("14 rows → 11 starters", () => {
			const rows = Array.from({ length: 14 }, (_, i) => ({
				IMPORTED_FIXTURE_DETAIL: "g1",
				PLAYER: `P${i}`,
			}));
			assignMatchDetailStarterFields(rows);
			expect(rows.slice(0, 11).every((r: { _starterStarted?: boolean }) => r._starterStarted)).toBe(true);
			expect(rows.slice(11).every((r: { _starterStarted?: boolean }) => r._starterStarted === false)).toBe(true);
		});
	});

	describe("getMatchDetailFixtureGroupKey", () => {
		it("uses IMPORTED_FIXTURE_DETAIL", () => {
			expect(
				getMatchDetailFixtureGroupKey({
					IMPORTED_FIXTURE_DETAIL: " x ",
					DATE: "2024-01-01",
					TEAM: "T",
				})
			).toBe("x");
		});
	});
});
