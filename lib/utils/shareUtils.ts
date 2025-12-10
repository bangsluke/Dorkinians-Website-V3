import { PlayerFilters, PlayerData } from "@/lib/stores/navigation";
import { VisualizationOption } from "@/components/stats/ShareVisualizationModal";

interface FilterData {
	seasons: Array<{ season: string; startDate: string; endDate: string }>;
	teams: Array<{ name: string }>;
	opposition: Array<{ name: string }>;
	competitions: Array<{ name: string; type: string }>;
}

function toNumber(val: any): number {
	if (val === null || val === undefined) return 0;
	if (typeof val === "number") {
		if (isNaN(val)) return 0;
		return val;
	}
	if (typeof val === "object") {
		if ("toNumber" in val && typeof val.toNumber === "function") {
			return val.toNumber();
		}
		if ("low" in val && "high" in val) {
			const low = val.low || 0;
			const high = val.high || 0;
			return low + high * 4294967296;
		}
	}
	const num = Number(val);
	return isNaN(num) ? 0 : num;
}

export function getAvailableVisualizations(
	playerData: PlayerData | null,
	playerFilters: PlayerFilters,
	allSeasonsSelected: boolean,
	allTeamsSelected: boolean,
	seasonalChartData: any[],
	teamChartData: any[],
	isLoadingSeasonalStats: boolean,
	isLoadingTeamStats: boolean,
	oppositionMapData: any[],
	fantasyBreakdown: any,
	isLoadingFantasyBreakdown: boolean,
	gameDetails: any,
	isLoadingGameDetails: boolean
): VisualizationOption[] {
	if (!playerData) return [];

	const options: VisualizationOption[] = [];

	// Seasonal Performance
	if (allSeasonsSelected && !isLoadingSeasonalStats && seasonalChartData.length > 0) {
		options.push({
			id: "seasonal-performance",
			label: "Seasonal Performance",
			description: "Bar chart showing performance across seasons",
			available: true,
		});
	}

	// Team Performance
	if (allTeamsSelected && !isLoadingTeamStats && teamChartData.length > 0) {
		options.push({
			id: "team-performance",
			label: "Team Performance",
			description: "Bar chart showing performance by team",
			available: true,
		});
	}

	// Positional Stats
	if (toNumber(playerData.gk) > 0 || toNumber(playerData.def) > 0 || toNumber(playerData.mid) > 0 || toNumber(playerData.fwd) > 0) {
		options.push({
			id: "positional-stats",
			label: "Positional Stats",
			description: "Visualization of appearances by position",
			available: true,
		});
	}

	// Match Results
	if (playerFilters.result.length !== 1) {
		const wins = toNumber(playerData.wins || 0);
		const draws = toNumber(playerData.draws || 0);
		const losses = toNumber(playerData.losses || 0);
		const gamesPlayed = wins + draws + losses;
		if (gamesPlayed > 0) {
			options.push({
				id: "match-results",
				label: "Match Results",
				description: "Pie chart of wins, draws, and losses",
				available: true,
			});
		}
	}

	// Defensive Record
	const conceded = toNumber(playerData.conceded);
	const cleanSheets = toNumber(playerData.cleanSheets);
	if (conceded > 0 || cleanSheets > 0 || toNumber(playerData.ownGoals) > 0) {
		options.push({
			id: "defensive-record",
			label: "Defensive Record",
			description: "Defensive statistics and clean sheets",
			available: true,
		});
	}

	// Distance Travelled
	if (toNumber(playerData.distance) > 0 && toNumber(playerData.awayGames) > 0) {
		options.push({
			id: "distance-travelled",
			label: "Distance Travelled",
			description: "Total distance traveled for away games",
			available: true,
		});
	}

	// Opposition Map
	if (oppositionMapData.length > 0) {
		options.push({
			id: "opposition-map",
			label: "Opposition Map",
			description: "Map showing opposition teams played",
			available: true,
		});
	}

	// Fantasy Points
	if (toNumber(playerData.fantasyPoints) > 0 && !isLoadingFantasyBreakdown && fantasyBreakdown) {
		options.push({
			id: "fantasy-points",
			label: "Fantasy Points",
			description: "Fantasy points breakdown and highlights",
			available: true,
		});
	}

	// Card Stats
	if (toNumber(playerData.yellowCards) > 0 || toNumber(playerData.redCards) > 0) {
		options.push({
			id: "card-stats",
			label: "Card Stats",
			description: "Yellow and red cards visualization",
			available: true,
		});
	}

	// Penalty Stats
	const hasPenalties = toNumber(playerData.penaltiesScored) > 0 || 
		toNumber(playerData.penaltiesMissed) > 0 || 
		toNumber(playerData.penaltiesSaved) > 0 || 
		toNumber(playerData.penaltiesConceded) > 0 ||
		toNumber(playerData.penaltyShootoutPenaltiesScored) > 0 ||
		toNumber(playerData.penaltyShootoutPenaltiesMissed) > 0 ||
		toNumber(playerData.penaltyShootoutPenaltiesSaved) > 0;
	if (hasPenalties) {
		options.push({
			id: "penalty-stats",
			label: "Penalty Stats",
			description: "Penalty statistics visualization",
			available: true,
		});
	}

	// Minutes per Stats
	if (toNumber(playerData.minutes) > 0) {
		options.push({
			id: "minutes-per-stats",
			label: "Minutes per Stats",
			description: "Minutes per goal, assist, MoM, etc.",
			available: true,
		});
	}

	// Game Details
	if (!isLoadingGameDetails && gameDetails) {
		options.push({
			id: "game-details",
			label: "Game Details",
			description: "Competition types, home/away, and unique counts",
			available: true,
		});
	}

	return options;
}

