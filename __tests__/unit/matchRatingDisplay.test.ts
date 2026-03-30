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
		expect(matchRatingCircleClass(9)).toContain("#C9A42A");
		expect(matchRatingCircleClass(7.5)).toContain("#5DCAA5");
		expect(matchRatingCircleClass(6.5)).toContain("#2D6A4F");
		expect(matchRatingCircleClass(5)).toContain("#D4A574");
		expect(matchRatingCircleClass(3)).toContain("#BC4749");
	});
});
