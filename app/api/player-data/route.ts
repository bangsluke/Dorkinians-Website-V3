import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";

const corsHeaders = getCorsHeadersWithSecurity();

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// Build filter conditions for Cypher query
export function buildFilterConditions(filters: any, params: any): string[] {
	const conditions: string[] = [];

	if (!filters) {
		return conditions;
	}

	// Time Range filters
	if (filters.timeRange) {
		const { type, seasons, beforeDate, afterDate, startDate, endDate } = filters.timeRange;

		if (type === "season" && seasons && seasons.length > 0) {
			conditions.push(`f.season IN $seasons`);
			params.seasons = seasons;
		} else if (type === "beforeDate" && beforeDate) {
			conditions.push(`f.date <= $beforeDate`);
			params.beforeDate = beforeDate;
		} else if (type === "afterDate" && afterDate) {
			conditions.push(`f.date >= $afterDate`);
			params.afterDate = afterDate;
		} else if (type === "betweenDates" && startDate && endDate) {
			conditions.push(`f.date >= $startDate AND f.date <= $endDate`);
			params.startDate = startDate;
			params.endDate = endDate;
		}
	}

	// Team filters
	if (filters.teams && filters.teams.length > 0) {
		conditions.push(`f.team IN $teams`);
		params.teams = filters.teams;
	}

	// Location filters
	if (filters.location && filters.location.length > 0) {
		const locationConditions = filters.location.map((loc: string) => (loc === "Home" ? 'f.homeOrAway = "Home"' : 'f.homeOrAway = "Away"'));
		conditions.push(`(${locationConditions.join(" OR ")})`);
	}

	// Opposition filters
	if (filters.opposition) {
		const mode = filters.opposition.mode ?? "all";
		if (mode === "team" && filters.opposition.searchTerm) {
			conditions.push(`toLower(f.opposition) CONTAINS toLower($oppositionSearch)`);
			params.oppositionSearch = filters.opposition.searchTerm;
		} else if (mode === "club" && filters.opposition.searchTerm) {
			// Join with OppositionDetails to filter by shortTeamName
			// Need to match OppositionDetails node and check shortTeamName
			conditions.push(`EXISTS {
				MATCH (od:OppositionDetails {graphLabel: $graphLabel})
				WHERE od.opposition = f.opposition 
				AND od.shortTeamName IS NOT NULL
				AND od.shortTeamName <> ''
				AND toLower(od.shortTeamName) CONTAINS toLower($oppositionSearch)
			}`);
			params.oppositionSearch = filters.opposition.searchTerm;
		}
	}

	// Competition filters
	if (filters.competition) {
		const mode = filters.competition.mode ?? "types";
		if (mode === "types" && filters.competition.types && filters.competition.types.length > 0) {
			conditions.push(`f.compType IN $compTypes`);
			params.compTypes = filters.competition.types;
		} else if (mode === "individual" && filters.competition.searchTerm && filters.competition.searchTerm.trim()) {
			conditions.push(`toLower(f.competition) CONTAINS toLower($competitionSearch)`);
			params.competitionSearch = filters.competition.searchTerm.trim();
		}
	}

	// Result filters
	if (filters.result && filters.result.length > 0) {
		const resultMapping: { [key: string]: string } = {
			Win: "W",
			Draw: "D",
			Loss: "L",
		};
		const resultValues = filters.result.map((r: string) => resultMapping[r]).filter(Boolean);
		if (resultValues.length > 0) {
			conditions.push(`f.result IN $results`);
			params.results = resultValues;
		}
	}

	// Position filters
	if (filters.position && filters.position.length > 0) {
		conditions.push(`md.class IN $positions`);
		params.positions = filters.position;
	}

	return conditions;
}

/** Split Cypher filter snippets for appearance-slot queries (allow `md IS NULL` only for f-only conditions). */
export function partitionFilterConditions(conditions: string[]): { fixture: string[]; matchDetail: string[] } {
	const matchDetail = conditions.filter((c) => c.includes("md."));
	const fixture = conditions.filter((c) => !c.includes("md."));
	return { fixture, matchDetail };
}

/** Neo4j RETURN fragment: career streak counters on `p` (Feature 5; independent of stat filters). */
export const PLAYER_STREAK_PROPERTY_RETURN = `
			coalesce(p.currentScoringStreak, 0) as currentScoringStreak,
			coalesce(p.currentAssistStreak, 0) as currentAssistStreak,
			coalesce(p.currentGoalInvolvementStreak, 0) as currentGoalInvolvementStreak,
			coalesce(p.currentCleanSheetStreak, 0) as currentCleanSheetStreak,
			coalesce(p.currentAppearanceStreak, 0) as currentAppearanceStreak,
			coalesce(p.currentStartStreak, 0) as currentStartStreak,
			coalesce(p.currentFullMatchStreak, 0) as currentFullMatchStreak,
			coalesce(p.currentMomStreak, 0) as currentMomStreak,
			coalesce(p.currentDisciplineStreak, 0) as currentDisciplineStreak,
			coalesce(p.currentWinStreak, 0) as currentWinStreak,
			coalesce(p.seasonBestScoringStreak, 0) as seasonBestScoringStreak,
			coalesce(p.seasonBestAssistStreak, 0) as seasonBestAssistStreak,
			coalesce(p.seasonBestCleanSheetStreak, 0) as seasonBestCleanSheetStreak,
			coalesce(p.seasonBestAppearanceStreak, 0) as seasonBestAppearanceStreak,
			coalesce(p.seasonBestDisciplineStreak, 0) as seasonBestDisciplineStreak,
			coalesce(p.seasonBestWinStreak, 0) as seasonBestWinStreak,
			coalesce(p.allTimeBestScoringStreak, 0) as allTimeBestScoringStreak,
			coalesce(p.allTimeBestAppearanceStreak, 0) as allTimeBestAppearanceStreak,
			coalesce(p.allTimeBestCleanSheetStreak, 0) as allTimeBestCleanSheetStreak,
			coalesce(p.allTimeBestWinStreak, 0) as allTimeBestWinStreak`;

/** Neo4j RETURN fragment: Feature 7 graph insights on `p` (independent of stat filters). */
export const PLAYER_GRAPH_INSIGHT_PROPERTY_RETURN = `
			p.bestPartnerName as bestPartnerName,
			p.bestPartnerWinRate as bestPartnerWinRate,
			p.bestPartnerMatches as bestPartnerMatches,
			p.partnershipsTopJson as partnershipsTopJson,
			p.impactDelta as impactDelta,
			p.impactWinRateWith as impactWinRateWith,
			p.impactWinRateWithout as impactWinRateWithout,
			p.impactSampleWith as impactSampleWith,
			p.impactSampleWithout as impactSampleWithout,
			p.squadInfluence as squadInfluence,
			p.squadInfluenceRank as squadInfluenceRank,
			p.communityId as communityId`;

export function mapPlayerStreakFieldsFromRecord(record: { get: (key: string) => unknown }, toNumber: (value: any) => number) {
	return {
		currentScoringStreak: toNumber(record.get("currentScoringStreak")),
		currentAssistStreak: toNumber(record.get("currentAssistStreak")),
		currentGoalInvolvementStreak: toNumber(record.get("currentGoalInvolvementStreak")),
		currentCleanSheetStreak: toNumber(record.get("currentCleanSheetStreak")),
		currentAppearanceStreak: toNumber(record.get("currentAppearanceStreak")),
		currentStartStreak: toNumber(record.get("currentStartStreak")),
		currentFullMatchStreak: toNumber(record.get("currentFullMatchStreak")),
		currentMomStreak: toNumber(record.get("currentMomStreak")),
		currentDisciplineStreak: toNumber(record.get("currentDisciplineStreak")),
		currentWinStreak: toNumber(record.get("currentWinStreak")),
		seasonBestScoringStreak: toNumber(record.get("seasonBestScoringStreak")),
		seasonBestAssistStreak: toNumber(record.get("seasonBestAssistStreak")),
		seasonBestCleanSheetStreak: toNumber(record.get("seasonBestCleanSheetStreak")),
		seasonBestAppearanceStreak: toNumber(record.get("seasonBestAppearanceStreak")),
		seasonBestDisciplineStreak: toNumber(record.get("seasonBestDisciplineStreak")),
		seasonBestWinStreak: toNumber(record.get("seasonBestWinStreak")),
		allTimeBestScoringStreak: toNumber(record.get("allTimeBestScoringStreak")),
		allTimeBestAppearanceStreak: toNumber(record.get("allTimeBestAppearanceStreak")),
		allTimeBestCleanSheetStreak: toNumber(record.get("allTimeBestCleanSheetStreak")),
		allTimeBestWinStreak: toNumber(record.get("allTimeBestWinStreak")),
	};
}

