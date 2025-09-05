import { create } from "zustand";

export type MainPage = "home" | "stats" | "totw" | "club-info" | "settings";
export type StatsSubPage = "player-stats" | "team-stats" | "club-stats" | "comparison";
export type TOTWSubPage = "totw" | "players-of-month";
export type ClubInfoSubPage = "club-information" | "match-information" | "club-captains" | "club-awards" | "useful-links";

// Player data interface matching TBL_Players schema
export interface PlayerData {
	id: string;
	playerName: string;
	allowOnSite: boolean;
	appearances: number;
	minutes: number;
	mom: number;
	goals: number;
	assists: number;
	yellowCards: number;
	redCards: number;
	saves: number;
	ownGoals: number;
	conceded: number;
	cleanSheets: number;
	penaltiesScored: number;
	penaltiesMissed: number;
	penaltiesConceded: number;
	penaltiesSaved: number;
	fantasyPoints: number;
	allGoalsScored: number;
	goalsPerApp: number;
	concededPerApp: number;
	minutesPerGoal: number;
	minutesPerCleanSheet: number;
	fantasyPointsPerApp: number;
	distance: number;
	homeGames: number;
	homeWins: number;
	homeGamesPercentWon: number;
	awayGames: number;
	awayWins: number;
	awayGamesPercentWon: number;
	gamesPercentWon: number;
	apps1s: number;
	apps2s: number;
	apps3s: number;
	apps4s: number;
	apps5s: number;
	apps6s: number;
	apps7s: number;
	apps8s: number;
	mostPlayedForTeam: string;
	numberTeamsPlayedFor: number;
	goals1s: number;
	goals2s: number;
	goals3s: number;
	goals4s: number;
	goals5s: number;
	goals6s: number;
	goals7s: number;
	goals8s: number;
	mostScoredForTeam: string;
	numberSeasonsPlayedFor: number;
	graphLabel: string;
}

