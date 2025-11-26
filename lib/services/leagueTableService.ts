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

export interface SeasonLeagueData {
	season: string;
	division?: string;
	url?: string;
	lastUpdated?: string;
	teams: {
		[key: string]: LeagueTableEntry[];
	};
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
 */
export async function getSeasonDataFromJSON(season: string): Promise<SeasonLeagueData | null> {
	try {
		const dataDir = path.join(process.cwd(), 'data', 'league-tables');
		const filePath = path.join(dataDir, `${season}.json`);

		if (!fs.existsSync(filePath)) {
			return null;
		}

		const fileContent = fs.readFileSync(filePath, 'utf-8');
		const data: SeasonLeagueData = JSON.parse(fileContent);

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
			WITH lt.teamName as teamName, lt.division as division, lt.lastUpdated as lastUpdated, lt.url as url,
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
			RETURN 
				$season as season,
				teamName,
				division,
				url,
				lastUpdated,
				entries
			ORDER BY teamName
		`;

		const result = await neo4jService.runQuery(query, params);

		if (result.records.length === 0) {
			return null;
		}

		// Group by teamName
		const teams: { [key: string]: LeagueTableEntry[] } = {};
		let division = '';
		let lastUpdated = '';
		let url = '';

		for (const record of result.records) {
			const teamName = record.get('teamName');
			const entries = record.get('entries') || [];

			if (!division && record.get('division')) {
				division = record.get('division');
			}
			if (!lastUpdated && record.get('lastUpdated')) {
				lastUpdated = record.get('lastUpdated');
			}
			if (!url && record.get('url')) {
				url = record.get('url');
			}

			if (teamName && entries.length > 0) {
				teams[teamName] = entries.map((entry: any) => ({
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
				}));
			}
		}

		return {
			season: currentSeason,
			division: division || undefined,
			url: url || undefined,
			lastUpdated: lastUpdated || undefined,
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
		if (currentSeasonData && currentSeasonData.season === season) {
			const teamData = currentSeasonData.teams[teamName];
			if (teamData && teamData.length > 0) {
				// Find Dorkinians team entry
				const dorkiniansEntry = teamData.find((entry) =>
					entry.team.toLowerCase().includes('dorkinians'),
				);
				return dorkiniansEntry || null;
			}
		}

		// Try JSON files for past seasons
		const seasonData = await getSeasonDataFromJSON(season);
		if (seasonData) {
			const teamData = seasonData.teams[teamName];
			if (teamData && teamData.length > 0) {
				// Find Dorkinians team entry
				const dorkiniansEntry = teamData.find((entry) =>
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

