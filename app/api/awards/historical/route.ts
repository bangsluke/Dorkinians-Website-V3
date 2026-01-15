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

interface HistoricalAwardEntry {
	awardName: string;
	receiver: string;
	season: string;
	isPlayer: boolean;
}

interface SeasonBreaker {
	type: "season";
	season: string;
}

type AwardDisplayItem = HistoricalAwardEntry | SeasonBreaker;

export async function GET(request: NextRequest) {
	try {
		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Fetch all HistoricalAward nodes
		const query = `
			MATCH (ha:HistoricalAward {graphLabel: $graphLabel})
			RETURN ha
		`;

		const result = await neo4jService.runQuery(query, { graphLabel });

		// Helper function to convert season property name to season string (e.g., "season197374" -> "1973/74")
		const seasonPropToSeason = (propName: string): string | null => {
			if (!propName || !propName.startsWith("season")) {
				return null;
			}
			const seasonDigits = propName.replace("season", "");
			// Format: YYYY/YY (e.g., "197374" -> "1973/74")
			if (seasonDigits.length === 6) {
				const year1 = seasonDigits.substring(0, 4);
				const year2 = seasonDigits.substring(4, 6);
				return `${year1}/${year2}`;
			}
			return null;
		};

		// Collect all award entries
		const allEntries: HistoricalAwardEntry[] = [];
		const seasonPattern = /^season(\d{4})(\d{2})$/;

		result.records.forEach((record: Record) => {
			const node = record.get("ha");
			const properties = node.properties;
			const awardName = String(properties.itemName || "");

			// Check all season properties
			Object.keys(properties).forEach((key) => {
				const match = key.match(seasonPattern);
				if (match) {
					const season = seasonPropToSeason(key);
					if (season) {
						const receiverValue = properties[key];
						if (receiverValue) {
							const receiverStr = String(receiverValue).trim();
							// Filter out placeholder values
							const lowerValue = receiverStr.toLowerCase();
							if (receiverStr !== "" && !["n/a", "na", "tbc", "tbd", "pending"].includes(lowerValue)) {
								allEntries.push({
									awardName,
									receiver: receiverStr,
									season,
									isPlayer: false, // Will be updated below
								});
							}
						}
					}
				}
			});
		});

		// Get all player names to check if receivers are players
		const playerQuery = `
			MATCH (p:Player {graphLabel: $graphLabel})
			RETURN p.playerName as playerName
		`;

		const playerResult = await neo4jService.runQuery(playerQuery, { graphLabel });
		const playerNames = new Set<string>();
		playerResult.records.forEach((record: Record) => {
			const playerName = record.get("playerName");
			if (playerName) {
				playerNames.add(String(playerName).trim().toLowerCase());
			}
		});

		// Update isPlayer flag for each entry
		allEntries.forEach((entry) => {
			// Check if receiver name matches any player (case-insensitive)
			const receiverLower = entry.receiver.toLowerCase().trim();
			entry.isPlayer = playerNames.has(receiverLower);
		});

		// Sort by season (newest first), then by award name
		allEntries.sort((a, b) => {
			const aYear = parseInt(a.season.split("/")[0]);
			const bYear = parseInt(b.season.split("/")[0]);
			if (aYear !== bYear) {
				return bYear - aYear;
			}
			return a.awardName.localeCompare(b.awardName);
		});

		// Group by season and add season breakers
		const displayData: AwardDisplayItem[] = [];
		let currentSeason = "";

		allEntries.forEach((entry) => {
			// Add season breaker if season changed
			if (entry.season !== currentSeason) {
				displayData.push({
					type: "season",
					season: entry.season,
				});
				currentSeason = entry.season;
			}
			displayData.push(entry);
		});

		return NextResponse.json({ awardsData: displayData }, { headers: corsHeaders });
	} catch (error) {
		logError("Error fetching historical award data", error);
		return NextResponse.json({ error: "Failed to fetch historical award data" }, { status: 500, headers: corsHeaders });
	}
}

