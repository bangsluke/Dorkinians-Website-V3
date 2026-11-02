/**
 * Mirrors the Map-based week/month grouping used in player-fantasy-breakdown
 * to ensure keyed access cannot pollute Object.prototype.
 */
function groupByKey(
	items: Array<{ key: string | null; points: number }>,
): Map<string, { totalPoints: number; count: number }> {
	const groups = new Map<string, { totalPoints: number; count: number }>();
	for (const item of items) {
		if (!item.key) continue;
		const key = String(item.key);
		const group = groups.get(key) ?? { totalPoints: 0, count: 0 };
		group.totalPoints += item.points;
		group.count += 1;
		groups.set(key, group);
	}
	return groups;
}

describe("fantasy week/month Map grouping", () => {
	it("aggregates a normal week key", () => {
		const groups = groupByKey([
			{ key: "2024/25-1", points: 10 },
			{ key: "2024/25-1", points: 5 },
			{ key: "2024/25-2", points: 3 },
		]);
		expect(groups.get("2024/25-1")).toEqual({ totalPoints: 15, count: 2 });
		expect(groups.get("2024/25-2")).toEqual({ totalPoints: 3, count: 1 });
	});

	it("stores __proto__ as a Map key without polluting Object.prototype", () => {
		const before = Object.prototype.hasOwnProperty("polluted");
		const groups = groupByKey([
			{ key: "__proto__", points: 99 },
			{ key: "constructor", points: 1 },
		]);

		expect(groups.get("__proto__")).toEqual({ totalPoints: 99, count: 1 });
		expect(groups.get("constructor")).toEqual({ totalPoints: 1, count: 1 });
		expect(Object.prototype.hasOwnProperty("polluted")).toBe(before);
		expect(({} as Record<string, unknown>).totalPoints).toBeUndefined();
		expect(Object.prototype).not.toHaveProperty("totalPoints");
	});
});
