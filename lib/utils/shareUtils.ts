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

	// Temporarily make element visible but keep it off-screen (html2canvas can capture off-screen elements)
	// Don't change position or z-index - keep it hidden from user but visible to html2canvas
	element.style.visibility = "visible";
	element.style.opacity = "1";
	// Keep original position and z-index to stay below blackout

	// Wait for any images to load - including stat icons
	const images = element.querySelectorAll("img");
	const imagePromises = Array.from(images).map((img) => {
		if (img.complete && img.naturalWidth > 0) return Promise.resolve();
		
		// Force reload if image failed or hasn't loaded
		if (!img.complete || img.naturalWidth === 0) {
			const src = img.src;
			img.src = '';
			img.src = src;
		}
		
		return new Promise<void>((resolve) => {
			const timeout = setTimeout(() => {
				resolve(); // Resolve after timeout even if image hasn't loaded
			}, 3000);
			
			img.onload = () => {
				clearTimeout(timeout);
				resolve();
			};
			img.onerror = () => {
				clearTimeout(timeout);
				resolve(); // Resolve even on error to not block
			};
		});
	});

	await Promise.all(imagePromises);
	
	// Additional delay to ensure all rendering is complete, especially for SVG icons
	await new Promise(resolve => setTimeout(resolve, 300));

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
			onclone: (clonedDoc) => {
				// Ensure filters are applied in cloned DOM and convert SVG icons to canvas
				const clonedElement = clonedDoc.querySelector('.shareable-stats-card');
				if (clonedElement) {
					// Handle logo
					const logoImg = clonedElement.querySelector('img[alt="Dorkinians FC Logo"]') as HTMLImageElement;
					if (logoImg) {
						logoImg.style.filter = "grayscale(100%) brightness(0) invert(1)";
					}
					
					// Convert all stat icon SVG images to canvas elements
					const statIcons = clonedElement.querySelectorAll('img[src*="/stat-icons/"]') as NodeListOf<HTMLImageElement>;
					statIcons.forEach((img) => {
						if (img.src && img.src.includes('.svg') && img.complete && img.naturalWidth > 0) {
							try {
								const canvas = clonedDoc.createElement('canvas');
								const width = img.naturalWidth || 42;
								const height = img.naturalHeight || 42;
								canvas.width = width;
								canvas.height = height;
								const ctx = canvas.getContext('2d');
								
								if (ctx) {
									// Draw the image to canvas
									ctx.drawImage(img, 0, 0, width, height);
									
									// Apply the filter effect (brightness(0) invert(1))
									const imageData = ctx.getImageData(0, 0, width, height);
									const data = imageData.data;
									for (let i = 0; i < data.length; i += 4) {
										// Invert colors
										data[i] = 255 - data[i];     // R
										data[i + 1] = 255 - data[i + 1]; // G
										data[i + 2] = 255 - data[i + 2]; // B
									}
									ctx.putImageData(imageData, 0, 0);
									
									// Replace img with canvas
									canvas.style.width = img.style.width || '42px';
									canvas.style.height = img.style.height || '42px';
									canvas.style.objectFit = 'contain';
									img.parentNode?.replaceChild(canvas, img);
								}
							} catch (e) {
								// If conversion fails, ensure the image is visible
								img.style.display = 'block';
								img.style.visibility = 'visible';
								img.style.opacity = '1';
							}
						}
					});
				}
			},
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
		// Convert data URL to blob
		const response = await fetch(imageDataUrl);
		const blob = await response.blob();
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
		// Convert data URL to blob
		const response = await fetch(imageDataUrl);
		const blob = await response.blob();
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
		// Convert data URL to blob
		const response = await fetch(imageDataUrl);
		const blob = await response.blob();
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

