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

export default homepageQuestions;
