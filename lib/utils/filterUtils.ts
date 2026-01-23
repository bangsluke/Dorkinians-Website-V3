import { PlayerFilters } from "@/lib/stores/navigation";

export interface ActiveFilter {
	key: string;
	label: string;
	value: string;
	removeKey: string;
}

interface FilterData {
	seasons: Array<{ season: string; startDate: string; endDate: string }>;
	teams: Array<{ name: string }>;
	opposition: Array<{ name: string }>;
	competitions: Array<{ name: string; type: string }>;
}

export function getActiveFilters(
	playerFilters: PlayerFilters,
	filterData?: FilterData
): ActiveFilter[] {
	const activeFilters: ActiveFilter[] = [];

	// Early return if playerFilters is null/undefined
	if (!playerFilters) {
		return activeFilters;
	}

	// Time Range filter
	const { timeRange } = playerFilters;
	if (!timeRange) {
		return activeFilters;
	}
	if (timeRange.type !== "allTime" || timeRange.seasons?.length > 0 || timeRange.beforeDate !== "" || timeRange.afterDate !== "" || timeRange.startDate !== "" || timeRange.endDate !== "") {
		let timeRangeValue = "";
		
		if (timeRange.type === "season" && timeRange.seasons?.length > 0) {
			timeRangeValue = timeRange.seasons.join(", ");
		} else if (timeRange.type === "beforeDate" && timeRange.beforeDate) {
			timeRangeValue = `Before ${formatDate(timeRange.beforeDate)}`;
		} else if (timeRange.type === "afterDate" && timeRange.afterDate) {
			timeRangeValue = `After ${formatDate(timeRange.afterDate)}`;
		} else if (timeRange.type === "betweenDates" && timeRange.startDate && timeRange.endDate) {
			timeRangeValue = `${formatDate(timeRange.startDate)} - ${formatDate(timeRange.endDate)}`;
		} else if (timeRange.type !== "allTime") {
			timeRangeValue = timeRange.type;
		}

		if (timeRangeValue) {
			activeFilters.push({
				key: "timeRange",
				label: "Time Range",
				value: timeRangeValue,
				removeKey: "timeRange",
			});
		}
	}

	// Teams filter
	if (playerFilters.teams?.length > 0) {
		activeFilters.push({
			key: "teams",
			label: "Team",
			value: playerFilters.teams.join(", "),
			removeKey: "teams",
		});
	}

	// Location filter
	if (playerFilters.location?.length > 0 && playerFilters.location.length < 2) {
		activeFilters.push({
			key: "location",
			label: "Location",
			value: playerFilters.location.join(", "),
			removeKey: "location",
		});
	}

	// Opposition filter
	const oppositionMode = playerFilters.opposition?.mode ?? "all";
	if (playerFilters.opposition && (oppositionMode !== "all" || playerFilters.opposition.searchTerm !== "")) {
		let oppositionValue = "";
		if (playerFilters.opposition.searchTerm) {
			const modeLabel = oppositionMode === "club" ? "Club: " : oppositionMode === "team" ? "Team: " : "";
			oppositionValue = modeLabel + playerFilters.opposition.searchTerm;
		} else if (oppositionMode !== "all") {
			oppositionValue = oppositionMode === "club" ? "Individual Club" : "Individual Team";
		}
		
		if (oppositionValue) {
			activeFilters.push({
				key: "opposition",
				label: "Opposition",
				value: oppositionValue,
				removeKey: "opposition",
			});
		}
	}

	// Competition filter
	if (playerFilters.competition) {
		const competitionParts: string[] = [];
		if (playerFilters.competition.types?.length > 0 && playerFilters.competition.types.length < 3) {
			competitionParts.push(playerFilters.competition.types.join(", "));
		}
		if (playerFilters.competition.searchTerm !== "") {
			competitionParts.push(playerFilters.competition.searchTerm);
		}
		
		if (competitionParts.length > 0) {
			activeFilters.push({
				key: "competition",
				label: "Competition",
				value: competitionParts.join(" - "),
				removeKey: "competition",
			});
		}
	}

	// Result filter
	if (playerFilters.result?.length > 0 && playerFilters.result.length < 3) {
		activeFilters.push({
			key: "result",
			label: "Result",
			value: playerFilters.result.join(", "),
			removeKey: "result",
		});
	}

	// Position filter
	if (playerFilters.position?.length > 0) {
		activeFilters.push({
			key: "position",
			label: "Position",
			value: playerFilters.position.join(", "),
			removeKey: "position",
		});
	}

	return activeFilters;
}

function formatDate(dateString: string): string {
	if (!dateString) return "";
	try {
		const date = new Date(dateString);
		return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
	} catch {
		return dateString;
	}
}

