import { create } from "zustand";

export type MainPage = "home" | "stats" | "totw" | "club-info";
export type StatsSubPage = "player-stats" | "team-stats" | "club-stats" | "comparison";

interface NavigationState {
	// Main page navigation
	currentMainPage: MainPage;
	// Stats sub-page navigation (for swipe gestures)
	currentStatsSubPage: StatsSubPage;
	// Navigation actions
	setMainPage: (page: MainPage) => void;
	setStatsSubPage: (page: StatsSubPage) => void;
	// Swipe navigation helpers
	nextStatsSubPage: () => void;
	previousStatsSubPage: () => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
	// Initial state
	currentMainPage: "home",
	currentStatsSubPage: "player-stats",

	// Main page navigation
	setMainPage: (page: MainPage) => {
		set({ currentMainPage: page });
		// Reset stats sub-page when leaving stats
		if (page !== "stats") {
			set({ currentStatsSubPage: "player-stats" });
		}
	},

	// Stats sub-page navigation
	setStatsSubPage: (page: StatsSubPage) => {
		set({ currentStatsSubPage: page });
	},

	// Swipe navigation within stats
	nextStatsSubPage: () => {
		const { currentStatsSubPage } = get();
		const subPages: StatsSubPage[] = ["player-stats", "team-stats", "club-stats", "comparison"];
		const currentIndex = subPages.indexOf(currentStatsSubPage);
		const nextIndex = (currentIndex + 1) % subPages.length;
		set({ currentStatsSubPage: subPages[nextIndex] });
	},

	previousStatsSubPage: () => {
		const { currentStatsSubPage } = get();
		const subPages: StatsSubPage[] = ["player-stats", "team-stats", "club-stats", "comparison"];
		const currentIndex = subPages.indexOf(currentStatsSubPage);
		const previousIndex = currentIndex === 0 ? subPages.length - 1 : currentIndex - 1;
		set({ currentStatsSubPage: subPages[previousIndex] });
	},
}));
