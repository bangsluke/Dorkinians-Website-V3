export interface MetricConfig {
	key: string;
	displayName: string;
	singular: string;
	plural: string;
	aliases: string[];
	description: string;
}

export const metricConfigs: MetricConfig[] = [
	{
		key: 'APP',
		displayName: 'appearances',
		singular: 'appearance',
		plural: 'appearances',
		aliases: ['apps', 'games', 'matches', 'games played', 'matches played'],
		description: 'Number of games/matches played'
	},
	{
		key: 'MIN',
		displayName: 'minutes',
		singular: 'minute played',
		plural: 'minutes played',
		aliases: ['minutes', 'mins', 'time played', 'playing time'],
		description: 'Total minutes played'
	},
	{
		key: 'MOM',
		displayName: 'man of the match',
		singular: 'man of the match award',
		plural: 'man of the match awards',
		aliases: ['mom', 'man of match', 'star man', 'player of match', 'best player'],
		description: 'Man of the match awards'
	},
	{
		key: 'G',
		displayName: 'goals',
		singular: 'goal',
		plural: 'goals',
		aliases: ['goal', 'scored', 'scoring', 'strikes'],
		description: 'Goals scored'
	},
	{
		key: 'A',
		displayName: 'assists',
		singular: 'assist',
		plural: 'assists',
		aliases: ['assist', 'assisting', 'set up', 'setup'],
		description: 'Assists provided'
	},
	{
		key: 'Y',
		displayName: 'yellow cards',
		singular: 'yellow card',
		plural: 'yellow cards',
		aliases: ['yellow', 'yellows', 'booking', 'bookings', 'caution', 'cautions'],
		description: 'Yellow cards received'
	},
	{
		key: 'R',
		displayName: 'red cards',
		singular: 'red card',
		plural: 'red cards',
		aliases: ['red', 'reds', 'sending off', 'sendings off', 'dismissal', 'dismissals'],
		description: 'Red cards received'
	},
	{
		key: 'SAVES',
		displayName: 'saves',
		singular: 'save',
		plural: 'saves',
		aliases: ['save', 'stopping', 'stopped', 'blocked'],
		description: 'Saves made (goalkeeper)'
	},
	{
		key: 'OG',
		displayName: 'own goals',
		singular: 'own goal',
		plural: 'own goals',
		aliases: ['own goal', 'own goals', 'scored against', 'scored on own team'],
		description: 'Own goals scored'
	},
	{
		key: 'C',
		displayName: 'conceded goals',
		singular: 'goal conceded',
		plural: 'goals conceded',
		aliases: ['conceded', 'conceding', 'let in', 'allowed', 'goals against'],
		description: 'Goals conceded (team)'
	},
	{
		key: 'CLS',
		displayName: 'clean sheets',
		singular: 'clean sheet',
		plural: 'clean sheets',
		aliases: ['clean sheet', 'clean sheets', 'shutout', 'shutouts', 'no goals conceded'],
		description: 'Clean sheets kept'
	},
	{
		key: 'PSC',
		displayName: 'penalties scored',
		singular: 'penalty scored',
		plural: 'penalties scored',
		aliases: ['penalty scored', 'penalties scored', 'penalty goal', 'penalty goals', 'spot kick goal'],
		description: 'Penalties successfully converted'
	},
	{
		key: 'PM',
		displayName: 'penalties missed',
		singular: 'penalty missed',
		plural: 'penalties missed',
		aliases: ['penalty missed', 'penalties missed', 'penalty failure', 'penalty failures', 'spot kick miss'],
		description: 'Penalties missed'
	},
	{
		key: 'PCO',
		displayName: 'penalties conceded',
		singular: 'penalty conceded',
		plural: 'penalties conceded',
		aliases: ['penalty conceded', 'penalties conceded', 'gave away penalty', 'gave away penalties'],
		description: 'Penalties conceded to opposition'
	},
	{
		key: 'PSV',
		displayName: 'penalties saved',
		singular: 'penalty saved',
		plural: 'penalties saved',
		aliases: ['penalty saved', 'penalties saved', 'stopped penalty', 'stopped penalties'],
		description: 'Penalties saved (goalkeeper)'
	},
	{
		key: 'FTP',
		displayName: 'fantasy points',
		singular: 'fantasy point',
		plural: 'fantasy points',
		aliases: ['fantasy point', 'fantasy points', 'fpl points', 'fpl point', 'fantasy football points'],
		description: 'Fantasy football points earned'
	}
];

export const getMetricConfig = (key: string): MetricConfig | undefined => {
	return metricConfigs.find(config => config.key === key);
};

export const findMetricByAlias = (alias: string): MetricConfig | undefined => {
	const lowerAlias = alias.toLowerCase();
	return metricConfigs.find(config => 
		config.aliases.some(a => a.toLowerCase() === lowerAlias) ||
		config.displayName.toLowerCase() === lowerAlias ||
		config.key.toLowerCase() === lowerAlias
	);
};

export const getMetricDisplayName = (key: string, value: number): string => {
	const config = getMetricConfig(key);
	if (!config) return key;
	
	return value === 1 ? config.singular : config.plural;
};
