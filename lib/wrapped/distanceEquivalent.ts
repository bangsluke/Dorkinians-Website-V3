/** Approx one-way route distances in miles for narrative travel comparisons. */
const ROUTES: { label: string; miles: number }[] = [
	{ label: "London to Brighton", miles: 50 },
	{ label: "London to Manchester", miles: 200 },
	{ label: "London to Paris", miles: 285 },
	{ label: "London to Amsterdam", miles: 335 },
	{ label: "London to Edinburgh", miles: 400 },
	{ label: "Land's End to John o' Groats", miles: 600 },
	{ label: "London to Berlin", miles: 700 },
	{ label: "London to Prague", miles: 800 },
	{ label: "London to Vienna", miles: 900 },
	{ label: "London to Madrid", miles: 1000 },
	{ label: "London to Rome", miles: 1100 },
	{ label: "London to Moscow", miles: 1800 },
];

export function distanceMilesToEquivalent(totalMiles: number): string {
	if (totalMiles <= 0) return "Enough short trips to add up";
	const m = Math.round(totalMiles);
	const [closest] = [...ROUTES].sort((a, b) => Math.abs(m - a.miles) - Math.abs(m - b.miles));
	if (!closest) return `${m} miles`;
	return `You logged ${m} miles - about as far as ${closest.label} (~${closest.miles} miles)`;
}
