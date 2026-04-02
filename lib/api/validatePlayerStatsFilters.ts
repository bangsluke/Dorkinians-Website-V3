/** Shared validation for POST bodies that include Player Stats filter objects. */

export function validatePlayerStatsFilters(filters: unknown): string | null {
	if (!filters || typeof filters !== "object") {
		return null;
	}
	const f = filters as Record<string, unknown>;

	if (f.timeRange) {
		const tr = f.timeRange as Record<string, unknown>;
		const { type, seasons, beforeDate, afterDate, startDate, endDate } = tr;

		if (!type || !["season", "beforeDate", "afterDate", "betweenDates", "allTime"].includes(String(type))) {
			return "Invalid timeRange type";
		}

		if (type === "season" && (!seasons || !Array.isArray(seasons) || seasons.length === 0)) {
			return "Seasons array is required for season filter";
		}

		if (type === "beforeDate" && !beforeDate) {
			return "beforeDate is required for beforeDate filter";
		}

		if (type === "afterDate" && !afterDate) {
			return "afterDate is required for afterDate filter";
		}

		if (type === "betweenDates" && (!startDate || !endDate)) {
			return "startDate and endDate are required for betweenDates filter";
		}
	}

	if (f.teams && (!Array.isArray(f.teams) || f.teams.some((team: unknown) => typeof team !== "string"))) {
		return "Teams must be an array of strings";
	}

	if (f.location && (!Array.isArray(f.location) || f.location.some((loc: unknown) => !["Home", "Away"].includes(String(loc))))) {
		return "Location must be an array containing 'Home' and/or 'Away'";
	}

	if (f.opposition) {
		const o = f.opposition as Record<string, unknown>;
		if (
			typeof o !== "object" ||
			!["all", "club", "team"].includes(String(o.mode ?? "all")) ||
			(typeof o.searchTerm !== "string" && o.searchTerm !== undefined)
		) {
			return "Invalid opposition filter structure";
		}
	}

	if (f.competition) {
		const c = f.competition as Record<string, unknown>;
		if (typeof c !== "object") {
			return "Competition filter must be an object";
		}

		if (!["types", "individual"].includes(String(c.mode ?? "types"))) {
			return "Competition mode must be 'types' or 'individual'";
		}

		if (
			c.types &&
			(!Array.isArray(c.types) || c.types.some((type: unknown) => !["League", "Cup", "Friendly"].includes(String(type))))
		) {
			return "Competition types must be an array containing 'League', 'Cup', and/or 'Friendly'";
		}

		if (c.searchTerm && typeof c.searchTerm !== "string") {
			return "Competition search term must be a string";
		}
	}

	if (
		f.result &&
		(!Array.isArray(f.result) || f.result.some((result: unknown) => !["Win", "Draw", "Loss"].includes(String(result))))
	) {
		return "Result must be an array containing 'Win', 'Draw', and/or 'Loss'";
	}

	return null;
}