export function mapPlayerGraphInsightFieldsFromRecord(record: { get: (key: string) => unknown }, toNumber: (value: any) => number) {
	const nullableNum = (key: string): number | null => {
		const v = record.get(key);
		if (v === null || v === undefined) return null;
		const n = typeof v === "number" ? v : toNumber(v);
		return Number.isNaN(n) ? null : n;
	};
	const name = record.get("bestPartnerName");
	const bestPartnerName = name != null && String(name).trim() !== "" ? String(name) : null;
	const wr = nullableNum("bestPartnerWinRate");
	const bm = nullableNum("bestPartnerMatches");
	const jsonRaw = record.get("partnershipsTopJson");
	const partnershipsTopJson = jsonRaw != null && String(jsonRaw).trim() !== "" ? String(jsonRaw) : null;
	const graphInsightsBestPartnerDisplay =
		bestPartnerName != null && wr != null && bm != null
			? `${bestPartnerName} (${Math.round(wr * 10) / 10}% in ${Math.round(bm)} games)`
			: bestPartnerName != null
				? bestPartnerName
				: null;
	const sw = nullableNum("impactSampleWith");
	const swo = nullableNum("impactSampleWithout");
	const irWith = nullableNum("impactWinRateWith");
	const irWithout = nullableNum("impactWinRateWithout");
	const rank = nullableNum("squadInfluenceRank");
	const comm = nullableNum("communityId");
	const impactRatesDisplay =
		irWith != null && irWithout != null && sw != null && swo != null
			? `${Math.round(irWith * 10) / 10}% with (${Math.round(sw)} games) · ${Math.round(irWithout * 10) / 10}% without (${Math.round(swo)} games)`
			: null;
	return {
		bestPartnerName,
		bestPartnerWinRate: wr,
		bestPartnerMatches: bm != null ? Math.round(bm) : null,
		partnershipsTopJson,
		graphInsightsBestPartnerDisplay,
		impactDelta: nullableNum("impactDelta"),
		impactWinRateWith: irWith,
		impactWinRateWithout: irWithout,
		impactRatesDisplay,
		impactSampleWith: sw != null ? Math.round(sw) : null,
		impactSampleWithout: swo != null ? Math.round(swo) : null,
		squadInfluence: nullableNum("squadInfluence"),
		squadInfluenceRank: rank != null ? Math.round(rank) : null,
		communityId: comm != null ? Math.round(comm) : null,
	};
}

/** Co-appearance / partnership rows scoped to the same fixtures as `buildPlayerStatsQuery` filters. */
export function buildFilteredPartnershipsQuery(playerName: string, filters: any): { query: string; params: Record<string, unknown> } {
	const graphLabel = neo4jService.getGraphLabel();
	const params: Record<string, unknown> = { graphLabel, playerName };
	const conditions = buildFilterConditions(filters, params);
	let query = `
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
		MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)`;
	if (conditions.length > 0) {
		query += ` WHERE ${conditions.join(" AND ")}`;
	}
	query += `
		WITH p, f, md.team AS xiTeam
		MATCH (f)-[:HAS_MATCH_DETAILS]->(mdO:MatchDetail {graphLabel: $graphLabel})
		WHERE mdO.team = xiTeam
		MATCH (pOther:Player {graphLabel: $graphLabel})-[:PLAYED_IN]->(mdO)
		WHERE pOther <> p AND coalesce(pOther.allowOnSite, true) = true
		WITH pOther.playerName AS mateName, f, f.result AS res
		WITH mateName, count(*) AS matches, sum(CASE WHEN res = 'W' THEN 1 ELSE 0 END) AS winCount
		WHERE matches >= 5
		RETURN mateName, matches, CASE WHEN matches > 0 THEN toFloat(winCount) * 100.0 / matches ELSE 0.0 END AS winRate
		LIMIT 400`;
	return { query, params };
}

export function buildFilteredImpactWithQuery(playerName: string, filters: any, team: string): { query: string; params: Record<string, unknown> } | null {
	if (!team || String(team).trim() === "") return null;
	const graphLabel = neo4jService.getGraphLabel();
	const params: Record<string, unknown> = { graphLabel, playerName, team };
	const conditions = buildFilterConditions(filters, params);
	let query = `
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
		WHERE md.team = $team
		MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)`;
	if (conditions.length > 0) {
		query += ` WHERE ${conditions.join(" AND ")}`;
	}
	query += `
		RETURN count(f) AS games, sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) AS wins`;
	return { query, params };
}

export function buildFilteredImpactWithoutQuery(playerName: string, filters: any, team: string): { query: string; params: Record<string, unknown> } | null {
	if (!team || String(team).trim() === "") return null;
	const graphLabel = neo4jService.getGraphLabel();
	const params: Record<string, unknown> = { graphLabel, playerName, team };
	const conditions = buildFilterConditions(filters, params);
	let query = `
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md:MatchDetail {graphLabel: $graphLabel})
		WHERE md.team = $team
		AND NOT (p)-[:PLAYED_IN]->(md)`;
	if (conditions.length > 0) {
		query += ` AND ${conditions.join(" AND ")}`;
	}
	query += `
		RETURN count(f) AS games, sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) AS wins`;
	return { query, params };
}

/** Top players by co-appearance edge count in filtered fixtures (proxy for squad “backbone” when filters apply). */
export function buildFilteredClubSquadBackboneQuery(filters: any): { query: string; params: Record<string, unknown> } {
	const graphLabel = neo4jService.getGraphLabel();
	const params: Record<string, unknown> = { graphLabel };
	const conditions = buildFilterConditions(filters, params);
	let query = `
		MATCH (p:Player {graphLabel: $graphLabel})
		WHERE coalesce(p.allowOnSite, true) = true
		MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
		MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)`;
	if (conditions.length > 0) {
		query += ` WHERE ${conditions.join(" AND ")}`;
	}
	query += `
		WITH p, f, md.team AS xiTeam
		MATCH (f)-[:HAS_MATCH_DETAILS]->(mdO:MatchDetail {graphLabel: $graphLabel})
		WHERE mdO.team = xiTeam
		MATCH (pOther:Player {graphLabel: $graphLabel})-[:PLAYED_IN]->(mdO)
		WHERE pOther <> p AND coalesce(pOther.allowOnSite, true) = true
		WITH p.playerName AS playerName, count(*) AS edgeWeight
		RETURN playerName, edgeWeight
		ORDER BY edgeWeight DESC
		LIMIT 12`;
	return { query, params };
}

export type FilteredPartnershipRow = { mateName: string; matches: number; winRate: number };

