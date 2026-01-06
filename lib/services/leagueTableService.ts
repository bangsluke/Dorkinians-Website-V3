/**
 * League Table Service
 * Handles fetching and processing league table data from JSON files and Neo4j
 */

import { neo4jService } from '../neo4j';
import fs from 'fs';
import path from 'path';

export interface LeagueTableEntry {
	position: number;
	team: string;
	played: number;
	won: number;
	drawn: number;
	lost: number;
	goalsFor: number;
	goalsAgainst: number;
	goalDifference: number;
	points: number;
}

export interface TeamLeagueData {
	division: string;
	url: string;
	lastUpdated?: string;
	table: LeagueTableEntry[];
}

export interface SeasonLeagueData {
	season: string;
	lastUpdated?: string;
	teams: {
		[key: string]: TeamLeagueData;
	};
}

/**
 * Normalize season format between slash (2016/17) and hyphen (2016-17) formats
 * @param season - Season string in any format
 * @param targetFormat - Target format: 'slash' for "2016/17" or 'hyphen' for "2016-17"
 * @returns Normalized season string
 */
export function normalizeSeasonFormat(season: string, targetFormat: 'slash' | 'hyphen' = 'slash'): string {
	if (!season) return season;
	if (targetFormat === 'slash') {
		return season.replace('-', '/');
	} else {
		return season.replace('/', '-');
	}
}

/**
 * Get all available seasons from JSON files
 */
export async function getAvailableSeasons(): Promise<string[]> {
	try {
		const dataDir = path.join(process.cwd(), 'data', 'league-tables');
		if (!fs.existsSync(dataDir)) {
			return [];
		}

		const files = fs.readdirSync(dataDir);
		const seasons = files
			.filter((file) => file.endsWith('.json'))
			.map((file) => file.replace('.json', ''))
			.sort()
			.reverse(); // Most recent first

		return seasons;
	} catch (error) {
		console.error('Error reading available seasons:', error);
		return [];
	}
}

/**
 * Get league table data for a specific season from JSON file
 * Handles both "2017/18" and "2017-18" formats (files are named with hyphens)
 */
export async function getSeasonDataFromJSON(season: string): Promise<SeasonLeagueData | null> {
	try {
		const dataDir = path.join(process.cwd(), 'data', 'league-tables');
		// Normalize season format to match filename (use hyphen)
		const normalizedSeason = normalizeSeasonFormat(season, 'hyphen');
		const filePath = path.join(dataDir, `${normalizedSeason}.json`);

		if (!fs.existsSync(filePath)) {
			console.warn(`League table JSON file not found: ${filePath}`);
			return null;
		}

		const fileContent = fs.readFileSync(filePath, 'utf-8');
		const data: SeasonLeagueData = JSON.parse(fileContent);

		// Ensure returned data's season property is in slash format for consistency
		if (data.season) {
			data.season = normalizeSeasonFormat(data.season, 'slash');
		}

		return data;
	} catch (error) {
		console.error(`Error reading season data for ${season}:`, error);
		return null;
	}
}

/**
 * Get current season league table data from Neo4j
 */
