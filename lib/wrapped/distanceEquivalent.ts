/** Approx one-way route distances in miles for narrative travel comparisons. */
const ROUTES: { label: string; miles: number }[] = [
	{ label: "London to Brighton", miles: 50 },
	{ label: "London to Manchester", miles: 200 },
	{ label: "London to Paris", miles: 285 },
	{ label: "London to Edinburgh", miles: 400 },
	{ label: "Madrid to Barcelona", miles: 385 },
	{ label: "New York to Boston", miles: 215 },
	{ label: "Berlin to Munich", miles: 365 },
	{ label: "Land's End to John o' Groats", miles: 600 },
];

export function distanceMilesToEquivalent(totalMiles: number): string {
	if (totalMiles <= 0) return "Enough short trips to add up";
	const m = Math.round(totalMiles);
	const closest = [...ROUTES].sort((a, b) => Math.abs(m - a.miles) - Math.abs(m - b.miles)).slice(0, 2);
	const [primary, secondary] = closest;
	if (!primary) return `You logged ${m} miles`;
	const primaryTrips = Math.max(1, Math.round((m / primary.miles) * 10) / 10);
	const secondaryTrips =
		secondary && secondary.miles > 0 ? Math.max(1, Math.round((m / secondary.miles) * 10) / 10) : null;
	return secondary && secondaryTrips
		? `You logged ${m} miles - about ${primaryTrips}x ${primary.label} (~${primary.miles} mi) or ${secondaryTrips}x ${secondary.label} (~${secondary.miles} mi).`
		: `You logged ${m} miles - about ${primaryTrips}x ${primary.label} (~${primary.miles} mi).`;
}