/** Build graph-insight object fields to merge into filtered player payloads (overrides precomputed Player properties). */
export function packFilteredPlayerGraphInsights(
	rows: FilteredPartnershipRow[],
	withStats: { games: number; wins: number } | null,
	withoutStats: { games: number; wins: number } | null
): ReturnType<typeof mapPlayerGraphInsightFieldsFromRecord> {
	const toNumber = (value: unknown): number => {
		if (value === null || value === undefined) return 0;
		if (typeof value === "number") return Number.isNaN(value) ? 0 : value;
		const n = Number(value);
		return Number.isNaN(n) ? 0 : n;
	};

	/** Union top partners by co-appearance volume and by win rate so UI "best win %" is not limited to the busiest teammates only. */
	const valid = rows.filter((r) => r.mateName.length > 0 && r.matches >= 5);
	const byName = new Map<string, FilteredPartnershipRow>();
	for (const r of valid) {
		byName.set(r.mateName, r);
	}
	const all = [...byName.values()];
	const byMatches = [...all].sort((a, b) => b.matches - a.matches || b.winRate - a.winRate || a.mateName.localeCompare(b.mateName));
	const byWinRate = [...all].sort((a, b) => b.winRate - a.winRate || b.matches - a.matches || a.mateName.localeCompare(b.mateName));
	const picked = new Map<string, FilteredPartnershipRow>();
	for (const r of byMatches.slice(0, 45)) picked.set(r.mateName, r);
	for (const r of byWinRate.slice(0, 45)) picked.set(r.mateName, r);
	const merged = [...picked.values()];

	const partnershipsTopJson =
		merged.length > 0
			? JSON.stringify(
					merged.map((r) => ({
						name: r.mateName,
						matches: Math.round(r.matches),
						winRate: Math.round(r.winRate * 10) / 10,
					}))
				)
			: null;

	const topWin = byWinRate[0];
	const bestPartnerName = topWin && topWin.mateName ? topWin.mateName : null;
	const bestPartnerWinRate = topWin ? topWin.winRate : null;
	const bestPartnerMatches = topWin ? Math.round(topWin.matches) : null;

	const graphInsightsBestPartnerDisplay =
		bestPartnerName != null && bestPartnerWinRate != null && bestPartnerMatches != null
			? `${bestPartnerName} (${Math.round(bestPartnerWinRate * 10) / 10}% in ${Math.round(bestPartnerMatches)} games)`
			: bestPartnerName;

	let impactWinRateWith: number | null = null;
	let impactWinRateWithout: number | null = null;
	let impactSampleWith: number | null = null;
	let impactSampleWithout: number | null = null;
	let impactDelta: number | null = null;
	let impactRatesDisplay: string | null = null;

	if (withStats && withStats.games > 0) {
		impactSampleWith = Math.round(withStats.games);
		impactWinRateWith = (withStats.wins / withStats.games) * 100;
	}
	if (withoutStats && withoutStats.games > 0) {
		impactSampleWithout = Math.round(withoutStats.games);
		impactWinRateWithout = (withoutStats.wins / withoutStats.games) * 100;
	}

	if (impactWinRateWith != null && impactWinRateWithout != null) {
		impactDelta = Math.round((impactWinRateWith - impactWinRateWithout) * 10) / 10;
		impactRatesDisplay =
			impactSampleWith != null && impactSampleWithout != null
				? `${Math.round(impactWinRateWith * 10) / 10}% with (${impactSampleWith} games) · ${Math.round(impactWinRateWithout * 10) / 10}% without (${impactSampleWithout} games)`
				: null;
	} else if (impactWinRateWith != null && impactSampleWith != null) {
		impactRatesDisplay = `${Math.round(impactWinRateWith * 10) / 10}% with (${impactSampleWith} games)`;
	}

	const synthetic = {
		get: (k: string): unknown => {
			switch (k) {
				case "bestPartnerName":
					return bestPartnerName;
				case "bestPartnerWinRate":
					return bestPartnerWinRate;
				case "bestPartnerMatches":
					return bestPartnerMatches;
				case "partnershipsTopJson":
					return partnershipsTopJson;
				case "impactDelta":
					return impactDelta;
				case "impactWinRateWith":
					return impactWinRateWith;
				case "impactWinRateWithout":
					return impactWinRateWithout;
				case "impactSampleWith":
					return impactSampleWith;
				case "impactSampleWithout":
					return impactSampleWithout;
				default:
					return null;
			}
		},
	};
	const base = mapPlayerGraphInsightFieldsFromRecord(synthetic, toNumber);
	return {
		...base,
		graphInsightsBestPartnerDisplay,
	};
}

/** Collect ordered match rows for live streak computation (same shape as foundation streak seeding). */
export function buildStreakMatchesCollectQuery(playerName: string, filters: any): { query: string; params: Record<string, unknown> } {
	const graphLabel = neo4jService.getGraphLabel();
	const params: Record<string, unknown> = { graphLabel, playerName };
	const conditions = buildFilterConditions(filters, params);
	let query = `
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		OPTIONAL MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
		OPTIONAL MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)`;
	if (conditions.length > 0) {
		query += ` WHERE md IS NULL OR (
			f IS NOT NULL
			AND f.seasonWeek IS NOT NULL
			AND f.seasonWeek <> ''
			AND (f.status IS NULL OR NOT (f.status IN ['Void', 'Postponed', 'Abandoned']))
			AND ${conditions.join(" AND ")}
		)`;
	} else {
		query += ` WHERE md IS NULL OR (
			f IS NOT NULL
			AND f.seasonWeek IS NOT NULL
			AND f.seasonWeek <> ''
			AND (f.status IS NULL OR NOT (f.status IN ['Void', 'Postponed', 'Abandoned']))
		)`;
	}
	query += `
		WITH p, md, f
		ORDER BY f.date ASC
		WITH p, collect(CASE WHEN md IS NULL OR f IS NULL THEN null ELSE {
			season: md.season,
			seasonWeek: f.seasonWeek,
			team: md.team,
			date: f.date,
			goals: md.goals,
			penaltiesScored: md.penaltiesScored,
			assists: md.assists,
			cleanSheets: md.cleanSheets,
			class: md.class,
			minutes: md.minutes,
			started: md.started,
			mom: md.mom,
			yellowCards: md.yellowCards,
			redCards: md.redCards,
			fixtureResult: f.result,
			fixtureId: f.id
		} END) as rawMatches
		RETURN rawMatches`;
	return { query, params };
}

/** Season fixture schedule for teams the player appeared for (unfiltered full schedule for break checks). */
export function buildStreakAppearanceSlotsCollectQuery(playerName: string, _filters: any): { query: string; params: Record<string, unknown> } {
	const graphLabel = neo4jService.getGraphLabel();
	const params: Record<string, unknown> = { graphLabel, playerName };
	let query = `
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		OPTIONAL MATCH (p)-[:PLAYED_IN]->(mdp:MatchDetail {graphLabel: $graphLabel})
		WHERE mdp.season IS NOT NULL AND mdp.team IS NOT NULL
		OPTIONAL MATCH (f:Fixture {graphLabel: $graphLabel})
		WHERE f.season = mdp.season
		  AND f.team = mdp.team
		  AND f.seasonWeek IS NOT NULL
		  AND f.seasonWeek <> ''
		  AND (f.status IS NULL OR NOT (f.status IN ['Void', 'Postponed', 'Abandoned']))
		WITH collect(DISTINCT CASE WHEN f IS NULL THEN null ELSE {
			season: f.season,
			seasonWeek: f.seasonWeek,
			team: f.team,
			date: f.date,
			fixtureId: f.id
		} END) AS seasonFixturesRaw`;
	query += `
		WITH [sf IN seasonFixturesRaw WHERE sf IS NOT NULL] AS seasonFixtures
		RETURN seasonFixtures AS appearanceSlots`;
	return { query, params };
}