export function formatFilterSummary(
	playerFilters: PlayerFilters,
	filterData?: FilterData
): string {
	const parts: string[] = [];

	// Time Range
	const { timeRange } = playerFilters;
	if (timeRange.type === "season" && timeRange.seasons.length > 0) {
		parts.push(timeRange.seasons.join(", "));
	} else if (timeRange.type === "beforeDate" && timeRange.beforeDate) {
		parts.push(`Before ${formatDate(timeRange.beforeDate)}`);
	} else if (timeRange.type === "afterDate" && timeRange.afterDate) {
		parts.push(`After ${formatDate(timeRange.afterDate)}`);
	} else if (timeRange.type === "betweenDates" && timeRange.startDate && timeRange.endDate) {
		parts.push(`${formatDate(timeRange.startDate)} - ${formatDate(timeRange.endDate)}`);
	} else if (timeRange.type === "allTime") {
		parts.push("All Time");
	}

	// Teams
	if (playerFilters.teams.length > 0) {
		parts.push(`Team: ${playerFilters.teams.join(", ")}`);
	}

	// Location
	if (playerFilters.location.length === 1) {
		parts.push(`Location: ${playerFilters.location[0]}`);
	}

	// Competition
	const competitionParts: string[] = [];
	if (playerFilters.competition.types.length > 0 && playerFilters.competition.types.length < 3) {
		competitionParts.push(playerFilters.competition.types.join(", "));
	}
	if (playerFilters.competition.searchTerm !== "") {
		competitionParts.push(playerFilters.competition.searchTerm);
	}
	if (competitionParts.length > 0) {
		parts.push(`Competition: ${competitionParts.join(" - ")}`);
	}

	// Result
	if (playerFilters.result.length > 0 && playerFilters.result.length < 3) {
		parts.push(`Result: ${playerFilters.result.join(", ")}`);
	}

	// Position
	if (playerFilters.position.length > 0) {
		parts.push(`Position: ${playerFilters.position.join(", ")}`);
	}

	return parts.length > 0 ? parts.join(" • ") : "All Time";
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

export async function generateShareImage(
	element: HTMLElement,
	scale: number = 2
): Promise<string> {
	const html2canvas = (await import("html2canvas")).default;
	
	// Ensure element is visible for html2canvas
	const originalStyle = {
		position: element.style.position,
		left: element.style.left,
		top: element.style.top,
		visibility: element.style.visibility,
		opacity: element.style.opacity,
		zIndex: element.style.zIndex,
	};

	// Temporarily make element visible but off-screen
	element.style.position = "fixed";
	element.style.left = "0";
	element.style.top = "0";
	element.style.visibility = "visible";
	element.style.opacity = "1";
	element.style.zIndex = "9999";

	// Wait for any images to load
	const images = element.querySelectorAll("img");
	const imagePromises = Array.from(images).map((img) => {
		if (img.complete) return Promise.resolve();
		return new Promise((resolve, reject) => {
			img.onload = resolve;
			img.onerror = resolve; // Resolve even on error to not block
			setTimeout(resolve, 2000); // Timeout after 2 seconds
		});
	});

	await Promise.all(imagePromises);
	
	// Small delay to ensure rendering
	await new Promise(resolve => setTimeout(resolve, 100));

	try {
		const canvas = await html2canvas(element, {
			scale: scale,
			backgroundColor: "#0f0f0f",
			useCORS: true,
			allowTaint: false,
			logging: false,
			width: element.offsetWidth,
			height: element.offsetHeight,
			windowWidth: element.offsetWidth,
			windowHeight: element.offsetHeight,
		});

		return canvas.toDataURL("image/png", 1.0);
	} finally {
		// Restore original styles
		element.style.position = originalStyle.position;
		element.style.left = originalStyle.left;
		element.style.top = originalStyle.top;
		element.style.visibility = originalStyle.visibility;
		element.style.opacity = originalStyle.opacity;
		element.style.zIndex = originalStyle.zIndex;
	}
}

export async function shareImage(
	imageDataUrl: string,
	playerName: string
): Promise<boolean> {
	try {
		// Convert data URL to blob
		const response = await fetch(imageDataUrl);
		const blob = await response.blob();
		const file = new File([blob], `${playerName}-stats.png`, { type: "image/png" });

		// Try Web Share API first (mobile-friendly)
		if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
			await navigator.share({
				files: [file],
				title: `${playerName} - Player Stats`,
				text: `Check out ${playerName}'s stats!`,
			});
			return true;
		}

		// Fallback: Download the image
		const link = document.createElement("a");
		link.href = imageDataUrl;
		link.download = `${playerName.replace(/\s+/g, "-")}-stats.png`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		return true;
	} catch (error) {
		console.error("Error sharing image:", error);
		return false;
	}
}

