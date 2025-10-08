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
	// Derived stats from statObject
	openPlayGoalsScored: number;
	goalInvolvements: number;
	minutesPerApp: number;
	momPerApp: number;
	yellowCardsPerApp: number;
	redCardsPerApp: number;
	savesPerApp: number;
	ownGoalsPerApp: number;
	cleanSheetsPerApp: number;
	penaltiesScoredPerApp: number;
	penaltiesMissedPerApp: number;
	penaltiesConcededPerApp: number;
	penaltiesSavedPerApp: number;

	// Team and season tracking
	mostPlayedForTeam: string;
	numberTeamsPlayedFor: number;
	mostScoredForTeam: string;
	numberSeasonsPlayedFor: number;
	graphLabel: string;
}

// Cached player data with date validation
export interface CachedPlayerData {
	playerData: PlayerData;
	selectedDate: string; // YYYY-MM-DD format
}

// Filter interfaces
export interface PlayerFilters {
	timeRange: {
		type: "season" | "beforeDate" | "afterDate" | "betweenDates";
		seasons: string[];
		beforeDate: string;
		afterDate: string;
		startDate: string;
		endDate: string;
	};
	teams: string[];
	location: ("Home" | "Away")[];
	opposition: {
		allOpposition: boolean;
		searchTerm: string;
	};
	competition: {
		types: ("League" | "Cup" | "Friendly")[];
		searchTerm: string;
	};
	result: ("Win" | "Draw" | "Loss")[];
	position: ("GK" | "DEF" | "MID" | "FWD")[];
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
	// Filter state
	playerFilters: PlayerFilters;
	isFilterSidebarOpen: boolean;
	hasUnsavedFilters: boolean;
	// Filter data cache
	filterData: {
		seasons: Array<{ season: string; startDate: string; endDate: string }>;
		teams: Array<{ name: string }>;
		opposition: Array<{ name: string }>;
		competitions: Array<{ name: string; type: string }>;
	};
	isFilterDataLoaded: boolean;
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
	// Filter actions
	openFilterSidebar: () => void;
	closeFilterSidebar: () => void;
	updatePlayerFilters: (filters: Partial<PlayerFilters>) => void;
	applyPlayerFilters: () => Promise<void>;
	resetPlayerFilters: () => void;
	// Swipe navigation helpers
	nextStatsSubPage: () => void;
	previousStatsSubPage: () => void;
	nextTOTWSubPage: () => void;
	previousTOTWSubPage: () => void;
	nextClubInfoSubPage: () => void;
	previousClubInfoSubPage: () => void;
	// Initialization
	initializeFromStorage: () => void;
	// Filter data loading
	loadFilterData: () => Promise<void>;
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
	// Filter initial state
	playerFilters: {
		timeRange: {
			type: "season",
			seasons: [],
			beforeDate: "",
			afterDate: "",
			startDate: "",
			endDate: "",
		},
		teams: [],
		location: ["Home", "Away"],
		opposition: {
			allOpposition: true,
			searchTerm: "",
		},
		competition: {
			types: ["League", "Cup"],
			searchTerm: "",
		},
		result: ["Win", "Draw", "Loss"],
		position: ["GK", "DEF", "MID", "FWD"],
	},
	isFilterSidebarOpen: false,
	hasUnsavedFilters: false,
	// Filter data cache
	filterData: {
		seasons: [],
		teams: [],
		opposition: [],
		competitions: [],
	},
	isFilterDataLoaded: false,

	// Initialize from localStorage after mount
	initializeFromStorage: () => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("dorkinians-selected-player");
			const cachedData = localStorage.getItem("dorkinians-cached-player-data");

			if (cachedData) {
				try {
					const parsedData: CachedPlayerData = JSON.parse(cachedData);
				} catch (error) {
					console.error("❌ [Cached Data] Failed to parse:", error);
				}
			}

