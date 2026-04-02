/**
 * Percentile where higher values are better: share of the sample strictly below `value`, 0–100.
 */
export function percentileHigherIsBetter(value: number, sample: number[]): number {
	const valid = sample.filter((v) => v != null && typeof v === "number" && !Number.isNaN(v));
	if (valid.length === 0) return 0;
	const below = valid.filter((v) => v < value).length;
	return Math.round((below / valid.length) * 100);
}
