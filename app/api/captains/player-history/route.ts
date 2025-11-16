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
			return NextResponse.json({ error: "Player name parameter is required" }, { status: 400, headers: corsHeaders });
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Captain items from "Club Captain" to "Vets Captain"
		const captainItems = [
			"Club Captain",
			"First XI Captain",
			"Second XI Captain",
			"Third XI Captain",
			"Fourth XI Captain",
			"Fifth XI Captain",
			"Sixth XI Captain",
			"Seventh XI Captain",
			"Eighth XI Captain",
			"Vets Captain",
		];

		// Fetch all CaptainsAndAwards nodes for captain items
		const query = `
			MATCH (ca:CaptainsAndAwards {graphLabel: $graphLabel})
			WHERE ca.itemName IN $captainItems
			RETURN ca
		`;

		const result = await neo4jService.runQuery(query, {
			graphLabel,
			captainItems,
		});

		// Map team names to display names
		const teamNameMap: Record<string, string> = {
			"Club Captain": "Club Captain",
			"First XI Captain": "First XI",
			"Second XI Captain": "Second XI",
			"Third XI Captain": "Third XI",
			"Fourth XI Captain": "Fourth XI",
			"Fifth XI Captain": "Fifth XI",
			"Sixth XI Captain": "Sixth XI",
			"Seventh XI Captain": "Seventh XI",
			"Eighth XI Captain": "Eighth XI",
			"Vets Captain": "Vets",
		};

		// Extract all captaincies for this player
		const captaincies: Array<{ season: string; team: string }> = [];
		const seasonPattern = /^season(\d{4})(\d{2})$/;

		result.records.forEach((record) => {
			const node = record.get("ca");
			const properties = node.properties;
			const itemName = String(properties.itemName || "");

			// Check all season properties
			Object.keys(properties).forEach((key) => {
				const match = key.match(seasonPattern);
				if (match) {
					const year1 = match[1];
					const year2 = match[2];
					const season = `${year1}/${year2}`;
					const captainValue = properties[key];

					if (captainValue && String(captainValue).trim().toLowerCase() === playerName.trim().toLowerCase()) {
						captaincies.push({
							season,
							team: teamNameMap[itemName] || itemName,
						});
					}
				}
			});
		});

		// Sort by season (newest first)
		captaincies.sort((a, b) => {
			const aYear = parseInt(a.season.split("/")[0]);
			const bYear = parseInt(b.season.split("/")[0]);
			return bYear - aYear;
		});

		return NextResponse.json(
			{
				playerName,
				totalCaptaincies: captaincies.length,
				captaincies,
			},
			{ headers: corsHeaders }
		);
	} catch (error) {
		console.error("Error fetching player captain history:", error);
		return NextResponse.json({ error: "Failed to fetch player captain history" }, { status: 500, headers: corsHeaders });
	}
}

