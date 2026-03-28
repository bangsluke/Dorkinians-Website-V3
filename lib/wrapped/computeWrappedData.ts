import { neo4jService } from "@/lib/neo4j";
import { classifyPlayerType } from "@/lib/wrapped/classifyPlayerType";
import { distanceMilesToEquivalent } from "@/lib/wrapped/distanceEquivalent";
import { percentileHigherIsBetter } from "@/lib/wrapped/percentile";
import { playerNameToWrappedSlug } from "@/lib/wrapped/slug";
import type { WrappedData } from "@/lib/wrapped/types";

function toNumber(value: unknown): number {
	if (value === null || value === undefined) return 0;
	if (typeof value === "number") return Number.isNaN(value) ? 0 : value;
	if (typeof value === "object") {
		const o = value as { toNumber?: () => number; low?: number; high?: number };
		if (typeof o.toNumber === "function") return o.toNumber();
		if ("low" in o && "high" in o) return (o.low || 0) + (o.high || 0) * 4294967296;
	}
	const n = Number(value);
	return Number.isNaN(n) ? 0 : n;
}

function seasonVariants(season: string): { seasonNorm: string; seasonHyphen: string } {
	const trim = season.trim();
	return {
		seasonNorm: trim.replace(/-/g, "/"),
		seasonHyphen: trim.replace(/\//g, "-"),
	};
}

type ClubRow = { nm: string; apps: number; mins: number; goals: number; assists: number; cs: number };

function toPlainProps(item: unknown): Record<string, unknown> | null {
	if (!item || typeof item !== "object") return null;
	if (item instanceof Map) {
		return Object.fromEntries(item.entries());
	}
	return item as Record<string, unknown>;
}

function parseClubRows(raw: unknown): ClubRow[] {
	if (!raw || !Array.isArray(raw)) return [];
	const out: ClubRow[] = [];
	for (const item of raw) {
		const r = toPlainProps(item);
		if (!r) continue;
		const nm = r.nm != null ? String(r.nm) : "";
		if (!nm) continue;
		out.push({
			nm,
			apps: toNumber(r.apps),
			mins: toNumber(r.mins),
			goals: toNumber(r.goals),
			assists: toNumber(r.assists),
			cs: toNumber(r.cs),
		});
	}
	return out;
}

function per90(stat: number, minutes: number): number | null {
	if (!minutes || minutes < 360) return null;
	return Math.round(((stat || 0) / minutes) * 90 * 100) / 100;
}

function pickLongestSeasonStreak(record: { get: (k: string) => unknown }): { type: string; value: number } | null {
	const candidates: [string, number][] = [
		["Scoring", toNumber(record.get("seasonBestScoringStreak"))],
		["Assist", toNumber(record.get("seasonBestAssistStreak"))],
		["Clean sheet", toNumber(record.get("seasonBestCleanSheetStreak"))],
		["Appearance", toNumber(record.get("seasonBestAppearanceStreak"))],
		["Discipline (no cards)", toNumber(record.get("seasonBestDisciplineStreak"))],
		["Win", toNumber(record.get("seasonBestWinStreak"))],
	];
	let best: { type: string; value: number } | null = null;
	for (const [type, value] of candidates) {
		if (value >= 3 && (!best || value > best.value)) {
			best = { type, value };
		}
	}
	return best;
}

export async function computeWrappedData(options: {
	playerName: string;
	season: string | null | undefined;
	sitePublicOrigin: string;
}): Promise<{ data: WrappedData } | { error: string; status: number }> {
	const playerName = options.playerName.trim();
	if (!playerName) {
		return { error: "Invalid player", status: 400 };
	}

	const connected = await neo4jService.connect();
	if (!connected) {
		return { error: "Database connection failed", status: 500 };
	}

	const graphLabel = neo4jService.getGraphLabel();
	const { seasonNorm, seasonHyphen } = seasonVariants(
		options.season?.trim() || (await fetchCurrentSeason(graphLabel)) || "",
	);
	if (!seasonNorm) {
		return { error: "Season not configured", status: 503 };
	}

	const playerCheck = await neo4jService.runQuery(
		`
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		RETURN p.playerName AS playerName,
			p.allowOnSite AS allowOnSite,
			coalesce(p.numberTeamsPlayedFor, 0) AS numberTeamsPlayedFor,
			p.bestPartnerName AS bestPartnerName,
			coalesce(p.bestPartnerWinRate, 0) AS bestPartnerWinRate,
			coalesce(p.bestPartnerMatches, 0) AS bestPartnerMatches,
			coalesce(p.seasonBestScoringStreak, 0) AS seasonBestScoringStreak,
			coalesce(p.seasonBestAssistStreak, 0) AS seasonBestAssistStreak,
			coalesce(p.seasonBestCleanSheetStreak, 0) AS seasonBestCleanSheetStreak,
			coalesce(p.seasonBestAppearanceStreak, 0) AS seasonBestAppearanceStreak,
			coalesce(p.seasonBestDisciplineStreak, 0) AS seasonBestDisciplineStreak,
			coalesce(p.seasonBestWinStreak, 0) AS seasonBestWinStreak
		LIMIT 1
		`,
		{ graphLabel, playerName },
	);

	if (playerCheck.records.length === 0) {
		return { error: "Player not found", status: 404 };
	}

	const pr = playerCheck.records[0];
	const allowOnSite = pr.get("allowOnSite");
	if (allowOnSite === false) {
		return { error: "Player not found", status: 404 };
	}

	const numberTeamsPlayedFor = toNumber(pr.get("numberTeamsPlayedFor"));
	const bestPartnerRaw = pr.get("bestPartnerName");
	const topPartnerName =
		bestPartnerRaw != null && String(bestPartnerRaw).trim() !== "" ? String(bestPartnerRaw) : "—";
	const topPartnerWinRate = Math.round(toNumber(pr.get("bestPartnerWinRate")) * 10) / 10;
	const topPartnerMatches = Math.round(toNumber(pr.get("bestPartnerMatches")));

	const seasonAgg = await neo4jService.runQuery(
		`
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
		MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		WHERE f.season = $seasonNorm OR f.season = $seasonHyphen
		RETURN count(md) AS apps,
			sum(coalesce(md.goals, 0)) AS goals,
			sum(coalesce(md.assists, 0)) AS assists,
			sum(coalesce(md.mom, 0)) AS mom,
			sum(coalesce(md.minutes, 0)) AS minutes,
			sum(coalesce(md.distance, 0)) AS distance,
			max(coalesce(md.matchRating, 0)) AS peakRating
		`,
		{ graphLabel, playerName, seasonNorm, seasonHyphen },
	);

	const s0 = seasonAgg.records[0];
	const totalMatches = Math.round(toNumber(s0?.get("apps")));
	const totalGoals = Math.round(toNumber(s0?.get("goals")));
	const totalAssists = Math.round(toNumber(s0?.get("assists")));
	const totalMom = Math.round(toNumber(s0?.get("mom")));
	const seasonMinutes = toNumber(s0?.get("minutes"));
	const totalDistance = Math.round(toNumber(s0?.get("distance")) * 10) / 10;
	const peakMatchRating = Math.round(toNumber(s0?.get("peakRating")) * 10) / 10;

	if (totalMatches === 0) {
		return { error: "No appearances in this season", status: 404 };
	}

	const clubRes = await neo4jService.runQuery(
		`
		MATCH (p2:Player {graphLabel: $graphLabel})
		WHERE p2.allowOnSite = true
		MATCH (p2)-[:PLAYED_IN]->(md2:MatchDetail {graphLabel: $graphLabel})
		MATCH (f2:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md2)
		WHERE f2.season = $seasonNorm OR f2.season = $seasonHyphen
		WITH p2.playerName AS nm,
			count(md2) AS apps,
			sum(coalesce(md2.minutes, 0)) AS mins,
			sum(coalesce(md2.goals, 0)) AS goals,
			sum(coalesce(md2.assists, 0)) AS assists,
			sum(coalesce(md2.cleanSheets, 0)) AS cs
		RETURN collect({nm: nm, apps: apps, mins: mins, goals: goals, assists: assists, cs: cs}) AS rows
		`,
		{ graphLabel, seasonNorm, seasonHyphen },
	);

	const rows = parseClubRows(clubRes.records[0]?.get("rows"));
	const my = rows.find((r) => r.nm === playerName);
	const appsList = rows.map((r) => r.apps);
	const matchesPercentile = my ? percentileHigherIsBetter(my.apps, appsList) : 0;

	const g90 = rows.map((r) => per90(r.goals, r.mins)).filter((v): v is number => v != null);
	const a90 = rows.map((r) => per90(r.assists, r.mins)).filter((v): v is number => v != null);
	const c90 = rows.map((r) => per90(r.cs, r.mins)).filter((v): v is number => v != null);
	const minsList = rows.map((r) => r.mins);

	const myG90 = per90(my?.goals ?? 0, my?.mins ?? 0) ?? 0;
	const myA90 = per90(my?.assists ?? 0, my?.mins ?? 0) ?? 0;
	const myC90 = per90(my?.cs ?? 0, my?.mins ?? 0) ?? 0;

	const percentiles = {
		goalsPer90: myG90 > 0 ? percentileHigherIsBetter(myG90, g90) : 0,
		assistsPer90: myA90 > 0 ? percentileHigherIsBetter(myA90, a90) : 0,
		appearances: percentileHigherIsBetter(my?.apps ?? 0, appsList),
		minutes: percentileHigherIsBetter(my?.mins ?? 0, minsList),
		cleanSheetsPer90: myC90 > 0 ? percentileHigherIsBetter(myC90, c90) : 0,
	};

	const monthRes = await neo4jService.runQuery(
		`
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
		MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		WHERE f.season = $seasonNorm OR f.season = $seasonHyphen
		WITH substring(toString(f.date), 0, 7) AS ym,
			sum(coalesce(md.goals, 0)) AS g,
			sum(coalesce(md.assists, 0)) AS a
		RETURN ym, g, a
		ORDER BY (g + a) DESC, g DESC
		LIMIT 1
		`,
		{ graphLabel, playerName, seasonNorm, seasonHyphen },
	);

	const ym = monthRes.records[0]?.get("ym");
	const bestMonthGoals = Math.round(toNumber(monthRes.records[0]?.get("g")));
	const bestMonthAssists = Math.round(toNumber(monthRes.records[0]?.get("a")));
	const bestMonth =
		ym != null && String(ym).length >= 7
			? formatYearMonth(String(ym))
			: "—";

	const peakRes = await neo4jService.runQuery(
		`
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
		MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		WHERE f.season = $seasonNorm OR f.season = $seasonHyphen
		WITH md, f
		ORDER BY coalesce(md.matchRating, 0) DESC, coalesce(md.goals, 0) DESC, coalesce(md.assists, 0) DESC
		LIMIT 1
		RETURN coalesce(md.matchRating, 0) AS peakRating,
			coalesce(f.opposition, '') AS opposition,
			coalesce(md.goals, 0) AS peakGoals,
			coalesce(md.assists, 0) AS peakAssists
		`,
		{ graphLabel, playerName, seasonNorm, seasonHyphen },
	);

	const peakR = peakRes.records[0];
	const peakMatchOpposition = peakR?.get("opposition") != null ? String(peakR.get("opposition")) : "—";
	const peakMatchGoals = Math.round(toNumber(peakR?.get("peakGoals")));
	const peakMatchAssists = Math.round(toNumber(peakR?.get("peakAssists")));
	const peakFromRow = Math.round(toNumber(peakR?.get("peakRating")) * 10) / 10;

	const streakPick = pickLongestSeasonStreak(pr);
	const longestStreakType = streakPick && streakPick.value >= 3 ? `${streakPick.type} streak` : null;
	const longestStreakValue = streakPick && streakPick.value >= 3 ? streakPick.value : null;

	const { type: playerType, reason: playerTypeReason } = classifyPlayerType({
		numberTeamsPlayedFor,
		percentiles,
	});

	const slug = playerNameToWrappedSlug(playerName);
	const base = options.sitePublicOrigin.replace(/\/$/, "");
	const wrappedUrl = `${base}/wrapped/${slug}`;
	const seasonLabel = seasonNorm;

	const data: WrappedData = {
		playerName,
		season: seasonLabel,
		totalMatches,
		totalGoals,
		totalAssists,
		totalMom,
		matchesPercentile,
		bestMonth,
		bestMonthGoals,
		bestMonthAssists,
		topPartnerName,
		topPartnerMatches,
		topPartnerWinRate,
		playerType,
		playerTypeReason,
		peakMatchRating: peakFromRow > 0 ? peakFromRow : peakMatchRating,
		peakMatchOpposition,
		peakMatchGoals,
		peakMatchAssists,
		longestStreakType,
		longestStreakValue,
		totalDistance,
		distanceEquivalent: distanceMilesToEquivalent(totalDistance),
		wrappedUrl,
	};

	return { data };
}

async function fetchCurrentSeason(graphLabel: string): Promise<string | null> {
	const r = await neo4jService.runQuery(
		`MATCH (sd:SiteDetail {graphLabel: $graphLabel}) RETURN sd.currentSeason AS currentSeason LIMIT 1`,
		{ graphLabel },
	);
	const v = r.records[0]?.get("currentSeason");
	return v != null && String(v).trim() !== "" ? String(v).trim() : null;
}

function formatYearMonth(ym: string): string {
	const [y, m] = ym.split("-");
	if (!y || !m) return ym;
	const monthNames = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	const mi = Number(m) - 1;
	if (mi < 0 || mi > 11) return ym;
	return `${monthNames[mi]} ${y}`;
}
