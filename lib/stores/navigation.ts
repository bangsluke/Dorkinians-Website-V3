import { create } from "zustand";

export type MainPage = "home" | "stats" | "totw" | "club-info" | "settings";
export type StatsSubPage = "player-stats" | "team-stats" | "club-stats" | "comparison";
export type TOTWSubPage = "totw" | "players-of-month";
export type ClubInfoSubPage = "club-information" | "match-information" | "club-captains" | "club-awards" | "useful-links";

interface NavigationState {
	// Main page navigation
	currentMainPage: MainPage;
	// Stats sub-page navigation (for swipe gestures)
	currentStatsSubPage: StatsSubPage;
	// TOTW sub-page navigation
	currentTOTWSubPage: TOTWSubPage;
	// Club Info sub-page navigation
	currentClubInfoSubPage: ClubInfoSubPage;
	// Player selection state
	selectedPlayer: string | null;
	isPlayerSelected: boolean;
	isEditMode: boolean;
	// Navigation actions
	setMainPage: (page: MainPage) => void;
	setStatsSubPage: (page: StatsSubPage) => void;
	setTOTWSubPage: (page: TOTWSubPage) => void;
	setClubInfoSubPage: (page: ClubInfoSubPage) => void;
	// Player selection actions
	selectPlayer: (playerName: string) => void;
	clearPlayerSelection: () => void;
	enterEditMode: () => void;
	// Swipe navigation helpers
	nextStatsSubPage: () => void;
	previousStatsSubPage: () => void;
	nextTOTWSubPage: () => void;
	previousTOTWSubPage: () => void;
	nextClubInfoSubPage: () => void;
	previousClubInfoSubPage: () => void;
	// Initialization
	initializeFromStorage: () => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
	// Initial state
	currentMainPage: "home",
	currentStatsSubPage: "player-stats",
	currentTOTWSubPage: "totw",
	currentClubInfoSubPage: "club-information",
	selectedPlayer: null,
	isPlayerSelected: false,
	isEditMode: false,

	// Initialize from localStorage after mount
	initializeFromStorage: () => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('dorkinians-selected-player');
			if (saved) {
				set({ selectedPlayer: saved, isPlayerSelected: true });
			}
		}
	},

	// Main page navigation
	setMainPage: (page: MainPage) => {
		set({ currentMainPage: page });
		// Reset stats sub-page when leaving stats
		if (page !== "stats") {
			set({ currentStatsSubPage: "player-stats" });
		}
		// Reset TOTW sub-page when leaving TOTW
		if (page !== "totw") {
			set({ currentTOTWSubPage: "totw" });
		}
		// Reset Club Info sub-page when leaving Club Info
		if (page !== "club-info") {
			set({ currentClubInfoSubPage: "club-information" });
		}
		// Reset player selection when leaving home
		if (page !== "home") {
			set({ selectedPlayer: null, isPlayerSelected: false });
		}
	},

	setStatsSubPage: (page: StatsSubPage) => {
		set({ currentStatsSubPage: page });
	},

	setTOTWSubPage: (page: TOTWSubPage) => {
		set({ currentTOTWSubPage: page });
	},

	setClubInfoSubPage: (page: ClubInfoSubPage) => {
		set({ currentClubInfoSubPage: page });
	},

	// Player selection actions
	selectPlayer: (playerName: string) => {
		// Save to localStorage
		if (typeof window !== 'undefined') {
			localStorage.setItem('dorkinians-selected-player', playerName);
		}
		set({ selectedPlayer: playerName, isPlayerSelected: true, isEditMode: false });
	},

	clearPlayerSelection: () => {
		// Remove from localStorage
		if (typeof window !== 'undefined') {
			localStorage.removeItem('dorkinians-selected-player');
		}
		set({ selectedPlayer: null, isPlayerSelected: false, isEditMode: false });
	},

	enterEditMode: () => {
		set({ isEditMode: true, isPlayerSelected: false });
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
		const prevIndex = currentIndex === 0 ? subPages.length - 1 : currentIndex - 1;
		set({ currentStatsSubPage: subPages[prevIndex] });
	},

	// Swipe navigation within TOTW
	nextTOTWSubPage: () => {
		const { currentTOTWSubPage } = get();
		const subPages: TOTWSubPage[] = ["totw", "players-of-month"];
		const currentIndex = subPages.indexOf(currentTOTWSubPage);
		const nextIndex = (currentIndex + 1) % subPages.length;
		set({ currentTOTWSubPage: subPages[nextIndex] });
	},

	previousTOTWSubPage: () => {
		const { currentTOTWSubPage } = get();
		const subPages: TOTWSubPage[] = ["totw", "players-of-month"];
		const currentIndex = subPages.indexOf(currentTOTWSubPage);
		const prevIndex = currentIndex === 0 ? subPages.length - 1 : currentIndex - 1;
		set({ currentTOTWSubPage: subPages[prevIndex] });
	},

	// Swipe navigation within Club Info
	nextClubInfoSubPage: () => {
		const { currentClubInfoSubPage } = get();
		const subPages: ClubInfoSubPage[] = ["club-information", "match-information", "club-captains", "club-awards", "useful-links"];
		const currentIndex = subPages.indexOf(currentClubInfoSubPage);
		const nextIndex = (currentIndex + 1) % subPages.length;
		set({ currentClubInfoSubPage: subPages[nextIndex] });
	},

	previousClubInfoSubPage: () => {
		const { currentClubInfoSubPage } = get();
		const subPages: ClubInfoSubPage[] = ["club-information", "match-information", "club-captains", "club-awards", "useful-links"];
		const currentIndex = subPages.indexOf(currentClubInfoSubPage);
		const prevIndex = currentIndex === 0 ? subPages.length - 1 : currentIndex - 1;
		set({ currentClubInfoSubPage: subPages[prevIndex] });
	},
}));
