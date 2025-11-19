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

interface MilestoneEntry {
	playerName: string;
	statType: string;
	milestone: number;
	currentValue: number;
	distanceFromMilestone: number;
	mostRecentMatchDate?: string;
}

// Helper function to convert Neo4j Integer/Float to JavaScript number
const toNumber = (value: any): number => {
	if (value === null || value === undefined) return 0;
	if (typeof value === "number") {
		if (isNaN(value)) return 0;
		return value;
	}
	// Handle Neo4j Integer objects
	if (typeof value === "object") {
		if ("toNumber" in value && typeof value.toNumber === "function") {
			return value.toNumber();
		}
		if ("low" in value && "high" in value) {
			// Neo4j Integer format: low + high * 2^32
			const low = value.low || 0;
			const high = value.high || 0;
			return low + high * 4294967296;
		}
		if ("toString" in value) {
			const num = Number(value.toString());
			return isNaN(num) ? 0 : num;
		}
	}
	const num = Number(value);
	return isNaN(num) ? 0 : num;
};

export async function GET(request: NextRequest) {
	try {
		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		// First, get the most recent match date to calculate 5 weeks back
		const mostRecentDateQuery = `
			MATCH (md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.date IS NOT NULL
			RETURN max(md.date) as mostRecentDate
		`;

		const mostRecentDateResult = await neo4jService.runQuery(mostRecentDateQuery, { graphLabel });
		const mostRecentDateStr = mostRecentDateResult.records[0]?.get("mostRecentDate");
		
		// Calculate 5 weeks (35 days) back from the most recent match date
		let cutoffDate: Date | null = null;
		if (mostRecentDateStr) {
			const mostRecentDate = new Date(String(mostRecentDateStr));
			cutoffDate = new Date(mostRecentDate);
			cutoffDate.setDate(cutoffDate.getDate() - 35); // 5 weeks = 35 days
		}

		// Query all players with their stats and match details ordered by date
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel})
			WHERE p.allowOnSite = true
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WITH p, md
			ORDER BY md.date ASC
			WITH p,
				collect(md) as matchDetails
			WITH p,
				size(matchDetails) as appearances,
				reduce(total = 0, md in matchDetails | total + coalesce(md.mom, 0)) as mom,
				reduce(total = 0, md in matchDetails | total + coalesce(md.goals, 0)) as goals,
				reduce(total = 0, md in matchDetails | total + coalesce(md.assists, 0)) as assists,
				matchDetails
			RETURN p.playerName as playerName,
				coalesce(appearances, 0) as appearances,
				coalesce(mom, 0) as mom,
				coalesce(goals, 0) as goals,
				coalesce(assists, 0) as assists,
				matchDetails
			ORDER BY p.playerName
		`;

		const params = { graphLabel };

		const result = await neo4jService.runQuery(query, params);

		// Process results
		const players: Array<{
			playerName: string;
			appearances: number;
			goals: number;
			assists: number;
			mom: number;
			matchDetails: Array<{
				date: string;
				mom: number;
				goals: number;
				assists: number;
			}>;
		}> = [];

		for (const record of result.records) {
			const playerName = String(record.get("playerName") || "");
			if (!playerName || playerName.trim() === "") continue;

			const matchDetailsRaw = record.get("matchDetails");
			const matchDetails: Array<{
				date: string;
				mom: number;
				goals: number;
				assists: number;
			}> = [];

			if (matchDetailsRaw && Array.isArray(matchDetailsRaw)) {
				for (const md of matchDetailsRaw) {
					const properties = md.properties || md;
					matchDetails.push({
						date: String(properties.date || ""),
						mom: toNumber(properties.mom || 0),
						goals: toNumber(properties.goals || 0),
						assists: toNumber(properties.assists || 0),
					});
				}
				// Sort by date to ensure most recent is last (in case order wasn't preserved)
				matchDetails.sort((a, b) => {
					const dateA = new Date(a.date).getTime();
					const dateB = new Date(b.date).getTime();
					return dateA - dateB;
				});
			}

			players.push({
				playerName,
				appearances: toNumber(record.get("appearances")),
				goals: toNumber(record.get("goals")),
				assists: toNumber(record.get("assists")),
				mom: toNumber(record.get("mom")),
				matchDetails,
			});
		}

		// Define milestones and stat types
		const milestones = [50, 100, 150, 200, 250, 300];
		const statTypes = [
			{ key: "appearances", label: "Apps" },
			{ key: "goals", label: "Goals" },
			{ key: "assists", label: "Assists" },
			{ key: "mom", label: "MoMs" },
		];

		const achieved: MilestoneEntry[] = [];
		const nearing: MilestoneEntry[] = [];

		// Process each player
		for (const player of players) {
			// Get most recent match date for this player
			const mostRecentMatchDate =
				player.matchDetails.length > 0
					? player.matchDetails[player.matchDetails.length - 1]?.date
					: undefined;

			// Filter: Only include players who have played in the past 5 weeks
			if (!mostRecentMatchDate || !cutoffDate) {
				continue; // Skip players with no match date or if we couldn't determine cutoff
			}

			const playerMostRecentDate = new Date(mostRecentMatchDate);
			if (playerMostRecentDate < cutoffDate) {
				continue; // Skip players who haven't played in the past 5 weeks
			}

			// Check each stat type
			for (const statType of statTypes) {
				const currentValue = player[statType.key as keyof typeof player] as number;
				const statKey = statType.key;

				// Check each milestone
				for (const milestone of milestones) {
					// Check if achieved (milestone to milestone + 4)
					if (currentValue >= milestone && currentValue <= milestone + 4) {
						achieved.push({
							playerName: player.playerName,
							statType: statType.label,
							milestone,
							currentValue,
							distanceFromMilestone: currentValue - milestone,
							mostRecentMatchDate: mostRecentMatchDate || undefined,
						});
					}

					// Check if nearing (milestone - 5 to milestone - 1)
					if (currentValue >= milestone - 5 && currentValue < milestone) {
						nearing.push({
							playerName: player.playerName,
							statType: statType.label,
							milestone,
							currentValue,
							distanceFromMilestone: milestone - currentValue,
							mostRecentMatchDate: mostRecentMatchDate || undefined,
						});
					}
				}
			}
		}

		// Helper function to get stat type priority (higher number = higher priority)
		const getStatTypePriority = (statType: string): number => {
			switch (statType) {
				case "MoMs":
					return 4; // Highest priority
				case "Goals":
					return 3;
				case "Assists":
					return 2;
				case "Apps":
					return 1; // Lowest priority
				default:
					return 0;
			}
		};

		// Sort achieved by: highest milestone first, then stat type priority, then proximity to milestone
		achieved.sort((a, b) => {
			// First sort by milestone (highest first - descending: 300, 250, 200, 150, 100, 50)
			if (a.milestone !== b.milestone) {
				return b.milestone - a.milestone; // Highest milestone first
			}

			// Then by stat type priority (MoM > Goals > Assists > Apps)
			const statPriorityA = getStatTypePriority(a.statType);
			const statPriorityB = getStatTypePriority(b.statType);
			if (statPriorityA !== statPriorityB) {
				return statPriorityB - statPriorityA; // Higher priority first
			}

			// Finally by proximity to milestone (nearest first - ascending distance)
			return a.distanceFromMilestone - b.distanceFromMilestone;
		});

		// Sort nearing by: highest milestone first, then stat type priority, then proximity to milestone
		nearing.sort((a, b) => {
			// First sort by milestone (highest first - descending: 300, 250, 200, 150, 100, 50)
			if (a.milestone !== b.milestone) {
				return b.milestone - a.milestone; // Highest milestone first (descending)
			}

			// Then by stat type priority (MoM > Goals > Assists > Apps)
			const statPriorityA = getStatTypePriority(a.statType);
			const statPriorityB = getStatTypePriority(b.statType);
			if (statPriorityA !== statPriorityB) {
				return statPriorityB - statPriorityA; // Higher priority first
			}

			// Finally by proximity to milestone (nearest first - ascending distance)
			return a.distanceFromMilestone - b.distanceFromMilestone;
		});

		// Limit to top 5 per category
		const topAchieved = achieved.slice(0, 5);
		const topNearing = nearing.slice(0, 5);

		return NextResponse.json(
			{
				achieved: topAchieved,
				nearing: topNearing,
			},
			{ headers: corsHeaders }
		);
	} catch (error) {
		console.error("Error fetching milestones:", error);
		return NextResponse.json({ error: "Failed to fetch milestones" }, { status: 500, headers: corsHeaders });
	}
}

