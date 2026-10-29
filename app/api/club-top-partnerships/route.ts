import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import {
	buildClubTopPartnershipsQuery,
	CLUB_PARTNERSHIP_TOP_LIMIT,
	type ClubPartnershipPair,
} from "@/lib/stats/clubTopPartnerships";
import type { PartnershipSortMode } from "@/lib/stats/partnershipSort";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

function toNumber(value: unknown): number {
	if (value === null || value === undefined) return 0;
	if (typeof value === "number") return Number.isNaN(value) ? 0 : value;
	if (typeof value === "object" && value !== null) {
		if ("toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
			return (value as { toNumber: () => number }).toNumber();
		}
		if ("low" in value && "high" in value) {
			const v = value as { low?: number; high?: number };
			return (v.low || 0) + (v.high || 0) * 4294967296;
		}
	}
	const n = Number(value);
	return Number.isNaN(n) ? 0 : n;
}

function parseSortMode(raw: unknown): PartnershipSortMode {
	return raw === "mostGames" ? "mostGames" : "bestWinRate";
}

export async function OPTIONS() {
	return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const filters = body?.filters ?? null;
		const sortMode = parseSortMode(body?.sortMode);

		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const { query, params } = buildClubTopPartnershipsQuery(
			graphLabel,
			filters,
			sortMode,
			undefined,
			CLUB_PARTNERSHIP_TOP_LIMIT,
		);

		const result = await neo4jService.runQuery(query, params);
		const partnerships: ClubPartnershipPair[] = result.records
			.map((record: { get: (key: string) => unknown }) => {
				const player1 = String(record.get("player1") || "").trim();
				const player2 = String(record.get("player2") || "").trim();
				if (!player1 || !player2) return null;
				return {
					player1,
					player2,
					matches: Math.round(toNumber(record.get("matches"))),
					winRate: Math.round(toNumber(record.get("winRate")) * 10) / 10,
				};
			})
			.filter((row: ClubPartnershipPair | null): row is ClubPartnershipPair => row != null);

		return NextResponse.json({ partnerships, sortMode }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching club top partnerships:", error);
		return NextResponse.json({ error: "Failed to fetch club top partnerships" }, { status: 500, headers: corsHeaders });
	}
}
