import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
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

		// Award items - starting from "Player of the Season Award" onwards
		const awardItems = [
			"Player of the Season Award",
			"Young Player of the Season Award",
			"Most Improved Player of the Season Award",
			"Golden Boot",
			"Newcomer of the Year Award",
			"Alan Lambert Sportsmanship Award",
			"Chairman's Cup",
			"Peter Mills Volunteers Award",
			"Goalkeeper of the Year Award",
			"1st XI Squad Player of the Season Award",
			"2nd XI Squad Player of the Season Award",
			"3rd XI Squad Player of the Season Award",
			"4th XI Squad Player of the Season Award",
			"5th XI Squad Player of the Season Award",
			"6th XI Squad Player of the Season Award",
			"7th XI Squad Player of the Season Award",
			"8th XI Squad Player of the Season Award",
			"Vets Squad Player of the Season Award",
		];

		// Fetch all CaptainsAndAwards nodes for award items
		const query = `
			MATCH (ca:CaptainsAndAwards {graphLabel: $graphLabel})
			WHERE ca.itemName IN $awardItems
			RETURN ca
		`;

		const result = await neo4jService.runQuery(query, {
			graphLabel,
			awardItems,
		});

		// Extract all awards for this player
		const awards: Array<{ season: string; awardName: string }> = [];
		const seasonPattern = /^season(\d{4})(\d{2})$/;
		const playerNameLower = playerName.trim().toLowerCase();

		// Process CaptainsAndAwards nodes
		result.records.forEach((record: Record) => {
			const node = record.get("ca");
			const properties = node.properties;
			const awardName = String(properties.itemName || "");

			// Check all season properties
			Object.keys(properties).forEach((key) => {
				const match = key.match(seasonPattern);
				if (match) {
					const year1 = match[1];
					const year2 = match[2];
					const season = `${year1}/${year2}`;
					const receiverValue = properties[key];

					if (receiverValue) {
						const receiverStr = String(receiverValue).trim();
						// Filter out placeholder values
						const lowerValue = receiverStr.toLowerCase();
						if (receiverStr !== "" && !['n/a', 'na', 'tbc', 'tbd', 'pending'].includes(lowerValue)) {
							// Split by comma and ampersand to check if player is in the list
							const receiverNames = receiverStr
								.split(/[,&]/)
								.map((name) => name.trim())
								.filter((name) => name.length > 0);

							// Check if player name matches any of the receivers
							const isReceiver = receiverNames.some(
								(name) => name.trim().toLowerCase() === playerNameLower
							);

							if (isReceiver) {
								awards.push({
									season,
									awardName,
								});
							}
						}
					}
				}
			});
		});

		// Also query HistoricalAward nodes
		const historicalQuery = `
			MATCH (ha:HistoricalAward {graphLabel: $graphLabel})
			RETURN ha
		`;

		const historicalResult = await neo4jService.runQuery(historicalQuery, { graphLabel });

		// Process HistoricalAward nodes
		historicalResult.records.forEach((record: Record) => {
			const node = record.get("ha");
			const properties = node.properties;
			const awardName = String(properties.itemName || "");

			// Check all season properties
			Object.keys(properties).forEach((key) => {
				const match = key.match(seasonPattern);
				if (match) {
					const year1 = match[1];
					const year2 = match[2];
					const season = `${year1}/${year2}`;
					const receiverValue = properties[key];

					if (receiverValue) {
						const receiverStr = String(receiverValue).trim();
						// Filter out placeholder values
						const lowerValue = receiverStr.toLowerCase();
						if (receiverStr !== "" && !['n/a', 'na', 'tbc', 'tbd', 'pending'].includes(lowerValue)) {
							// Split by comma and ampersand to check if player is in the list
							const receiverNames = receiverStr
								.split(/[,&]/)
								.map((name) => name.trim())
								.filter((name) => name.length > 0);

							// Check if player name matches any of the receivers
							const isReceiver = receiverNames.some(
								(name) => name.trim().toLowerCase() === playerNameLower
							);

							if (isReceiver) {
								awards.push({
									season,
									awardName,
								});
							}
						}
					}
				}
			});
		});

		// Sort by season (newest first), then by award name
		awards.sort((a, b) => {
			const aYear = parseInt(a.season.split("/")[0]);
			const bYear = parseInt(b.season.split("/")[0]);
			if (bYear !== aYear) {
				return bYear - aYear;
			}
			return a.awardName.localeCompare(b.awardName);
		});

		return NextResponse.json(
			{
				playerName,
				totalAwards: awards.length,
				awards,
			},
			{ headers: corsHeaders }
		);
	} catch (error) {
		logError("Error fetching player award history", error);
		return NextResponse.json({ error: "Failed to fetch player award history" }, { status: 500, headers: corsHeaders });
	}
}

