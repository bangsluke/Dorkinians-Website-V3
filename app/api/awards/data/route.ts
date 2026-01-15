import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import type { Record } from "neo4j-driver";
import { log, logError } from "@/lib/utils/logger";

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
		const season = searchParams.get("season");

		if (!season) {
			return NextResponse.json({ error: "Season parameter is required" }, { status: 400, headers: corsHeaders });
		}

		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Convert season format: "2019/20" → "season201920"
		const seasonPropName = `season${season.replace(/\//g, "")}`;

		// Captain items - these should be excluded
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

		// Fetch all CaptainsAndAwards nodes for award items (exclude captain items)
		const query = `
			MATCH (ca:CaptainsAndAwards {graphLabel: $graphLabel})
			WHERE ca.itemName IN $awardItems
			RETURN ca
		`;

		const result = await neo4jService.runQuery(query, {
			graphLabel,
			awardItems,
		});

		log('info', `[Awards API] Fetched ${result.records.length} records for season ${season} (property: ${seasonPropName})`);

		// Create a map of all award items to ensure we return all types
		const allAwardItemsMap = new Map<string, { awardName: string; receiver: string | null }>();
		awardItems.forEach((item) => {
			allAwardItemsMap.set(item, {
				awardName: item,
				receiver: null,
			});
		});

		// Process results and populate the map
		result.records.forEach((record: Record) => {
			const node = record.get("ca");
			const properties = node.properties;
			const awardName = String(properties.itemName || "");

			// Access the season property
			const receiver = properties[seasonPropName];
			let receiverName: string | null = null;

			if (receiver !== undefined && receiver !== null) {
				const receiverStr = String(receiver).trim();
				// Filter out placeholder values
				const lowerValue = receiverStr.toLowerCase();
				if (receiverStr !== "" && !['n/a', 'na', 'tbc', 'tbd', 'pending'].includes(lowerValue)) {
					receiverName = receiverStr;
				}
			}

			if (awardName && allAwardItemsMap.has(awardName)) {
				allAwardItemsMap.set(awardName, {
					awardName,
					receiver: receiverName,
				});
			}
		});

		// Convert map to array and sort by award name
		const awardsData = Array.from(allAwardItemsMap.values()).sort((a, b) => {
			// Define order for awards
			const order = [
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
			const aIndex = order.indexOf(a.awardName);
			const bIndex = order.indexOf(b.awardName);
			if (aIndex === -1 && bIndex === -1) return a.awardName.localeCompare(b.awardName);
			if (aIndex === -1) return 1;
			if (bIndex === -1) return -1;
			return aIndex - bIndex;
		});

		return NextResponse.json({ awardsData }, { headers: corsHeaders });
	} catch (error) {
		logError("Error fetching award data", error);
		return NextResponse.json({ error: "Failed to fetch award data" }, { status: 500, headers: corsHeaders });
	}
}

