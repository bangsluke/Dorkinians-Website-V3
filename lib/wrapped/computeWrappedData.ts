import type { Record as Neo4jRecord } from "neo4j-driver";
import { neo4jService } from "@/lib/neo4j";
import { classifyPlayerType } from "@/lib/wrapped/classifyPlayerType";
import { distanceMilesToEquivalent } from "@/lib/wrapped/distanceEquivalent";
import { percentileHigherIsBetter } from "@/lib/wrapped/percentile";
import { playerNameToWrappedSlug } from "@/lib/wrapped/slug";
import type { WrappedData, WrappedVeoFixture } from "@/lib/wrapped/types";
import {
	fetchDorkiniansLeagueFinishForTeamSeason,
	fetchDorkiniansLeagueTableRowForTeamSeason,
	fixtureDisplayTeamToLeagueTableKey,
	isCupTieAdvanced,
} from "@/lib/wrapped/wrappedTeamSeason";
import { CYPHER_FIXTURE_VEOLINK_COALESCE } from "@/lib/utils/neo4jVeoLink";

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

function normalizeSeasonLabel(raw: string): string {
	return raw.trim().replace(/-/g, "/");
}

function seasonsEquivalent(a: string, b: string): boolean {
	const va = seasonVariants(normalizeSeasonLabel(a));
	const vb = seasonVariants(normalizeSeasonLabel(b));
	return va.seasonNorm === vb.seasonNorm;
}

function parseSeasonStartYear(label: string): number {
	const norm = normalizeSeasonLabel(label);
	const m = norm.match(/^(\d{4})/);
	return m ? parseInt(m[1], 10) : 0;
}

function formatTeamDisplayForTrophy(team: string): string {
	const t = team.trim();
	if (!t) return "Dorkinians";
	return /^(\d+)(st|nd|rd|th)\s+XI$/i.test(t) ? `Dorkinians ${t}` : t;
}

/** Newest first (by leading calendar year, then lexicographic tie-break). */
function sortSeasonsDesc(unique: string[]): string[] {
	return [...unique].sort((a, b) => {
		const ya = parseSeasonStartYear(a);
		const yb = parseSeasonStartYear(b);
		if (yb !== ya) return yb - ya;
		return normalizeSeasonLabel(b).localeCompare(normalizeSeasonLabel(a));
	});
}

type ClubRow = {
	nm: string;
	apps: number;
	mins: number;
	goals: number;
	assists: number;
	cs: number;
	ftp: number;
	dist: number;
	mom: number;
	starts: number;
};

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
			ftp: toNumber(r.ftp),
			dist: toNumber(r.dist),
			mom: toNumber(r.mom),
			starts: toNumber(r.starts),
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

type WrappedSeasonMetadataContext = {
	graphLabel: string;
	playerRecord: Neo4jRecord;
	numberTeamsPlayedFor: number;
	seasonsAvailable: string[];
	seasonNorm: string;
	seasonHyphen: string;
	seasonLabel: string;
};