			if (saved) {
				set({ selectedPlayer: saved, isPlayerSelected: true });

				// Load cached player data if available
				if (cachedData) {
					try {
						const parsedData: CachedPlayerData = JSON.parse(cachedData);
						set({ cachedPlayerData: parsedData });
					} catch (error) {
						console.error("❌ [Cached Data] Failed to parse cached player data:", error);
						localStorage.removeItem("dorkinians-cached-player-data");
					}
				}
			} else {
				console.log("ℹ️ [Player Selection] No saved player found in localStorage");
			}
		}
	},

	// Main page navigation
	setMainPage: (page: MainPage) => {
		console.log("🏠 [Navigation] setMainPage called with page:", page);
		console.log("📊 [Navigation] Current state before change:", {
			selectedPlayer: get().selectedPlayer,
			isPlayerSelected: get().isPlayerSelected,
			currentMainPage: get().currentMainPage,
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
			console.log("🔄 [Navigation] Leaving home page for non-stats page, clearing player selection");
			set({ selectedPlayer: null, isPlayerSelected: false });
		} else if (page === "home") {
			console.log("🏠 [Navigation] Returning to home page, preserving player selection");
		} else if (page === "stats") {
			console.log("📊 [Navigation] Navigating to stats page, preserving player selection");
		}

		console.log("📊 [Navigation] State after change:", {
			selectedPlayer: get().selectedPlayer,
			isPlayerSelected: get().isPlayerSelected,
			currentMainPage: get().currentMainPage,
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
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-selected-player", playerName);
		}
		set({ selectedPlayer: playerName, isPlayerSelected: true, isEditMode: false });

		// Fetch and cache player data asynchronously
		get().fetchAndCachePlayerData(playerName);
	},

	clearPlayerSelection: () => {
		// Remove from localStorage
		if (typeof window !== "undefined") {
			localStorage.removeItem("dorkinians-selected-player");
			localStorage.removeItem("dorkinians-cached-player-data");
		}
		set({
			selectedPlayer: null,
			isPlayerSelected: false,
			isEditMode: false,
			cachedPlayerData: null,
		});
	},

	enterEditMode: () => {
		// Clear player from localStorage
		if (typeof window !== "undefined") {
			localStorage.removeItem("dorkinians-selected-player");
			localStorage.removeItem("dorkinians-cached-player-data");
		}
		// Clear all player-related state
		set({
			isEditMode: true,
			isPlayerSelected: false,
			selectedPlayer: null,
			cachedPlayerData: null,
			isLoadingPlayerData: false,
		});
	},

	// Player data actions
	fetchAndCachePlayerData: async (playerName: string) => {
		set({ isLoadingPlayerData: true });

		try {
			const response = await fetch(`/api/player-data?playerName=${encodeURIComponent(playerName)}`);
			if (response.ok) {
				const { playerData } = await response.json();
				const currentDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

				const cachedData: CachedPlayerData = {
					playerData,
					selectedDate: currentDate,
				};

				// Save to localStorage
				if (typeof window !== "undefined") {
					localStorage.setItem("dorkinians-cached-player-data", JSON.stringify(cachedData));
				}

				set({ cachedPlayerData: cachedData });
			} else {
				console.error("Failed to fetch player data:", response.statusText);
			}
		} catch (error) {
			console.error("Error fetching player data:", error);
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

		const currentDate = new Date().toISOString().split("T")[0];
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
		// Always show all 4 pages: Player Stats, Team Stats, Club Stats, Player Comparison
		const availablePages: StatsSubPage[] = [
			"player-stats" as StatsSubPage,
			"team-stats" as StatsSubPage,
			"club-stats" as StatsSubPage,
			"comparison" as StatsSubPage,
		];
		const currentIndex = availablePages.indexOf(currentStatsSubPage);
		const nextIndex = (currentIndex + 1) % availablePages.length;
		set({ currentStatsSubPage: availablePages[nextIndex] });
	},

	previousStatsSubPage: () => {
		const { currentStatsSubPage } = get();
		// Always show all 4 pages: Player Stats, Team Stats, Club Stats, Player Comparison
		const availablePages: StatsSubPage[] = [
			"player-stats" as StatsSubPage,
			"team-stats" as StatsSubPage,
			"club-stats" as StatsSubPage,
			"comparison" as StatsSubPage,
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

	// Filter actions
	openFilterSidebar: () => {
		set({ isFilterSidebarOpen: true });
	},

	closeFilterSidebar: () => {
		const { hasUnsavedFilters } = get();
		if (hasUnsavedFilters) {
			const confirmed = window.confirm("You have unsaved filter changes. Are you sure you want to close without applying them?");
			if (!confirmed) return;
		}
		set({ isFilterSidebarOpen: false, hasUnsavedFilters: false });
	},

	updatePlayerFilters: (filters: Partial<PlayerFilters>) => {
		const currentFilters = get().playerFilters;
		const newFilters = { ...currentFilters, ...filters };
		set({
			playerFilters: newFilters,
			hasUnsavedFilters: true,
		});
	},

	applyPlayerFilters: async () => {
		const { selectedPlayer, playerFilters } = get();
		if (!selectedPlayer) return;

		// Apply filters for player
		set({ isFilterSidebarOpen: false, hasUnsavedFilters: false });

		// Fetch filtered player data
		try {
			set({ isLoadingPlayerData: true });

			const response = await fetch("/api/player-data-filtered", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					playerName: selectedPlayer,
					filters: playerFilters,
				}),
			});

			if (response.ok) {
				const data = await response.json();

				// Log copyable query for debugging
				if (data.debug && data.debug.copyPasteQuery) {
					console.log("🔍 COPY-PASTE QUERY FOR MANUAL TESTING:");
					console.log(data.debug.copyPasteQuery);
				}

				const currentDate = new Date().toISOString().split("T")[0];

				// Cache the filtered data
				const cachedData: CachedPlayerData = {
					playerData: data.playerData,
					selectedDate: currentDate,
				};

				// Save to localStorage
				if (typeof window !== "undefined") {
					localStorage.setItem("dorkinians-cached-player-data", JSON.stringify(cachedData));
				}

				set({
					cachedPlayerData: cachedData,
					isLoadingPlayerData: false,
				});
			} else {
				console.error("❌ Failed to fetch filtered player data");
				const errorText = await response.text();
				console.error("❌ Error response:", errorText);
				set({ isLoadingPlayerData: false });
			}
		} catch (error) {
			console.error("❌ Error fetching filtered player data:", error);
			set({ isLoadingPlayerData: false });
		}
	},

	resetPlayerFilters: () => {
		set({
			playerFilters: {
				timeRange: {
					type: "season",
					seasons: [],
					beforeDate: "",
					afterDate: "",
					startDate: "",
					endDate: "",
				},
				teams: [],
				location: ["Home", "Away"],
				opposition: {
					allOpposition: true,
					searchTerm: "",
				},
				competition: {
					types: ["League", "Cup"],
					searchTerm: "",
				},
				result: ["Win", "Draw", "Loss"],
				position: ["GK", "DEF", "MID", "FWD"],
			},
			hasUnsavedFilters: false,
		});
	},

	// Load filter data asynchronously
	loadFilterData: async () => {
		if (get().isFilterDataLoaded) return; // Already loaded

		try {
			// Load all filter data in parallel
			const [seasonsResponse, teamsResponse, oppositionResponse, competitionsResponse] = await Promise.all([
				fetch("/api/seasons"),
				fetch("/api/teams"),
				fetch("/api/opposition"),
				fetch("/api/competitions"),
			]);

			const [seasons, teams, opposition, competitions] = await Promise.all([
				seasonsResponse.json(),
				teamsResponse.json(),
				oppositionResponse.json(),
				competitionsResponse.json(),
			]);

			set({
				filterData: {
					seasons: seasons.seasons || [],
					teams: teams.teams || [],
					opposition: opposition.opposition || [],
					competitions: competitions.competitions || [],
				},
				isFilterDataLoaded: true,
			});
		} catch (error) {
			console.error("Failed to load filter data:", error);
		}
	},
}));
