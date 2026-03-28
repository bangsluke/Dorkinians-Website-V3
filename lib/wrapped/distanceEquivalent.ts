/** Rough UK mile comparisons for travel copy (MatchDetail distance treated as miles). */
const ROUTES: { label: string; miles: number }[] = [
	{ label: "London to Brighton", miles: 50 },
	{ label: "London to Bristol", miles: 120 },
	{ label: "London to Manchester", miles: 200 },
	{ label: "London to Edinburgh", miles: 400 },
	{ label: "Land's End to John o' Groats", miles: 600 },
];

export function distanceMilesToEquivalent(totalMiles: number): string {
	if (totalMiles <= 0) return "Enough short trips to add up";
	const m = Math.round(totalMiles);
	let best = ROUTES[0]!;
	let bestDiff = Math.abs(m - best.miles);
	for (const r of ROUTES) {
		const d = Math.abs(m - r.miles);
		if (d < bestDiff) {
			best = r;
			bestDiff = d;
		}
	}
	return `About the same as ${best.label} (~${best.miles} mi) — you logged ${m} mi`;
}
