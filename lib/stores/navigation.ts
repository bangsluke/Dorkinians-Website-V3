import { create } from "zustand";
import { WeeklyTOTW } from "@/types";

export type MainPage = "home" | "stats" | "totw" | "club-info" | "settings";
export type StatsSubPage = "player-stats" | "club-stats" | "comparison";
export type TOTWSubPage = "totw" | "players-of-month";
export type ClubInfoSubPage = "club-information" | "league-information" | "club-captains" | "club-awards" | "useful-links";

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
	penaltyShootoutPenaltiesScored: number;
	penaltyShootoutPenaltiesMissed: number;
	penaltyShootoutPenaltiesSaved: number;
	fantasyPoints: number;
	allGoalsScored: number;
	goalsPerApp: number;
	concededPerApp: number;
	minutesPerGoal: number;
	minutesPerCleanSheet: number;
	fantasyPointsPerApp: number;
	distance: number;
	awayGames: number;
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
	pointsPerGame: number;
	wins: number;
	draws: number;
	losses: number;

	// Position tracking
	gk: number;
	def: number;
	mid: number;
	fwd: number;
	gkMinutes: number;
	defMinutes: number;
	midMinutes: number;
	fwdMinutes: number;
	// Team and season tracking
	mostPlayedForTeam: string;
	numberTeamsPlayedFor: number;
	mostScoredForTeam: string;
	numberSeasonsPlayedFor: number;
	oppositionPlayed: number;
	competitionsCompeted: number;
	teammatesPlayedWith: number;
	graphLabel: string;
}

// Cached player data with date validation
export interface CachedPlayerData {
	playerData: PlayerData;
	selectedDate: string; // YYYY-MM-DD format
}

// Team data interface matching team stats query response
export interface TeamData {
	team: string;
	gamesPlayed: number;
	wins: number;
	draws: number;
	losses: number;
	goalsScored: number;
	goalsConceded: number;
	goalDifference: number;
	cleanSheets: number;
	winPercentage: number;
	goalsPerGame: number;
	goalsConcededPerGame: number;
	pointsPerGame: number;
	homeGames: number;
	homeWins: number;
	homeWinPercentage: number;
	awayGames: number;
	awayWins: number;
	awayWinPercentage: number;
	totalAppearances: number;
	totalMinutes: number;
	totalMOM: number;
	totalGoals: number;
	totalAssists: number;
	totalYellowCards: number;
	totalRedCards: number;
	totalSaves: number;
	totalOwnGoals: number;
	totalPlayerCleanSheets: number;
	totalPenaltiesScored: number;
	totalPenaltiesMissed: number;
	totalPenaltiesConceded: number;
	totalPenaltiesSaved: number;
	totalFantasyPoints: number;
	totalDistance: number;
	goalsPerAppearance: number;
	assistsPerAppearance: number;
	momPerAppearance: number;
	minutesPerAppearance: number;
	fantasyPointsPerAppearance: number;
	numberOfSeasons: number;
	numberOfCompetitions: number;
}

// TOTW cache interfaces
export interface TOTWWeek {
	week: number;
	dateLookup: string;
	weekAdjusted: string;
}

export interface TOTWPlayer {
	playerName: string;
	ftpScore: number;
	position: string;
}

export interface CachedTOTWSeasons {
	seasons: string[];
	currentSeason: string | null;
}

export interface CachedTOTWWeeks {
	weeks: TOTWWeek[];
	currentWeek: number | null;
	latestGameweek?: string;
}

export interface CachedTOTWWeekData {
	totwData: WeeklyTOTW;
	players: TOTWPlayer[];
}

// Players of the Month cache interfaces
export interface POMMonthPlayer {
	rank: number;
	playerName: string;
	ftpScore: number;
}

export interface POMMonthPlayerStats {
	appearances: number;
	goals: number;
	assists: number;
	cleanSheets: number;
	mom: number;
	yellowCards: number;
	redCards: number;
	saves: number;
	ownGoals: number;
	conceded: number;
	penaltiesScored: number;
	penaltiesMissed: number;
	penaltiesSaved: number;
	matchDetails: any[];
}

