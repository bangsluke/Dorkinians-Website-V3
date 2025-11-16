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

		console.log(`[Captains API] Fetched ${result.records.length} records for season ${season} (property: ${seasonPropName})`);
		
		// Debug: Log what we got
		result.records.forEach((record) => {
			const node = record.get("ca");
			const properties = node.properties;
			const availableProps = Object.keys(properties).filter(p => p.startsWith('season'));
			console.log(`[Captains API] Node itemName: "${properties.itemName}", available season props: [${availableProps.join(', ')}], looking for: ${seasonPropName}, value: ${properties[seasonPropName]}`);
		});

		// Helper function to determine if captain value contains multiple players
		const hasMultipleCaptains = (captainValue: string | null): boolean => {
			if (!captainValue) return false;
			return captainValue.includes(",") || captainValue.includes("&");
		};

		// Helper function to get team display name with proper pluralization
		const getTeamDisplayName = (itemName: string, captainValue: string | null): string => {
			// Club Captain doesn't pluralize
			if (itemName === "Club Captain") {
				return "Club Captain";
			}

			// For items like "1st XI Captain(s)", extract the base name and handle pluralization
			// Remove "(s)" suffix if present
			const baseName = itemName.replace(/\s*\(s\)$/, "");
			const isMultiple = hasMultipleCaptains(captainValue);

			// If multiple captains, ensure plural (add "s" if not already there)
			// If single captain, ensure singular (remove "s" if present)
			if (isMultiple) {
				// Ensure plural - add "s" if base doesn't end with "s"
				return baseName.endsWith("s") ? baseName : `${baseName}s`;
			} else {
				// Ensure singular - remove trailing "s" if present (but keep "1st", "2nd", etc.)
				return baseName.endsWith("s") && !baseName.match(/\d+st$|\d+nd$|\d+rd$|\d+th$/) 
					? baseName.slice(0, -1) 
					: baseName;
			}
		};

		// Create a map of all captain items to ensure we return all types
		const allCaptainItemsMap = new Map<string, { team: string; captain: string | null }>();
		captainItems.forEach((item) => {
			allCaptainItemsMap.set(item, {
				team: getTeamDisplayName(item, null),
				captain: null,
			});
		});

		// Process results and populate the map
		result.records.forEach((record) => {
			const node = record.get("ca");
			const properties = node.properties;
			const team = String(properties.itemName || "");
			
			// Access the season property - check if it exists
			const captain = properties[seasonPropName];
			let captainName: string | null = null;
			
			if (captain !== undefined && captain !== null) {
				const captainStr = String(captain).trim();
				// Filter out placeholder values
				const lowerValue = captainStr.toLowerCase();
				if (captainStr !== "" && !['n/a', 'na', 'tbc', 'tbd', 'pending'].includes(lowerValue)) {
					captainName = captainStr;
				}
			}

			if (team && allCaptainItemsMap.has(team)) {
				allCaptainItemsMap.set(team, {
					team: getTeamDisplayName(team, captainName),
					captain: captainName,
				});
			}
		});

		// Convert map to array and sort
		const captainsData = Array.from(allCaptainItemsMap.values()).sort((a, b) => {
			// Sort: Club Captain first, then 1st XI through 8th XI, then Vets
			// Use base names for sorting (without pluralization)
			const getBaseName = (teamName: string): string => {
				// Remove trailing "s" and "(s)" for sorting
				return teamName.replace(/\s*\(s\)$/, "").replace(/s$/, "");
			};
			const order = [
				"Club Captain",
				"1st XI Captain",
				"2nd XI Captain",
				"3rd XI Captain",
				"4th XI Captain",
				"5th XI Captain",
				"6th XI Captain",
				"7th XI Captain",
				"8th XI Captain",
				"Vets Captain",
			];
			const aBase = getBaseName(a.team);
			const bBase = getBaseName(b.team);
			const aIndex = order.indexOf(aBase);
			const bIndex = order.indexOf(bBase);
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

