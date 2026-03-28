import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { buildFilterConditions } from "../player-data/route";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

const ALPHA_REACTIVE = 0.30;
const ALPHA_BASELINE = 0.12;
const SQUAD_AVG_FTP = 5.5;

type RawMatch = {
	fixtureId: string;
	week: string;
	date: string;
	matchRating: number | null;
	fantasyPoints: number;
};

type FullMatchRow = RawMatch & {
	class: string;
	minutes: number;
	goals: number;
	assists: number;
	mom: number;
	cleanSheets: number;
	saves: number;
	yellowCards: number;
	redCards: number;
	ownGoals: number;
	concededPlayer: number;
	penaltiesMissed: number;
	penaltiesSaved: number;
	opposition: string;
	homeOrAway: string;
	result: string;
	compType: string;
	dorkiniansGoals: number;
	fixtureConceded: number;
};

/** Last N matches for recent-form UI + rating tooltip (newest-first in JSON). */
export type PlayerFormRecentMatch = {
	fixtureId: string;
	week: string;
	date: string;
	displayScore: number;
	matchRating: number | null;
	fantasyPoints: number;
	class: string;
	minutes: number;
	goals: number;
	assists: number;
	mom: number;
	cleanSheets: number;
	saves: number;
	yellowCards: number;
	redCards: number;
	ownGoals: number;
	conceded: number;
	penaltiesMissed: number;
	penaltiesSaved: number;
	opposition: string;
	homeOrAway: string;
	result: string;
	compType: string;
	goalsScored: number;
	goalsConceded: number;
};

function toNumber(value: unknown, fallback = 0): number {
	if (value === null || value === undefined) return fallback;
	if (typeof value === "number") return Number.isNaN(value) ? fallback : value;
	if (typeof value === "object" && value !== null) {
		if ("toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
			const n = (value as { toNumber: () => number }).toNumber();
			return Number.isNaN(n) ? fallback : n;
		}
		if ("low" in value && "high" in value) {
			const v = value as { low?: number; high?: number };
			return (v.low || 0) + (v.high || 0) * 4294967296;
		}
	}
	const n = Number(value);
	return Number.isNaN(n) ? fallback : n;
}

function computeForm(matches: RawMatch[]) {
	let ewmaReactive = SQUAD_AVG_FTP;
	let ewmaBaseline = SQUAD_AVG_FTP;
	const history = matches.map((match) => {
		const rawScore = match.matchRating != null ? match.matchRating : match.fantasyPoints;
		const score = typeof rawScore === "number" && !Number.isNaN(rawScore) ? rawScore : SQUAD_AVG_FTP;
		ewmaReactive = ALPHA_REACTIVE * score + (1 - ALPHA_REACTIVE) * ewmaReactive;
		ewmaBaseline = ALPHA_BASELINE * score + (1 - ALPHA_BASELINE) * ewmaBaseline;
		return {
			matchId: match.fixtureId,
			week: match.week,
			date: match.date,
			rawScore: Math.round(score * 10) / 10,
			ewmaReactive: Math.round(ewmaReactive * 10) / 10,
			ewmaBaseline: Math.round(ewmaBaseline * 10) / 10,
		};
	});

	const trend = (() => {
		if (history.length < 4) return "stable";
		const current = history[history.length - 1].ewmaReactive;
		const threeAgo = history[history.length - 4].ewmaReactive;
		const diff = current - threeAgo;
		if (diff > 0.3) return "rising";
		if (diff < -0.3) return "declining";
		return "stable";
	})();

	const latest = history.length > 0 ? history[history.length - 1] : null;
	let peak = history.length > 0 ? history[0] : null;
	for (const point of history) {
		if (peak && point.ewmaReactive > peak.ewmaReactive) {
			peak = point;
		}
	}
	const seasonAvg =
		history.length > 0
			? Math.round((history.reduce((sum, h) => sum + h.rawScore, 0) / history.length) * 10) / 10
			: null;

	const goldenCrosses = history
		.map((point, idx) => {
			if (idx === 0) return null;
			const prev = history[idx - 1];
			const crossed = prev.ewmaReactive <= prev.ewmaBaseline && point.ewmaReactive > point.ewmaBaseline;
			return crossed ? { week: point.week, date: point.date } : null;
		})
		.filter(Boolean);

	return {
		history,
		summary: {
			formCurrent: latest ? latest.ewmaReactive : null,
			formBaseline: latest ? latest.ewmaBaseline : null,
			formTrend: trend,
			formPeak: peak ? peak.ewmaReactive : null,
			formPeakWeek: peak ? peak.week : null,
			seasonAvg,
		},
		goldenCrosses,
	};
}

