import {
	detectOneWordStatAssumption,
	prependAssumptionToAnswer,
} from "@/lib/utils/oneWordStatAssumption";

describe("oneWordStatAssumption", () => {
	it("detects goals and builds the assumption sentence", () => {
		const assumption = detectOneWordStatAssumption("goals");
		expect(assumption).not.toBeNull();
		expect(assumption?.assumedQuestion).toBe("How many goals have I got?");
		expect(assumption?.assumptionPrefix).toContain(
			"I assumed this is the question you were after",
		);
	});

	it("allows a trailing question mark", () => {
		expect(detectOneWordStatAssumption("goals?")?.statDisplayName).toBe("goals");
	});

	it("ignores multi-word questions", () => {
		expect(detectOneWordStatAssumption("how many goals")).toBeNull();
	});

	it("prepends the assumption to an answer", () => {
		const assumption = detectOneWordStatAssumption("goals");
		expect(assumption).not.toBeNull();
		const answer = prependAssumptionToAnswer("Luke Bangs scored 3 goals.", assumption!);
		expect(answer).toContain("I assumed this is the question you were after");
		expect(answer).toContain("Luke Bangs scored 3 goals.");
	});
});
