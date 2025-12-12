import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const playerName = searchParams.get("playerName");

		if (!playerName) {
			return NextResponse.json(
				{ error: "playerName parameter is required" },
				{ status: 400, headers: corsHeaders }
			);
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Query to get opposition performance data with goals and assists
		const query = `
			MATCH (p:Player {playerName: $playerName, graphLabel: $graphLabel})
			-[r:PLAYED_AGAINST_OPPONENT]->(od:OppositionDetails {graphLabel: $graphLabel})
			WHERE r.timesPlayed > 0
			RETURN od.opposition as name, 
			       r.timesPlayed as appearances,
			       coalesce(r.goalsScored, 0) as goals,
			       coalesce(r.assists, 0) as assists
			ORDER BY r.timesPlayed DESC
		`;

		const result = await neo4jService.runQuery(query, { playerName, graphLabel });

		const performanceData = result.records
			.map((record) => {
				const appearances = record.get("appearances") ? parseInt(String(record.get("appearances")), 10) : 0;
				const goals = record.get("goals") ? parseInt(String(record.get("goals")), 10) : 0;
				const assists = record.get("assists") ? parseInt(String(record.get("assists")), 10) : 0;

				if (appearances === 0) {
					return null;
				}

				const goalsPerApp = appearances > 0 ? goals / appearances : 0;
				const assistsPerApp = appearances > 0 ? assists / appearances : 0;

				return {
					name: String(record.get("name") || ""),
					goalsPerApp: parseFloat(goalsPerApp.toFixed(3)),
					assistsPerApp: parseFloat(assistsPerApp.toFixed(3)),
					appearances,
					goals,
					assists,
				};
			})
			.filter((item) => item !== null && (item.goals > 0 || item.assists > 0));

		return NextResponse.json({ performanceData }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching player opposition performance data:", error);
		return NextResponse.json({ error: "Failed to fetch opposition performance data" }, { status: 500, headers: corsHeaders });
	}
}
