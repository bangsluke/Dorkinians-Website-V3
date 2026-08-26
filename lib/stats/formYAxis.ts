export type FormChartSeriesPoint = {
	rawScore: number;
	ewmaReactive: number;
	ewmaBaseline: number;
};

/** Y-axis domain and integer ticks from the player's form value range. */
export function formYAxisFromData(formData: FormChartSeriesPoint[]): { domain: [number, number]; ticks: number[] } {
	const values: number[] = [];
	for (const d of formData) {
		if (Number.isFinite(d.rawScore)) values.push(d.rawScore);
		if (Number.isFinite(d.ewmaReactive)) values.push(d.ewmaReactive);
		if (Number.isFinite(d.ewmaBaseline)) values.push(d.ewmaBaseline);
	}
	if (values.length === 0) {
		return { domain: [0, 10], ticks: [0, 2, 4, 6, 8, 10] };
	}
	let yMin = Math.floor(Math.min(...values));
	let yMax = Math.ceil(Math.max(...values));
	if (yMin === yMax) {
		yMin -= 1;
		yMax += 1;
	}
	const span = yMax - yMin;
	const step = span <= 6 ? 1 : span <= 12 ? 2 : Math.max(1, Math.ceil(span / 5));
	const ticks: number[] = [];
	for (let t = yMin; t <= yMax; t += step) {
		ticks.push(t);
	}
	if (ticks[ticks.length - 1] !== yMax) {
		ticks.push(yMax);
	}
	return { domain: [yMin, yMax], ticks };
}