export interface CachedPOMSeasons {
	seasons: string[];
}

export interface CachedPOMMonthData {
	players: POMMonthPlayer[];
}

// Filter interfaces
export interface PlayerFilters {
	timeRange: {
		type: "allTime" | "season" | "beforeDate" | "afterDate" | "betweenDates";
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
	previousMainPage: MainPage | null; // Store previous page before navigating to settings
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
	// Filter state - cached per stats sub-page
	playerFiltersByPage: Record<StatsSubPage, PlayerFilters>;
	playerFilters: PlayerFilters; // Current page filters (synced from playerFiltersByPage)
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
	// TOTW data cache
	cachedTOTWSeasons: CachedTOTWSeasons | null;
	cachedTOTWWeeks: Record<string, CachedTOTWWeeks>; // Keyed by season
	cachedTOTWWeekData: Record<string, CachedTOTWWeekData>; // Keyed by "season:week"
	// Players of the Month data cache
	cachedPOMSeasons: CachedPOMSeasons | null;
	cachedPOMMonths: Record<string, string[]>; // Keyed by season
	cachedPOMMonthData: Record<string, CachedPOMMonthData>; // Keyed by "season:month"
	cachedPOMPlayerStats: Record<string, POMMonthPlayerStats>; // Keyed by "season:month:playerName"
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
	removeTimeRangeFilter: () => Promise<void>;
	removeTeamFilter: (team: string) => Promise<void>;
	removeLocationFilter: (location: "Home" | "Away") => Promise<void>;
	removeOppositionFilter: () => Promise<void>;
	removeCompetitionTypeFilter: (type: "League" | "Cup" | "Friendly") => Promise<void>;
	removeCompetitionSearchFilter: () => Promise<void>;
	removeResultFilter: (result: "Win" | "Draw" | "Loss") => Promise<void>;
	removePositionFilter: (position: "GK" | "DEF" | "MID" | "FWD") => Promise<void>;
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
	// TOTW cache actions
	cacheTOTWSeasons: (seasons: string[], currentSeason: string | null) => void;
	cacheTOTWWeeks: (season: string, weeks: TOTWWeek[], currentWeek: number | null, latestGameweek?: string) => void;
	cacheTOTWWeekData: (season: string, week: number, totwData: WeeklyTOTW, players: TOTWPlayer[]) => void;
	getCachedTOTWSeasons: () => CachedTOTWSeasons | null;
	getCachedTOTWWeeks: (season: string) => CachedTOTWWeeks | null;
	getCachedTOTWWeekData: (season: string, week: number) => CachedTOTWWeekData | null;
	// Players of the Month cache actions
	cachePOMSeasons: (seasons: string[]) => void;
	cachePOMMonths: (season: string, months: string[]) => void;
	cachePOMMonthData: (season: string, month: string, players: POMMonthPlayer[]) => void;
	cachePOMPlayerStats: (season: string, month: string, playerName: string, stats: POMMonthPlayerStats) => void;
	getCachedPOMSeasons: () => CachedPOMSeasons | null;
	getCachedPOMMonths: (season: string) => string[] | null;
	getCachedPOMMonthData: (season: string, month: string) => CachedPOMMonthData | null;
	getCachedPOMPlayerStats: (season: string, month: string, playerName: string) => POMMonthPlayerStats | null;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
	// Initial state
	currentMainPage: "home",
	previousMainPage: null,
	currentStatsSubPage: "player-stats",
	currentTOTWSubPage: "totw",
	currentClubInfoSubPage: "club-information",
	selectedPlayer: null,
	isPlayerSelected: false,
	isEditMode: false,
	cachedPlayerData: null,
	isLoadingPlayerData: false,
	// Filter initial state - cached per page
	playerFiltersByPage: {
		"player-stats": {
			timeRange: {
				type: "allTime",
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
			position: [],
		},
		"club-stats": {
			timeRange: {
				type: "allTime",
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
			position: [],
		},
		"comparison": {
			timeRange: {
				type: "allTime",
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
			position: [],
		},
	},
	// Current page filters (synced from playerFiltersByPage)
	playerFilters: {
		timeRange: {
			type: "allTime",
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
		position: [],
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
	// TOTW data cache initial state
	cachedTOTWSeasons: null,
	cachedTOTWWeeks: {},
	cachedTOTWWeekData: {},
	// Players of the Month data cache initial state
	cachedPOMSeasons: null,
	cachedPOMMonths: {},
	cachedPOMMonthData: {},
	cachedPOMPlayerStats: {},

	// Initialize from localStorage after mount
	initializeFromStorage: () => {
		if (typeof window !== "undefined") {
			// Load navigation state from localStorage
			const savedMainPage = localStorage.getItem("dorkinians-current-main-page");
			let restoredMainPage: MainPage = "home";
			
			// If saved page is "settings", restore the previous page instead
			if (savedMainPage === "settings") {
				const previousMainPage = localStorage.getItem("dorkinians-previous-main-page");
				if (previousMainPage && (previousMainPage === "home" || previousMainPage === "stats" || previousMainPage === "totw" || previousMainPage === "club-info")) {
					restoredMainPage = previousMainPage as MainPage;
					set({ currentMainPage: restoredMainPage, previousMainPage: null });
					// Update localStorage with the restored page
					localStorage.setItem("dorkinians-current-main-page", restoredMainPage);
				} else {
					// Fallback to home if no previous page found
					restoredMainPage = "home";
					set({ currentMainPage: restoredMainPage, previousMainPage: null });
					localStorage.setItem("dorkinians-current-main-page", restoredMainPage);
				}
			} else if (savedMainPage && (savedMainPage === "home" || savedMainPage === "stats" || savedMainPage === "totw" || savedMainPage === "club-info" || savedMainPage === "settings")) {
				restoredMainPage = savedMainPage as MainPage;
				set({ currentMainPage: restoredMainPage });
			}

			// Load previous main page
			const savedPreviousMainPage = localStorage.getItem("dorkinians-previous-main-page");
			if (savedPreviousMainPage && (savedPreviousMainPage === "home" || savedPreviousMainPage === "stats" || savedPreviousMainPage === "totw" || savedPreviousMainPage === "club-info")) {
				set({ previousMainPage: savedPreviousMainPage as MainPage });
			}

			// Restore sub-pages - explicitly restore the sub-page that corresponds to the restored main page
			// This ensures proper ordering and that the correct sub-page is restored
			if (restoredMainPage === "stats") {
				const savedStatsSubPage = localStorage.getItem("dorkinians-current-stats-sub-page");
				if (savedStatsSubPage && (savedStatsSubPage === "player-stats" || savedStatsSubPage === "club-stats" || savedStatsSubPage === "comparison")) {
					set({ currentStatsSubPage: savedStatsSubPage as StatsSubPage });
				}
			} else if (restoredMainPage === "totw") {
				const savedTOTWSubPage = localStorage.getItem("dorkinians-current-totw-sub-page");
				if (savedTOTWSubPage && (savedTOTWSubPage === "totw" || savedTOTWSubPage === "players-of-month")) {
					set({ currentTOTWSubPage: savedTOTWSubPage as TOTWSubPage });
				}
			} else if (restoredMainPage === "club-info") {
				const savedClubInfoSubPage = localStorage.getItem("dorkinians-current-club-info-sub-page");
				if (savedClubInfoSubPage && (savedClubInfoSubPage === "club-information" || savedClubInfoSubPage === "league-information" || savedClubInfoSubPage === "club-captains" || savedClubInfoSubPage === "club-awards" || savedClubInfoSubPage === "useful-links")) {
					set({ currentClubInfoSubPage: savedClubInfoSubPage as ClubInfoSubPage });
				}
			}

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

			// Load filters per page if available
			const savedFilters = localStorage.getItem("dorkinians-player-filters-by-page");
			if (savedFilters) {
				try {
					const parsedFilters: Record<StatsSubPage, PlayerFilters> = JSON.parse(savedFilters);
					const currentPage = get().currentStatsSubPage;
					set({ 
						playerFiltersByPage: parsedFilters,
						playerFilters: parsedFilters[currentPage] || parsedFilters["player-stats"],
					});
					
					// Apply filters on initial load if player is selected
					const { selectedPlayer: currentPlayer } = get();
					if (currentPlayer) {
						setTimeout(() => {
							get().applyPlayerFilters();
						}, 0);
					}
				} catch (error) {
					console.error("❌ [Filters] Failed to parse saved filters:", error);
					localStorage.removeItem("dorkinians-player-filters-by-page");
					
					// Apply default filters on initial load if player is selected
					const { selectedPlayer: currentPlayer } = get();
					if (currentPlayer) {
						setTimeout(() => {
							get().applyPlayerFilters();
						}, 0);
					}
				}
			} else {
				// No saved filters, apply default filters on initial load if player is selected
				const { selectedPlayer: currentPlayer } = get();
				if (currentPlayer) {
					setTimeout(() => {
						get().applyPlayerFilters();
					}, 0);
				}
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

		// Store previous page before navigating to settings
		if (page === "settings" && currentPage !== "settings") {
			set({ previousMainPage: currentPage });
			// Persist previous page to localStorage
			if (typeof window !== "undefined") {
				localStorage.setItem("dorkinians-previous-main-page", currentPage);
			}
		}

		set({ currentMainPage: page });

		// Reset sub-pages only when actually leaving those pages
		// Don't reset sub-pages when navigating to/from settings (settings is a special case)
		if (currentPage === "stats" && page !== "stats" && page !== "settings") {
			set({ currentStatsSubPage: "player-stats" });
		}
		if (currentPage === "totw" && page !== "totw" && page !== "settings") {
			set({ currentTOTWSubPage: "totw" });
		}
		if (currentPage === "club-info" && page !== "club-info" && page !== "settings") {
			set({ currentClubInfoSubPage: "club-information" });
		}
		// When navigating FROM settings back to a page, don't reset sub-pages (they should be preserved)
		if (currentPage === "settings" && page !== "settings") {
			// Don't reset sub-pages - they should be restored from localStorage via initializeFromStorage
		}

		// Persist to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-current-main-page", page);
		}

		console.log("📊 [Navigation] State after change:", {
			selectedPlayer: get().selectedPlayer,
			isPlayerSelected: get().isPlayerSelected,
			currentMainPage: get().currentMainPage,
		});
	},

	setStatsSubPage: (page: StatsSubPage) => {
		const currentPage = get().currentStatsSubPage;
		const currentFilters = get().playerFilters;
		const filtersByPage = get().playerFiltersByPage;
		
		// Save current page filters
		const updatedFiltersByPage = {
			...filtersByPage,
			[currentPage]: currentFilters,
		};
		
		// Load filters for new page
		const newPageFilters = updatedFiltersByPage[page];
		
		set({
			currentStatsSubPage: page,
			playerFiltersByPage: updatedFiltersByPage,
			playerFilters: newPageFilters,
			hasUnsavedFilters: false,
		});
		
		// Persist to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-player-filters-by-page", JSON.stringify(updatedFiltersByPage));
			localStorage.setItem("dorkinians-current-stats-sub-page", page);
		}
	},

	setTOTWSubPage: (page: TOTWSubPage) => {
		set({ currentTOTWSubPage: page });
		
		// Persist to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-current-totw-sub-page", page);
		}
	},

	setClubInfoSubPage: (page: ClubInfoSubPage) => {
		set({ currentClubInfoSubPage: page });
		
		// Persist to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-current-club-info-sub-page", page);
		}
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
		const { currentStatsSubPage, playerFilters, playerFiltersByPage } = get();
		// Always show all 3 pages: Player Stats, Club Stats, Player Comparison
		const availablePages: StatsSubPage[] = [
			"player-stats" as StatsSubPage,
			"club-stats" as StatsSubPage,
			"comparison" as StatsSubPage,
		];
		const currentIndex = availablePages.indexOf(currentStatsSubPage);
		const nextIndex = (currentIndex + 1) % availablePages.length;
		const nextPage = availablePages[nextIndex];
		
		// Save current page filters and load next page filters
		const updatedFiltersByPage = {
			...playerFiltersByPage,
			[currentStatsSubPage]: playerFilters,
		};
		
		set({
			currentStatsSubPage: nextPage,
			playerFiltersByPage: updatedFiltersByPage,
			playerFilters: updatedFiltersByPage[nextPage],
			hasUnsavedFilters: false,
		});
		
		// Persist to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-player-filters-by-page", JSON.stringify(updatedFiltersByPage));
		}
	},

	previousStatsSubPage: () => {
		const { currentStatsSubPage, playerFilters, playerFiltersByPage } = get();
		// Always show all 3 pages: Player Stats, Club Stats, Player Comparison
		const availablePages: StatsSubPage[] = [
			"player-stats" as StatsSubPage,
			"club-stats" as StatsSubPage,
			"comparison" as StatsSubPage,
		];
		const currentIndex = availablePages.indexOf(currentStatsSubPage);
		const prevIndex = currentIndex === 0 ? availablePages.length - 1 : currentIndex - 1;
		const prevPage = availablePages[prevIndex];
		
		// Save current page filters and load previous page filters
		const updatedFiltersByPage = {
			...playerFiltersByPage,
			[currentStatsSubPage]: playerFilters,
		};
		
		set({
			currentStatsSubPage: prevPage,
			playerFiltersByPage: updatedFiltersByPage,
			playerFilters: updatedFiltersByPage[prevPage],
			hasUnsavedFilters: false,
		});
		
		// Persist to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-player-filters-by-page", JSON.stringify(updatedFiltersByPage));
		}
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
		const subPages: ClubInfoSubPage[] = ["club-information", "league-information", "club-captains", "club-awards", "useful-links"];
		const currentIndex = subPages.indexOf(currentClubInfoSubPage);
		const nextIndex = (currentIndex + 1) % subPages.length;
		set({ currentClubInfoSubPage: subPages[nextIndex] });
	},

	previousClubInfoSubPage: () => {
		const { currentClubInfoSubPage } = get();
		const subPages: ClubInfoSubPage[] = ["club-information", "league-information", "club-captains", "club-awards", "useful-links"];
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
		const currentPage = get().currentStatsSubPage;
		const currentFilters = get().playerFilters;
		const newFilters = { ...currentFilters, ...filters };
		const updatedFiltersByPage = {
			...get().playerFiltersByPage,
			[currentPage]: newFilters,
		};
		set({
			playerFilters: newFilters,
			playerFiltersByPage: updatedFiltersByPage,
			hasUnsavedFilters: true,
		});
		
		// Persist to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-player-filters-by-page", JSON.stringify(updatedFiltersByPage));
		}
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
		const currentPage = get().currentStatsSubPage;
		const defaultFilters: PlayerFilters = {
			timeRange: {
				type: "allTime",
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
			position: [],
		};
		const updatedFiltersByPage = {
			...get().playerFiltersByPage,
			[currentPage]: defaultFilters,
		};
		set({
			playerFilters: defaultFilters,
			playerFiltersByPage: updatedFiltersByPage,
			hasUnsavedFilters: false,
		});
		
		// Persist to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-player-filters-by-page", JSON.stringify(updatedFiltersByPage));
		}
	},

	removeTimeRangeFilter: async () => {
		const currentPage = get().currentStatsSubPage;
		const currentFilters = get().playerFilters;
		const updatedFilters: PlayerFilters = {
			...currentFilters,
			timeRange: {
				type: "allTime" as const,
				seasons: [],
				beforeDate: "",
				afterDate: "",
				startDate: "",
				endDate: "",
			},
		};
		const updatedFiltersByPage = {
			...get().playerFiltersByPage,
			[currentPage]: updatedFilters,
		};
		set({
			playerFilters: updatedFilters,
			playerFiltersByPage: updatedFiltersByPage,
			hasUnsavedFilters: false,
		});
		
		// Persist to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-player-filters-by-page", JSON.stringify(updatedFiltersByPage));
		}
		
		await get().applyPlayerFilters();
	},