export async function getCurrentSeasonDataFromNeo4j(teamName?: string): Promise<SeasonLeagueData | null> {
	try {
		const connected = await neo4jService.connect();
		if (!connected) {
			console.error('Neo4j connection failed');
			return null;
		}

		const graphLabel = neo4jService.getGraphLabel();
		
		// First, get the most recent season
		const seasonQuery = `
			MATCH (lt:LeagueTable {graphLabel: $graphLabel})
			WHERE lt.season IS NOT NULL
			WITH DISTINCT lt.season as season
			ORDER BY season DESC
			LIMIT 1
			RETURN season
		`;
		
		const seasonResult = await neo4jService.runQuery(seasonQuery, { graphLabel });
		
		if (seasonResult.records.length === 0) {
			return null;
		}
		
		const currentSeason = seasonResult.records[0].get('season');
		
		// Now get all league table entries for that season
		let query = `
			MATCH (lt:LeagueTable {graphLabel: $graphLabel, season: $season})
		`;

		const params: any = { graphLabel, season: currentSeason };

		if (teamName) {
			query += ` WHERE lt.teamName = $teamName`;
			params.teamName = teamName;
		}

		query += `
			WITH lt.teamName as teamName, 
				lt.division as division, 
				lt.lastUpdated as lastUpdated, 
				lt.url as url,
				collect({
					position: lt.position,
					team: lt.team,
					played: lt.played,
					won: lt.won,
					drawn: lt.drawn,
					lost: lt.lost,
					goalsFor: lt.goalsFor,
					goalsAgainst: lt.goalsAgainst,
					goalDifference: lt.goalDifference,
					points: lt.points
				}) as entries
			WITH teamName, 
				COALESCE(division, '') as division,
				lastUpdated,
				url,
				entries
			RETURN 
				$season as season,
				teamName,
				CASE WHEN division IS NULL OR division = '' THEN '' ELSE division END as division,
				url,
				lastUpdated,
				entries
			ORDER BY teamName
		`;

		// Push query to chatbotService for extraction
		try {
			const { ChatbotService } = await import("./chatbotService");
			const chatbotService = ChatbotService.getInstance();
			let readyToExecuteQuery = query.replace(/\$graphLabel/g, `'${graphLabel}'`);
			readyToExecuteQuery = readyToExecuteQuery.replace(/\$season/g, `'${currentSeason}'`);
			if (teamName) readyToExecuteQuery = readyToExecuteQuery.replace(/\$teamName/g, `'${teamName}'`);
			chatbotService.lastExecutedQueries.push(`CURRENT_SEASON_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`CURRENT_SEASON_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		const result = await neo4jService.runQuery(query, params);

		if (result.records.length === 0) {
			return null;
		}

		// Helper function to convert team display name to team key (1st XI -> 1s)
		const teamNameToKey = (teamName: string): string => {
			const teamNameLower = teamName.toLowerCase().trim();
			const mapping: { [key: string]: string } = {
				'1st xi': '1s',
				'2nd xi': '2s',
				'3rd xi': '3s',
				'4th xi': '4s',
				'5th xi': '5s',
				'6th xi': '6s',
				'7th xi': '7s',
				'8th xi': '8s',
			};
			return mapping[teamNameLower] || teamName;
		};

		// Group by teamName and normalize keys
		const teams: { [key: string]: TeamLeagueData } = {};
		let seasonLastUpdated: string | undefined = undefined;

		for (const record of result.records) {
			const teamName = record.get('teamName');
			const entries = record.get('entries') || [];
			const divisionRaw = record.get('division');
			const url = record.get('url') || '';
			const lastUpdated = record.get('lastUpdated');

			// Convert division to string, handling null/undefined/empty
			const division = divisionRaw ? String(divisionRaw).trim() : '';

			// Get lastUpdated at season level (use first non-null value)
			if (!seasonLastUpdated && lastUpdated) {
				seasonLastUpdated = lastUpdated.toString();
			}

			if (teamName && entries.length > 0) {
				const teamKey = teamNameToKey(teamName);
				teams[teamKey] = {
					division: division,
					url: url || '',
					lastUpdated: lastUpdated ? lastUpdated.toString() : undefined,
					table: entries.map((entry: any) => ({
						position: entry.position?.toNumber?.() ?? entry.position ?? 0,
						team: entry.team ?? '',
						played: entry.played?.toNumber?.() ?? entry.played ?? 0,
						won: entry.won?.toNumber?.() ?? entry.won ?? 0,
						drawn: entry.drawn?.toNumber?.() ?? entry.drawn ?? 0,
						lost: entry.lost?.toNumber?.() ?? entry.lost ?? 0,
						goalsFor: entry.goalsFor?.toNumber?.() ?? entry.goalsFor ?? 0,
						goalsAgainst: entry.goalsAgainst?.toNumber?.() ?? entry.goalsAgainst ?? 0,
						goalDifference: entry.goalDifference?.toNumber?.() ?? entry.goalDifference ?? 0,
						points: entry.points?.toNumber?.() ?? entry.points ?? 0,
					})),
				};
			}
		}

		return {
			season: currentSeason,
			lastUpdated: seasonLastUpdated,
			teams,
		};
	} catch (error) {
		console.error('Error fetching current season data from Neo4j:', error);
		return null;
	}
}

/**
 * Get league table data for a specific team and season
 */
export async function getTeamSeasonData(
	teamName: string,
	season: string,
): Promise<LeagueTableEntry | null> {
	try {
		// Try Neo4j first (for current season)
		const currentSeasonData = await getCurrentSeasonDataFromNeo4j(teamName);
		if (currentSeasonData) {
			// Normalize seasons for comparison (both to slash format)
			const normalizedRequestSeason = normalizeSeasonFormat(season, 'slash');
			const normalizedCurrentSeason = normalizeSeasonFormat(currentSeasonData.season, 'slash');
			
			if (normalizedCurrentSeason === normalizedRequestSeason) {
				const teamData = currentSeasonData.teams[teamName];
				if (teamData && teamData.table && teamData.table.length > 0) {
					// Find Dorkinians team entry
					const dorkiniansEntry = teamData.table.find((entry) =>
						entry.team.toLowerCase().includes('dorkinians'),
					);
					return dorkiniansEntry || null;
				}
			}
		}

		// Try JSON files for past seasons
		// Convert to hyphen format for filename lookup
		const jsonSeasonFormat = normalizeSeasonFormat(season, 'hyphen');
		const seasonData = await getSeasonDataFromJSON(jsonSeasonFormat);
		
		if (seasonData) {
			const teamData = seasonData.teams[teamName];
			if (teamData && teamData.table && teamData.table.length > 0) {
				// Find Dorkinians team entry
				const dorkiniansEntry = teamData.table.find((entry) =>
					entry.team.toLowerCase().includes('dorkinians'),
				);
				return dorkiniansEntry || null;
			}
		}

		return null;
	} catch (error) {
		console.error(`Error fetching team season data for ${teamName} in ${season}:`, error);
		return null;
	}
}

export interface HistoricalPositionEntry {
	team: string;
	season: string;
	position: number;
	played: number;
	won: number;
	drawn: number;
	lost: number;
	goalsFor: number;
	goalsAgainst: number;
	goalDifference: number;
	points: number;
	division: string;
}

/**
 * Get all historical league positions for Dorkinians across all teams and seasons
 */
export async function getAllHistoricalPositions(): Promise<HistoricalPositionEntry[]> {
	const positions: HistoricalPositionEntry[] = [];
	
	try {
		const seasons = await getAvailableSeasons();
		
		for (const season of seasons) {
			const seasonData = await getSeasonDataFromJSON(season);
			if (!seasonData) continue;
			
			// Iterate through all teams in this season
			for (const [teamKey, teamData] of Object.entries(seasonData.teams)) {
				if (!teamData || !teamData.table || teamData.table.length === 0) continue;
				
				// Find Dorkinians entry in this team's table
				const dorkiniansEntry = teamData.table.find((entry) =>
					entry.team.toLowerCase().includes('dorkinians'),
				);
				
				if (dorkiniansEntry) {
					positions.push({
						team: teamKey,
						season: seasonData.season,
						position: dorkiniansEntry.position,
						played: dorkiniansEntry.played,
						won: dorkiniansEntry.won,
						drawn: dorkiniansEntry.drawn,
						lost: dorkiniansEntry.lost,
						goalsFor: dorkiniansEntry.goalsFor,
						goalsAgainst: dorkiniansEntry.goalsAgainst,
						goalDifference: dorkiniansEntry.goalDifference,
						points: dorkiniansEntry.points,
						division: teamData.division || '',
					});
				}
			}
		}
		
		// Also check current season from Neo4j
		const currentSeasonData = await getCurrentSeasonDataFromNeo4j();
		if (currentSeasonData) {
			for (const [teamKey, teamData] of Object.entries(currentSeasonData.teams)) {
				if (!teamData || !teamData.table || teamData.table.length === 0) continue;
				
				const dorkiniansEntry = teamData.table.find((entry) =>
					entry.team.toLowerCase().includes('dorkinians'),
				);
				
				if (dorkiniansEntry) {
					positions.push({
						team: teamKey,
						season: currentSeasonData.season,
						position: dorkiniansEntry.position,
						played: dorkiniansEntry.played,
						won: dorkiniansEntry.won,
						drawn: dorkiniansEntry.drawn,
						lost: dorkiniansEntry.lost,
						goalsFor: dorkiniansEntry.goalsFor,
						goalsAgainst: dorkiniansEntry.goalsAgainst,
						goalDifference: dorkiniansEntry.goalDifference,
						points: dorkiniansEntry.points,
						division: teamData.division || '',
					});
				}
			}
		}
	} catch (error) {
		console.error('Error fetching all historical positions:', error);
	}
	
	return positions;
}

/**
 * Get the highest (best) league finish across all teams and seasons
 */
export async function getHighestLeagueFinish(): Promise<HistoricalPositionEntry | null> {
	const allPositions = await getAllHistoricalPositions();
	
	if (allPositions.length === 0) {
		return null;
	}
	
	// Find the best position (lowest number = highest finish)
	const bestPosition = allPositions.reduce((best, current) => {
		return current.position < best.position ? current : best;
	});
	
	return bestPosition;
}

/**
 * Get the highest (best) league finish for a specific player across all teams/seasons they've played for
 * Queries Neo4j to find all teams and seasons the player has played for, then finds their best league position
 */
export async function getPlayerHighestLeagueFinish(playerName: string): Promise<HistoricalPositionEntry | null> {
	try {
		const connected = await neo4jService.connect();
		if (!connected) {
			console.error('Neo4j connection failed');
			return null;
		}

		const graphLabel = neo4jService.getGraphLabel();
		
		// Query to find all distinct team/season combinations the player has played for
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel})
			WHERE md.team IS NOT NULL AND md.season IS NOT NULL
			WITH DISTINCT md.team as team, md.season as season
			RETURN team, season
			ORDER BY season DESC, team
		`;
		
		// Push query to chatbotService for extraction
		try {
			const { ChatbotService } = await import("./chatbotService");
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`PLAYER_HIGHEST_LEAGUE_FINISH_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`PLAYER_HIGHEST_LEAGUE_FINISH_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}
		
		const result = await neo4jService.runQuery(query, { graphLabel, playerName });
		
		if (result.records.length === 0) {
			return null;
		}
		
		// Convert team names to team keys (e.g., "1st XI" -> "1s")
		const teamNameToKey = (teamName: string): string => {
			const teamNameLower = teamName.toLowerCase().trim();
			const mapping: { [key: string]: string } = {
				'1st xi': '1s',
				'2nd xi': '2s',
				'3rd xi': '3s',
				'4th xi': '4s',
				'5th xi': '5s',
				'6th xi': '6s',
				'7th xi': '7s',
				'8th xi': '8s',
			};
			return mapping[teamNameLower] || teamName;
		};
		
		// Collect all positions for teams/seasons the player has played for
		const playerPositions: HistoricalPositionEntry[] = [];
		
		for (const record of result.records) {
			const team = record.get('team');
			const season = record.get('season');
			const teamKey = teamNameToKey(team);
			
			// Get league position for this team/season
			const normalizedSeason = normalizeSeasonFormat(season, 'slash');
			const teamData = await getTeamSeasonData(teamKey, normalizedSeason);
			
			if (teamData) {
				// Get full season data to get division
				const jsonSeasonFormat = normalizeSeasonFormat(season, 'hyphen');
				const seasonData = await getSeasonDataFromJSON(jsonSeasonFormat);
				const division = seasonData?.teams[teamKey]?.division || '';
				
				playerPositions.push({
					team: teamKey,
					season: normalizedSeason,
					position: teamData.position,
					played: teamData.played,
					won: teamData.won,
					drawn: teamData.drawn,
					lost: teamData.lost,
					goalsFor: teamData.goalsFor,
					goalsAgainst: teamData.goalsAgainst,
					goalDifference: teamData.goalDifference,
					points: teamData.points,
					division: division,
				});
			}
		}
		
		if (playerPositions.length === 0) {
			return null;
		}
		
		// Find the best position (lowest number = highest finish)
		const bestPosition = playerPositions.reduce((best, current) => {
			return current.position < best.position ? current : best;
		});
		
		return bestPosition;
	} catch (error) {
		console.error(`Error fetching player highest league finish for ${playerName}:`, error);
		return null;
	}
}

/**
 * Get the highest (best) league finish for a specific team across all seasons
 * Returns the position entry with full league table data for that season
 */
export async function getTeamHighestPosition(teamName: string): Promise<{ position: HistoricalPositionEntry; fullTable: LeagueTableEntry[]; division: string } | null> {
	try {
		const allPositions = await getAllHistoricalPositions();
		
		// Filter positions for the specific team
		const teamPositions = allPositions.filter((pos) => pos.team === teamName);
		
		if (teamPositions.length === 0) {
			return null;
		}
		
		// Find the best position (lowest number = highest finish)
		const bestPosition = teamPositions.reduce((best, current) => {
			return current.position < best.position ? current : best;
		});
		
		// Get full league table for this season
		const normalizedSeason = normalizeSeasonFormat(bestPosition.season, 'hyphen');
		const seasonData = await getSeasonDataFromJSON(normalizedSeason);
		let fullTable = seasonData?.teams[teamName]?.table || [];
		
		// If not found in JSON, try current season from Neo4j
		if (fullTable.length === 0) {
			const currentSeasonData = await getCurrentSeasonDataFromNeo4j();
			if (currentSeasonData && normalizeSeasonFormat(currentSeasonData.season, 'slash') === normalizeSeasonFormat(bestPosition.season, 'slash')) {
				fullTable = currentSeasonData.teams[teamName]?.table || [];
			}
		}
		
		return {
			position: bestPosition,
			fullTable: fullTable,
			division: bestPosition.division,
		};
	} catch (error) {
		console.error(`Error fetching highest position for ${teamName}:`, error);
		return null;
	}
}

/**
 * Get the lowest (worst) league finish for a specific team across all seasons
 * Returns the position entry with full league table data for that season
 */
export async function getTeamLowestPosition(teamName: string): Promise<{ position: HistoricalPositionEntry; fullTable: LeagueTableEntry[]; division: string } | null> {
	try {
		const allPositions = await getAllHistoricalPositions();
		
		// Filter positions for the specific team
		const teamPositions = allPositions.filter((pos) => pos.team === teamName);
		
		if (teamPositions.length === 0) {
			return null;
		}
		
		// Find the worst position (highest number = lowest finish)
		const worstPosition = teamPositions.reduce((worst, current) => {
			return current.position > worst.position ? current : worst;
		});
		
		// Get full league table for this season
		const normalizedSeason = normalizeSeasonFormat(worstPosition.season, 'hyphen');
		const seasonData = await getSeasonDataFromJSON(normalizedSeason);
		let fullTable = seasonData?.teams[teamName]?.table || [];
		
		// If not found in JSON, try current season from Neo4j
		if (fullTable.length === 0) {
			const currentSeasonData = await getCurrentSeasonDataFromNeo4j();
			if (currentSeasonData && normalizeSeasonFormat(currentSeasonData.season, 'slash') === normalizeSeasonFormat(worstPosition.season, 'slash')) {
				fullTable = currentSeasonData.teams[teamName]?.table || [];
			}
		}
		
		return {
			position: worstPosition,
			fullTable: fullTable,
			division: worstPosition.division,
		};
	} catch (error) {
		console.error(`Error fetching lowest position for ${teamName}:`, error);
		return null;
	}
}

