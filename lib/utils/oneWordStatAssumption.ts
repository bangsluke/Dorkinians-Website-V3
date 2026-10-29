import { metricConfigs } from "@/lib/config/chatbotMetrics";

export interface OneWordStatAssumption {
	statDisplayName: string;
	assumedQuestion: string;
	assumptionPrefix: string;
}

/** Core player-stat keys preferred when several metricConfigs share the same one-word alias (e.g. G vs AllGSC). */
const PRIMARY_ONE_WORD_STAT_KEYS = [
	"G",
	"A",
	"APP",
	"STARTS",
	"MIN",
	"MOM",
	"Y",
	"R",
	"SAVES",
	"CLS",
	"OG",
	"C",
	"PSC",
] as const;

/**
 * Detect a one-word (optional trailing ?/!) question that maps to exactly one stat metric.
 * Does not rewrite the analyzed question; callers prepend the assumption sentence to the answer.
 */
export function detectOneWordStatAssumption(question: string): OneWordStatAssumption | null {
	const trimmed = question.trim();
	if (!trimmed) return null;

	const withoutPunctuation = trimmed.replace(/[?!]+$/g, "").trim();
	if (!withoutPunctuation || /\s/.test(withoutPunctuation)) {
		return null;
	}

	const token = withoutPunctuation.toLowerCase();
	const matches = metricConfigs.filter((metric) => {
		const candidates = [
			metric.displayName,
			metric.singular,
			metric.plural,
			...metric.aliases,
		]
			.map((value) => value.toLowerCase().trim())
			.filter((value) => value.length > 0 && !/\s/.test(value));
		return candidates.includes(token);
	});

	if (matches.length === 0) {
		return null;
	}

	const primaryMatches = matches.filter((metric) =>
		(PRIMARY_ONE_WORD_STAT_KEYS as readonly string[]).includes(metric.key),
	);
	const chosen =
		primaryMatches.length === 1
			? primaryMatches[0]
			: primaryMatches.length > 1
				? primaryMatches[0]
				: matches.length === 1
					? matches[0]
					: null;

	if (!chosen) {
		return null;
	}

	const statDisplayName = chosen.plural || chosen.displayName;
	const assumedQuestion = `How many ${statDisplayName} have I got?`;
	return {
		statDisplayName,
		assumedQuestion,
		assumptionPrefix: `I assumed this is the question you were after: ${assumedQuestion}`,
	};
}

export function prependAssumptionToAnswer(answer: string, assumption: OneWordStatAssumption): string {
	const body = answer?.trim() ? answer : "";
	if (!body) {
		return assumption.assumptionPrefix;
	}
	return `${assumption.assumptionPrefix}\n\n${body}`;
}