export async function OPTIONS() {
	return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { playerName, filters } = body;

		if (!playerName || typeof playerName !== "string" || playerName.trim() === "") {
			return NextResponse.json({ error: "Valid player name is required" }, { status: 400, headers: corsHeaders });
		}

		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const params: Record<string, unknown> = {
			graphLabel,
			playerName: playerName.trim(),
		};

		let query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		`;

		const conditions = buildFilterConditions(filters || null, params);
		if (conditions.length > 0) {
			query += ` WHERE ${conditions.join(" AND ")}`;
		}

		query += `
			RETURN
				f.id AS fixtureId,
				f.seasonWeek AS week,
				toString(f.date) AS date,
				md.matchRating AS matchRating,
				coalesce(md.fantasyPoints, 0) AS fantasyPoints,
				coalesce(md.class, "") AS class,
				coalesce(md.minutes, 0) AS minutes,
				coalesce(md.goals, 0) AS goals,
				coalesce(md.assists, 0) AS assists,
				coalesce(md.mom, 0) AS mom,
				coalesce(md.cleanSheets, 0) AS cleanSheets,
				coalesce(md.saves, 0) AS saves,
				coalesce(md.yellowCards, 0) AS yellowCards,
				coalesce(md.redCards, 0) AS redCards,
				coalesce(md.ownGoals, 0) AS ownGoals,
				coalesce(md.conceded, 0) AS concededPlayer,
				coalesce(md.penaltiesMissed, 0) AS penaltiesMissed,
				coalesce(md.penaltiesSaved, 0) AS penaltiesSaved,
				coalesce(f.opposition, "") AS opposition,
				coalesce(f.homeOrAway, "") AS homeOrAway,
				coalesce(f.result, "") AS result,
				coalesce(f.compType, "") AS compType,
				coalesce(f.dorkiniansGoals, 0) AS dorkiniansGoals,
				coalesce(f.conceded, 0) AS fixtureConceded
			ORDER BY f.date ASC
		`;

		const result = await neo4jService.runQuery(query, params);
		const fullRows: FullMatchRow[] = result.records.map((r: any) => {
			const matchRating = r.get("matchRating") == null ? null : Math.round(toNumber(r.get("matchRating")) * 10) / 10;
			const fantasyPoints = toNumber(r.get("fantasyPoints"), 0);
			return {
				fixtureId: String(r.get("fixtureId") || ""),
				week: String(r.get("week") || ""),
				date: String(r.get("date") || ""),
				matchRating,
				fantasyPoints,
				class: String(r.get("class") || ""),
				minutes: toNumber(r.get("minutes"), 0),
				goals: toNumber(r.get("goals"), 0),
				assists: toNumber(r.get("assists"), 0),
				mom: toNumber(r.get("mom"), 0),
				cleanSheets: toNumber(r.get("cleanSheets"), 0),
				saves: toNumber(r.get("saves"), 0),
				yellowCards: toNumber(r.get("yellowCards"), 0),
				redCards: toNumber(r.get("redCards"), 0),
				ownGoals: toNumber(r.get("ownGoals"), 0),
				concededPlayer: toNumber(r.get("concededPlayer"), 0),
				penaltiesMissed: toNumber(r.get("penaltiesMissed"), 0),
				penaltiesSaved: toNumber(r.get("penaltiesSaved"), 0),
				opposition: String(r.get("opposition") || ""),
				homeOrAway: String(r.get("homeOrAway") || ""),
				result: String(r.get("result") || ""),
				compType: String(r.get("compType") || ""),
				fixtureConceded: toNumber(r.get("fixtureConceded"), 0),
				dorkiniansGoals: toNumber(r.get("dorkiniansGoals"), 0),
			};
		});

		const matches: RawMatch[] = fullRows.map((row) => ({
			fixtureId: row.fixtureId,
			week: row.week,
			date: row.date,
			matchRating: row.matchRating,
			fantasyPoints: row.fantasyPoints,
		}));

		const data = computeForm(matches);

		const lastTen = fullRows.slice(-10);
		const recentFormMatches: PlayerFormRecentMatch[] = [...lastTen].reverse().map((row) => {
			const rawScore = row.matchRating != null ? row.matchRating : row.fantasyPoints;
			const displayScore = typeof rawScore === "number" && !Number.isNaN(rawScore) ? Math.round(rawScore * 10) / 10 : SQUAD_AVG_FTP;
			return {
				fixtureId: row.fixtureId,
				week: row.week,
				date: row.date,
				displayScore,
				matchRating: row.matchRating,
				fantasyPoints: row.fantasyPoints,
				class: row.class,
				minutes: row.minutes,
				goals: row.goals,
				assists: row.assists,
				mom: row.mom,
				cleanSheets: row.cleanSheets,
				saves: row.saves,
				yellowCards: row.yellowCards,
				redCards: row.redCards,
				ownGoals: row.ownGoals,
				conceded: row.concededPlayer,
				penaltiesMissed: row.penaltiesMissed,
				penaltiesSaved: row.penaltiesSaved,
				opposition: row.opposition,
				homeOrAway: row.homeOrAway,
				result: row.result,
				compType: row.compType,
				goalsScored: row.dorkiniansGoals,
				goalsConceded: row.fixtureConceded,
			};
		});

		return NextResponse.json({ ...data, recentFormMatches }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching player form data:", error);
		return NextResponse.json({ error: "Failed to fetch player form data" }, { status: 500, headers: corsHeaders });
	}
}

