import { matchRatingCircleClass, playerSurnameOrAfterFirstName } from "@/lib/utils/matchRatingDisplay";

describe("playerSurnameOrAfterFirstName", () => {
	test("returns tokens after first name", () => {
		expect(playerSurnameOrAfterFirstName("Tan King")).toBe("King");
		expect(playerSurnameOrAfterFirstName("Andy Sears-Black")).toBe("Sears-Black");
	});
	test("single name unchanged", () => {
		expect(playerSurnameOrAfterFirstName("Madonna")).toBe("Madonna");
	});
});

describe("matchRatingCircleClass", () => {
	test("bands match rating guide thresholds", () => {
		expect(matchRatingCircleClass(9)).toContain("--match-rating-85-100-bg");
		expect(matchRatingCircleClass(7.5)).toContain("--match-rating-70-84-bg");
		expect(matchRatingCircleClass(6.5)).toContain("--match-rating-60-69-bg");
		expect(matchRatingCircleClass(5)).toContain("--match-rating-40-59-bg");
		expect(matchRatingCircleClass(3)).toContain("--match-rating-10-39-bg");
	});
});
