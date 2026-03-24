import { useNavigationStore } from "../../../lib/stores/navigation";

describe("Navigation store coverage", () => {
	beforeEach(() => {
		useNavigationStore.setState({
			isFilterSidebarOpen: false,
			hasUnsavedFilters: false,
			currentStatsSubPage: "player-stats",
		} as any);
		jest.clearAllMocks();
	});

	test("opens and closes filter sidebar", () => {
		useNavigationStore.getState().openFilterSidebar();
		expect(useNavigationStore.getState().isFilterSidebarOpen).toBe(true);

		useNavigationStore.setState({ hasUnsavedFilters: true } as any);
		useNavigationStore.getState().closeFilterSidebar();
		expect(useNavigationStore.getState().isFilterSidebarOpen).toBe(false);
		expect(useNavigationStore.getState().hasUnsavedFilters).toBe(false);
	});

	test("updatePlayerFilters marks state as unsaved", () => {
		useNavigationStore.getState().updatePlayerFilters({
			teams: ["1st Team"],
		});

		const state = useNavigationStore.getState();
		expect(state.playerFilters.teams).toEqual(["1st Team"]);
		expect(state.playerFiltersByPage["player-stats"].teams).toEqual(["1st Team"]);
		expect(state.hasUnsavedFilters).toBe(true);
	});

	test("resetPlayerFilters resets defaults and clears unsaved flag", () => {
		useNavigationStore.getState().updatePlayerFilters({
			teams: ["3rd Team"],
			location: ["Home"],
		});

		useNavigationStore.getState().resetPlayerFilters();
		const state = useNavigationStore.getState();

		expect(state.playerFilters.timeRange.type).toBe("allTime");
		expect(state.playerFilters.teams).toEqual([]);
		expect(state.playerFilters.location).toEqual(["Home", "Away"]);
		expect(state.playerFilters.position).toEqual(["GK", "DEF", "MID", "FWD"]);
		expect(state.hasUnsavedFilters).toBe(false);
	});

	test("clearPlayerSelection clears selected player state", () => {
		useNavigationStore.setState({ selectedPlayer: "Luke", isPlayerSelected: true, cachedPlayerData: { selectedDate: "2024-01-01", playerData: {} } } as any);
		useNavigationStore.getState().clearPlayerSelection();

		const state = useNavigationStore.getState();
		expect(state.selectedPlayer).toBeNull();
		expect(state.isPlayerSelected).toBe(false);
		expect(state.cachedPlayerData).toBeNull();
	});
});
