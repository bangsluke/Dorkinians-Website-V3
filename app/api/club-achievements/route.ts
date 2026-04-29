import { NextRequest, NextResponse } from 'next/server';
import {
	getAvailableSeasons,
	getSeasonDataFromJSON,
	normalizeSeasonFormat,
} from '@/lib/services/leagueTableService';
import { apiCache, getCacheTTL } from '@/lib/utils/apiCache';
import { neo4jService } from '@/lib/neo4j';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

export type ClubAchievementType = 'league' | 'cup';

export interface ClubAchievement {
	team: string;
	division: string;
	season: string;
	type: ClubAchievementType;
	competition?: string;
}

export async function OPTIONS() {
	return NextResponse.json({}, { headers: corsHeaders });
}

function getTeamPriority(team: string): number {
	const teamMap: { [key: string]: number } = {
		'1s': 1,
		'2s': 2,
		'3s': 3,
		'4s': 4,
		'5s': 5,
		'6s': 6,
		'7s': 7,
		'8s': 8,
	};
	return teamMap[team] || 999;
}

function achievementSortKey(a: ClubAchievement, b: ClubAchievement): number {
	const priorityDiff = getTeamPriority(a.team) - getTeamPriority(b.team);
	if (priorityDiff !== 0) return priorityDiff;
	const seasonA = parseInt(a.season.replace('/', ''), 10);
	const seasonB = parseInt(b.season.replace('/', ''), 10);
	if (seasonA !== seasonB) return seasonB - seasonA;
	const typeOrder = (t: ClubAchievementType): number => (t === 'league' ? 0 : 1);
	const typeDiff = typeOrder(a.type) - typeOrder(b.type);
	if (typeDiff !== 0) return typeDiff;
	const tieA = a.type === 'cup' ? (a.competition ?? '') : a.division;
	const tieB = b.type === 'cup' ? (b.competition ?? '') : b.division;
	return tieA.localeCompare(tieB);
}

export async function GET(_request: NextRequest) {
	try {
		const cacheKey = apiCache.generateKey('/api/club-achievements');
		const cached = apiCache.get<{ achievements: ClubAchievement[] }>(cacheKey);
		if (cached) {
			return NextResponse.json(cached, { headers: corsHeaders });
		}

		const achievements: ClubAchievement[] = [];

		const seasons = await getAvailableSeasons();
		const seasonDataPromises = seasons.map((season) => getSeasonDataFromJSON(season));
		const seasonDataResults = await Promise.all(seasonDataPromises);

		for (const seasonData of seasonDataResults) {
			if (!seasonData) continue;

			for (const [teamKey, teamData] of Object.entries(seasonData.teams)) {
				if (!teamData || !teamData.table || teamData.table.length === 0) continue;

				const dorkiniansEntry = teamData.table.find((entry) =>
					entry.team.toLowerCase().includes('dorkinians'),
				);

				if (dorkiniansEntry && dorkiniansEntry.position === 1) {
					achievements.push({
						team: teamKey,
						division: teamData.division || '',
						season: seasonData.season,
						type: 'league',
					});
				}
			}
		}

		const connected = await neo4jService.connect();
		if (connected) {
			const graphLabel = neo4jService.getGraphLabel();
			const cupQuery = `
				MATCH (cw:CupWin {graphLabel: $graphLabel})
				RETURN cw.teamKey AS team, cw.season AS season, cw.competition AS competition
			`;
			const cupResult = await neo4jService.runQuery(cupQuery, { graphLabel });
			for (const record of cupResult.records) {
				const team = record.get('team');
				const season = record.get('season');
				const competition = record.get('competition');
				if (!team || !season || !competition) continue;
				const seasonStr = normalizeSeasonFormat(String(season), 'slash');
				achievements.push({
					team: String(team),
					division: '',
					season: seasonStr,
					type: 'cup',
					competition: String(competition),
				});
			}
		}

		achievements.sort(achievementSortKey);

		const response = { achievements };

		const ttl = getCacheTTL('/api/club-achievements');
		apiCache.set(cacheKey, response, ttl);

		return NextResponse.json(response, { headers: corsHeaders });
	} catch (error) {
		console.error('Error fetching club achievements:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch club achievements' },
			{ status: 500, headers: corsHeaders },
		);
	}
}
