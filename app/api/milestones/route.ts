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
		
		// Calculate cutoffs: 5 weeks for Apps, 1 year for Goals/Assists/MoMs
		let cutoffDate5Weeks: Date | null = null;
		let cutoffDate1Year: Date | null = null;
		if (mostRecentDateStr) {
			const mostRecentDate = new Date(String(mostRecentDateStr));
			cutoffDate5Weeks = new Date(mostRecentDate);
			cutoffDate5Weeks.setDate(cutoffDate5Weeks.getDate() - 35); // 5 weeks = 35 days
			cutoffDate1Year = new Date(mostRecentDate);
			cutoffDate1Year.setFullYear(cutoffDate1Year.getFullYear() - 1); // 1 year
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

		// Define milestones per stat type
		const milestonesByStatType: { [key: string]: number[] } = {
			appearances: [50, 100, 150, 200, 250, 300], // Apps: only standard milestones
			goals: [10, 25, 50, 100, 150, 200, 250, 300], // Goals: includes 10 and 25
			assists: [10, 25, 50, 100, 150, 200, 250, 300], // Assists: includes 10 and 25
			mom: [10, 25, 50, 100, 150, 200, 250, 300], // MoMs: includes 10 and 25
		};

		const statTypes = [
			{ key: "appearances", label: "Apps" },
			{ key: "goals", label: "Goals" },
			{ key: "assists", label: "Assists" },
			{ key: "mom", label: "MoMs" },
		];

		const achieved: MilestoneEntry[] = [];
		const nearing: MilestoneEntry[] = [];
		
		// Track closest players to each milestone (even outside window) - key: "statType-milestone"
		const closestToMilestone: { [key: string]: MilestoneEntry | null } = {};

		// Process each player
		for (const player of players) {
			// Get most recent match date for this player
			const mostRecentMatchDate =
				player.matchDetails.length > 0
					? player.matchDetails[player.matchDetails.length - 1]?.date
					: undefined;

			// Check each stat type for closest player tracking (all players, not just recent)
			for (const statType of statTypes) {
				const currentValue = player[statType.key as keyof typeof player] as number;
				const statKey = statType.key;

				// Get milestones for this specific stat type
				const milestones = milestonesByStatType[statKey] || [];

				// Check each milestone to track closest player (even outside window)
				for (const milestone of milestones) {
					// Only track players who haven't reached the milestone yet
					if (currentValue < milestone) {
						const distance = milestone - currentValue;
						const key = `${statType.label}-${milestone}`;
						
						// Track closest player to this milestone
						if (!closestToMilestone[key] || distance < closestToMilestone[key]!.distanceFromMilestone) {
							closestToMilestone[key] = {
								playerName: player.playerName,
								statType: statType.label,
								milestone,
								currentValue,
								distanceFromMilestone: distance,
								mostRecentMatchDate: mostRecentMatchDate || undefined,
							};
						}
					}
				}
			}

			// Check each stat type for achieved/nearing with appropriate activity window
			for (const statType of statTypes) {
				const currentValue = player[statType.key as keyof typeof player] as number;
				const statKey = statType.key;

				// Determine activity cutoff based on stat type
				// Apps: 5 weeks, Goals/Assists/MoMs: 1 year
				const isSingleStat = statKey === "goals" || statKey === "assists" || statKey === "mom";
				const cutoffDate = isSingleStat ? cutoffDate1Year : cutoffDate5Weeks;

				// Filter: Only include players who have played within the appropriate window
				if (!mostRecentMatchDate || !cutoffDate) {
					continue; // Skip players with no match date or if we couldn't determine cutoff
				}

				const playerMostRecentDate = new Date(mostRecentMatchDate);
				if (playerMostRecentDate < cutoffDate) {
					continue; // Skip players who haven't played within the appropriate window
				}

				// Get milestones for this specific stat type (process in descending order to prioritize higher milestones)
				const milestones = milestonesByStatType[statKey] || [];
				const milestonesDescending = [...milestones].sort((a, b) => b - a);

				// Track if player has been added for this stat type (separate flags for achieved and nearing)
				let playerAddedToAchieved = false;
				let playerAddedToNearing = false;

				// Check each milestone (highest first)
				for (const milestone of milestonesDescending) {
					// Skip achieved check if player already added to achieved for this stat type
					// Skip nearing check if player already added to nearing for this stat type
					// But allow player to appear in both lists

					// Check if achieved (milestone to milestone + 4)
					// Only check if player hasn't been added to achieved yet
					if (!playerAddedToAchieved && currentValue >= milestone && currentValue <= milestone + 4) {
						achieved.push({
							playerName: player.playerName,
							statType: statType.label,
							milestone,
							currentValue,
							distanceFromMilestone: currentValue - milestone,
							mostRecentMatchDate: mostRecentMatchDate || undefined,
						});
						playerAddedToAchieved = true;
					}

					// Check if nearing - use wider window (15) for Goals, Assists, and MoMs; 5 for Apps
					// Only check if player hasn't been added to nearing yet
					const nearingWindow = statKey === "appearances" ? 5 : 15;
					const qualifiesForNearing = !playerAddedToNearing && currentValue >= milestone - nearingWindow && currentValue < milestone;
					if (qualifiesForNearing) {
						nearing.push({
							playerName: player.playerName,
							statType: statType.label,
							milestone,
							currentValue,
							distanceFromMilestone: milestone - currentValue,
							mostRecentMatchDate: mostRecentMatchDate || undefined,
						});
						playerAddedToNearing = true;
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

		// Sort achieved by: highest milestone first, then proximity to milestone
		achieved.sort((a, b) => {
			// First sort by milestone (highest first - descending: 300, 250, 200, 150, 100, 50)
			if (a.milestone !== b.milestone) {
				return b.milestone - a.milestone; // Highest milestone first
			}

			// Then by proximity to milestone (nearest first - ascending distance)
			return a.distanceFromMilestone - b.distanceFromMilestone;
		});

		// Sort nearing by: highest milestone first, then proximity to milestone
		nearing.sort((a, b) => {
			// First sort by milestone (highest first - descending: 300, 250, 200, 150, 100, 50)
			if (a.milestone !== b.milestone) {
				return b.milestone - a.milestone; // Highest milestone first (descending)
			}

			// Then by proximity to milestone (nearest first - ascending distance)
			return a.distanceFromMilestone - b.distanceFromMilestone;
		});

		// Limit to top 5 per stat type (not globally)
		// For single stats (Goals, Assists, MoMs): separate lists for achieved and nearing, each with top 5
		// For Apps: keep existing logic
		const achievedByStatType: { [key: string]: MilestoneEntry[] } = {};
		const nearingByStatType: { [key: string]: MilestoneEntry[] } = {};

		// Group by stat type
		for (const entry of achieved) {
			if (!achievedByStatType[entry.statType]) {
				achievedByStatType[entry.statType] = [];
			}
			achievedByStatType[entry.statType].push(entry);
		}

		for (const entry of nearing) {
			if (!nearingByStatType[entry.statType]) {
				nearingByStatType[entry.statType] = [];
			}
			nearingByStatType[entry.statType].push(entry);
		}

		// Sort each stat type's lists and take top 5
		// For achieved: prioritize by milestone (highest first), then proximity
		// This ensures we show the highest milestones achieved, but if there are players at the 10 milestone,
		// they'll appear if they're in the top 5 for that stat type
		for (const statType in achievedByStatType) {
			achievedByStatType[statType].sort((a, b) => {
				// Sort by milestone (highest first), then proximity
				if (a.milestone !== b.milestone) {
					return b.milestone - a.milestone;
				}
				return a.distanceFromMilestone - b.distanceFromMilestone;
			});
			achievedByStatType[statType] = achievedByStatType[statType].slice(0, 5);
		}

		for (const statType in nearingByStatType) {
			nearingByStatType[statType].sort((a, b) => {
				// Sort by milestone (highest first), then proximity
				if (a.milestone !== b.milestone) {
					return b.milestone - a.milestone;
				}
				return a.distanceFromMilestone - b.distanceFromMilestone;
			});
			nearingByStatType[statType] = nearingByStatType[statType].slice(0, 5);
		}

		// Flatten back to arrays (top 5 per stat type for each list)
		const topAchieved = Object.values(achievedByStatType).flat();
		const topNearing = Object.values(nearingByStatType).flat();

		// Sort globally for "Show All" view (by milestone highest first, then proximity)
		topAchieved.sort((a, b) => {
			if (a.milestone !== b.milestone) {
				return b.milestone - a.milestone;
			}
			return a.distanceFromMilestone - b.distanceFromMilestone;
		});

		topNearing.sort((a, b) => {
			if (a.milestone !== b.milestone) {
				return b.milestone - a.milestone;
			}
			return a.distanceFromMilestone - b.distanceFromMilestone;
		});

		// Convert closestToMilestone object to array
		const closestPlayers = Object.values(closestToMilestone).filter((entry): entry is MilestoneEntry => entry !== null);

		return NextResponse.json(
			{
				achieved: topAchieved,
				nearing: topNearing,
				closestToMilestone: closestPlayers,
			},
			{ headers: corsHeaders }
		);
	} catch (error) {
		console.error("Error fetching milestones:", error);
		return NextResponse.json({ error: "Failed to fetch milestones" }, { status: 500, headers: corsHeaders });
	}
}

