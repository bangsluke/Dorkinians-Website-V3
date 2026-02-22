import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { buildFilterConditions } from "@/app/api/player-data/route";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
	return NextResponse.json({}, { headers: corsHeaders });
}

function normalizeSeasonDisplay(season: string): string {
	if (!season) return season;
	return season.replace("-", "/");
}

function toNumber(value: unknown): number {
	if (value === null || value === undefined) return 0;
	if (typeof value === "number") return isNaN(value) ? 0 : value;
	if (typeof value === "object" && value !== null) {
		if ("toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
			return (value as { toNumber: () => number }).toNumber();
		}
		if ("low" in value && "high" in value) {
			const v = value as { low?: number; high?: number };
			return (v.low || 0) + (v.high || 0) * 4294967296;
		}
	}
	const num = Number(value);
	return isNaN(num) ? 0 : num;
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const playerName = searchParams.get("playerName");
		const filtersParam = searchParams.get("filters");

		if (!playerName || typeof playerName !== "string" || playerName.trim() === "") {
			return NextResponse.json({ error: "Valid player name is required" }, { status: 400, headers: corsHeaders });
		}

		let filters: Record<string, unknown> | null = null;
		if (filtersParam && filtersParam.trim() !== "") {
			try {
				filters = JSON.parse(decodeURIComponent(filtersParam)) as Record<string, unknown>;
			} catch {
				// ignore invalid JSON
			}
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

		const filterConditions = buildFilterConditions(filters, params);
		const whereConditions =
			filterConditions.length > 0
				? `WHERE f.season IS NOT NULL AND ${filterConditions.join(" AND ")}`
				: "WHERE f.season IS NOT NULL";

		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
			${whereConditions}
			WITH f.season AS rawSeason, count(DISTINCT f) AS apps
			WHERE rawSeason IS NOT NULL
			RETURN rawSeason, apps
			ORDER BY rawSeason ASC
		`;

		const result = await neo4jService.runQuery(query, params);

		const seasons = result.records.map((r) => {
			const rawSeason = r.get("rawSeason");
			const seasonStr = rawSeason != null ? String(rawSeason) : "";
			return {
				season: normalizeSeasonDisplay(seasonStr),
				apps: toNumber(r.get("apps")),
			};
		});

		return NextResponse.json({ seasons }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching player seasons games:", error);
		return NextResponse.json({ error: "Failed to fetch player seasons" }, { status: 500, headers: corsHeaders });
	}
}
