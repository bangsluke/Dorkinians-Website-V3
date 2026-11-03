/**
 * Format failed-test detail items the same way as the seeding failure email
 * "Failed Tests with Detailed Information" section.
 */

export type FailedTestDetailItem = Record<string, unknown>;

export interface FailedTestDetail {
	name: string;
	type: string;
	count?: number;
	items: FailedTestDetailItem[];
}

function asString(value: unknown, fallback = "N/A"): string {
	if (value == null) return fallback;
	return String(value);
}

function withReason(line: string, item: FailedTestDetailItem): string {
	const reason = item.reason;
	if (typeof reason === "string" && reason.trim()) {
		return `${line} — ${reason.trim()}`;
	}
	return line;
}

export function formatFailedTestItemLine(type: string, item: FailedTestDetailItem): string {
	if (type === "skippedItems") {
		const identifier =
			(item.id as string | undefined) ||
			`${asString(item.from, "")} → ${asString(item.to, "")}`.trim();
		return `${identifier || "N/A"} (${asString(item.reason, "Unknown reason")})`;
	}
	if (type === "fixtureMatchDetails") {
		return withReason(
			`Fixture ${asString(item.id)} — date ${asString(item.date)}, season ${asString(item.season)}, links: ${asString(item.relationshipCount)}`,
			item,
		);
	}
	if (type === "oppositionRelationships") {
		return withReason(
			`Opposition ${asString(item.opposition)} (${asString(item.id)}) — links: ${asString(item.relationshipCount)}`,
			item,
		);
	}
	if (type === "matchDetailFixture") {
		return withReason(
			`MatchDetail ${asString(item.id)} — ${asString(item.playerName)}, date ${asString(item.date)}`,
			item,
		);
	}
	if (type === "playerOpponents") {
		return withReason(`Player ${asString(item.playerName)} (${asString(item.id)})`, item);
	}
	if (type === "details") {
		const matchDetailId = item.matchDetailId ?? item.id ?? "N/A";
		return `MatchDetail ${asString(matchDetailId)} (${asString(item.playerName)}) - ${asString(item.reason, "Unknown reason")}`;
	}
	if (type === "leagueFreshness") {
		const lastUpdated = item.lastUpdated ? `; lastUpdated ${item.lastUpdated}` : "";
		const maxFixtureDate = item.maxFixtureDate ? `; latest fixture ${item.maxFixtureDate}` : "";
		const offendingFixtureCount = item.offendingFixtureCount
			? `; ${item.offendingFixtureCount} offending fixture${Number(item.offendingFixtureCount) !== 1 ? "s" : ""}`
			: "";
		return `${asString(item.team, "Unknown team")} - ${asString(item.reason, "Unknown reason")}${lastUpdated}${maxFixtureDate}${offendingFixtureCount}`;
	}
	try {
		return JSON.stringify(item);
	} catch {
		return asString(item);
	}
}

export function parseFailedTestsDetailJson(raw: unknown): FailedTestDetail[] {
	if (raw == null) return [];
	let parsed: unknown = raw;
	if (typeof raw === "string") {
		const trimmed = raw.trim();
		if (!trimmed) return [];
		try {
			parsed = JSON.parse(trimmed);
		} catch {
			return [];
		}
	}
	if (!Array.isArray(parsed)) return [];
	return parsed
		.filter((entry): entry is FailedTestDetail => {
			return (
				entry != null &&
				typeof entry === "object" &&
				typeof (entry as FailedTestDetail).name === "string" &&
				typeof (entry as FailedTestDetail).type === "string" &&
				Array.isArray((entry as FailedTestDetail).items)
			);
		})
		.map((entry) => ({
			name: entry.name,
			type: entry.type,
			count: typeof entry.count === "number" ? entry.count : entry.items.length,
			items: entry.items,
		}));
}
