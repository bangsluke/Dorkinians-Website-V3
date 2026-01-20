import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { Record } from "neo4j-driver";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";

const corsHeaders = getCorsHeadersWithSecurity();

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
	try {
		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			const errorHeaders = {
				...corsHeaders,
				"Cache-Control": "no-cache, no-store, must-revalidate",
			};
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: errorHeaders });
		}

		// Fetch all players that are allowed on site
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel})
			WHERE p.allowOnSite = true
			RETURN p.playerName as playerName, p.mostPlayedForTeam as mostPlayedForTeam
			ORDER BY p.playerName
		`;
		const params = { graphLabel: neo4jService.getGraphLabel() };

		const result = await neo4jService.runQuery(query, params);

		const players = result.records
			.map((record: Record) => ({
				playerName: String(record.get("playerName") || ""),
				mostPlayedForTeam: String(record.get("mostPlayedForTeam") || ""),
			}))
			.filter((player: { playerName: string }) => player.playerName && player.playerName.trim() !== "");

		// Add Cache-Control header for BFCache compatibility
		const responseHeaders = {
			...corsHeaders,
			"Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
		};

		return NextResponse.json({ players }, { headers: responseHeaders });
	} catch (error) {
		const errorHeaders = {
			...corsHeaders,
			"Cache-Control": "no-cache, no-store, must-revalidate",
		};
		return NextResponse.json({ error: "Failed to fetch players" }, { status: 500, headers: errorHeaders });
	}
}
