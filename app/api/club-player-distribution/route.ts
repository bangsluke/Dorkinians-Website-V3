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

		// Base query - match players with their match details
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

		// Count distinct players per team level
		// Team names in database are "1st XI", "2nd XI", etc.
		query += `
			WITH p, md.team as team
			WHERE team IS NOT NULL
			WITH DISTINCT p, team
			WITH team,
				count(DISTINCT p) as playerCount
			RETURN team, playerCount
			ORDER BY 
				CASE team
					WHEN "1st XI" THEN 1
					WHEN "2nd XI" THEN 2
					WHEN "3rd XI" THEN 3
					WHEN "4th XI" THEN 4
					WHEN "5th XI" THEN 5
					WHEN "6th XI" THEN 6
					WHEN "7th XI" THEN 7
					WHEN "8th XI" THEN 8
					ELSE 99
				END
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

		// Map team names to short codes for sankey diagram
		const teamNameMap: { [key: string]: string } = {
			"1st XI": "1s",
			"2nd XI": "2s",
			"3rd XI": "3s",
			"4th XI": "4s",
			"5th XI": "5s",
			"6th XI": "6s",
			"7th XI": "7s",
			"8th XI": "8s",
		};

		const distribution = result.records.map((record) => {
			const teamName = String(record.get("team") || "");
			const count = toNumber(record.get("playerCount"));
			return {
				team: teamNameMap[teamName] || teamName,
				count: count,
			};
		});

		return NextResponse.json({ distribution }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching club player distribution:", error);
		return NextResponse.json({ error: "Failed to fetch club player distribution" }, { status: 500, headers: corsHeaders });
	}
}