export async function computeWrappedSeasonMetadata(options: {
	playerName: string;
	season?: string | null | undefined;
}): Promise<{ data: WrappedSeasonMetadataContext } | { error: string; status: number }> {
	const playerName = options.playerName.trim();
	if (!playerName) {
		return { error: "Invalid player", status: 400 };
	}

	const connected = await neo4jService.connect();
	if (!connected) {
		return { error: "Database connection failed", status: 500 };
	}

	const graphLabel = neo4jService.getGraphLabel();
	const siteCurrentSeasonRaw = await fetchCurrentSeason(graphLabel);

	const playerCheck = await neo4jService.runQuery(
		`
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		RETURN p.playerName AS playerName,
			p.allowOnSite AS allowOnSite,
			coalesce(p.numberTeamsPlayedFor, 0) AS numberTeamsPlayedFor,
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

	const seasonsRes = await neo4jService.runQuery(
		`
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
		MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		WITH DISTINCT f.season AS raw
		WHERE raw IS NOT NULL AND trim(toString(raw)) <> ''
		RETURN collect(DISTINCT toString(raw)) AS seasons
		`,
		{ graphLabel, playerName },
	);

	const rawSeasons = seasonsRes.records[0]?.get("seasons");
	const seasonSet = new Set<string>();
	if (Array.isArray(rawSeasons)) {
		for (const item of rawSeasons) {
			if (item == null) continue;
			const n = normalizeSeasonLabel(String(item));
			if (n) seasonSet.add(n);
		}
	}
	const seasonsAvailable = sortSeasonsDesc(Array.from(seasonSet));
	if (seasonsAvailable.length === 0) {
		return { error: "No appearances recorded", status: 404 };
	}

	const requested = options.season?.trim();
	let effectiveNorm: string | null = null;
	if (requested) {
		effectiveNorm = seasonsAvailable.find((s) => seasonsEquivalent(s, requested)) ?? null;
	}
	if (!effectiveNorm && siteCurrentSeasonRaw) {
		const curNorm = normalizeSeasonLabel(siteCurrentSeasonRaw);
		effectiveNorm = seasonsAvailable.find((s) => seasonsEquivalent(s, curNorm)) ?? null;
	}
	if (!effectiveNorm) {
		effectiveNorm = seasonsAvailable[0] ?? null;
	}
	if (!effectiveNorm) {
		return { error: "Season not configured", status: 503 };
	}

	const { seasonNorm, seasonHyphen } = seasonVariants(effectiveNorm);

	return {
		data: {
			graphLabel,
			playerRecord: pr,
			numberTeamsPlayedFor: toNumber(pr.get("numberTeamsPlayedFor")),
			seasonsAvailable,
			seasonNorm,
			seasonHyphen,
			seasonLabel: seasonNorm,
		},
	};
}

export async function computeWrappedData(options: {
	playerName: string;
	season: string | null | undefined;
	sitePublicOrigin: string;
}): Promise<{ data: WrappedData } | { error: string; status: number }> {
	const playerName = options.playerName.trim();
	const metadata = await computeWrappedSeasonMetadata({ playerName, season: options.season });
	if ("error" in metadata) {
		return metadata;
	}
	const { graphLabel, playerRecord: pr, numberTeamsPlayedFor, seasonsAvailable, seasonNorm, seasonHyphen, seasonLabel } =
		metadata.data;

	const seasonAgg = await neo4jService.runQuery(
		`
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
		MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		WHERE f.season = $seasonNorm OR f.season = $seasonHyphen
		RETURN count(md) AS apps,
			sum(coalesce(md.goals, 0)) AS goals,
			sum(coalesce(md.penaltiesScored, 0)) AS penaltiesScored,
			sum(coalesce(md.assists, 0)) AS assists,
			sum(coalesce(md.mom, 0)) AS mom,
			sum(coalesce(md.minutes, 0)) AS minutes,
			sum(coalesce(md.distance, 0)) AS distance,
			sum(coalesce(md.yellowCards, 0)) AS yellowCards,
			sum(coalesce(md.redCards, 0)) AS redCards,
			sum(coalesce(md.cleanSheets, 0)) AS cleanSheets,
			sum(CASE
				WHEN trim(toUpper(coalesce(f.result, ''))) = 'W'
					OR trim(toUpper(coalesce(f.result, ''))) STARTS WITH 'WIN' THEN 1
				ELSE 0
			END) AS wins,
			sum(CASE
				WHEN trim(toUpper(coalesce(f.result, ''))) = 'D'
					OR trim(toUpper(coalesce(f.result, ''))) STARTS WITH 'DRA' THEN 1
				ELSE 0
			END) AS draws,
			sum(CASE WHEN coalesce(md.started, false) THEN 1 ELSE 0 END) AS starts,
			max(coalesce(md.matchRating, 0)) AS peakRating
		`,
		{ graphLabel, playerName, seasonNorm, seasonHyphen },
	);

	const s0 = seasonAgg.records[0];
	const totalMatches = Math.round(toNumber(s0?.get("apps")));
	const totalGoals = Math.round(toNumber(s0?.get("goals")));
	const totalPenaltiesScored = Math.round(toNumber(s0?.get("penaltiesScored")));
	const totalAssists = Math.round(toNumber(s0?.get("assists")));
	const totalMom = Math.round(toNumber(s0?.get("mom")));
	const seasonMinutes = toNumber(s0?.get("minutes"));
	const totalStarts = Math.round(toNumber(s0?.get("starts")));
	const totalDistance = Math.round(toNumber(s0?.get("distance")) * 10) / 10;
	const totalYellowCards = Math.round(toNumber(s0?.get("yellowCards")));
	const totalRedCards = Math.round(toNumber(s0?.get("redCards")));
	const totalWins = Math.round(toNumber(s0?.get("wins")));
	const totalDraws = Math.round(toNumber(s0?.get("draws")));
	const totalCleanSheets = Math.round(toNumber(s0?.get("cleanSheets")));
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
			sum(coalesce(md2.cleanSheets, 0)) AS cs,
			sum(coalesce(md2.fantasyPoints, 0)) AS ftp,
			sum(coalesce(md2.distance, 0)) AS dist,
			sum(coalesce(md2.mom, 0)) AS mom,
			sum(CASE WHEN coalesce(md2.started, false) THEN 1 ELSE 0 END) AS starts
		RETURN collect({nm: nm, apps: apps, mins: mins, goals: goals, assists: assists, cs: cs, ftp: ftp, dist: dist, mom: mom, starts: starts}) AS rows
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
	const f90 = rows.map((r) => per90(r.ftp, r.mins)).filter((v): v is number => v != null);
	const minsList = rows.map((r) => r.mins);
	const distList = rows.map((r) => r.dist);

	const myG90 = per90(my?.goals ?? 0, my?.mins ?? 0) ?? 0;
	const myA90 = per90(my?.assists ?? 0, my?.mins ?? 0) ?? 0;
	const myC90 = per90(my?.cs ?? 0, my?.mins ?? 0) ?? 0;
	const myF90 = per90(my?.ftp ?? 0, my?.mins ?? 0) ?? 0;
	const myDist = my?.dist ?? 0;
	const myMom90 = per90(my?.mom ?? 0, my?.mins ?? 0) ?? 0;
	const m90 = rows.map((r) => per90(r.mom, r.mins)).filter((v): v is number => v != null);

	const startRatios = rows
		.filter((r) => r.apps >= 5)
		.map((r) => (r.starts > 0 ? r.starts / r.apps : 0));
	const myApps = my?.apps ?? 0;
	const myStarts = my?.starts ?? 0;
	const myStartRatio = myApps >= 5 && myStarts >= 0 ? myStarts / myApps : -1;

	const percentiles = {
		goalsPer90: myG90 > 0 ? percentileHigherIsBetter(myG90, g90) : 0,
		assistsPer90: myA90 > 0 ? percentileHigherIsBetter(myA90, a90) : 0,
		appearances: percentileHigherIsBetter(my?.apps ?? 0, appsList),
		minutes: percentileHigherIsBetter(my?.mins ?? 0, minsList),
		cleanSheetsPer90: myC90 > 0 ? percentileHigherIsBetter(myC90, c90) : 0,
		ftpPer90: myF90 > 0 ? percentileHigherIsBetter(myF90, f90) : 0,
		distance: myDist > 0 ? percentileHigherIsBetter(myDist, distList) : 0,
		momPer90: myMom90 > 0 && m90.length > 0 ? percentileHigherIsBetter(myMom90, m90) : 0,
		startRate:
			myStartRatio >= 0 && startRatios.length > 0 ?
				percentileHigherIsBetter(myStartRatio, startRatios)
			:	0,
	};

	const monthRes = await neo4jService.runQuery(
		`
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
		MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		WHERE f.season = $seasonNorm OR f.season = $seasonHyphen
		WITH substring(toString(f.date), 0, 7) AS ym,
			count(md) AS monthApps,
			sum(coalesce(md.goals, 0)) AS g,
			sum(coalesce(md.penaltiesScored, 0)) AS psc,
			sum(coalesce(md.assists, 0)) AS a,
			sum(coalesce(md.mom, 0)) AS monthMom,
			sum(coalesce(md.fantasyPoints, 0)) AS ftp,
			sum(coalesce(md.minutes, 0)) AS mins,
			sum(CASE WHEN coalesce(md.started, false) THEN 1 ELSE 0 END) AS starts,
			sum(coalesce(md.yellowCards, 0)) AS yellowCards,
			sum(coalesce(md.redCards, 0)) AS redCards
		RETURN ym, monthApps, g, psc, a, monthMom, ftp, mins, starts, yellowCards, redCards
		ORDER BY (g + a) DESC, g DESC
		LIMIT 1
		`,
		{ graphLabel, playerName, seasonNorm, seasonHyphen },
	);

	const ym = monthRes.records[0]?.get("ym");
	const bestMonthGoals = Math.round(toNumber(monthRes.records[0]?.get("g")));
	const bestMonthPenaltiesScored = Math.round(toNumber(monthRes.records[0]?.get("psc")));
	const bestMonthAssists = Math.round(toNumber(monthRes.records[0]?.get("a")));
	const bestMonthMom = Math.round(toNumber(monthRes.records[0]?.get("monthMom")));
	const bestMonthMatches = Math.round(toNumber(monthRes.records[0]?.get("monthApps")));
	const bestMonthFantasyPoints = Math.round(toNumber(monthRes.records[0]?.get("ftp")) * 10) / 10;
	const bestMonthMinutes = Math.round(toNumber(monthRes.records[0]?.get("mins")));
	const bestMonthStarts = Math.round(toNumber(monthRes.records[0]?.get("starts")));
	const bestMonthYellowCards = Math.round(toNumber(monthRes.records[0]?.get("yellowCards")));
	const bestMonthRedCards = Math.round(toNumber(monthRes.records[0]?.get("redCards")));
	const bestMonth =
		ym != null && String(ym).length >= 7
			? formatYearMonth(String(ym))
			: "-";

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
			coalesce(md.penaltiesScored, 0) AS peakPenaltiesScored,
			coalesce(md.assists, 0) AS peakAssists,
			coalesce(md.mom, 0) AS peakMom,
			coalesce(md.fantasyPoints, 0) AS peakFantasyPoints,
			coalesce(md.minutes, 0) AS peakMinutes,
			coalesce(md.started, false) AS peakStarted,
			coalesce(md.yellowCards, 0) AS peakYellowCards,
			coalesce(md.redCards, 0) AS peakRedCards,
			coalesce(f.result, '') AS peakResult,
			coalesce(f.dorkiniansGoals, 0) AS peakDorkiniansGoals,
			coalesce(f.conceded, 0) AS peakConceded
		`,
		{ graphLabel, playerName, seasonNorm, seasonHyphen },
	);

	const peakR = peakRes.records[0];
	const peakMatchOpposition = peakR?.get("opposition") != null ? String(peakR.get("opposition")) : "-";
	const peakMatchGoals = Math.round(toNumber(peakR?.get("peakGoals")));
	const peakMatchPenaltiesScored = Math.round(toNumber(peakR?.get("peakPenaltiesScored")));
	const peakMatchAssists = Math.round(toNumber(peakR?.get("peakAssists")));
	const peakMatchMomCount = Math.round(toNumber(peakR?.get("peakMom")));
	const peakMatchMom = peakMatchMomCount > 0;
	const peakMatchFantasyPoints = Math.round(toNumber(peakR?.get("peakFantasyPoints")) * 10) / 10;
	const peakMatchMinutes = Math.round(toNumber(peakR?.get("peakMinutes")));
	const peakMatchStarted = Boolean(peakR?.get("peakStarted"));
	const peakMatchYellowCards = Math.round(toNumber(peakR?.get("peakYellowCards")));
	const peakMatchRedCards = Math.round(toNumber(peakR?.get("peakRedCards")));
	const peakFromRow = Math.round(toNumber(peakR?.get("peakRating")) * 10) / 10;
	const peakResultRaw = peakR?.get("peakResult") != null ? String(peakR.get("peakResult")) : "";
	const peakDorkGoals = Math.round(toNumber(peakR?.get("peakDorkiniansGoals")));
	const peakConceded = Math.round(toNumber(peakR?.get("peakConceded")));
	const hasPeak = peakFromRow > 0 || peakMatchRating > 0;
	const peakMatchResultLabel = hasPeak ? wrappedPeakResultLabel(peakResultRaw) : "-";
	const peakMatchScoreline = hasPeak ? `${peakDorkGoals}-${peakConceded}` : "-";

	const posRes = await neo4jService.runQuery(
		`
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
		MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		WHERE f.season = $seasonNorm OR f.season = $seasonHyphen
		WITH coalesce(md.class, 'UNK') AS cls, count(*) AS c
		RETURN cls, c
		ORDER BY c DESC
		LIMIT 1
		`,
		{ graphLabel, playerName, seasonNorm, seasonHyphen },
	);
	const rawCls = posRes.records[0]?.get("cls");
	const mostPlayedPosition = formatWrappedPositionClass(rawCls != null ? String(rawCls) : "");

	const partnerRes = await neo4jService.runQuery(
		`
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		MATCH (p)-[:PLAYED_IN]->(md1:MatchDetail {graphLabel: $graphLabel})<-[:HAS_MATCH_DETAILS]-(f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md2:MatchDetail {graphLabel: $graphLabel})<-[:PLAYED_IN]-(p2:Player {graphLabel: $graphLabel})
		WHERE p2.playerName <> p.playerName
		  AND coalesce(p2.allowOnSite, true) = true
		  AND (f.season = $seasonNorm OR f.season = $seasonHyphen)
		  AND coalesce(md1.minutes, 0) > 0 AND coalesce(md2.minutes, 0) > 0
		  AND NOT coalesce(f.status, '') IN ['Void', 'Postponed', 'Abandoned']
		WITH p2.playerName AS partner,
			count(DISTINCT f) AS games,
			sum(CASE
				WHEN trim(toUpper(coalesce(f.result, ''))) = 'W'
					OR trim(toUpper(coalesce(f.result, ''))) STARTS WITH 'WIN' THEN 1
				ELSE 0
			END) AS wins
		WHERE games >= 1
		RETURN partner, games, wins
		ORDER BY CASE WHEN games >= 5 THEN 1 ELSE 0 END DESC, (wins * 1.0 / games) DESC, games DESC
		LIMIT 1
		`,
		{ graphLabel, playerName, seasonNorm, seasonHyphen },
	);
	const partnerRec = partnerRes.records[0];
	let topPartnerName = "-";
	let topPartnerMatches = 0;
	let topPartnerWinRate = 0;
	if (partnerRec) {
		const games = Math.round(toNumber(partnerRec.get("games")));
		const wins = Math.round(toNumber(partnerRec.get("wins")));
		const pn = partnerRec.get("partner");
		topPartnerName = pn != null && String(pn).trim() !== "" ? String(pn) : "-";
		topPartnerMatches = games;
		topPartnerWinRate = games > 0 ? Math.round((wins * 1000) / games) / 10 : 0;
	}

	const streakPick = pickLongestSeasonStreak(pr);
	const longestStreakType = streakPick && streakPick.value >= 3 ? `${streakPick.type} streak` : null;
	const longestStreakValue = streakPick && streakPick.value >= 3 ? streakPick.value : null;

	const veoRes = await neo4jService.runQuery(
		`
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
		MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		WHERE (f.season = $seasonNorm OR f.season = $seasonHyphen)
		WITH f
		WHERE (${CYPHER_FIXTURE_VEOLINK_COALESCE}) IS NOT NULL
		RETURN coalesce(toString(f.id), '') AS fixtureId,
			coalesce(f.team, '') AS team,
			coalesce(f.opposition, '') AS opposition,
			coalesce(toString(f.date), '') AS date,
			coalesce(f.result, '') AS result,
			coalesce(f.dorkiniansGoals, 0) AS goalsScored,
			coalesce(f.conceded, 0) AS goalsConceded,
			${CYPHER_FIXTURE_VEOLINK_COALESCE} AS veoLink
		ORDER BY f.date DESC
		`,
		{ graphLabel, playerName, seasonNorm, seasonHyphen },
	);

	const veoFixtures: WrappedVeoFixture[] = veoRes.records
		.map((rec: Neo4jRecord) => ({
			fixtureId: rec.get("fixtureId") != null ? String(rec.get("fixtureId")) : "",
			team: rec.get("team") != null ? String(rec.get("team")) : "",
			opposition: rec.get("opposition") != null ? String(rec.get("opposition")) : "",
			date: rec.get("date") != null ? String(rec.get("date")) : "",
			result: rec.get("result") != null ? String(rec.get("result")) : "",
			goalsScored: Math.round(toNumber(rec.get("goalsScored"))),
			goalsConceded: Math.round(toNumber(rec.get("goalsConceded"))),
			veoLink: rec.get("veoLink") != null ? String(rec.get("veoLink")).trim() : "",
		}))
		.filter((row: WrappedVeoFixture) => row.veoLink.length > 0);

	const dominantRes = await neo4jService.runQuery(
		`
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
		MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		WHERE (f.season = $seasonNorm OR f.season = $seasonHyphen)
		  AND coalesce(md.minutes, 0) > 0
		  AND NOT coalesce(f.status, '') IN ['Void', 'Postponed', 'Abandoned']
		WITH coalesce(f.team, '') AS team, count(*) AS apps, sum(coalesce(md.minutes, 0)) AS mins
		WHERE trim(team) <> ''
		RETURN team, apps, mins
		ORDER BY apps DESC, mins DESC, team ASC
		LIMIT 1
		`,
		{ graphLabel, playerName, seasonNorm, seasonHyphen },
	);
	const domRec = dominantRes.records[0];
	const wrappedDominantTeam =
		domRec?.get("team") != null ? String(domRec.get("team")).trim() : "";

	const leaguePtsRes = await neo4jService.runQuery(
		`
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
		MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		WHERE (f.season = $seasonNorm OR f.season = $seasonHyphen)
		  AND coalesce(md.minutes, 0) > 0
		  AND NOT coalesce(f.status, '') IN ['Void', 'Postponed', 'Abandoned']
		  AND toLower(trim(f.compType)) = 'league'
		RETURN sum(
			CASE
				WHEN trim(toUpper(coalesce(f.result, ''))) = 'W'
					OR trim(toUpper(coalesce(f.result, ''))) STARTS WITH 'WIN' THEN 3
				WHEN trim(toUpper(coalesce(f.result, ''))) = 'D'
					OR trim(toUpper(coalesce(f.result, ''))) STARTS WITH 'DRA' THEN 1
				ELSE 0
			END
		) AS leaguePts,
		sum(
			CASE
				WHEN trim(toUpper(coalesce(f.result, ''))) = 'W'
					OR trim(toUpper(coalesce(f.result, ''))) STARTS WITH 'WIN' THEN 1
				ELSE 0
			END
		) AS leagueWins,
		sum(
			CASE
				WHEN trim(toUpper(coalesce(f.result, ''))) = 'D'
					OR trim(toUpper(coalesce(f.result, ''))) STARTS WITH 'DRA' THEN 1
				ELSE 0
			END
		) AS leagueDraws
		`,
		{ graphLabel, playerName, seasonNorm, seasonHyphen },
	);
	const wrappedLeaguePointsContributed = Math.round(toNumber(leaguePtsRes.records[0]?.get("leaguePts")));
	const wrappedLeagueWinsFromPlayedGames = Math.round(toNumber(leaguePtsRes.records[0]?.get("leagueWins")));
	const wrappedLeagueDrawsFromPlayedGames = Math.round(toNumber(leaguePtsRes.records[0]?.get("leagueDraws")));

	const homeAwayRes = await neo4jService.runQuery(
		`
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
		MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		WHERE (f.season = $seasonNorm OR f.season = $seasonHyphen)
		  AND coalesce(md.minutes, 0) > 0
		  AND NOT coalesce(f.status, '') IN ['Void', 'Postponed', 'Abandoned']
		WITH CASE WHEN trim(toUpper(coalesce(f.homeOrAway, 'HOME'))) = 'AWAY' THEN 'Away' ELSE 'Home' END AS loc,
			count(md) AS apps,
			sum(coalesce(md.goals, 0)) AS goals,
			sum(coalesce(md.penaltiesScored, 0)) AS penaltiesScored,
			sum(coalesce(md.assists, 0)) AS assists,
			sum(
				CASE
					WHEN trim(toUpper(coalesce(f.result, ''))) = 'W'
						OR trim(toUpper(coalesce(f.result, ''))) STARTS WITH 'WIN' THEN 1
					ELSE 0
				END
			) AS wins
		RETURN loc, apps, goals, penaltiesScored, assists, wins
		`,
		{ graphLabel, playerName, seasonNorm, seasonHyphen },
	);
	const homeAway = new Map<string, { apps: number; goals: number; penaltiesScored: number; assists: number; wins: number }>();
	for (const rec of homeAwayRes.records) {
		const loc = rec.get("loc") != null ? String(rec.get("loc")) : "Home";
		homeAway.set(loc, {
			apps: Math.round(toNumber(rec.get("apps"))),
			goals: Math.round(toNumber(rec.get("goals"))),
			penaltiesScored: Math.round(toNumber(rec.get("penaltiesScored"))),
			assists: Math.round(toNumber(rec.get("assists"))),
			wins: Math.round(toNumber(rec.get("wins"))),
		});
	}
	const homeStats = homeAway.get("Home") ?? { apps: 0, goals: 0, penaltiesScored: 0, assists: 0, wins: 0 };
	const awayStats = homeAway.get("Away") ?? { apps: 0, goals: 0, penaltiesScored: 0, assists: 0, wins: 0 };
	const wrappedHomeWinRate = homeStats.apps > 0 ? Math.round((homeStats.wins * 1000) / homeStats.apps) / 10 : 0;
	const wrappedAwayWinRate = awayStats.apps > 0 ? Math.round((awayStats.wins * 1000) / awayStats.apps) / 10 : 0;

	const cupRowsRes = await neo4jService.runQuery(
		`
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
		MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		WHERE (f.season = $seasonNorm OR f.season = $seasonHyphen)
		  AND coalesce(md.minutes, 0) > 0
		  AND NOT coalesce(f.status, '') IN ['Void', 'Postponed', 'Abandoned']
		  AND toLower(trim(f.compType)) = 'cup'
		RETURN coalesce(f.result, '') AS result, coalesce(f.fullResult, '') AS fullResult
		`,
		{ graphLabel, playerName, seasonNorm, seasonHyphen },
	);
	let wrappedCupTiesAdvanced = 0;
	for (const rec of cupRowsRes.records) {
		const result = rec.get("result") != null ? String(rec.get("result")) : "";
		const fullResult = rec.get("fullResult") != null ? String(rec.get("fullResult")) : "";
		if (isCupTieAdvanced(result, fullResult)) wrappedCupTiesAdvanced++;
	}

	const leagueKey = fixtureDisplayTeamToLeagueTableKey(wrappedDominantTeam);
	const leagueFinish = await fetchDorkiniansLeagueFinishForTeamSeason({
		graphLabel,
		seasonNorm,
		seasonHyphen,
		leagueTableTeamKey: leagueKey,
	});
	const wrappedDominantTeamLeaguePosition = leagueFinish.position;
	const wrappedDominantTeamLeagueDivision = leagueFinish.division;

	const leagueRowEntry = await fetchDorkiniansLeagueTableRowForTeamSeason({
		seasonNorm,
		leagueTableTeamKey: leagueKey,
	});
	const wrappedDominantTeamLeagueRow =
		leagueRowEntry ?
			{
				position: leagueRowEntry.position,
				team: leagueRowEntry.team,
				played: leagueRowEntry.played,
				won: leagueRowEntry.won,
				drawn: leagueRowEntry.drawn,
				lost: leagueRowEntry.lost,
				goalsFor: leagueRowEntry.goalsFor,
				goalsAgainst: leagueRowEntry.goalsAgainst,
				goalDifference: leagueRowEntry.goalDifference,
				points: leagueRowEntry.points,
			}
		:	null;

	const playedTeamsRes = await neo4jService.runQuery(
		`
		MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
		MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
		MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		WHERE (f.season = $seasonNorm OR f.season = $seasonHyphen)
		  AND coalesce(md.minutes, 0) > 0
		  AND NOT coalesce(f.status, '') IN ['Void', 'Postponed', 'Abandoned']
		RETURN collect(DISTINCT coalesce(f.team, '')) AS teams
		`,
		{ graphLabel, playerName, seasonNorm, seasonHyphen },
	);
	const rawTeams = playedTeamsRes.records[0]?.get("teams");
	const uniquePlayedTeams = Array.isArray(rawTeams)
		? Array.from(new Set(rawTeams.map((t) => String(t ?? "").trim()).filter((t) => t.length > 0)))
		: [];
	const wrappedTrophiesWon: string[] = [];
	for (const team of uniquePlayedTeams) {
		const leagueTableTeamKey = fixtureDisplayTeamToLeagueTableKey(team);
		if (!leagueTableTeamKey) continue;
		const finish = await fetchDorkiniansLeagueFinishForTeamSeason({
			graphLabel,
			seasonNorm,
			seasonHyphen,
			leagueTableTeamKey,
		});
		if (finish.position === 1) {
			const teamLabel = formatTeamDisplayForTrophy(team);
			const division = finish.division?.trim();
			const suffix = division ? `${division} Champions` : "League Champions";
			wrappedTrophiesWon.push(`${teamLabel} ${suffix} ${seasonLabel}`);
		}
	}

	const { type: playerType, reason: playerTypeReason } = classifyPlayerType({
		numberTeamsPlayedFor,
		percentiles,
	});

	const slug = playerNameToWrappedSlug(playerName);
	const base = options.sitePublicOrigin.replace(/\/$/, "");
	const wrappedUrl = `${base}/wrapped/${slug}?season=${encodeURIComponent(seasonLabel)}`;

	const data: WrappedData = {
		playerName,
		season: seasonLabel,
		seasonsAvailable,
		veoFixtures,
		totalMatches,
		totalMinutes: Math.round(seasonMinutes),
		totalStarts,
		mostPlayedPosition,
		totalGoals,
		totalPenaltiesScored,
		totalAssists,
		totalMom,
		matchesPercentile,
		bestMonth,
		bestMonthGoals,
		bestMonthPenaltiesScored,
		bestMonthAssists,
		bestMonthMom,
		bestMonthMatches,
		bestMonthFantasyPoints,
		bestMonthMinutes,
		bestMonthStarts,
		bestMonthYellowCards,
		bestMonthRedCards,
		topPartnerName,
		topPartnerMatches,
		topPartnerWinRate,
		playerType,
		playerTypeReason,
		peakMatchRating: peakFromRow > 0 ? peakFromRow : peakMatchRating,
		peakMatchOpposition,
		peakMatchGoals,
		peakMatchPenaltiesScored,
		peakMatchAssists,
		peakMatchFantasyPoints,
		peakMatchMinutes,
		peakMatchStarted,
		peakMatchMom,
		peakMatchMomCount,
		peakMatchYellowCards,
		peakMatchRedCards,
		peakMatchResultLabel,
		peakMatchScoreline,
		longestStreakType,
		longestStreakValue,
		totalYellowCards,
		totalRedCards,
		totalWins,
		totalDraws,
		totalCleanSheets,
		totalDistance,
		distanceEquivalent: distanceMilesToEquivalent(totalDistance),
		wrappedUrl,
		wrappedLeaguePointsContributed,
		wrappedLeagueWinsFromPlayedGames,
		wrappedLeagueDrawsFromPlayedGames,
		wrappedCupTiesAdvanced,
		wrappedDominantTeam,
		wrappedDominantTeamLeaguePosition,
		wrappedDominantTeamLeagueDivision,
		wrappedDominantTeamLeagueRow,
		wrappedTrophiesWon,
		wrappedHomeApps: homeStats.apps,
		wrappedAwayApps: awayStats.apps,
		wrappedHomeWinRate,
		wrappedAwayWinRate,
		wrappedHomeGoals: homeStats.goals,
		wrappedAwayGoals: awayStats.goals,
		wrappedHomePenaltiesScored: homeStats.penaltiesScored,
		wrappedAwayPenaltiesScored: awayStats.penaltiesScored,
		wrappedHomeAssists: homeStats.assists,
		wrappedAwayAssists: awayStats.assists,
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

function wrappedPeakResultLabel(raw: string): string {
	const u = raw.trim().toUpperCase();
	if (u === "W" || u.startsWith("WIN")) return "Win";
	if (u === "D" || u.startsWith("DRA")) return "Draw";
	if (u === "L" || u.startsWith("LOS")) return "Loss";
	return raw.trim() || "-";
}

function formatWrappedPositionClass(cls: string): string {
	const c = cls.trim().toUpperCase();
	const map: Record<string, string> = {
		GK: "Goalkeeper",
		DEF: "Defender",
		MID: "Midfielder",
		FWD: "Forward",
	};
	if (map[c]) return map[c];
	if (!c || c === "UNK" || c === "UN") return "-";
	return cls;
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