// Cached player data with date validation
export interface CachedPlayerData {
	playerData: PlayerData;
	selectedDate: string; // YYYY-MM-DD format
}

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
	// Player data caching
	cachedPlayerData: CachedPlayerData | null;
	isLoadingPlayerData: boolean;
	// Navigation actions
	setMainPage: (page: MainPage) => void;
	setStatsSubPage: (page: StatsSubPage) => void;
	setTOTWSubPage: (page: TOTWSubPage) => void;
	setClubInfoSubPage: (page: ClubInfoSubPage) => void;
	// Player selection actions
	selectPlayer: (playerName: string) => void;
	clearPlayerSelection: () => void;
	enterEditMode: () => void;
	// Player data actions
	fetchAndCachePlayerData: (playerName: string) => Promise<void>;
	validateAndRefreshPlayerData: (playerName: string) => Promise<void>;
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
	cachedPlayerData: null,
	isLoadingPlayerData: false,

	// Initialize from localStorage after mount
	initializeFromStorage: () => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('dorkinians-selected-player');
			const cachedData = localStorage.getItem('dorkinians-cached-player-data');
			
			console.log('🔍 [Navigation Store] initializeFromStorage called');
			console.log('📦 [LocalStorage] dorkinians-selected-player:', saved);
			console.log('📦 [LocalStorage] dorkinians-cached-player-data:', cachedData ? 'Present' : 'Not found');
			
			if (cachedData) {
				try {
					const parsedData: CachedPlayerData = JSON.parse(cachedData);
					console.log('📊 [Cached Data] Parsed successfully:', {
						playerName: parsedData.playerData?.playerName,
						selectedDate: parsedData.selectedDate,
						hasPlayerData: !!parsedData.playerData
					});
				} catch (error) {
					console.error('❌ [Cached Data] Failed to parse:', error);
				}
			}
			
			if (saved) {
				console.log('✅ [Player Selection] Restoring player from localStorage:', saved);
				set({ selectedPlayer: saved, isPlayerSelected: true });
				
				// Load cached player data if available
				if (cachedData) {
					try {
						const parsedData: CachedPlayerData = JSON.parse(cachedData);
						set({ cachedPlayerData: parsedData });
						console.log('✅ [Cached Data] Loaded successfully');
					} catch (error) {
						console.error('❌ [Cached Data] Failed to parse cached player data:', error);
						localStorage.removeItem('dorkinians-cached-player-data');
					}
				}
			} else {
				console.log('ℹ️ [Player Selection] No saved player found in localStorage');
			}
		}
	},

	// Main page navigation
	setMainPage: (page: MainPage) => {
		console.log('🏠 [Navigation] setMainPage called with page:', page);
		console.log('📊 [Navigation] Current state before change:', {
			selectedPlayer: get().selectedPlayer,
			isPlayerSelected: get().isPlayerSelected,
			currentMainPage: get().currentMainPage
		});
		
		const currentPage = get().currentMainPage;
		
		set({ currentMainPage: page });
		
		// Reset sub-pages only when actually leaving those pages
		if (currentPage === "stats" && page !== "stats") {
			set({ currentStatsSubPage: "player-stats" });
		}
		if (currentPage === "totw" && page !== "totw") {
			set({ currentTOTWSubPage: "totw" });
		}
		if (currentPage === "club-info" && page !== "club-info") {
			set({ currentClubInfoSubPage: "club-information" });
		}
		
		// Only clear player selection when leaving home page to non-stats pages
		if (currentPage === "home" && page !== "home" && page !== "stats") {
			console.log('🔄 [Navigation] Leaving home page for non-stats page, clearing player selection');
			set({ selectedPlayer: null, isPlayerSelected: false });
		} else if (page === "home") {
			console.log('🏠 [Navigation] Returning to home page, preserving player selection');
		} else if (page === "stats") {
			console.log('📊 [Navigation] Navigating to stats page, preserving player selection');
		}
		
		console.log('📊 [Navigation] State after change:', {
			selectedPlayer: get().selectedPlayer,
			isPlayerSelected: get().isPlayerSelected,
			currentMainPage: get().currentMainPage
		});
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
		
		// Fetch and cache player data asynchronously
		get().fetchAndCachePlayerData(playerName);
	},

	clearPlayerSelection: () => {
		// Remove from localStorage
		if (typeof window !== 'undefined') {
			localStorage.removeItem('dorkinians-selected-player');
			localStorage.removeItem('dorkinians-cached-player-data');
		}
		set({ 
			selectedPlayer: null, 
			isPlayerSelected: false, 
			isEditMode: false,
			cachedPlayerData: null
		});
	},

	enterEditMode: () => {
		// Clear player from localStorage
		if (typeof window !== 'undefined') {
			localStorage.removeItem('dorkinians-selected-player');
			localStorage.removeItem('dorkinians-cached-player-data');
		}
		// Clear all player-related state
		set({ 
			isEditMode: true, 
			isPlayerSelected: false,
			selectedPlayer: null,
			cachedPlayerData: null,
			isLoadingPlayerData: false
		});
	},

	// Player data actions
	fetchAndCachePlayerData: async (playerName: string) => {
		set({ isLoadingPlayerData: true });
		
		try {
			const response = await fetch(`/api/player-data?playerName=${encodeURIComponent(playerName)}`);
			if (response.ok) {
				const { playerData } = await response.json();
				const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
				
				const cachedData: CachedPlayerData = {
					playerData,
					selectedDate: currentDate
				};
				
				// Save to localStorage
				if (typeof window !== 'undefined') {
					localStorage.setItem('dorkinians-cached-player-data', JSON.stringify(cachedData));
				}
				
				set({ cachedPlayerData: cachedData });
			} else {
				console.error('Failed to fetch player data:', response.statusText);
			}
		} catch (error) {
			console.error('Error fetching player data:', error);
		} finally {
			set({ isLoadingPlayerData: false });
		}
	},

	validateAndRefreshPlayerData: async (playerName: string) => {
		const { cachedPlayerData } = get();
		
		if (!cachedPlayerData) {
			// No cached data, fetch fresh
			await get().fetchAndCachePlayerData(playerName);
			return;
		}
		
		const currentDate = new Date().toISOString().split('T')[0];
		const cachedDate = cachedPlayerData.selectedDate;
		
		if (currentDate !== cachedDate) {
			// Date has changed, refresh data
			console.log(`Player data is stale (${cachedDate} vs ${currentDate}), refreshing...`);
			await get().fetchAndCachePlayerData(playerName);
		}
	},

	// Swipe navigation within stats
	nextStatsSubPage: () => {
		const { currentStatsSubPage } = get();
		// Always show all 4 pages: Player Stats, Team Stats, Club Stats, Comparison
		const availablePages: StatsSubPage[] = [
			"player-stats" as StatsSubPage,
			"team-stats" as StatsSubPage,
			"club-stats" as StatsSubPage,
			"comparison" as StatsSubPage
		];
		const currentIndex = availablePages.indexOf(currentStatsSubPage);
		const nextIndex = (currentIndex + 1) % availablePages.length;
		set({ currentStatsSubPage: availablePages[nextIndex] });
	},

	previousStatsSubPage: () => {
		const { currentStatsSubPage } = get();
		// Always show all 4 pages: Player Stats, Team Stats, Club Stats, Comparison
		const availablePages: StatsSubPage[] = [
			"player-stats" as StatsSubPage,
			"team-stats" as StatsSubPage,
			"club-stats" as StatsSubPage,
			"comparison" as StatsSubPage
		];
		const currentIndex = availablePages.indexOf(currentStatsSubPage);
		const prevIndex = currentIndex === 0 ? availablePages.length - 1 : currentIndex - 1;
		set({ currentStatsSubPage: availablePages[prevIndex] });
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
