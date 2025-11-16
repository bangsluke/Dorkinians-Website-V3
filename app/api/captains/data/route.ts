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
		// We fetch the entire node and extract the season property in JavaScript
		const query = `
			MATCH (ca:CaptainsAndAwards {graphLabel: $graphLabel})
			WHERE ca.itemName IN $captainItems
			RETURN ca
		`;

		const result = await neo4jService.runQuery(query, {
			graphLabel,
			captainItems,
		});

		// Map team names to display names with ordinal format and (s) suffix
		const teamNameMap: Record<string, string> = {
			"Club Captain": "Club Captain",
			"First XI Captain": "1st XI Captain(s)",
			"Second XI Captain": "2nd XI Captain(s)",
			"Third XI Captain": "3rd XI Captain(s)",
			"Fourth XI Captain": "4th XI Captain(s)",
			"Fifth XI Captain": "5th XI Captain(s)",
			"Sixth XI Captain": "6th XI Captain(s)",
			"Seventh XI Captain": "7th XI Captain(s)",
			"Eighth XI Captain": "8th XI Captain(s)",
			"Vets Captain": "Vets Captain(s)",
		};

		// Create a map of all captain items to ensure we return all types
		const allCaptainItemsMap = new Map<string, { team: string; captain: string | null }>();
		captainItems.forEach((item) => {
			allCaptainItemsMap.set(item, {
				team: teamNameMap[item] || item,
				captain: null,
			});
		});

		// Process results and populate the map
		result.records.forEach((record) => {
			const node = record.get("ca");
			const properties = node.properties;
			const team = String(properties.itemName || "");
			const captain = properties[seasonPropName];
			const captainName = captain ? String(captain).trim() : null;

			if (team && allCaptainItemsMap.has(team)) {
				allCaptainItemsMap.set(team, {
					team: teamNameMap[team] || team,
					captain: captainName && captainName !== "" ? captainName : null,
				});
			}
		});

		// Convert map to array and sort
		const captainsData = Array.from(allCaptainItemsMap.values()).sort((a, b) => {
			// Sort: Club Captain first, then 1st XI through 8th XI, then Vets
			const order = [
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
			const aIndex = order.indexOf(a.team);
			const bIndex = order.indexOf(b.team);
			if (aIndex === -1 && bIndex === -1) return 0;
			if (aIndex === -1) return 1;
			if (bIndex === -1) return -1;
			return aIndex - bIndex;
		});

		return NextResponse.json({ captainsData }, { headers: corsHeaders });
	} catch (error) {
		console.error("Error fetching captain data:", error);
		return NextResponse.json({ error: "Failed to fetch captain data" }, { status: 500, headers: corsHeaders });
	}
}