	removeTeamFilter: async (team: string) => {
		const currentPage = get().currentStatsSubPage;
		const currentFilters = get().playerFilters;
		const updatedFilters = {
			...currentFilters,
			teams: currentFilters.teams.filter((t) => t !== team),
		};
		const updatedFiltersByPage = {
			...get().playerFiltersByPage,
			[currentPage]: updatedFilters,
		};
		set({
			playerFilters: updatedFilters,
			playerFiltersByPage: updatedFiltersByPage,
			hasUnsavedFilters: false,
		});
		
		// Persist to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-player-filters-by-page", JSON.stringify(updatedFiltersByPage));
		}
		
		await get().applyPlayerFilters();
	},

	removeLocationFilter: async (location: "Home" | "Away") => {
		const currentPage = get().currentStatsSubPage;
		const currentFilters = get().playerFilters;
		const updatedFilters = {
			...currentFilters,
			location: currentFilters.location.filter((l) => l !== location),
		};
		const updatedFiltersByPage = {
			...get().playerFiltersByPage,
			[currentPage]: updatedFilters,
		};
		set({
			playerFilters: updatedFilters,
			playerFiltersByPage: updatedFiltersByPage,
			hasUnsavedFilters: false,
		});
		
		// Persist to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-player-filters-by-page", JSON.stringify(updatedFiltersByPage));
		}
		
		await get().applyPlayerFilters();
	},

	removeOppositionFilter: async () => {
		const currentPage = get().currentStatsSubPage;
		const currentFilters = get().playerFilters;
		const updatedFilters = {
			...currentFilters,
			opposition: {
				allOpposition: true,
				searchTerm: "",
			},
		};
		const updatedFiltersByPage = {
			...get().playerFiltersByPage,
			[currentPage]: updatedFilters,
		};
		set({
			playerFilters: updatedFilters,
			playerFiltersByPage: updatedFiltersByPage,
			hasUnsavedFilters: false,
		});
		
		// Persist to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-player-filters-by-page", JSON.stringify(updatedFiltersByPage));
		}
		
		await get().applyPlayerFilters();
	},

	removeCompetitionTypeFilter: async (type: "League" | "Cup" | "Friendly") => {
		const currentPage = get().currentStatsSubPage;
		const currentFilters = get().playerFilters;
		const updatedFilters = {
			...currentFilters,
			competition: {
				...currentFilters.competition,
				types: currentFilters.competition.types.filter((t) => t !== type),
			},
		};
		const updatedFiltersByPage = {
			...get().playerFiltersByPage,
			[currentPage]: updatedFilters,
		};
		set({
			playerFilters: updatedFilters,
			playerFiltersByPage: updatedFiltersByPage,
			hasUnsavedFilters: false,
		});
		
		// Persist to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-player-filters-by-page", JSON.stringify(updatedFiltersByPage));
		}
		
		await get().applyPlayerFilters();
	},

	removeCompetitionSearchFilter: async () => {
		const currentPage = get().currentStatsSubPage;
		const currentFilters = get().playerFilters;
		const updatedFilters = {
			...currentFilters,
			competition: {
				...currentFilters.competition,
				searchTerm: "",
			},
		};
		const updatedFiltersByPage = {
			...get().playerFiltersByPage,
			[currentPage]: updatedFilters,
		};
		set({
			playerFilters: updatedFilters,
			playerFiltersByPage: updatedFiltersByPage,
			hasUnsavedFilters: false,
		});
		
		// Persist to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-player-filters-by-page", JSON.stringify(updatedFiltersByPage));
		}
		
		await get().applyPlayerFilters();
	},

	removeResultFilter: async (result: "Win" | "Draw" | "Loss") => {
		const currentPage = get().currentStatsSubPage;
		const currentFilters = get().playerFilters;
		const updatedFilters = {
			...currentFilters,
			result: currentFilters.result.filter((r) => r !== result),
		};
		const updatedFiltersByPage = {
			...get().playerFiltersByPage,
			[currentPage]: updatedFilters,
		};
		set({
			playerFilters: updatedFilters,
			playerFiltersByPage: updatedFiltersByPage,
			hasUnsavedFilters: false,
		});
		
		// Persist to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-player-filters-by-page", JSON.stringify(updatedFiltersByPage));
		}
		
		await get().applyPlayerFilters();
	},

	removePositionFilter: async (position: "GK" | "DEF" | "MID" | "FWD") => {
		const currentPage = get().currentStatsSubPage;
		const currentFilters = get().playerFilters;
		const updatedFilters = {
			...currentFilters,
			position: currentFilters.position.filter((p) => p !== position),
		};
		const updatedFiltersByPage = {
			...get().playerFiltersByPage,
			[currentPage]: updatedFilters,
		};
		set({
			playerFilters: updatedFilters,
			playerFiltersByPage: updatedFiltersByPage,
			hasUnsavedFilters: false,
		});
		
		// Persist to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-player-filters-by-page", JSON.stringify(updatedFiltersByPage));
		}
		
		await get().applyPlayerFilters();
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

	// TOTW cache actions
	cacheTOTWSeasons: (seasons: string[], currentSeason: string | null) => {
		set({
			cachedTOTWSeasons: {
				seasons,
				currentSeason,
			},
		});
	},

	cacheTOTWWeeks: (season: string, weeks: TOTWWeek[], currentWeek: number | null, latestGameweek?: string) => {
		const { cachedTOTWWeeks } = get();
		set({
			cachedTOTWWeeks: {
				...cachedTOTWWeeks,
				[season]: {
					weeks,
					currentWeek,
					latestGameweek,
				},
			},
		});
	},

	cacheTOTWWeekData: (season: string, week: number, totwData: WeeklyTOTW, players: TOTWPlayer[]) => {
		const { cachedTOTWWeekData } = get();
		const cacheKey = `${season}:${week}`;
		set({
			cachedTOTWWeekData: {
				...cachedTOTWWeekData,
				[cacheKey]: {
					totwData,
					players,
				},
			},
		});
	},

	getCachedTOTWSeasons: () => {
		return get().cachedTOTWSeasons;
	},

	getCachedTOTWWeeks: (season: string) => {
		const { cachedTOTWWeeks } = get();
		return cachedTOTWWeeks[season] || null;
	},

	getCachedTOTWWeekData: (season: string, week: number) => {
		const { cachedTOTWWeekData } = get();
		const cacheKey = `${season}:${week}`;
		return cachedTOTWWeekData[cacheKey] || null;
	},

	// Players of the Month cache actions
	cachePOMSeasons: (seasons: string[]) => {
		set({
			cachedPOMSeasons: {
				seasons,
			},
		});
	},

	cachePOMMonths: (season: string, months: string[]) => {
		const { cachedPOMMonths } = get();
		set({
			cachedPOMMonths: {
				...cachedPOMMonths,
				[season]: months,
			},
		});
	},

	cachePOMMonthData: (season: string, month: string, players: POMMonthPlayer[]) => {
		const { cachedPOMMonthData } = get();
		const cacheKey = `${season}:${month}`;
		set({
			cachedPOMMonthData: {
				...cachedPOMMonthData,
				[cacheKey]: {
					players,
				},
			},
		});
	},

	cachePOMPlayerStats: (season: string, month: string, playerName: string, stats: POMMonthPlayerStats) => {
		const { cachedPOMPlayerStats } = get();
		const cacheKey = `${season}:${month}:${playerName}`;
		set({
			cachedPOMPlayerStats: {
				...cachedPOMPlayerStats,
				[cacheKey]: stats,
			},
		});
	},

	getCachedPOMSeasons: () => {
		return get().cachedPOMSeasons;
	},

	getCachedPOMMonths: (season: string) => {
		const { cachedPOMMonths } = get();
		return cachedPOMMonths[season] || null;
	},

	getCachedPOMMonthData: (season: string, month: string) => {
		const { cachedPOMMonthData } = get();
		const cacheKey = `${season}:${month}`;
		return cachedPOMMonthData[cacheKey] || null;
	},

	getCachedPOMPlayerStats: (season: string, month: string, playerName: string) => {
		const { cachedPOMPlayerStats } = get();
		const cacheKey = `${season}:${month}:${playerName}`;
		return cachedPOMPlayerStats[cacheKey] || null;
	},
}));
