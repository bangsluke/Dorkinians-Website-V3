import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { buildFilterConditions } from "../player-data/route";

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
		const { filters, statType } = body;

		if (!filters || typeof filters !== "object") {
			return NextResponse.json({ error: "Filters object is required" }, { status: 400, headers: corsHeaders });
		}

		const validStatTypes = ["goals", "assists", "appearances", "cleanSheets", "saves", "yellowCards", "redCards", "penaltiesScored", "fantasyPoints", "minutes", "mom"];
		if (!statType || !validStatTypes.includes(statType)) {
			return NextResponse.json({ error: `Valid statType is required. Options: ${validStatTypes.join(", ")}` }, { status: 400, headers: corsHeaders });
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

		// Base query - match match details
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

		// Determine which stat field to aggregate
		const statFieldMap: { [key: string]: string } = {
			goals: "md.goals",
			assists: "md.assists",
			appearances: "1", // Count occurrences
			cleanSheets: "md.cleanSheets",
			saves: "md.saves",
			yellowCards: "md.yellowCards",
			redCards: "md.redCards",
			penaltiesScored: "md.penaltiesScored",
			fantasyPoints: "md.fantasyPoints",
			minutes: "md.minutes",
			mom: "md.mom",
		};

		const statField = statFieldMap[statType];

		// Determine position based on class field in MatchDetail
		// Group by position and aggregate stat
		if (statType === "appearances") {
			query += `
				WITH md.class as position, count(md) as statValue
				WHERE position IS NOT NULL AND position <> ""
				RETURN position, statValue
			`;
		} else {
			query += `
				WITH md.class as position, sum(coalesce(${statField}, 0)) as statValue
				WHERE position IS NOT NULL AND position <> ""
				RETURN position, statValue
			`;
		}

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

		// Map position class values to display names
		const positionMap: { [key: string]: string } = {
			"GK": "GK",
			"DEF": "DEF",
			"MID": "MID",
			"FWD": "FWD",
		};

		const stats = result.records
			.map((record) => {
				const positionClass = String(record.get("position") || "");
				const value = toNumber(record.get("statValue"));
				// Map common position class values
				const position = positionMap[positionClass] || positionClass;
				return { position, value };
			})
			.filter((item) => ["GK", "DEF", "MID", "FWD"].includes(item.position))
			.sort((a, b) => {
				// Sort: GK, DEF, MID, FWD
				const order = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
				return (order[a.position as keyof typeof order] ?? 99) - (order[b.position as keyof typeof order] ?? 99);
			});

		return NextResponse.json({ stats }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching club position stats:", error);
		return NextResponse.json({ error: "Failed to fetch club position stats" }, { status: 500, headers: corsHeaders });
	}
}
