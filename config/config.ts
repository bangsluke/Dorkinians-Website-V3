export const appConfig = {
	version: "1.1.5",
	name: "Dorkinians FC",
	description: "Comprehensive source for club statistics, player performance, and team insights",
	author: "Luke Bangs",
	contact: "bangsluke@gmail.com"
} as const;

export type AppConfig = typeof appConfig;

export interface HomepageQuestion {
	id: string;
	question: string;
	description: string;
	category: 'player' | 'team' | 'general';
}

export interface UsefulLink {
	id: string;
	title: string;
	url: string;
	description: string;
	category: 'official' | 'league' | 'sponsor' | 'social' | 'other';
}

export const homepageQuestions: HomepageQuestion[] = [
	{
		id: 'goals-scored',
		question: 'How many goals have I scored?',
		description: 'Get your total goal count across all teams and seasons',
		category: 'player'
	},
	{
		id: 'team-performance',
		question: 'How did my team perform this season?',
		description: 'View team standings, results, and key statistics',
		category: 'team'
	},
	{
		id: 'totw-appearances',
		question: 'How many times have I been in Team of the Week?',
		description: 'Check your Team of the Week appearances and recognition',
		category: 'player'
	}
];

export const usefulLinks: UsefulLink[] = [
	{
		id: 'main-website',
		title: 'Dorkinians FC Official Website',
		url: 'https://www.dorkiniansfc.co.uk/',
		description: 'Official club website with news, fixtures, and team information',
		category: 'official'
	},
	{
		id: 'kit-store',
		title: 'Dorkinian Shop',
		url: 'https://www.dorkiniansfc.co.uk/shop',
		description: 'For annual membership payments and payment plans',
		category: 'official'
	},
	
	{
		id: 'twitter',
		title: 'Club Twitter',
		url: 'https://www.twitter.com/dorkiniansfc',
		description: 'Follow us on Twitter for news and updates',
		category: 'social'
	},
	{
		id: 'instagram',
		title: 'Club Instagram',
		url: 'https://www.instagram.com/dorkiniansfc',
		description: 'Follow us on Instagram for photos and stories',
		category: 'social'
	},
	{
		id: 'facebook',
		title: 'Club Facebook',
		url: 'https://www.facebook.com/groups/234447916584875',
		description: 'Join us on Facebook for latest updates',
		category: 'social'
	},
	{
		id: 'the-fa',
		title: 'The Football Association',
		url: 'https://www.thefa.com/',
		description: 'Official FA website with rules and regulations',
		category: 'other'
	},
	{
		id: 'surrey-fa',
		title: 'Surrey FA',
		url: 'https://www.surreyfa.com/',
		description: 'Surrey County Football Association',
		category: 'other'
	}
];

// Function to generate league links from dataSources
export const generateLeagueLinks = (): UsefulLink[] => {
	// Import dataSources dynamically to avoid circular dependencies
	const { dataSources } = require('../lib/config/dataSources.js');
	
	// Get current season (2024-25) and previous season (2023-24)
	const currentSeason = '2024-25';
	const previousSeason = '2023-24';
	
	// Filter FA site data sources for league tables
	const leagueSources = dataSources.filter((source: any) => 
		source.type === 'FASiteData' && 
		source.category === 'league' && 
		source.url !== 'TBC' &&
		(source.season === currentSeason || source.season === previousSeason)
	);
	
	// Group by team and get the most recent season for each team
	const teamLeagues = leagueSources.reduce((acc: any, source: any) => {
		const team = source.team;
		const season = source.season;
		
		if (!acc[team] || season === currentSeason) {
			acc[team] = source;
		}
		return acc;
	}, {});
	
	// Convert to UsefulLink format
	return Object.values(teamLeagues).map((source: any) => ({
		id: `league-${source.team.toLowerCase().replace(/\s+/g, '-')}`,
		title: `${source.team} League Table (${source.season})`,
		url: source.url,
		description: `View ${source.team} league standings and results for ${source.season} season`,
		category: 'league' as const
	}));
};

export default homepageQuestions;
