/**
 * Flatten Neo4j driver property values for badge evaluation (Feature 9).
 * Keep thresholds in sync with `database-dorkinians/services/badgeDefinitions.js`.
 */

export type BadgePlayer = Record<string, unknown>;

export function neo4jValueToJs(value: unknown): unknown {
	if (value === null || value === undefined) return value;
	if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") return value;
	if (typeof value === "bigint") return Number(value);
	if (typeof value === "object" && value !== null && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
		return (value as { toNumber: () => number }).toNumber();
	}
	if (typeof value === "object" && value !== null && "low" in value && "high" in value) {
		const o = value as { low: number; high: number };
		return o.low + o.high * 4294967296;
	}
	return value;
}

export function playerPropsFromNeo4j(properties: Record<string, unknown>): BadgePlayer {
	const p: BadgePlayer = {};
	for (const [k, v] of Object.entries(properties)) {
		p[k] = neo4jValueToJs(v);
	}
	return p;
}
