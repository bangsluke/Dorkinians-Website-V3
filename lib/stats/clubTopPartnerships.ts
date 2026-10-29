import { buildFilterConditions, partitionFilterConditions } from "@/app/api/player-data/route";
import type { PartnershipSortMode } from "@/lib/stats/partnershipSort";

export const CLUB_PARTNERSHIP_MIN_MATCHES = 5;
export const CLUB_PARTNERSHIP_TOP_LIMIT = 10;

export type ClubPartnershipPair = {
	player1: string;
	player2: string;
	matches: number;
	winRate: number;
};

/**
 * Club-wide co-appearance pairs (same fixture), respecting Club Stats filters.
 * Minimum shared games matches Feature 7 player partnerships.
 */
export function buildClubTopPartnershipsQuery(
	graphLabel: string,
	filters: unknown,
	sortMode: PartnershipSortMode = "bestWinRate",
	minMatches: number = CLUB_PARTNERSHIP_MIN_MATCHES,
	limit: number = CLUB_PARTNERSHIP_TOP_LIMIT,
): { query: string; params: Record<string, unknown> } {
	const params: Record<string, unknown> = {
		graphLabel,
		minPartnershipMatches: minMatches,
	};
	const conditions = buildFilterConditions(filters, params);
	const { fixture, matchDetail } = partitionFilterConditions(conditions);

	// Position filters reference `md.` — require both partners' MatchDetails to match.
	const positionBoth = matchDetail.map((c) => {
		const for1 = c.replace(/\bmd\./g, "md1.");
		const for2 = c.replace(/\bmd\./g, "md2.");
		return `(${for1} AND ${for2})`;
	});

	const whereParts = [
		"p1.id < p2.id",
		"coalesce(p1.allowOnSite, true) = true",
		"coalesce(p2.allowOnSite, true) = true",
		"f.result IS NOT NULL",
		...fixture,
		...positionBoth,
	];

	const orderBy =
		sortMode === "mostGames"
			? "matches DESC, winRate DESC, player1 ASC, player2 ASC"
			: "winRate DESC, matches DESC, player1 ASC, player2 ASC";

	const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));

	const query = `
		MATCH (p1:Player {graphLabel: $graphLabel})-[:PLAYED_IN]->(md1:MatchDetail {graphLabel: $graphLabel})
		      <-[:HAS_MATCH_DETAILS]-(f:Fixture {graphLabel: $graphLabel})
		      -[:HAS_MATCH_DETAILS]->(md2:MatchDetail {graphLabel: $graphLabel})
		      <-[:PLAYED_IN]-(p2:Player {graphLabel: $graphLabel})
		WHERE ${whereParts.join("\n		  AND ")}
		WITH p1, p2,
		     count(DISTINCT f) AS matchesTogether,
		     sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) AS winsTogether
		WHERE matchesTogether >= $minPartnershipMatches
		RETURN p1.playerName AS player1,
		       p2.playerName AS player2,
		       matchesTogether AS matches,
		       round(toFloat(winsTogether) / matchesTogether * 1000) / 10 AS winRate
		ORDER BY ${orderBy}
		LIMIT ${safeLimit}
	`;

	return { query, params };
}

export function sortClubPartnershipPairs(
	list: ClubPartnershipPair[],
	mode: PartnershipSortMode,
): ClubPartnershipPair[] {
	const copy = [...list];
	if (mode === "mostGames") {
		copy.sort(
			(a, b) =>
				b.matches - a.matches ||
				b.winRate - a.winRate ||
				a.player1.localeCompare(b.player1) ||
				a.player2.localeCompare(b.player2),
		);
		return copy;
	}
	copy.sort(
		(a, b) =>
			b.winRate - a.winRate ||
			b.matches - a.matches ||
			a.player1.localeCompare(b.player1) ||
			a.player2.localeCompare(b.player2),
	);
	return copy;
}
