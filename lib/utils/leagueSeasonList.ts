const SEASON_KEY = /^\d{4}-\d{2}$/;

/**
 * Same season boundary as the database season calculator:
 * before 1 August the season is previous/current year, and from 1 August it is current/next year.
 */
export function calculateCurrentSeason(date: Date = new Date()): string {
	const year = date.getFullYear();
	const month = date.getMonth() + 1;
	if (month < 8) {
		const previousYear = year - 1;
		return `${previousYear}/${year.toString().slice(-2)}`;
	}
	const nextYear = year + 1;
	return `${year}/${nextYear.toString().slice(-2)}`;
}

function toSeasonKey(season: string): string {
	return season.replace("/", "-");
}

/**
 * Keep saved seasons and add the configured current season when it is not already listed.
 * Seasons are returned newest first as YYYY-YY keys.
 */
export function includeCurrentSeason(seasons: string[], currentSeason: string | null | undefined): string[] {
	const saved = seasons.filter((season) => SEASON_KEY.test(season));
	if (!currentSeason) {
		return saved;
	}

	const currentKey = toSeasonKey(currentSeason);
	if (!SEASON_KEY.test(currentKey) || saved.includes(currentKey)) {
		return saved;
	}

	return [currentKey, ...saved].sort().reverse();
}
