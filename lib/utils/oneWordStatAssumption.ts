import { metricConfigs, type MetricConfig } from "@/lib/config/chatbotMetrics";

export interface OneWordStatAssumption {
	metricKey: string;
	statDisplayName: string;
	assumedQuestion: string;
	assumptionPrefix: string;
}

/** Core player-stat keys preferred when several metricConfigs share the same one-word alias (e.g. G vs AllGSC). */
const PRIMARY_ONE_WORD_STAT_KEYS: readonly string[] = [
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
];

function oneWordLabels(metric: MetricConfig): string[] {
	return [metric.displayName, metric.singular, metric.plural, ...metric.aliases]
		.map((value) => value.toLowerCase().trim())
		.filter((value) => value.length > 0 && !/\s/.test(value));
}

function isOwnName(metric: MetricConfig, token: string): boolean {
	return [metric.displayName, metric.singular, metric.plural].some(
		(value) => value.toLowerCase().trim() === token,
	);
}

/**
 * Prefer a single primary counting stat, then a metric whose own name equals the token.
 * A remaining tie is left unresolved so the question is not rewritten.
 */
function chooseMetric(matches: MetricConfig[], token: string): MetricConfig | null {
	const primaryMatches = matches.filter((metric) => PRIMARY_ONE_WORD_STAT_KEYS.includes(metric.key));
	const pool = primaryMatches.length > 0 ? primaryMatches : matches;
	if (pool.length === 1) {
		return pool[0];
	}

	const namedMatches = pool.filter((metric) => isOwnName(metric, token));
	if (namedMatches.length === 1) {
		return namedMatches[0];
	}

	return null;
}

/**
 * Detect a one-word (optional trailing ?/!) question that maps to one stat metric.
 * Callers replace the analyzed question with assumedQuestion and prepend assumptionPrefix.
 */
export function detectOneWordStatAssumption(question: string): OneWordStatAssumption | null {
	const trimmed = question.trim();
	if (!trimmed) return null;

	const withoutPunctuation = trimmed.replace(/[?!]+$/g, "").trim();
	if (!withoutPunctuation || /\s/.test(withoutPunctuation)) {
		return null;
	}

	const token = withoutPunctuation.toLowerCase();
	const matches = metricConfigs.filter((metric) => oneWordLabels(metric).includes(token));
	if (matches.length === 0) {
		return null;
	}

	const chosen = chooseMetric(matches, token);
	if (!chosen) {
		return null;
	}

	const statDisplayName = chosen.plural || chosen.displayName;
	const assumedQuestion = `How many ${statDisplayName} have I got?`;
	return {
		metricKey: chosen.key,
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
