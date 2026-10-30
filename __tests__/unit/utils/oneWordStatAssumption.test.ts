import { metricConfigs, type MetricConfig } from "@/lib/config/chatbotMetrics";
import {
	detectOneWordStatAssumption,
	prependAssumptionToAnswer,
} from "@/lib/utils/oneWordStatAssumption";

function oneWordForms(metric: MetricConfig): string[] {
	return [metric.displayName, metric.singular, metric.plural, ...metric.aliases]
		.map((value) => value.toLowerCase().trim())
		.filter((value) => value.length > 0 && !/\s/.test(value));
}

describe("oneWordStatAssumption", () => {
	it("detects goals and builds the assumption sentence", () => {
		const assumption = detectOneWordStatAssumption("goals");
		expect(assumption).not.toBeNull();
		expect(assumption?.metricKey).toBe("G");
		expect(assumption?.assumedQuestion).toBe("How many goals have I got?");
		expect(assumption?.assumptionPrefix).toContain(
			"I assumed this is the question you were after",
		);
	});

	it("maps goal and goals to the same goals question", () => {
		for (const input of ["goal", "goals", "Goals", "GOAL"]) {
			const assumption = detectOneWordStatAssumption(input);
			expect(assumption?.metricKey).toBe("G");
			expect(assumption?.statDisplayName).toBe("goals");
			expect(assumption?.assumedQuestion).toBe("How many goals have I got?");
		}
	});

	it("maps Assist and Assists in any case to the assists question", () => {
		for (const input of ["Assist", "assist", "Assists", "assists", "ASSIST", "assist?"]) {
			const assumption = detectOneWordStatAssumption(input);
			expect(assumption?.metricKey).toBe("A");
			expect(assumption?.statDisplayName).toBe("assists");
			expect(assumption?.assumedQuestion).toBe("How many assists have I got?");
			expect(assumption?.assumptionPrefix).toBe(
				"I assumed this is the question you were after: How many assists have I got?",
			);
		}
	});

	it("allows a trailing question mark", () => {
		expect(detectOneWordStatAssumption("goals?")?.statDisplayName).toBe("goals");
	});

	it("ignores multi-word questions", () => {
		expect(detectOneWordStatAssumption("how many goals")).toBeNull();
		expect(detectOneWordStatAssumption("yellow cards")).toBeNull();
	});

	it("resolves every one-word stat name and alias to that stat's plural", () => {
		const tokens = new Set<string>();
		for (const metric of metricConfigs) {
			for (const form of oneWordForms(metric)) {
				tokens.add(form);
			}
		}

		for (const token of tokens) {
			const assumption = detectOneWordStatAssumption(token);
			expect(assumption).not.toBeNull();
			const chosen = metricConfigs.find((metric) => metric.key === assumption?.metricKey);
			expect(chosen).toBeDefined();
			expect(assumption?.statDisplayName).toBe(chosen?.plural || chosen?.displayName);
			expect(assumption?.assumedQuestion).toBe(
				`How many ${assumption?.statDisplayName} have I got?`,
			);

			const listers = metricConfigs.filter((metric) => oneWordForms(metric).includes(token));
			expect(listers.map((metric) => metric.key)).toContain(assumption?.metricKey);
		}
	});

	it("keeps shared goal words on the base goals stat", () => {
		for (const input of ["goal", "goals", "scored", "scoring", "strikes"]) {
			expect(detectOneWordStatAssumption(input)?.metricKey).toBe("G");
		}
	});

	it("prepends the assumption to an answer", () => {
		const assumption = detectOneWordStatAssumption("goals");
		expect(assumption).not.toBeNull();
		const answer = prependAssumptionToAnswer("Luke Bangs scored 3 goals.", assumption!);
		expect(answer).toContain("I assumed this is the question you were after");
		expect(answer).toContain("Luke Bangs scored 3 goals.");
	});
});
