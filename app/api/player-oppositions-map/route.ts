import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { Record } from "neo4j-driver";

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

		// Query to get all OppositionDetails where the player has played
		const query = `
			MATCH (p:Player {playerName: $playerName, graphLabel: $graphLabel})
			-[r:PLAYED_AGAINST_OPPONENT]->(od:OppositionDetails {graphLabel: $graphLabel})
			WHERE od.address IS NOT NULL AND od.latitude IS NOT NULL AND od.longitude IS NOT NULL
			RETURN od.opposition as name, 
			       od.address as address, 
			       od.latitude as lat, 
			       od.longitude as lng, 
			       r.timesPlayed as timesPlayed
			ORDER BY r.timesPlayed DESC
		`;

		const result = await neo4jService.runQuery(query, { playerName, graphLabel });

		const oppositions = result.records.map((record: Record) => {
			const lat = record.get("lat");
			const lng = record.get("lng");
			return {
				name: String(record.get("name") || ""),
				address: String(record.get("address") || ""),
				lat: lat !== null && lat !== undefined ? parseFloat(String(lat)) : null,
				lng: lng !== null && lng !== undefined ? parseFloat(String(lng)) : null,
				timesPlayed: record.get("timesPlayed") ? parseInt(String(record.get("timesPlayed")), 10) : 0,
			};
		}).filter((opp: { lat: number | null; lng: number | null }) => opp.lat !== null && opp.lng !== null);

		return NextResponse.json({ oppositions }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching player oppositions map data:", error);
		return NextResponse.json({ error: "Failed to fetch opposition map data" }, { status: 500, headers: corsHeaders });
	}
}