// Build unified Cypher query with aggregation
export function buildPlayerStatsQuery(playerName: string, filters: any = null): { query: string; params: any } {
	const graphLabel = neo4jService.getGraphLabel();
	const params: any = {
		graphLabel,
		playerName,
	};

	// Base query - match player and join to MatchDetail and Fixture
	let query = `
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
		MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
	`;

	// Build filter conditions
	const conditions = buildFilterConditions(filters, params);
	if (conditions.length > 0) {
		query += ` WHERE ${conditions.join(" AND ")}`;
	}

	// Aggregation query with all stats calculated in Cypher
	query += `
		WITH p, md, f
		// Aggregate all stats in a single pass
		WITH p,
			count(md) as appearances,
			sum(coalesce(md.minutes, 0)) as minutes,
			sum(coalesce(md.mom, 0)) as mom,
			sum(coalesce(md.goals, 0)) as goals,
			sum(coalesce(md.assists, 0)) as assists,
			sum(coalesce(md.yellowCards, 0)) as yellowCards,
			sum(coalesce(md.redCards, 0)) as redCards,
			sum(coalesce(md.saves, 0)) as saves,
			sum(coalesce(md.ownGoals, 0)) as ownGoals,
			sum(coalesce(md.conceded, 0)) as conceded,
			sum(coalesce(md.cleanSheets, 0)) as cleanSheets,
			sum(CASE 
				WHEN toUpper(coalesce(md.class, "")) = "GK" 
				AND f IS NOT NULL
				AND coalesce(f.conceded, -1) = 0
				THEN 1 
				ELSE 0 
			END) as gkCleanSheets,
			sum(coalesce(md.penaltiesScored, 0)) as penaltiesScored,
			sum(coalesce(md.penaltiesMissed, 0)) as penaltiesMissed,
			sum(coalesce(md.penaltiesConceded, 0)) as penaltiesConceded,
			sum(coalesce(md.penaltiesSaved, 0)) as penaltiesSaved,
			sum(coalesce(md.penaltyShootoutPenaltiesScored, 0)) as penaltyShootoutPenaltiesScored,
			sum(coalesce(md.penaltyShootoutPenaltiesMissed, 0)) as penaltyShootoutPenaltiesMissed,
			sum(coalesce(md.penaltyShootoutPenaltiesSaved, 0)) as penaltyShootoutPenaltiesSaved,
			sum(coalesce(md.fantasyPoints, 0)) as fantasyPoints,
			sum(coalesce(md.distance, 0)) as distance,
			sum(CASE WHEN toUpper(coalesce(md.class, "")) = "GK" THEN 1 ELSE 0 END) as gk,
			sum(CASE WHEN toUpper(coalesce(md.class, "")) = "DEF" THEN 1 ELSE 0 END) as def,
			sum(CASE WHEN toUpper(coalesce(md.class, "")) = "MID" THEN 1 ELSE 0 END) as mid,
			sum(CASE WHEN toUpper(coalesce(md.class, "")) = "FWD" THEN 1 ELSE 0 END) as fwd,
			sum(CASE WHEN toUpper(coalesce(md.class, "")) = "GK" THEN coalesce(md.minutes, 0) ELSE 0 END) as gkMinutes,
			sum(CASE WHEN toUpper(coalesce(md.class, "")) = "DEF" THEN coalesce(md.minutes, 0) ELSE 0 END) as defMinutes,
			sum(CASE WHEN toUpper(coalesce(md.class, "")) = "MID" THEN coalesce(md.minutes, 0) ELSE 0 END) as midMinutes,
			sum(CASE WHEN toUpper(coalesce(md.class, "")) = "FWD" THEN coalesce(md.minutes, 0) ELSE 0 END) as fwdMinutes,
			collect(DISTINCT md.team) as teams,
			collect(DISTINCT md.season) as seasons,
			count(DISTINCT f.opposition) as oppositionPlayed,
			count(DISTINCT f.competition) as competitionsCompeted,
			sum(CASE WHEN f.homeOrAway = "Home" THEN 1 ELSE 0 END) as homeGames,
			sum(CASE WHEN f.homeOrAway = "Home" AND f.result = "W" THEN 1 ELSE 0 END) as homeWins,
			sum(CASE WHEN f.homeOrAway = "Away" THEN 1 ELSE 0 END) as awayGames,
			sum(CASE WHEN f.homeOrAway = "Away" AND f.result = "W" THEN 1 ELSE 0 END) as awayWins,
			sum(CASE WHEN f.result = "W" THEN 1 ELSE 0 END) as wins,
			sum(CASE WHEN f.result = "D" THEN 1 ELSE 0 END) as draws,
			sum(CASE WHEN f.result = "L" THEN 1 ELSE 0 END) as losses,
			sum(CASE WHEN md.goals > 0 AND f.result = "W" THEN 1 ELSE 0 END) as winsWhenScoring,
			sum(CASE WHEN md.goals > 0 THEN 1 ELSE 0 END) as gamesWithGoals,
			sum(CASE WHEN md.started = true THEN 1 ELSE 0 END) as starts,
			sum(CASE WHEN md.started = false THEN 1 ELSE 0 END) as subAppearances,
			sum(CASE WHEN md.started = true AND f.result = "W" THEN 1 ELSE 0 END) as winsWhenStarting,
			sum(CASE WHEN md.started = false AND f.result = "W" THEN 1 ELSE 0 END) as winsFromBench,
			avg(md.matchRating) as averageMatchRating,
			max(md.matchRating) as highestMatchRating,
			sum(CASE WHEN coalesce(md.matchRating, 0) >= 8.0 THEN 1 ELSE 0 END) as matchesRated8Plus
		// Calculate team aggregations separately - re-match with filters
		WITH p, appearances, minutes, mom, goals, assists, yellowCards, redCards, saves, ownGoals, conceded, cleanSheets, gkCleanSheets,
			starts, subAppearances, winsWhenStarting, winsFromBench, averageMatchRating, highestMatchRating, matchesRated8Plus,
			penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, penaltyShootoutPenaltiesScored, penaltyShootoutPenaltiesMissed, penaltyShootoutPenaltiesSaved, fantasyPoints, distance,
			gk, def, mid, fwd, gkMinutes, defMinutes, midMinutes, fwdMinutes,
			teams, seasons, oppositionPlayed, competitionsCompeted, homeGames, homeWins, awayGames, awayWins, wins, draws, losses, winsWhenScoring, gamesWithGoals
		MATCH (p)-[:PLAYED_IN]->(md2:MatchDetail {graphLabel: $graphLabel})
		MATCH (f2:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md2)
	`;
	
	// Re-apply same filter conditions for team aggregation (replace f with f2 and md with md2)
	if (conditions.length > 0) {
		const teamConditions = conditions.map((cond) => cond.replace(/\bf\./g, "f2.").replace(/\bmd\./g, "md2."));
		query += ` WHERE ${teamConditions.join(" AND ")}`;
	}
	
	query += `
		WITH p, appearances, minutes, mom, goals, assists, yellowCards, redCards, saves, ownGoals, conceded, cleanSheets, gkCleanSheets,
			starts, subAppearances, winsWhenStarting, winsFromBench, averageMatchRating, highestMatchRating, matchesRated8Plus,
			penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, penaltyShootoutPenaltiesScored, penaltyShootoutPenaltiesMissed, penaltyShootoutPenaltiesSaved, fantasyPoints, distance,
			gk, def, mid, fwd, gkMinutes, defMinutes, midMinutes, fwdMinutes,
			teams, seasons, oppositionPlayed, competitionsCompeted, homeGames, homeWins, awayGames, awayWins, wins, draws, losses, winsWhenScoring, gamesWithGoals,
			md2.team as team,
			md2.goals as teamGoal,
			md2.penaltiesScored as teamPenaltiesScored
		WITH p, appearances, minutes, mom, goals, assists, yellowCards, redCards, saves, ownGoals, conceded, cleanSheets, gkCleanSheets,
			starts, subAppearances, winsWhenStarting, winsFromBench, averageMatchRating, highestMatchRating, matchesRated8Plus,
			penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, penaltyShootoutPenaltiesScored, penaltyShootoutPenaltiesMissed, penaltyShootoutPenaltiesSaved, fantasyPoints, distance,
			gk, def, mid, fwd, gkMinutes, defMinutes, midMinutes, fwdMinutes,
			teams, seasons, oppositionPlayed, competitionsCompeted, homeGames, homeWins, awayGames, awayWins, wins, draws, losses, winsWhenScoring, gamesWithGoals,
			team,
			count(*) as teamAppearances,
			sum(coalesce(teamGoal, 0)) + sum(coalesce(teamPenaltiesScored, 0)) as teamGoals,
			CASE 
				WHEN team = "1st XI" THEN 1
				WHEN team = "2nd XI" THEN 2
				WHEN team = "3rd XI" THEN 3
				WHEN team = "4th XI" THEN 4
				WHEN team = "5th XI" THEN 5
				WHEN team = "6th XI" THEN 6
				WHEN team = "7th XI" THEN 7
				WHEN team = "8th XI" THEN 8
				ELSE 999
			END as teamPriority
		WITH p, appearances, minutes, mom, goals, assists, yellowCards, redCards, saves, ownGoals, conceded, cleanSheets, gkCleanSheets,
			starts, subAppearances, winsWhenStarting, winsFromBench, averageMatchRating, highestMatchRating, matchesRated8Plus,
			penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, penaltyShootoutPenaltiesScored, penaltyShootoutPenaltiesMissed, penaltyShootoutPenaltiesSaved, fantasyPoints, distance,
			gk, def, mid, fwd, gkMinutes, defMinutes, midMinutes, fwdMinutes,
			teams, seasons, oppositionPlayed, competitionsCompeted, homeGames, homeWins, awayGames, awayWins, wins, draws, losses, winsWhenScoring, gamesWithGoals,
			collect({team: team, appearances: teamAppearances, goals: teamGoals, teamPriority: teamPriority}) as teamStats
		WITH p, appearances, minutes, mom, goals, assists, yellowCards, redCards, saves, ownGoals, conceded, cleanSheets, gkCleanSheets,
			starts, subAppearances, winsWhenStarting, winsFromBench, averageMatchRating, highestMatchRating, matchesRated8Plus,
			penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, penaltyShootoutPenaltiesScored, penaltyShootoutPenaltiesMissed, penaltyShootoutPenaltiesSaved, fantasyPoints, distance,
			gk, def, mid, fwd, gkMinutes, defMinutes, midMinutes, fwdMinutes,
			teams, seasons, oppositionPlayed, competitionsCompeted, homeGames, homeWins, awayGames, awayWins, wins, draws, losses, winsWhenScoring, gamesWithGoals, teamStats
		// Handle team stats - find most played and most scored teams
		// Use reduce to find max, handling empty teamStats
		// For ties, prefer higher team (lower priority number: 1st XI = 1, 2nd XI = 2, etc.)
		WITH p, appearances, minutes, mom, goals, assists, yellowCards, redCards, saves, ownGoals, conceded, cleanSheets, gkCleanSheets,
			starts, subAppearances, winsWhenStarting, winsFromBench, averageMatchRating, highestMatchRating, matchesRated8Plus,
			penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, penaltyShootoutPenaltiesScored, penaltyShootoutPenaltiesMissed, penaltyShootoutPenaltiesSaved, fantasyPoints, distance,
			gk, def, mid, fwd, gkMinutes, defMinutes, midMinutes, fwdMinutes,
			teams, seasons, oppositionPlayed, competitionsCompeted, homeGames, homeWins, awayGames, awayWins, wins, draws, losses, winsWhenScoring, gamesWithGoals,
			CASE WHEN size(teamStats) = 0 THEN {team: "", appearances: 0, goals: 0, teamPriority: 999}
			ELSE reduce(maxTeam = teamStats[0], ts in teamStats | 
				CASE 
					WHEN ts.appearances > maxTeam.appearances THEN ts
					WHEN ts.appearances = maxTeam.appearances AND ts.teamPriority < maxTeam.teamPriority THEN ts
					ELSE maxTeam
				END
			)
			END as mostPlayedTeam,
			CASE WHEN size(teamStats) = 0 THEN {team: "", appearances: 0, goals: 0, teamPriority: 999}
			ELSE reduce(maxTeam = teamStats[0], ts in teamStats | 
				CASE 
					WHEN ts.goals > maxTeam.goals THEN ts
					WHEN ts.goals = maxTeam.goals AND ts.teamPriority < maxTeam.teamPriority THEN ts
					ELSE maxTeam
				END
			)
			END as mostScoredTeam
		// Calculate teammates - need to query separately
		// Pass through mostPlayedTeam and mostScoredTeam so they're available later
		WITH p, appearances, minutes, mom, goals, assists, yellowCards, redCards, saves, ownGoals, conceded, cleanSheets, gkCleanSheets,
			starts, subAppearances, winsWhenStarting, winsFromBench, averageMatchRating, highestMatchRating, matchesRated8Plus,
			penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, penaltyShootoutPenaltiesScored, penaltyShootoutPenaltiesMissed, penaltyShootoutPenaltiesSaved, fantasyPoints, distance,
			gk, def, mid, fwd, gkMinutes, defMinutes, midMinutes, fwdMinutes,
			teams, seasons, oppositionPlayed, competitionsCompeted, homeGames, homeWins, awayGames, awayWins, wins, draws, losses, winsWhenScoring, gamesWithGoals,
			mostPlayedTeam, mostScoredTeam
		MATCH (p)-[:PLAYED_IN]->(md3:MatchDetail {graphLabel: $graphLabel})
		MATCH (f3:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md3)
	`;
	
	// Re-apply same filter conditions for teammates query
	if (conditions.length > 0) {
		const teammateConditions = conditions.map((cond) => cond.replace(/\bf\./g, "f3.").replace(/\bmd\./g, "md3."));
		query += ` WHERE ${teammateConditions.join(" AND ")}`;
	}
	
	query += `
		WITH p, appearances, minutes, mom, goals, assists, yellowCards, redCards, saves, ownGoals, conceded, cleanSheets, gkCleanSheets,
			starts, subAppearances, winsWhenStarting, winsFromBench, averageMatchRating, highestMatchRating, matchesRated8Plus,
			penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, penaltyShootoutPenaltiesScored, penaltyShootoutPenaltiesMissed, penaltyShootoutPenaltiesSaved, fantasyPoints, distance,
			gk, def, mid, fwd, gkMinutes, defMinutes, midMinutes, fwdMinutes,
			teams, seasons, oppositionPlayed, competitionsCompeted, homeGames, homeWins, awayGames, awayWins, wins, draws, losses, winsWhenScoring, gamesWithGoals,
			mostPlayedTeam, mostScoredTeam,
			coalesce(mostPlayedTeam.team, "") as mostPlayedForTeam,
			coalesce(mostPlayedTeam.appearances, 0) as mostPlayedForTeamAppearances,
			coalesce(mostScoredTeam.team, "") as mostScoredForTeam,
			coalesce(mostScoredTeam.goals, 0) as mostScoredForTeamGoals,
			size(teams) as numberTeamsPlayedFor,
			size(seasons) as numberSeasonsPlayedFor,
			f3
		MATCH (f3)-[:HAS_MATCH_DETAILS]->(md4:MatchDetail {graphLabel: $graphLabel})
		MATCH (md4)<-[:PLAYED_IN]-(p2:Player {graphLabel: $graphLabel})
		WHERE p2.playerName <> $playerName
		WITH p, appearances, minutes, mom, goals, assists, yellowCards, redCards, saves, ownGoals, conceded, cleanSheets, gkCleanSheets,
			starts, subAppearances, winsWhenStarting, winsFromBench, averageMatchRating, highestMatchRating, matchesRated8Plus,
			penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, penaltyShootoutPenaltiesScored, penaltyShootoutPenaltiesMissed, penaltyShootoutPenaltiesSaved, fantasyPoints, distance,
			gk, def, mid, fwd, gkMinutes, defMinutes, midMinutes, fwdMinutes,
			mostPlayedForTeam, mostPlayedForTeamAppearances, mostScoredForTeam, mostScoredForTeamGoals, numberTeamsPlayedFor, numberSeasonsPlayedFor,
			oppositionPlayed, competitionsCompeted,
			homeGames, homeWins, awayGames, awayWins, wins, draws, losses, winsWhenScoring, gamesWithGoals,
			count(DISTINCT p2.playerName) as teammatesPlayedWith
		// Calculate derived stats
		WITH p, appearances, minutes, mom, goals, assists, yellowCards, redCards, saves, ownGoals, conceded, cleanSheets, gkCleanSheets,
			starts, subAppearances, winsWhenStarting, winsFromBench, averageMatchRating, highestMatchRating, matchesRated8Plus,
			penaltiesScored, penaltiesMissed, penaltiesConceded, penaltiesSaved, penaltyShootoutPenaltiesScored, penaltyShootoutPenaltiesMissed, penaltyShootoutPenaltiesSaved, fantasyPoints, distance,
			gk, def, mid, fwd, gkMinutes, defMinutes, midMinutes, fwdMinutes,
			mostPlayedForTeam, mostPlayedForTeamAppearances, mostScoredForTeam, mostScoredForTeamGoals, numberTeamsPlayedFor, numberSeasonsPlayedFor,
			oppositionPlayed, competitionsCompeted, teammatesPlayedWith,
			homeGames, homeWins, awayGames, awayWins, wins, draws, losses, winsWhenScoring, gamesWithGoals,
			goals + penaltiesScored as allGoalsScored,
			goals as openPlayGoalsScored,
			(goals + penaltiesScored) + assists as goalInvolvements,
			CASE WHEN appearances > 0 THEN toFloat(goals + penaltiesScored) / appearances ELSE 0.0 END as goalsPerApp,
			CASE WHEN appearances > 0 THEN toFloat(assists) / appearances ELSE 0.0 END as assistsPerApp,
			CASE WHEN appearances > 0 THEN toFloat((goals + penaltiesScored) + assists) / appearances ELSE 0.0 END as goalInvolvementsPerApp,
			CASE WHEN appearances > 0 THEN toFloat(conceded) / appearances ELSE 0.0 END as concededPerApp,
			CASE WHEN (goals + penaltiesScored) > 0 THEN toFloat(minutes) / (goals + penaltiesScored) ELSE 0.0 END as minutesPerGoal,
			CASE WHEN cleanSheets > 0 THEN toFloat(minutes) / cleanSheets ELSE 0.0 END as minutesPerCleanSheet,
			CASE WHEN appearances > 0 THEN toFloat(fantasyPoints) / appearances ELSE 0.0 END as fantasyPointsPerApp,
			CASE WHEN appearances > 0 THEN toFloat(minutes) / appearances ELSE 0.0 END as minutesPerApp,
			CASE WHEN appearances > 0 THEN toFloat(mom) / appearances ELSE 0.0 END as momPerApp,
			CASE WHEN appearances > 0 THEN toFloat(yellowCards) / appearances ELSE 0.0 END as yellowCardsPerApp,
			CASE WHEN appearances > 0 THEN toFloat(redCards) / appearances ELSE 0.0 END as redCardsPerApp,
			CASE WHEN appearances > 0 THEN toFloat(saves) / appearances ELSE 0.0 END as savesPerApp,
			CASE WHEN appearances > 0 THEN toFloat(ownGoals) / appearances ELSE 0.0 END as ownGoalsPerApp,
			CASE WHEN appearances > 0 THEN toFloat(cleanSheets) / appearances ELSE 0.0 END as cleanSheetsPerApp,
			CASE WHEN appearances > 0 THEN toFloat(penaltiesScored) / appearances ELSE 0.0 END as penaltiesScoredPerApp,
			CASE WHEN appearances > 0 THEN toFloat(penaltiesMissed) / appearances ELSE 0.0 END as penaltiesMissedPerApp,
			CASE WHEN appearances > 0 THEN toFloat(penaltiesConceded) / appearances ELSE 0.0 END as penaltiesConcededPerApp,
			CASE WHEN appearances > 0 THEN toFloat(penaltiesSaved) / appearances ELSE 0.0 END as penaltiesSavedPerApp,
			CASE WHEN (penaltiesScored + penaltiesMissed) > 0 THEN toFloat(penaltiesScored) / (penaltiesScored + penaltiesMissed) * 100 ELSE 0.0 END as penaltyConversionRate,
			CASE WHEN gamesWithGoals > 0 THEN toFloat(winsWhenScoring) / gamesWithGoals * 100 ELSE 0.0 END as winRateWhenScoring,
			CASE WHEN homeGames + awayGames > 0 THEN toFloat(wins) / (homeGames + awayGames) * 100 ELSE 0.0 END as gamesPercentWon,
			CASE WHEN homeGames > 0 THEN toFloat(homeWins) / homeGames * 100 ELSE 0.0 END as homeGamesPercentWon,
			CASE WHEN awayGames > 0 THEN toFloat(awayWins) / awayGames * 100 ELSE 0.0 END as awayGamesPercentWon,
			CASE WHEN homeGames + awayGames > 0 THEN toFloat(wins * 3 + draws * 1 + losses * 0) / (homeGames + awayGames) ELSE 0.0 END as pointsPerGame,
			CASE WHEN starts > 0 THEN toFloat(winsWhenStarting) / starts * 100 ELSE 0.0 END as winRateWhenStarting,
			CASE WHEN subAppearances > 0 THEN toFloat(winsFromBench) / subAppearances * 100 ELSE 0.0 END as winRateFromBench,
			CASE WHEN appearances > 0 THEN toFloat(starts) / appearances * 100 ELSE 0.0 END as startRatePercent,
			CASE WHEN minutes >= 360 THEN round((toFloat(goals + penaltiesScored) / minutes) * 90 * 100) / 100 ELSE null END as goalsPer90,
			CASE WHEN minutes >= 360 THEN round((toFloat(assists) / minutes) * 90 * 100) / 100 ELSE null END as assistsPer90,
			CASE WHEN minutes >= 360 THEN round((toFloat((goals + penaltiesScored) + assists) / minutes) * 90 * 100) / 100 ELSE null END as goalInvolvementsPer90,
			CASE WHEN minutes >= 360 THEN round((toFloat(fantasyPoints) / minutes) * 90 * 100) / 100 ELSE null END as ftpPer90,
			CASE WHEN minutes >= 360 THEN round((toFloat(cleanSheets) / minutes) * 90 * 100) / 100 ELSE null END as cleanSheetsPer90,
			CASE WHEN minutes >= 360 THEN round((toFloat(conceded) / minutes) * 90 * 100) / 100 ELSE null END as concededPer90,
			CASE WHEN minutes >= 360 THEN round((toFloat(saves) / minutes) * 90 * 100) / 100 ELSE null END as savesPer90,
			CASE WHEN minutes >= 360 THEN round((toFloat(yellowCards + redCards) / minutes) * 90 * 100) / 100 ELSE null END as cardsPer90,
			CASE WHEN minutes >= 360 THEN round((toFloat(mom) / minutes) * 90 * 100) / 100 ELSE null END as momPer90
		RETURN p.id as id,
			p.playerName as playerName,
			p.allowOnSite as allowOnSite,
			p.graphLabel as graphLabel,
			coalesce(gk, 0) as gk,
			coalesce(def, 0) as def,
			coalesce(mid, 0) as mid,
			coalesce(fwd, 0) as fwd,
			coalesce(gkMinutes, 0) as gkMinutes,
			coalesce(defMinutes, 0) as defMinutes,
			coalesce(midMinutes, 0) as midMinutes,
			coalesce(fwdMinutes, 0) as fwdMinutes,
			coalesce(appearances, 0) as appearances,
			coalesce(minutes, 0) as minutes,
			coalesce(mom, 0) as mom,
			coalesce(goals, 0) as goals,
			coalesce(assists, 0) as assists,
			coalesce(yellowCards, 0) as yellowCards,
			coalesce(redCards, 0) as redCards,
			coalesce(saves, 0) as saves,
			coalesce(ownGoals, 0) as ownGoals,
			coalesce(conceded, 0) as conceded,
			coalesce(cleanSheets, 0) as cleanSheets,
			coalesce(gkCleanSheets, 0) as gkCleanSheets,
			coalesce(penaltiesScored, 0) as penaltiesScored,
			coalesce(penaltiesMissed, 0) as penaltiesMissed,
			coalesce(penaltiesConceded, 0) as penaltiesConceded,
			coalesce(penaltiesSaved, 0) as penaltiesSaved,
			coalesce(penaltyShootoutPenaltiesScored, 0) as penaltyShootoutPenaltiesScored,
			coalesce(penaltyShootoutPenaltiesMissed, 0) as penaltyShootoutPenaltiesMissed,
			coalesce(penaltyShootoutPenaltiesSaved, 0) as penaltyShootoutPenaltiesSaved,
			coalesce(fantasyPoints, 0) as fantasyPoints,
			coalesce(distance, 0) as distance,
			coalesce(allGoalsScored, 0) as allGoalsScored,
			coalesce(openPlayGoalsScored, 0) as openPlayGoalsScored,
			coalesce(goalInvolvements, 0) as goalInvolvements,
			coalesce(goalsPerApp, 0.0) as goalsPerApp,
			coalesce(concededPerApp, 0.0) as concededPerApp,
			coalesce(minutesPerGoal, 0.0) as minutesPerGoal,
			coalesce(minutesPerCleanSheet, 0.0) as minutesPerCleanSheet,
			coalesce(fantasyPointsPerApp, 0.0) as fantasyPointsPerApp,
			coalesce(minutesPerApp, 0.0) as minutesPerApp,
			coalesce(momPerApp, 0.0) as momPerApp,
			coalesce(yellowCardsPerApp, 0.0) as yellowCardsPerApp,
			coalesce(redCardsPerApp, 0.0) as redCardsPerApp,
			coalesce(savesPerApp, 0.0) as savesPerApp,
			coalesce(ownGoalsPerApp, 0.0) as ownGoalsPerApp,
			coalesce(cleanSheetsPerApp, 0.0) as cleanSheetsPerApp,
			coalesce(penaltiesScoredPerApp, 0.0) as penaltiesScoredPerApp,
			coalesce(penaltiesMissedPerApp, 0.0) as penaltiesMissedPerApp,
			coalesce(penaltiesConcededPerApp, 0.0) as penaltiesConcededPerApp,
			coalesce(penaltiesSavedPerApp, 0.0) as penaltiesSavedPerApp,
			coalesce(assistsPerApp, 0.0) as assistsPerApp,
			coalesce(goalInvolvementsPerApp, 0.0) as goalInvolvementsPerApp,
			coalesce(penaltyConversionRate, 0.0) as penaltyConversionRate,
			coalesce(winRateWhenScoring, 0.0) as winRateWhenScoring,
			coalesce(homeGames, 0) as homeGames,
			coalesce(homeWins, 0) as homeWins,
			coalesce(homeGamesPercentWon, 0.0) as homeGamesPercentWon,
			coalesce(awayGames, 0) as awayGames,
			coalesce(awayWins, 0) as awayWins,
			coalesce(awayGamesPercentWon, 0.0) as awayGamesPercentWon,
			coalesce(gamesPercentWon, 0.0) as gamesPercentWon,
			coalesce(pointsPerGame, 0.0) as pointsPerGame,
			coalesce(wins, 0) as wins,
			coalesce(draws, 0) as draws,
			coalesce(losses, 0) as losses,
			coalesce(mostPlayedForTeam, "") as mostPlayedForTeam,
			coalesce(mostPlayedForTeamAppearances, 0) as mostPlayedForTeamAppearances,
			coalesce(numberTeamsPlayedFor, 0) as numberTeamsPlayedFor,
			coalesce(mostScoredForTeam, "") as mostScoredForTeam,
			coalesce(mostScoredForTeamGoals, 0) as mostScoredForTeamGoals,
			coalesce(numberSeasonsPlayedFor, 0) as numberSeasonsPlayedFor,
			coalesce(oppositionPlayed, 0) as oppositionPlayed,
			coalesce(competitionsCompeted, 0) as competitionsCompeted,
			coalesce(teammatesPlayedWith, 0) as teammatesPlayedWith,
			coalesce(starts, 0) as starts,
			coalesce(subAppearances, 0) as subAppearances,
			coalesce(winRateWhenStarting, 0.0) as winRateWhenStarting,
			coalesce(winRateFromBench, 0.0) as winRateFromBench,
			coalesce(startRatePercent, 0.0) as startRatePercent,
			goalsPer90 as goalsPer90,
			assistsPer90 as assistsPer90,
			goalInvolvementsPer90 as goalInvolvementsPer90,
			ftpPer90 as ftpPer90,
			cleanSheetsPer90 as cleanSheetsPer90,
			concededPer90 as concededPer90,
			savesPer90 as savesPer90,
			cardsPer90 as cardsPer90,
			momPer90 as momPer90,
			averageMatchRating as averageMatchRating,
			highestMatchRating as highestMatchRating,
			coalesce(matchesRated8Plus, 0) as matchesRated8Plus,
${PLAYER_GRAPH_INSIGHT_PROPERTY_RETURN},
${PLAYER_STREAK_PROPERTY_RETURN}
	`;

	return { query, params };
}

