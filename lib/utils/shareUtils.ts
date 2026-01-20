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
	isLoadingGameDetails: boolean,
	monthlyChartData: any[],
	isLoadingMonthlyStats: boolean,
	awardsData: any,
	isLoadingAwards: boolean
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

	// Game Details
	if (!isLoadingGameDetails && gameDetails) {
		options.push({
			id: "game-details",
			label: "Game Details",
			description: "Competition types, home/away, and unique counts",
			available: true,
		});
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

	// Monthly Performance
	if (!isLoadingMonthlyStats && monthlyChartData.length > 0) {
		options.push({
			id: "monthly-performance",
			label: "Monthly Performance",
			description: "Bar chart showing performance by month",
			available: true,
		});
	}

	// Awards and Achievements
	if (!isLoadingAwards && awardsData && (awardsData.awards?.length > 0 || awardsData.playerOfMonthCount > 0 || awardsData.starManCount > 0)) {
		options.push({
			id: "awards-and-achievements",
			label: "Awards and Achievements",
			description: "Player awards, Player of the Month, and Star Man counts",
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
	// Validate element exists
	if (!element) {
		throw new Error("Element is null or undefined");
	}

	// Find the actual card element (either the element itself or inside it)
	const cardElement = element.classList.contains('shareable-stats-card') 
		? element 
		: (element.querySelector('.shareable-stats-card') as HTMLElement) || element;

	// If element is a wrapper, ensure it's visible so the card inside can be captured
	let originalWrapperStyle: { visibility: string; opacity: string } | null = null;
	if (element !== cardElement) {
		originalWrapperStyle = {
			visibility: element.style.visibility,
			opacity: element.style.opacity,
		};
		element.style.visibility = 'visible';
		element.style.opacity = '1';
	}

	// Wait for card element to have dimensions (up to 5 seconds)
	let attempts = 0;
	while ((cardElement.offsetWidth === 0 || cardElement.offsetHeight === 0) && attempts < 50) {
		await new Promise(resolve => setTimeout(resolve, 100));
		attempts++;
	}

	if (cardElement.offsetWidth === 0 || cardElement.offsetHeight === 0) {
		throw new Error(`Card element has invalid dimensions: ${cardElement.offsetWidth}x${cardElement.offsetHeight}`);
	}

	// Use the card element for capture
	const targetElement = cardElement;

	const html2canvas = (await import("html2canvas")).default;
	
	// Ensure target element is visible for html2canvas
	const originalStyle = {
		position: targetElement.style.position,
		left: targetElement.style.left,
		top: targetElement.style.top,
		visibility: targetElement.style.visibility,
		opacity: targetElement.style.opacity,
		zIndex: targetElement.style.zIndex,
	};

	// Temporarily make target element visible but keep it off-screen (html2canvas can capture off-screen elements)
	// Don't change position or z-index - keep it hidden from user but visible to html2canvas
	targetElement.style.visibility = "visible";
	targetElement.style.opacity = "1";
	// Keep original position and z-index to stay below blackout

	// Ensure all images have crossOrigin set and wait for them to load
	const images = targetElement.querySelectorAll("img");
	const imagePromises = Array.from(images).map((img) => {
		// Ensure CORS is enabled for all images (critical for avoiding tainted canvas)
		if (!img.crossOrigin) {
			img.crossOrigin = 'anonymous';
		}
		
		if (img.complete && img.naturalWidth > 0) {
			return Promise.resolve();
		}
		
		// Force reload if image failed or hasn't loaded, ensuring CORS is set
		if (!img.complete || img.naturalWidth === 0) {
			const src = img.src;
			img.src = '';
			img.crossOrigin = 'anonymous';
			img.src = src;
		}
		
		return new Promise<void>((resolve) => {
			const timeout = setTimeout(() => {
				resolve(); // Resolve after timeout even if image hasn't loaded
			}, 5000);
			
			img.onload = () => {
				clearTimeout(timeout);
				resolve();
			};
			img.onerror = () => {
				clearTimeout(timeout);
				// Don't hide on error - let html2canvas handle it
				resolve(); // Resolve even on error to not block
			};
		});
	});

	await Promise.all(imagePromises);
	
	// Additional delay to ensure all rendering is complete, especially for SVG icons
	await new Promise(resolve => setTimeout(resolve, 500));

	try {
		const canvas = await html2canvas(targetElement, {
			scale: scale,
			backgroundColor: "#0f0f0f",
			useCORS: true,
			allowTaint: false,
			logging: false,
			width: targetElement.offsetWidth,
			height: targetElement.offsetHeight,
			windowWidth: targetElement.offsetWidth,
			windowHeight: targetElement.offsetHeight,
			onclone: (clonedDoc, element) => {
				// Ensure filters are applied in cloned DOM and handle CORS
				const clonedElement = clonedDoc.querySelector('.shareable-stats-card');
				if (clonedElement) {
					// Ensure all images have crossOrigin set for CORS
					const allImages = clonedElement.querySelectorAll('img') as NodeListOf<HTMLImageElement>;
					allImages.forEach((img) => {
						// Set CORS if not already set (critical for avoiding tainted canvas)
						if (!img.crossOrigin) {
							img.crossOrigin = 'anonymous';
						}
						// Ensure images are visible
						img.style.display = 'block';
						img.style.visibility = 'visible';
						img.style.opacity = '1';
					});
				}
			},
		});

		if (!canvas) {
			throw new Error("html2canvas returned null or undefined");
		}

		return canvas.toDataURL("image/png", 1.0);
	} catch (error) {
		console.error("[Share] Error in generateShareImage:", error);
		throw error;
	} finally {
		// Restore original styles
		targetElement.style.position = originalStyle.position;
		targetElement.style.left = originalStyle.left;
		targetElement.style.top = originalStyle.top;
		targetElement.style.visibility = originalStyle.visibility;
		targetElement.style.opacity = originalStyle.opacity;
		targetElement.style.zIndex = originalStyle.zIndex;
		
		// Restore wrapper styles if element was a wrapper
		if (originalWrapperStyle) {
			element.style.visibility = originalWrapperStyle.visibility;
			element.style.opacity = originalWrapperStyle.opacity;
		}
	}
}

// Convert data URL to blob (without using fetch to avoid CSP violations)
function dataURLtoBlob(dataURL: string): Blob {
	const arr = dataURL.split(',');
	const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
	const bstr = atob(arr[1]);
	let n = bstr.length;
	const u8arr = new Uint8Array(n);
	while (n--) {
		u8arr[n] = bstr.charCodeAt(n);
	}
	return new Blob([u8arr], { type: mime });
}

// Detect iOS devices
function isIOS(): boolean {
	if (typeof window === "undefined") return false;
	return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
		(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export async function shareImage(
	imageDataUrl: string,
	playerName: string
): Promise<{ success: boolean; needsIOSPreview?: boolean; needsPreview?: boolean }> {
	try {
		// Convert data URL to blob (without fetch to avoid CSP violations)
		const blob = dataURLtoBlob(imageDataUrl);
		const file = new File([blob], `${playerName}-stats.png`, { type: "image/png" });

		// For iOS, return flag to show preview first
		if (isIOS() && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
			return { success: true, needsIOSPreview: true };
		}

		// For non-iOS with Web Share API, return flag to show preview first
		if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
			return { success: true, needsPreview: true };
		}

		// Fallback: Download the image (no preview for browsers without Web Share API)
		const link = document.createElement("a");
		link.href = imageDataUrl;
		link.download = `${playerName.replace(/\s+/g, "-")}-stats.png`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		return { success: true };
	} catch (error) {
		console.error("Error sharing image:", error);
		return { success: false };
	}
}

export async function performIOSShare(
	imageDataUrl: string,
	playerName: string
): Promise<boolean> {
	try {
		// Convert data URL to blob (without fetch to avoid CSP violations)
		const blob = dataURLtoBlob(imageDataUrl);
		const file = new File([blob], `${playerName}-stats.png`, { type: "image/png" });

		if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
			await navigator.share({
				files: [file],
				title: `${playerName} - Player Stats`,
				text: `Check out ${playerName}'s stats!`,
			});
			return true;
		}
		return false;
	} catch (error) {
		console.error("Error performing iOS share:", error);
		return false;
	}
}

export async function performNonIOSShare(
	imageDataUrl: string,
	playerName: string
): Promise<boolean> {
	try {
		// Convert data URL to blob (without fetch to avoid CSP violations)
		const blob = dataURLtoBlob(imageDataUrl);
		const file = new File([blob], `${playerName}-stats.png`, { type: "image/png" });

		// Try Web Share API first
		if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
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
		console.error("Error performing non-iOS share:", error);
		return false;
	}
}

