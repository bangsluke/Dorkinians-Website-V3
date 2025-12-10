import { PlayerFilters } from "@/lib/stores/navigation";

interface FilterData {
	seasons: Array<{ season: string; startDate: string; endDate: string }>;
	teams: Array<{ name: string }>;
	opposition: Array<{ name: string }>;
	competitions: Array<{ name: string; type: string }>;
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

