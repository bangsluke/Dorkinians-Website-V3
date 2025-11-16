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

		// Captain items - these match the actual itemName values in the database
		const captainItems = [
			"Club Captain",
			"1st XI Captain(s)",
			"2nd XI Captain(s)",
			"3rd XI Captain(s)",
			"4th XI Captain(s)",
			"5th XI Captain(s)",
			"6th XI Captain(s)",
			"7th XI Captain(s)",
			"8th XI Captain(s)",
			"Vets Captain(s)",
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

		// Map team names to display names (remove "(s)" suffix and handle pluralization)
		const getTeamDisplayName = (itemName: string): string => {
			if (itemName === "Club Captain") {
				return "Club Captain";
			}
			// Remove "(s)" suffix and return the base name
			return itemName.replace(/\s*\(s\)$/, "");
		};

		// Extract all captaincies for this player
		const captaincies: Array<{ season: string; team: string }> = [];
		const seasonPattern = /^season(\d{4})(\d{2})$/;
		const playerNameLower = playerName.trim().toLowerCase();

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

					if (captainValue) {
						const captainStr = String(captainValue).trim();
						// Split by comma and ampersand to check if player is in the list
						const captainNames = captainStr
							.split(/[,&]/)
							.map((name) => name.trim())
							.filter((name) => name.length > 0);

						// Check if player name matches any of the captains
						const isCaptain = captainNames.some(
							(name) => name.trim().toLowerCase() === playerNameLower
						);

						if (isCaptain) {
							captaincies.push({
								season,
								team: getTeamDisplayName(itemName),
							});
						}
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

