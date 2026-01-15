import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { buildFilterConditions } from "../player-data/route";
import type { Record } from "neo4j-driver";
import { logError } from "@/lib/utils/logger";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { filters } = body;

		if (!filters || typeof filters !== "object") {
			return NextResponse.json({ error: "Filters object is required" }, { status: 400, headers: corsHeaders });
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const params: any = {
			graphLabel,
		};

		// Base query - match players who have match details matching filters
		let query = `
			MATCH (p:Player {graphLabel: $graphLabel})
			WHERE p.allowOnSite = true
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			MATCH (f:Fixture {graphLabel: $graphLabel})-[:HAS_MATCH_DETAILS]->(md)
		`;

		// Build filter conditions
		const conditions = buildFilterConditions(filters, params);
		if (conditions.length > 0) {
			query += ` WHERE ${conditions.join(" AND ")}`;
		}

		// Calculate numberSeasonsPlayedFor from distinct seasons
		query += `
			WITH p, f.season as season
			WHERE season IS NOT NULL AND season <> ""
			WITH DISTINCT p, collect(DISTINCT season) as seasons
			WITH p, size(seasons) as tenure
			WHERE tenure > 0
			RETURN tenure
		`;

		const result = await neo4jService.runQuery(query, params);

		// Helper function to convert Neo4j Integer to JavaScript number
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
			}
			const num = Number(value);
			return isNaN(num) ? 0 : num;
		};

		const tenures = result.records.map((record: Record) => {
			return toNumber(record.get("tenure"));
		});

		return NextResponse.json({ tenures }, { headers: corsHeaders });
	} catch (error) {
		logError("Error fetching club player tenure", error);
		return NextResponse.json({ error: "Failed to fetch club player tenure" }, { status: 500, headers: corsHeaders });
	}
}