export function buildPlayerProfileHeadlineQuery(playerName: string): { query: string; params: any } {
	const graphLabel = neo4jService.getGraphLabel();
	return {
		params: { graphLabel, playerName },
		query: `
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
		MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		RETURN p.playerName AS playerName,
			p.allowOnSite AS allowOnSite,
			count(md) AS appearances,
			sum(coalesce(md.minutes, 0)) AS minutes,
			sum(coalesce(md.goals, 0)) + sum(coalesce(md.penaltiesScored, 0)) AS allGoalsScored,
			sum(coalesce(md.assists, 0)) AS assists,
			sum(coalesce(md.mom, 0)) AS mom,
			sum(coalesce(md.fantasyPoints, 0)) AS fantasyPoints,
			round(avg(coalesce(md.matchRating, 0)) * 10) / 10 AS averageMatchRating,
			count(DISTINCT md.team) AS numberTeamsPlayedFor
		LIMIT 1
		`,
	};
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const playerName = searchParams.get("playerName");
		const profileHeadlineMode = searchParams.get("profileHeadline") === "1";

		if (!playerName) {
			return NextResponse.json({ error: "Player name is required" }, { status: 400, headers: corsHeaders });
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		// Helper function to convert Neo4j Integer/Float to JavaScript number
		const toNumber = (value: any): number => {
			if (value === null || value === undefined) return 0;
			if (typeof value === "number") {
				if (isNaN(value)) return 0;
				return value;
			}
			if (typeof value === "object") {
				if ("toNumber" in value && typeof value.toNumber === "function") {
					return value.toNumber();
				}
				if ("low" in value && "high" in value) {
					const low = value.low || 0;
					const high = value.high || 0;
					return low + high * 4294967296;
				}
				if ("toString" in value) {
					const num = Number(value.toString());
					return isNaN(num) ? 0 : num;
				}
			}
			const num = Number(value);
			return isNaN(num) ? 0 : num;
		};

		if (profileHeadlineMode) {
			const { query, params } = buildPlayerProfileHeadlineQuery(playerName);
			const result = await neo4jService.runQuery(query, params);
			if (result.records.length === 0) {
				return NextResponse.json({ error: "Player not found" }, { status: 404, headers: corsHeaders });
			}
			const record = result.records[0];
			if (record.get("allowOnSite") === false) {
				return NextResponse.json({ error: "Player not found" }, { status: 404, headers: corsHeaders });
			}
			const playerData = {
				playerName: record.get("playerName"),
				appearances: toNumber(record.get("appearances")),
				allGoalsScored: toNumber(record.get("allGoalsScored")),
				assists: toNumber(record.get("assists")),
				minutes: toNumber(record.get("minutes")),
				mom: toNumber(record.get("mom")),
				fantasyPoints: Math.round(toNumber(record.get("fantasyPoints"))),
				averageMatchRating: Math.round(toNumber(record.get("averageMatchRating")) * 10) / 10,
				numberTeamsPlayedFor: toNumber(record.get("numberTeamsPlayedFor")),
			};
			return NextResponse.json({ playerData }, { headers: { ...corsHeaders, "Cache-Control": "public, max-age=120" } });
		}

		// Build query with no filters
		const { query, params } = buildPlayerStatsQuery(playerName, null);

		const result = await neo4jService.runQuery(query, params);

		if (result.records.length === 0) {
			return NextResponse.json({ error: "Player not found" }, { status: 404, headers: corsHeaders });
		}

		// Extract aggregated stats from result
		const record = result.records[0];
		
		const playerData = {
			id: record.get("id"),
			playerName: record.get("playerName"),
			allowOnSite: record.get("allowOnSite"),
			gk: toNumber(record.get("gk")),
			def: toNumber(record.get("def")),
			mid: toNumber(record.get("mid")),
			fwd: toNumber(record.get("fwd")),
			gkMinutes: toNumber(record.get("gkMinutes")),
			defMinutes: toNumber(record.get("defMinutes")),
			midMinutes: toNumber(record.get("midMinutes")),
			fwdMinutes: toNumber(record.get("fwdMinutes")),
			appearances: toNumber(record.get("appearances")),
			minutes: toNumber(record.get("minutes")),
			mom: toNumber(record.get("mom")),
			goals: toNumber(record.get("goals")),
			assists: toNumber(record.get("assists")),
			yellowCards: toNumber(record.get("yellowCards")),
			redCards: toNumber(record.get("redCards")),
			saves: toNumber(record.get("saves")),
			ownGoals: toNumber(record.get("ownGoals")),
			conceded: toNumber(record.get("conceded")),
			cleanSheets: toNumber(record.get("cleanSheets")),
			gkCleanSheets: toNumber(record.get("gkCleanSheets")),
			penaltiesScored: toNumber(record.get("penaltiesScored")),
			penaltiesMissed: toNumber(record.get("penaltiesMissed")),
			penaltiesConceded: toNumber(record.get("penaltiesConceded")),
			penaltiesSaved: toNumber(record.get("penaltiesSaved")),
			penaltyShootoutPenaltiesScored: toNumber(record.get("penaltyShootoutPenaltiesScored")),
			penaltyShootoutPenaltiesMissed: toNumber(record.get("penaltyShootoutPenaltiesMissed")),
			penaltyShootoutPenaltiesSaved: toNumber(record.get("penaltyShootoutPenaltiesSaved")),
			fantasyPoints: Math.round(toNumber(record.get("fantasyPoints"))),
			allGoalsScored: toNumber(record.get("allGoalsScored")),
			openPlayGoalsScored: toNumber(record.get("openPlayGoalsScored")),
			goalInvolvements: toNumber(record.get("goalInvolvements")),
			goalsPerApp: toNumber(record.get("goalsPerApp")),
			concededPerApp: toNumber(record.get("concededPerApp")),
			minutesPerGoal: toNumber(record.get("minutesPerGoal")),
			minutesPerCleanSheet: toNumber(record.get("minutesPerCleanSheet")),
			fantasyPointsPerApp: toNumber(record.get("fantasyPointsPerApp")),
			minutesPerApp: toNumber(record.get("minutesPerApp")),
			assistsPerApp: toNumber(record.get("assistsPerApp")),
			goalInvolvementsPerApp: toNumber(record.get("goalInvolvementsPerApp")),
			penaltyConversionRate: toNumber(record.get("penaltyConversionRate")),
			winRateWhenScoring: toNumber(record.get("winRateWhenScoring")),
			distance: toNumber(record.get("distance")),
			homeGames: toNumber(record.get("homeGames")),
			homeWins: toNumber(record.get("homeWins")),
			homeGamesPercentWon: toNumber(record.get("homeGamesPercentWon")),
			awayGames: toNumber(record.get("awayGames")),
			awayWins: toNumber(record.get("awayWins")),
			awayGamesPercentWon: toNumber(record.get("awayGamesPercentWon")),
			gamesPercentWon: toNumber(record.get("gamesPercentWon")),
			pointsPerGame: toNumber(record.get("pointsPerGame")),
			wins: toNumber(record.get("wins")),
			draws: toNumber(record.get("draws")),
			losses: toNumber(record.get("losses")),
			mostPlayedForTeam: record.get("mostPlayedForTeam") || "",
			mostPlayedForTeamAppearances: toNumber(record.get("mostPlayedForTeamAppearances")),
			numberTeamsPlayedFor: toNumber(record.get("numberTeamsPlayedFor")),
			mostScoredForTeam: record.get("mostScoredForTeam") || "",
			mostScoredForTeamGoals: toNumber(record.get("mostScoredForTeamGoals")),
			numberSeasonsPlayedFor: toNumber(record.get("numberSeasonsPlayedFor")),
			oppositionPlayed: toNumber(record.get("oppositionPlayed")),
			competitionsCompeted: toNumber(record.get("competitionsCompeted")),
			teammatesPlayedWith: toNumber(record.get("teammatesPlayedWith")),
			graphLabel: record.get("graphLabel"),
			starts: toNumber(record.get("starts")),
			subAppearances: toNumber(record.get("subAppearances")),
			winRateWhenStarting: toNumber(record.get("winRateWhenStarting")),
			winRateFromBench: toNumber(record.get("winRateFromBench")),
			startRatePercent: toNumber(record.get("startRatePercent")),
			goalsPer90: (() => {
				const v = record.get("goalsPer90");
				if (v === null || v === undefined) return null;
				return Math.round(toNumber(v) * 100) / 100;
			})(),
			assistsPer90: (() => {
				const v = record.get("assistsPer90");
				if (v === null || v === undefined) return null;
				return Math.round(toNumber(v) * 100) / 100;
			})(),
			goalInvolvementsPer90: (() => {
				const v = record.get("goalInvolvementsPer90");
				if (v === null || v === undefined) return null;
				return Math.round(toNumber(v) * 100) / 100;
			})(),
			ftpPer90: (() => {
				const v = record.get("ftpPer90");
				if (v === null || v === undefined) return null;
				return Math.round(toNumber(v) * 100) / 100;
			})(),
			cleanSheetsPer90: (() => {
				const v = record.get("cleanSheetsPer90");
				if (v === null || v === undefined) return null;
				return Math.round(toNumber(v) * 100) / 100;
			})(),
			concededPer90: (() => {
				const v = record.get("concededPer90");
				if (v === null || v === undefined) return null;
				return Math.round(toNumber(v) * 100) / 100;
			})(),
			savesPer90: (() => {
				const v = record.get("savesPer90");
				if (v === null || v === undefined) return null;
				return Math.round(toNumber(v) * 100) / 100;
			})(),
			cardsPer90: (() => {
				const v = record.get("cardsPer90");
				if (v === null || v === undefined) return null;
				return Math.round(toNumber(v) * 100) / 100;
			})(),
			momPer90: (() => {
				const v = record.get("momPer90");
				if (v === null || v === undefined) return null;
				return Math.round(toNumber(v) * 100) / 100;
			})(),
			averageMatchRating: (() => {
				const v = record.get("averageMatchRating");
				if (v === null || v === undefined) return null;
				const n = typeof v === "number" ? v : toNumber(v);
				return Math.round(n * 10) / 10;
			})(),
			highestMatchRating: (() => {
				const v = record.get("highestMatchRating");
				if (v === null || v === undefined) return null;
				const n = typeof v === "number" ? v : toNumber(v);
				return Math.round(n * 10) / 10;
			})(),
			matchesRated8Plus: toNumber(record.get("matchesRated8Plus")),
			...mapPlayerGraphInsightFieldsFromRecord(record, toNumber),
			...mapPlayerStreakFieldsFromRecord(record, toNumber),
		};

		return NextResponse.json({ playerData }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching player data:", error);
		return NextResponse.json({ error: "Failed to fetch player data" }, { status: 500, headers: corsHeaders });
	}
}
