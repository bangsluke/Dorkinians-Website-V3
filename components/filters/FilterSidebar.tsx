"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon, CheckIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useNavigationStore, type PlayerFilters } from "@/lib/stores/navigation";
import { statsPageConfig } from "@/config/config";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/lib/hooks/useToast";
import ProgressIndicator from "@/components/ui/ProgressIndicator";
import ConfirmModal from "@/components/modals/ConfirmModal";

interface FilterSidebarProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess?: (message: string) => void;
}

interface AccordionSection {
	id: string;
	title: string;
	isOpen: boolean;
}

export default function FilterSidebar({ isOpen, onClose, onSuccess }: FilterSidebarProps) {
	const {
		playerFilters,
		updatePlayerFilters,
		applyPlayerFilters,
		resetPlayerFilters,
		hasUnsavedFilters,
		filterData,
		isFilterDataLoaded,
		loadFilterData,
		currentStatsSubPage,
	} = useNavigationStore();
	const { showSuccess: localShowSuccess } = useToast();
	const showSuccess = onSuccess || localShowSuccess;

	// State for autocomplete dropdowns
	const [showOppositionDropdown, setShowOppositionDropdown] = useState(false);
	const [showCompetitionDropdown, setShowCompetitionDropdown] = useState(false);
	// State for keyboard navigation
	const [oppositionHighlightedIndex, setOppositionHighlightedIndex] = useState(-1);
	const [competitionHighlightedIndex, setCompetitionHighlightedIndex] = useState(-1);
	// Refs for dropdown containers (for scrolling)
	const oppositionDropdownRef = useRef<HTMLDivElement>(null);
	const competitionDropdownRef = useRef<HTMLDivElement>(null);
	// State for clear all confirmation modal
	const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
	// State for unsaved changes confirmation modal
	const [showUnsavedChangesConfirm, setShowUnsavedChangesConfirm] = useState(false);
	
	// State to track initial filter state when sidebar opens
	const [initialFilterSnapshot, setInitialFilterSnapshot] = useState<PlayerFilters | null>(null);
	// Ref to track if snapshot has been captured for current sidebar opening
	const snapshotCapturedRef = useRef(false);
	// Ref to track user-initiated clears to prevent auto-initialization
	// Also check localStorage for persisted cleared state (survives page reloads)
	const getClearedState = (): { teams?: boolean; position?: boolean } => {
		if (typeof window === "undefined") return {};
		try {
			const stored = localStorage.getItem("dorkinians-filters-cleared");
			return stored ? JSON.parse(stored) : {};
		} catch {
			return {};
		}
	};
	const setClearedState = (state: { teams?: boolean; position?: boolean }) => {
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-filters-cleared", JSON.stringify(state));
		}
	};
	const userClearedRef = useRef<{ teams?: boolean; position?: boolean }>(getClearedState());
	// State for validation errors (inline display)
	const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
	// State for date validation errors
	const [dateValidationErrors, setDateValidationErrors] = useState<{
		beforeDate?: string;
		afterDate?: string;
		startDate?: string;
		endDate?: string;
	}>({});
	// State for progress indicator
	const [showProgressIndicator, setShowProgressIndicator] = useState(false);
	const [applyStartTime, setApplyStartTime] = useState<number | null>(null);
	// State to track client-side mount to prevent hydration mismatch
	const [isMounted, setIsMounted] = useState(false);

	// Get available filters for current page
	const availableFilters: string[] = useMemo(() => {
		const config = statsPageConfig[currentStatsSubPage];
		return config?.availableFilters ? [...config.availableFilters] : [];
	}, [currentStatsSubPage]);

	// All possible accordion sections - Common filters open by default, advanced collapsed
	const allAccordionSections: AccordionSection[] = useMemo(
		() => [
			{ id: "timeRange", title: "Time Range", isOpen: true }, // Common - always open
			{ id: "team", title: "Team", isOpen: true }, // Common - open by default
			{ id: "location", title: "Home vs Away", isOpen: true }, // Common - open by default
			{ id: "opposition", title: "Opposition", isOpen: false }, // Advanced - collapsed
			{ id: "competition", title: "Competition", isOpen: false }, // Advanced - collapsed
			{ id: "result", title: "Result", isOpen: false }, // Advanced - collapsed
			{ id: "position", title: "Position", isOpen: false }, // Advanced - collapsed
		],
		[],
	);

	// Filter accordion sections to only include available ones
	const [accordionSections, setAccordionSections] = useState<AccordionSection[]>(() => {
		return allAccordionSections.filter((section) => availableFilters.includes(section.id));
	});

	// Update accordion sections when available filters change
	useEffect(() => {
		setAccordionSections((prev) => {
			const filtered = allAccordionSections.filter((section) => availableFilters.includes(section.id));
			// Preserve open/closed state for sections that remain
			return filtered.map((section) => {
				const existing = prev.find((p) => p.id === section.id);
				return existing || section;
			});
		});
	}, [availableFilters, allAccordionSections]);

	// Track client-side mount to prevent hydration mismatch
	useEffect(() => {
		setIsMounted(true);
	}, []);

	// Load filter data on mount if not already loaded
	useEffect(() => {
		if (isOpen && !isFilterDataLoaded) {
			loadFilterData();
		}
	}, [isOpen, isFilterDataLoaded, loadFilterData]);

	// Validate date ranges when they change
	useEffect(() => {
		if (isOpen && playerFilters?.timeRange) {
			const errors = validateDateRanges();
			setDateValidationErrors(errors);
		} else {
			setDateValidationErrors({});
		}
	}, [playerFilters?.timeRange, isOpen]);

	// Update inline validation errors when filters change
	useEffect(() => {
		if (isOpen) {
			const missingSections = validateRequiredFilters();
			const dateErrors = validateDateRanges();
			const errors: Record<string, string> = {};

			// Map missing sections to section IDs
			const sectionIdMap: Record<string, string> = {
				"Team": "team",
				"Position": "position",
				"Home vs Away": "location",
				"Result": "result",
				"Competition": "competition",
			};

			missingSections.forEach((section) => {
				const sectionId = sectionIdMap[section];
				if (sectionId) {
					errors[sectionId] = `Please select at least one option in ${section}`;
				}
			});

			// Add date range errors
			if (Object.keys(dateErrors).length > 0) {
				errors.timeRange = "Please fix date range errors above";
			}

			setValidationErrors(errors);
		} else {
			setValidationErrors({});
		}
	}, [playerFilters, isOpen, dateValidationErrors]);

	// Initialize default values when sidebar opens
	useEffect(() => {
		if (isOpen && playerFilters && isFilterDataLoaded && filterData) {
			const updates: Partial<PlayerFilters> = {};
			let needsUpdate = false;

			// Initialize teams to all teams if empty (unless user explicitly cleared)
			if ((playerFilters.teams?.length || 0) === 0 && filterData.teams.length > 0 && !userClearedRef.current.teams) {
				updates.teams = filterData.teams.map(team => team.name);
				needsUpdate = true;
			}

			// Initialize positions to all positions if empty (unless user explicitly cleared)
			if ((playerFilters.position?.length || 0) === 0 && !userClearedRef.current.position) {
				updates.position = ["GK", "DEF", "MID", "FWD"];
				needsUpdate = true;
			}

			// Initialize location to both if empty
			if ((playerFilters.location?.length || 0) === 0) {
				updates.location = ["Home", "Away"];
				needsUpdate = true;
			}

			// Initialize competition types to all if empty
			if ((playerFilters.competition?.types?.length || 0) === 0) {
				updates.competition = {
					...(playerFilters.competition || { mode: "types", types: [], searchTerm: "" }),
					mode: "types",
					types: ["League", "Cup", "Friendly"],
				};
				needsUpdate = true;
			}

			// Initialize seasons to all seasons if timeRange type is "season" and seasons array is empty
			if (playerFilters.timeRange?.type === "season" && (playerFilters.timeRange?.seasons?.length || 0) === 0 && filterData.seasons.length > 0) {
				updates.timeRange = {
					...(playerFilters.timeRange || {
						type: "season",
						seasons: [],
						beforeDate: "",
						afterDate: "",
						startDate: "",
						endDate: "",
					}),
					seasons: filterData.seasons.map(season => season.season),
				};
				needsUpdate = true;
			}

			if (needsUpdate) {
				updatePlayerFilters(updates);
			}
		}
	}, [isOpen, isFilterDataLoaded, filterData, playerFilters, updatePlayerFilters]);

	// Reset highlighted indices when dropdowns close or search terms change
	useEffect(() => {
		if (!showOppositionDropdown) {
			setOppositionHighlightedIndex(-1);
		}
	}, [showOppositionDropdown]);

	useEffect(() => {
		if (!showCompetitionDropdown) {
			setCompetitionHighlightedIndex(-1);
		}
	}, [showCompetitionDropdown]);

	// Capture snapshot after initialization completes
	useEffect(() => {
		if (isOpen && playerFilters && isFilterDataLoaded && filterData && !snapshotCapturedRef.current) {
		// Get default values for comparison
		const allTeams = filterData.teams.map(team => team.name);
		const allPositions = ["GK", "DEF", "MID", "FWD"] as const;
		const defaultLocation: ("Home" | "Away")[] = ["Home", "Away"];
		const defaultCompetitionTypes = ["League", "Cup", "Friendly"] as const;

		// Use defaults if empty for snapshot
		const teamsForSnapshot = (playerFilters.teams?.length || 0) === 0 ? allTeams : (playerFilters.teams || []);
		const positionForSnapshot = (playerFilters.position?.length || 0) === 0 ? allPositions : (playerFilters.position || []);
		const locationForSnapshot: ("Home" | "Away")[] = (playerFilters.location?.length || 0) === 0 ? defaultLocation : (playerFilters.location || []);
		const competitionTypesForSnapshot = (playerFilters.competition?.types?.length || 0) === 0 ? defaultCompetitionTypes : (playerFilters.competition?.types || []);

			// Create a deep copy of the filters as the snapshot
			const snapshot: PlayerFilters = {
				timeRange: {
					type: playerFilters.timeRange.type,
					seasons: [...(playerFilters.timeRange.seasons || [])],
					beforeDate: playerFilters.timeRange.beforeDate || "",
					afterDate: playerFilters.timeRange.afterDate || "",
					startDate: playerFilters.timeRange.startDate || "",
					endDate: playerFilters.timeRange.endDate || "",
				},
				teams: [...teamsForSnapshot],
				location: [...locationForSnapshot],
			opposition: {
				mode: playerFilters.opposition?.mode ?? "all",
				searchTerm: playerFilters.opposition?.searchTerm || "",
			},
				competition: {
					mode: playerFilters.competition?.mode ?? "types",
					types: [...competitionTypesForSnapshot],
					searchTerm: playerFilters.competition?.searchTerm || "",
				},
				result: [...(playerFilters.result || [])],
				position: [...positionForSnapshot],
			};
			setInitialFilterSnapshot(snapshot);
			snapshotCapturedRef.current = true;
		} else if (!isOpen) {
			// When sidebar closes, check if teams/position were auto-initialized and revert them
			// Auto-initialized means: they were empty in the snapshot but have values now
			const updates: Partial<PlayerFilters> = {};
			let needsRevert = false;
			
			if (initialFilterSnapshot) {
				// If teams were empty in snapshot but have values now, they were auto-initialized
				// Always revert auto-initialized filters when sidebar closes without applying
				const teamsWereEmpty = (initialFilterSnapshot.teams?.length || 0) === 0;
				const teamsNowHaveValues = (playerFilters?.teams?.length || 0) > 0;
				if (teamsWereEmpty && teamsNowHaveValues) {
					updates.teams = [];
					needsRevert = true;
					// Set cleared flag so auto-init doesn't happen on next open
					userClearedRef.current.teams = true;
				}
				// If position was empty in snapshot but has values now, it was auto-initialized
				const positionWasEmpty = (initialFilterSnapshot.position?.length || 0) === 0;
				const positionNowHasValues = (playerFilters?.position?.length || 0) > 0;
				if (positionWasEmpty && positionNowHasValues) {
					updates.position = [];
					needsRevert = true;
					// Set cleared flag so auto-init doesn't happen on next open
					userClearedRef.current.position = true;
				}
			}
			
			// Revert auto-initialized filters if needed (this will update playerFilters and trigger badge recalculation)
			if (needsRevert) {
				// Update only teams/position to empty, preserving other filters
				updatePlayerFilters(updates);
				// Apply to ensure badge updates and state is persisted
				applyPlayerFilters();
			}
			
			// Clear snapshot and reset refs when sidebar closes
			setInitialFilterSnapshot(null);
			snapshotCapturedRef.current = false;
			// Only reset userClearedRef flags if the corresponding filters have values (and weren't just reverted)
			// This preserves the cleared state (empty arrays) so auto-initialization doesn't happen on next open
			const finalFilters = needsRevert ? { ...playerFilters, teams: [], position: [] } : playerFilters;
			const clearedState = { ...userClearedRef.current };
			if (finalFilters?.teams && finalFilters.teams.length > 0) {
				delete clearedState.teams;
			}
			if (finalFilters?.position && finalFilters.position.length > 0) {
				delete clearedState.position;
			}
			// Update both ref and localStorage to persist cleared state across page reloads
			userClearedRef.current = clearedState;
			setClearedState(clearedState);
		}
	}, [isOpen, isFilterDataLoaded, filterData, playerFilters]);

	const toggleAccordion = (sectionId: string) => {
		setAccordionSections((prev) => prev.map((section) => (section.id === sectionId ? { ...section, isOpen: !section.isOpen } : section)));
	};

	// Apply filter preset
	const applyPreset = (presetName: "thisSeason" | "allTime" | "last30Days" | "lastSeason") => {
		if (!filterData || filterData.seasons.length === 0) return;

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		switch (presetName) {
			case "thisSeason": {
				// Get current season (first season in the list, which should be the most recent)
				const currentSeason = filterData.seasons[0]?.season;
				if (currentSeason) {
					updatePlayerFilters({
						timeRange: {
							type: "season",
							seasons: [currentSeason],
							beforeDate: "",
							afterDate: "",
							startDate: "",
							endDate: "",
						},
					});
				}
				break;
			}
			case "allTime": {
				updatePlayerFilters({
					timeRange: {
						type: "allTime",
						seasons: [],
						beforeDate: "",
						afterDate: "",
						startDate: "",
						endDate: "",
					},
				});
				break;
			}
			case "last30Days": {
				const endDate = new Date(today);
				const startDate = new Date(today);
				startDate.setDate(startDate.getDate() - 30);
				
				updatePlayerFilters({
					timeRange: {
						type: "betweenDates",
						seasons: [],
						beforeDate: "",
						afterDate: "",
						startDate: startDate.toISOString().split('T')[0],
						endDate: endDate.toISOString().split('T')[0],
					},
				});
				break;
			}
			case "lastSeason": {
				// Get previous season (second season in the list)
				const lastSeason = filterData.seasons[1]?.season;
				if (lastSeason) {
					updatePlayerFilters({
						timeRange: {
							type: "season",
							seasons: [lastSeason],
							beforeDate: "",
							afterDate: "",
							startDate: "",
							endDate: "",
						},
					});
				}
				break;
			}
		}
	};

	const handleTimeRangeTypeChange = (type: "allTime" | "season" | "beforeDate" | "afterDate" | "betweenDates") => {
		if (type === "allTime") {
			// Clear all time range filters when "All Time" is selected
			updatePlayerFilters({
				timeRange: {
					type: "allTime",
					seasons: [],
					beforeDate: "",
					afterDate: "",
					startDate: "",
					endDate: "",
				},
			});
		} else {
			updatePlayerFilters({
				timeRange: {
					...(playerFilters?.timeRange || {
						type: "allTime",
						seasons: [],
						beforeDate: "",
						afterDate: "",
						startDate: "",
						endDate: "",
					}),
					type,
				},
			});
		}
	};

	const handleSeasonToggle = (season: string) => {
		if (!playerFilters?.timeRange) return;
		const currentSeasons = playerFilters.timeRange.seasons || [];
		const newSeasons = currentSeasons.includes(season) ? currentSeasons.filter((s) => s !== season) : [...currentSeasons, season];

		updatePlayerFilters({
			timeRange: {
				...playerFilters.timeRange,
				seasons: newSeasons,
			},
		});
	};

	// When date inputs change, ensure "All Time" is unchecked (handled by isAllTimeSelected)

	const handleTeamToggle = (team: string) => {
		if (!playerFilters) return;
		const currentTeams = playerFilters.teams || [];
		const newTeams = currentTeams.includes(team) ? currentTeams.filter((t) => t !== team) : [...currentTeams, team];
		
		// If user unchecks last team, mark as user-cleared to prevent auto-reinitialization
		if (newTeams.length === 0) {
			userClearedRef.current.teams = true;
		} else if (currentTeams.length === 0 && newTeams.length > 0) {
			// If user adds a team back after clearing, reset the flag
			userClearedRef.current.teams = false;
		}

		updatePlayerFilters({
			teams: newTeams,
		});
	};

	const handleTeamCheckAll = () => {
		if (!playerFilters || !filterData) return;
		userClearedRef.current.teams = false;
		const allTeams = filterData.teams.map(team => team.name);
		updatePlayerFilters({
			teams: allTeams,
		});
	};

	const handleTeamClearAll = () => {
		if (!playerFilters) return;
		userClearedRef.current.teams = true;
		updatePlayerFilters({
			teams: [],
		});
	};

	const handleLocationToggle = (location: "Home" | "Away") => {
		if (!playerFilters) return;
		const currentLocation = playerFilters.location || [];
		const newLocation = currentLocation.includes(location) ? currentLocation.filter((l) => l !== location) : [...currentLocation, location];

		updatePlayerFilters({
			location: newLocation,
		});
	};

	const handleOppositionSearch = (searchTerm: string) => {
		if (!playerFilters) return;
		updatePlayerFilters({
			opposition: {
				...(playerFilters.opposition || { mode: "all", searchTerm: "" }),
				searchTerm,
			},
		});
		setShowOppositionDropdown(true);
		setOppositionHighlightedIndex(-1); // Reset highlight when search changes
	};

	// Filter opposition teams based on search term (deduplicated by name)
	const filteredOpposition = useMemo(() => {
		if (!filterData?.opposition) return [];
		const searchTerm = (playerFilters?.opposition?.searchTerm || "").toLowerCase();
		
		// Deduplicate by name
		const seen = new Set<string>();
		const unique = filterData.opposition.filter(opp => {
			if (seen.has(opp.name)) return false;
			seen.add(opp.name);
			return true;
		});
		
		if (!searchTerm) {
			return unique.slice(0, 50); // Show all options (limited to 50) when searchTerm is empty
		}
		return unique
			.filter(opp => opp.name.toLowerCase().includes(searchTerm))
			.slice(0, 50); // Limit to 50 results
	}, [filterData?.opposition, playerFilters?.opposition?.searchTerm]);

	// Filter opposition clubs based on search term (deduplicated by shortTeamName)
	const filteredOppositionClubs = useMemo(() => {
		if (!filterData?.oppositionClubs) return [];
		const searchTerm = (playerFilters?.opposition?.searchTerm || "").toLowerCase();
		
		// Deduplicate by shortTeamName
		const seen = new Set<string>();
		const unique = filterData.oppositionClubs.filter(club => {
			if (seen.has(club.shortTeamName)) return false;
			seen.add(club.shortTeamName);
			return true;
		});
		
		if (!searchTerm) {
			return unique.slice(0, 50); // Show all options (limited to 50) when searchTerm is empty
		}
		return unique
			.filter(club => club.shortTeamName.toLowerCase().includes(searchTerm))
			.slice(0, 50); // Limit to 50 results
	}, [filterData?.oppositionClubs, playerFilters?.opposition?.searchTerm]);

	const handleOppositionSelect = (oppositionName: string) => {
		if (!playerFilters) return;
		updatePlayerFilters({
			opposition: {
				...(playerFilters.opposition || { mode: "all", searchTerm: "" }),
				searchTerm: oppositionName,
			},
		});
		setShowOppositionDropdown(false);
		setOppositionHighlightedIndex(-1);
	};

	// Keyboard navigation for opposition dropdown
	const handleOppositionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if ((playerFilters?.opposition?.mode ?? "all") === "all") return;
		
		const currentList = (playerFilters?.opposition?.mode ?? "all") === "club" 
			? filteredOppositionClubs 
			: filteredOpposition;
		const maxIndex = currentList.length - 1;
		
		if (maxIndex < 0) return; // No items to navigate
		
		if (e.key === "ArrowDown") {
			e.preventDefault();
			const newIndex = oppositionHighlightedIndex < 0 ? 0 : (oppositionHighlightedIndex >= maxIndex ? 0 : oppositionHighlightedIndex + 1);
			setOppositionHighlightedIndex(newIndex);
			// Scroll into view
			setTimeout(() => {
				const dropdown = oppositionDropdownRef.current;
				if (dropdown) {
					const buttons = dropdown.querySelectorAll('button');
					if (buttons[newIndex]) {
						buttons[newIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
					}
				}
			}, 0);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			const newIndex = oppositionHighlightedIndex <= 0 ? maxIndex : oppositionHighlightedIndex - 1;
			setOppositionHighlightedIndex(newIndex);
			// Scroll into view
			setTimeout(() => {
				const dropdown = oppositionDropdownRef.current;
				if (dropdown) {
					const buttons = dropdown.querySelectorAll('button');
					if (buttons[newIndex]) {
						buttons[newIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
					}
				}
			}, 0);
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (oppositionHighlightedIndex >= 0 && oppositionHighlightedIndex < currentList.length) {
				const selected = (playerFilters?.opposition?.mode ?? "all") === "club"
					? filteredOppositionClubs[oppositionHighlightedIndex].shortTeamName
					: filteredOpposition[oppositionHighlightedIndex].name;
				handleOppositionSelect(selected);
			}
		} else if (e.key === "Escape") {
			e.preventDefault();
			setShowOppositionDropdown(false);
			setOppositionHighlightedIndex(-1);
		}
	};

	const handleCompetitionSearch = (searchTerm: string) => {
		if (!playerFilters) return;
		const currentMode = playerFilters.competition?.mode ?? "types";
		if (currentMode !== "individual") return; // Only allow searching when in individual mode
		
		updatePlayerFilters({
			competition: {
				...(playerFilters.competition || { mode: "types", types: ["League", "Cup", "Friendly"], searchTerm: "" }),
				searchTerm,
			},
		});
		setShowCompetitionDropdown(true);
		setCompetitionHighlightedIndex(-1); // Reset highlight when search changes
	};

	// Filter competitions based on search term (deduplicated by name)
	const filteredCompetitions = useMemo(() => {
		if (!filterData?.competitions) return [];
		const searchTerm = (playerFilters?.competition?.searchTerm || "").toLowerCase();
		
		// Deduplicate by name (same competition name can appear with different types)
		const seen = new Set<string>();
		const unique = filterData.competitions.filter(comp => {
			if (seen.has(comp.name)) return false;
			seen.add(comp.name);
			return true;
		});
		
		if (!searchTerm) {
			return unique.slice(0, 50); // Show all options (limited to 50) when searchTerm is empty
		}
		return unique
			.filter(comp => comp.name.toLowerCase().includes(searchTerm))
			.slice(0, 50); // Limit to 50 results
	}, [filterData?.competitions, playerFilters?.competition?.searchTerm]);

	const handleCompetitionSelect = (competitionName: string) => {
		if (!playerFilters) return;
		updatePlayerFilters({
			competition: {
				...(playerFilters.competition || { mode: "types", types: ["League", "Cup", "Friendly"], searchTerm: "" }),
				searchTerm: competitionName,
			},
		});
		setShowCompetitionDropdown(false);
		setCompetitionHighlightedIndex(-1);
	};

	// Keyboard navigation for competition dropdown
	const handleCompetitionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if ((playerFilters?.competition?.mode ?? "types") === "types") return;
		
		const maxIndex = filteredCompetitions.length - 1;
		
		if (maxIndex < 0) return; // No items to navigate
		
		if (e.key === "ArrowDown") {
			e.preventDefault();
			const newIndex = competitionHighlightedIndex < 0 ? 0 : (competitionHighlightedIndex >= maxIndex ? 0 : competitionHighlightedIndex + 1);
			setCompetitionHighlightedIndex(newIndex);
			// Scroll into view
			setTimeout(() => {
				const dropdown = competitionDropdownRef.current;
				if (dropdown) {
					const buttons = dropdown.querySelectorAll('button');
					if (buttons[newIndex]) {
						buttons[newIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
					}
				}
			}, 0);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			const newIndex = competitionHighlightedIndex <= 0 ? maxIndex : competitionHighlightedIndex - 1;
			setCompetitionHighlightedIndex(newIndex);
			// Scroll into view
			setTimeout(() => {
				const dropdown = competitionDropdownRef.current;
				if (dropdown) {
					const buttons = dropdown.querySelectorAll('button');
					if (buttons[newIndex]) {
						buttons[newIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
					}
				}
			}, 0);
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (competitionHighlightedIndex >= 0 && competitionHighlightedIndex < filteredCompetitions.length) {
				handleCompetitionSelect(filteredCompetitions[competitionHighlightedIndex].name);
			}
		} else if (e.key === "Escape") {
			e.preventDefault();
			setShowCompetitionDropdown(false);
			setCompetitionHighlightedIndex(-1);
		}
	};

	const handleCompetitionTypeToggle = (type: "League" | "Cup" | "Friendly") => {
		if (!playerFilters) return;
		const currentMode = playerFilters.competition?.mode ?? "types";
		if (currentMode !== "types") return; // Only allow toggling when in types mode
		
		const currentTypes = playerFilters.competition?.types || [];
		const newTypes = currentTypes.includes(type) ? currentTypes.filter((t) => t !== type) : [...currentTypes, type];

		updatePlayerFilters({
			competition: {
				...(playerFilters.competition || { mode: "types", types: ["League", "Cup", "Friendly"], searchTerm: "" }),
				types: newTypes,
			},
		});
	};

	const handleResultToggle = (result: "Win" | "Draw" | "Loss") => {
		if (!playerFilters) return;
		const currentResults = playerFilters.result || [];
		const newResults = currentResults.includes(result) ? currentResults.filter((r) => r !== result) : [...currentResults, result];

		updatePlayerFilters({
			result: newResults,
		});
	};

	const handlePositionToggle = (position: "GK" | "DEF" | "MID" | "FWD") => {
		if (!playerFilters) return;
		const currentPositions = playerFilters.position || [];
		const newPositions = currentPositions.includes(position)
			? currentPositions.filter((p) => p !== position)
			: [...currentPositions, position];
		
		// If user unchecks last position, mark as user-cleared to prevent auto-reinitialization
		if (newPositions.length === 0) {
			userClearedRef.current.position = true;
		} else if (currentPositions.length === 0 && newPositions.length > 0) {
			// If user adds a position back after clearing, reset the flag
			userClearedRef.current.position = false;
		}

		updatePlayerFilters({
			position: newPositions,
		});
	};

	const handlePositionCheckAll = () => {
		if (!playerFilters) return;
		userClearedRef.current.position = false;
		updatePlayerFilters({
			position: ["GK", "DEF", "MID", "FWD"],
		});
	};

	const handlePositionClearAll = () => {
		if (!playerFilters) return;
		userClearedRef.current.position = true;
		updatePlayerFilters({
			position: [],
		});
	};

	// Validate date ranges
	const validateDateRanges = (): { [key: string]: string } => {
		const errors: { [key: string]: string } = {};
		const timeRange = playerFilters?.timeRange;
		if (!timeRange) return errors;

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Validate betweenDates
		if (timeRange.type === "betweenDates") {
			const startDate = timeRange.startDate;
			const endDate = timeRange.endDate;

			if (startDate && endDate) {
				const start = new Date(startDate);
				const end = new Date(endDate);

				if (start > end) {
					errors.endDate = "End date must be after start date";
				}

				if (start > today) {
					errors.startDate = "Start date cannot be in the future";
				}

				if (end > today) {
					errors.endDate = errors.endDate || "End date cannot be in the future";
				}
			} else if (startDate && !endDate) {
				const start = new Date(startDate);
				if (start > today) {
					errors.startDate = "Start date cannot be in the future";
				}
			} else if (endDate && !startDate) {
				const end = new Date(endDate);
				if (end > today) {
					errors.endDate = "End date cannot be in the future";
				}
			}
		}

		// Validate beforeDate
		if (timeRange.type === "beforeDate" && timeRange.beforeDate) {
			const before = new Date(timeRange.beforeDate);
			if (before > today) {
				errors.beforeDate = "Date cannot be in the future";
			}
		}

		// Validate afterDate
		if (timeRange.type === "afterDate" && timeRange.afterDate) {
			const after = new Date(timeRange.afterDate);
			if (after > today) {
				errors.afterDate = "Date cannot be in the future";
			}
		}

		return errors;
	};

	const validateRequiredFilters = (): string[] => {
		const missingSections: string[] = [];
		
		if (availableFilters.includes("team") && (playerFilters?.teams?.length || 0) === 0) {
			missingSections.push("Team");
		}
		
		if (availableFilters.includes("position") && (playerFilters?.position?.length || 0) === 0) {
			missingSections.push("Position");
		}
		
		if (availableFilters.includes("location") && (playerFilters?.location?.length || 0) === 0) {
			missingSections.push("Home vs Away");
		}
		
		if (availableFilters.includes("result") && (playerFilters?.result?.length || 0) === 0) {
			missingSections.push("Result");
		}
		
		if (availableFilters.includes("competition") && (playerFilters?.competition?.types?.length || 0) === 0) {
			missingSections.push("Competition");
		}
		
		return missingSections;
	};

	// Check if filters are valid (required filters selected and date ranges valid)
	const isFilterValid = (): boolean => {
		const missingSections = validateRequiredFilters();
		const dateErrors = validateDateRanges();
		
		return missingSections.length === 0 && Object.keys(dateErrors).length === 0;
	};

	// Get validation message explaining why filters are invalid
	const getValidationMessage = (): string | null => {
		const missingSections = validateRequiredFilters();
		const dateErrors = validateDateRanges();
		
		const messages: string[] = [];
		
		if (missingSections.length > 0) {
			messages.push(`Please select at least one option in: ${missingSections.join(", ")}`);
		}
		
		if (Object.keys(dateErrors).length > 0) {
			messages.push(`Please fix date range errors`);
		}
		
		return messages.length > 0 ? messages.join(". ") : null;
	};

	const handleApply = async () => {
		const missingSections = validateRequiredFilters();
		const dateErrors = validateDateRanges();
		
		if (missingSections.length > 0 || Object.keys(dateErrors).length > 0) {
			// Errors will be shown inline via useEffect
			return;
		}
		
		// Track start time and show progress indicator after 3 seconds
		const startTime = Date.now();
		setApplyStartTime(startTime);
		setShowProgressIndicator(false);
		
		// Check if operation takes longer than 3 seconds
		const progressCheck = setTimeout(() => {
			if (Date.now() - startTime >= 3000) {
				setShowProgressIndicator(true);
			}
		}, 3000);
		
		try {
			await applyPlayerFilters();
			// Reset snapshot and cleared flags after applying filters
			setInitialFilterSnapshot(null);
			snapshotCapturedRef.current = false;
			userClearedRef.current = {};
			setClearedState({});
			
			// Show success toast and close sidebar
			showSuccess("Filters applied successfully");
			onClose();
		} finally {
			clearTimeout(progressCheck);
			setShowProgressIndicator(false);
			setApplyStartTime(null);
		}
	};

	const handleClearAll = () => {
		if (hasActiveFilters()) {
			setShowClearAllConfirm(true);
		} else {
			// If no active filters, clear directly without confirmation
			handleClearAllConfirm();
		}
	};

	const handleClearAllConfirm = async () => {
		// Reset filters: Set all filters to defaults
		if (!playerFilters || !filterData) return;
		
		const allTeams = filterData.teams.map(team => team.name);
		userClearedRef.current.teams = false;
		userClearedRef.current.position = false;
		
		updatePlayerFilters({
			timeRange: {
				type: "allTime",
				seasons: [],
				beforeDate: "",
				afterDate: "",
				startDate: "",
				endDate: "",
			},
			teams: allTeams,
			location: ["Home", "Away"],
			opposition: {
				mode: "all",
				searchTerm: "",
			},
			competition: {
				mode: "types",
				types: ["League", "Cup", "Friendly"],
				searchTerm: "",
			},
			result: ["Win", "Draw", "Loss"],
			position: ["GK", "DEF", "MID", "FWD"],
		});
		
		await applyPlayerFilters();
		showSuccess("Filters reset");
		setShowClearAllConfirm(false);
	};

	const handleClose = () => {
		// Check if there are actual filter changes using the snapshot comparison
		if (hasFilterChanges()) {
			setShowUnsavedChangesConfirm(true);
		} else {
			onClose();
		}
	};

	const handleUnsavedChangesConfirm = () => {
		setShowUnsavedChangesConfirm(false);
		onClose();
	};

	const hasActiveFilters = () => {
		if (!playerFilters) return false;
		const { timeRange, teams, location, opposition, competition, result, position } = playerFilters;

		return (
			(timeRange?.seasons?.length || 0) > 0 ||
			(timeRange?.beforeDate || "") !== "" ||
			(timeRange?.afterDate || "") !== "" ||
			(timeRange?.startDate || "") !== "" ||
			(timeRange?.endDate || "") !== "" ||
			(teams?.length || 0) > 0 ||
			(location?.length || 2) < 2 ||
			(opposition?.mode ?? "all") !== "all" ||
			(opposition?.searchTerm || "") !== "" ||
			(competition?.mode ?? "types") !== "types" ||
			(competition?.types?.length || 3) !== 3 ||
			(competition?.searchTerm || "") !== "" ||
			(result?.length || 3) < 3 ||
			(position?.length || 4) < 4
		);
	};

	// Compare current filters with initial snapshot to detect changes
	const hasFilterChanges = (): boolean => {
		if (!playerFilters || !initialFilterSnapshot) return false;

		// Compare timeRange
		if (
			playerFilters.timeRange.type !== initialFilterSnapshot.timeRange.type ||
			JSON.stringify(playerFilters.timeRange.seasons?.sort()) !== JSON.stringify(initialFilterSnapshot.timeRange.seasons?.sort()) ||
			(playerFilters.timeRange.beforeDate || "") !== (initialFilterSnapshot.timeRange.beforeDate || "") ||
			(playerFilters.timeRange.afterDate || "") !== (initialFilterSnapshot.timeRange.afterDate || "") ||
			(playerFilters.timeRange.startDate || "") !== (initialFilterSnapshot.timeRange.startDate || "") ||
			(playerFilters.timeRange.endDate || "") !== (initialFilterSnapshot.timeRange.endDate || "")
		) {
			return true;
		}

		// Compare teams
		if (JSON.stringify((playerFilters.teams || []).sort()) !== JSON.stringify((initialFilterSnapshot.teams || []).sort())) {
			return true;
		}

		// Compare location
		if (JSON.stringify((playerFilters.location || []).sort()) !== JSON.stringify((initialFilterSnapshot.location || []).sort())) {
			return true;
		}

		// Compare opposition
		if (
			(playerFilters.opposition?.mode ?? "all") !== (initialFilterSnapshot.opposition?.mode ?? "all") ||
			(playerFilters.opposition?.searchTerm || "") !== (initialFilterSnapshot.opposition?.searchTerm || "")
		) {
			return true;
		}

		// Compare competition
		if (
			(playerFilters.competition?.mode ?? "types") !== (initialFilterSnapshot.competition?.mode ?? "types") ||
			JSON.stringify((playerFilters.competition?.types || []).sort()) !== JSON.stringify((initialFilterSnapshot.competition?.types || []).sort()) ||
			(playerFilters.competition?.searchTerm || "") !== (initialFilterSnapshot.competition?.searchTerm || "")
		) {
			return true;
		}

		// Compare result
		if (JSON.stringify((playerFilters.result || []).sort()) !== JSON.stringify((initialFilterSnapshot.result || []).sort())) {
			return true;
		}

		// Compare position
		if (JSON.stringify((playerFilters.position || []).sort()) !== JSON.stringify((initialFilterSnapshot.position || []).sort())) {
			return true;
		}

		return false;
	};

	return (
		<>
		<AnimatePresence>
			{isOpen && isMounted && (
				<>

					{/* Backdrop */}
					<motion.div
						className='fixed inset-0 bg-black/50 z-40'
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={handleClose}
					/>

					{/* Sidebar */}
					<motion.div
						data-testid="filter-sidebar"
						className='fixed right-0 top-0 h-full w-full max-w-md z-50 shadow-xl overflow-x-hidden'
						style={{ backgroundColor: '#0f0f0f' }}
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ type: "spring", stiffness: 300, damping: 30 }}>
						<div className='h-full flex flex-col overflow-x-hidden'>
							{/* Header */}
							<div className='flex items-center justify-between p-4 border-b border-[var(--color-border)]'>
								<h2 className='text-lg font-semibold text-[var(--color-text-primary)]'>Filter Options</h2>
								<div className='flex items-center space-x-2'>
									<Button
										variant="tertiary"
										size="sm"
										onClick={handleClearAll}
										className='text-sm'
										title="Reset filters to defaults">
										Reset Filters
									</Button>
									<button 
										data-testid="filter-sidebar-close" 
										onClick={handleClose} 
										className='min-w-[44px] min-h-[44px] p-3 flex items-center justify-center text-[var(--color-text-primary)]/60 hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent' 
										aria-label='Close filter sidebar'
										title="Close filters">
										<XMarkIcon className='w-5 h-5' />
									</button>
								</div>
							</div>

							{/* Filter Content */}
							<div 
								className='flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2'
								style={{ WebkitOverflowScrolling: 'touch' }}>
								{/* Filter Presets */}
								{isFilterDataLoaded && filterData && filterData.seasons.length > 0 && (
									<div className='border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)]/50 p-4 mb-2'>
										<label className='block text-sm font-medium text-[var(--color-text-primary)]/90 mb-2'>Quick Filters</label>
										<div className='grid grid-cols-2 gap-2'>
											<Button
												variant="tertiary"
												size="sm"
												onClick={() => applyPreset("thisSeason")}
												className='text-sm'>
												This Season
											</Button>
											<Button
												variant="tertiary"
												size="sm"
												onClick={() => applyPreset("allTime")}
												className='text-sm'>
												All Time
											</Button>
											<Button
												variant="tertiary"
												size="sm"
												onClick={() => applyPreset("last30Days")}
												className='text-sm'>
												Last 30 Days
											</Button>
											<Button
												variant="tertiary"
												size="sm"
												onClick={() => applyPreset("lastSeason")}
												className='text-sm'>
												Last Season
											</Button>
										</div>
									</div>
								)}

								{/* Time Range Section */}
								{availableFilters.includes("timeRange") && (
									<div className={`border rounded-lg bg-[var(--color-surface)]/50 ${validationErrors.timeRange ? 'border-red-500/50' : 'border-[var(--color-border)]'}`} data-testid="filter-timeRange">
									<button
										onClick={() => toggleAccordion("timeRange")}
										className='w-full flex items-center justify-between p-4 text-left hover:bg-[var(--color-surface)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'>
										<div className='flex items-center gap-2'>
											<span className='font-medium text-[var(--color-text-primary)]'>Time Range</span>
											{validationErrors.timeRange && (
												<ExclamationTriangleIcon className='w-5 h-5 text-red-400' aria-label="Validation error" />
											)}
										</div>
										{accordionSections.find((s) => s.id === "timeRange")?.isOpen ? (
											<ChevronUpIcon className='w-5 h-5 text-[var(--color-text-primary)]/60' />
										) : (
											<ChevronDownIcon className='w-5 h-5 text-[var(--color-text-primary)]/60' />
										)}
									</button>

									{accordionSections.find((s) => s.id === "timeRange")?.isOpen && (
										<div className='px-4 pb-4 space-y-2'>
											{/* Time Range Type Selection */}
											<div className='space-y-1'>
												<label className='block text-sm font-medium text-[var(--color-text-primary)]/90'>Time Range Type</label>
												<div className='space-y-1'>
													{[
														{ value: "allTime", label: "All Time" },
														{ value: "season", label: "Season" },
														{ value: "beforeDate", label: "Before Date" },
														{ value: "afterDate", label: "After Date" },
														{ value: "betweenDates", label: "Between Dates" },
													].map((option) => (
														<label key={option.value} className='flex items-center min-h-[36px]'>
															<input
																type='radio'
																name='timeRangeType'
																value={option.value}
																checked={(playerFilters?.timeRange?.type || "allTime") === option.value}
																onChange={() => handleTimeRangeTypeChange(option.value as any)}
																className='mr-2 accent-dorkinians-yellow w-5 h-5 md:w-4 md:h-4 focus:outline-none focus:ring-2 focus:ring-[var(--color-field-focus)] focus:ring-offset-2 focus:ring-offset-transparent'
															/>
															<span className='text-base md:text-sm text-[var(--color-text-primary)]/80'>{option.label}</span>
														</label>
													))}
												</div>
											</div>

											{/* Season Selection */}
											{(playerFilters?.timeRange?.type || "allTime") === "season" && (
												<div className='space-y-1'>
													<label className='block text-sm font-medium text-[var(--color-text-primary)]/90'>Seasons</label>
													{filterData.seasons.length === 0 ? (
														<div className='text-sm text-[var(--color-text-primary)]/60'>Loading seasons...</div>
													) : (
														<div 
															className='max-h-32 overflow-y-scroll'
															style={{
																scrollbarWidth: 'thin',
																scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent'
															}}>
															<div className='grid grid-cols-2 gap-1'>
																{filterData.seasons.map((season) => (
																	<label key={season.season} className='flex items-center min-h-[36px]'>
																		<input
																			type='checkbox'
																			checked={(playerFilters?.timeRange?.seasons || []).includes(season.season)}
																			onChange={() => handleSeasonToggle(season.season)}
																			className='mr-2 accent-dorkinians-yellow w-5 h-5 md:w-4 md:h-4 focus:outline-none focus:ring-2 focus:ring-[var(--color-field-focus)] focus:ring-offset-2 focus:ring-offset-transparent'
																		/>
																		<span className='text-base md:text-sm text-[var(--color-text-primary)]/80'>{season.season}</span>
																	</label>
																))}
															</div>
														</div>
													)}
												</div>
											)}

											{/* Date Inputs */}
											{(playerFilters?.timeRange?.type || "allTime") === "beforeDate" && (
												<div className='space-y-1'>
													<Input
														type='date'
														label='Before Date'
														value={playerFilters?.timeRange?.beforeDate || ""}
														onChange={(e) =>
															updatePlayerFilters({
																timeRange: { 
																	...(playerFilters?.timeRange || {
																		type: "beforeDate",
																		seasons: [],
																		beforeDate: "",
																		afterDate: "",
																		startDate: "",
																		endDate: "",
																	}), 
																	beforeDate: e.target.value 
																},
															})
														}
														size="md"
														className='w-full max-w-full'
													/>
													{dateValidationErrors.beforeDate && (
														<p className='text-sm text-red-400 mt-1'>{dateValidationErrors.beforeDate}</p>
													)}
												</div>
											)}

											{(playerFilters?.timeRange?.type || "allTime") === "afterDate" && (
												<div className='space-y-1'>
													<Input
														type='date'
														label='After Date'
														value={playerFilters?.timeRange?.afterDate || ""}
														onChange={(e) =>
															updatePlayerFilters({
																timeRange: { 
																	...(playerFilters?.timeRange || {
																		type: "afterDate",
																		seasons: [],
																		beforeDate: "",
																		afterDate: "",
																		startDate: "",
																		endDate: "",
																	}), 
																	afterDate: e.target.value 
																},
															})
														}
														size="sm"
														className='w-full max-w-full'
													/>
													{dateValidationErrors.afterDate && (
														<p className='text-sm text-red-400 mt-1'>{dateValidationErrors.afterDate}</p>
													)}
												</div>
											)}

											{(playerFilters?.timeRange?.type || "allTime") === "betweenDates" && (
												<div className='space-y-1'>
													<div className='space-y-1'>
														<Input
															type='date'
															label='Start Date'
															value={playerFilters?.timeRange?.startDate || ""}
															onChange={(e) =>
																updatePlayerFilters({
																	timeRange: { 
																		...(playerFilters?.timeRange || {
																			type: "betweenDates",
																			seasons: [],
																			beforeDate: "",
																			afterDate: "",
																			startDate: "",
																			endDate: "",
																		}), 
																		startDate: e.target.value 
																	},
																})
															}
															size="sm"
															className='w-full max-w-[200px]'
														/>
														{dateValidationErrors.startDate && (
															<p className='text-sm text-red-400 mt-1'>{dateValidationErrors.startDate}</p>
														)}
													</div>
													<div className='space-y-1'>
														<Input
															type='date'
															label='End Date'
															value={playerFilters?.timeRange?.endDate || ""}
															onChange={(e) =>
																updatePlayerFilters({
																	timeRange: { 
																		...(playerFilters?.timeRange || {
																			type: "betweenDates",
																			seasons: [],
																			beforeDate: "",
																			afterDate: "",
																			startDate: "",
																			endDate: "",
																		}), 
																		endDate: e.target.value 
																	},
																})
															}
															size="md"
															className='w-full max-w-[200px]'
														/>
														{dateValidationErrors.endDate && (
															<p className='text-sm text-red-400 mt-1'>{dateValidationErrors.endDate}</p>
														)}
													</div>
												</div>
											)}
											{/* Inline validation error for Time Range */}
											{validationErrors.timeRange && (
												<div className='px-4 pb-2 pt-2'>
													<p className='text-sm text-red-400 flex items-center gap-1'>
														<ExclamationTriangleIcon className='w-4 h-4' />
														{validationErrors.timeRange}
													</p>
												</div>
											)}
										</div>
									)}
									</div>
								)}

								{/* Team Section */}
								{availableFilters.includes("team") && (
									<div className={`border rounded-lg bg-[var(--color-surface)]/50 ${validationErrors.team ? 'border-red-500/50' : 'border-[var(--color-border)]'}`} data-testid="filter-team">
									<button
										onClick={() => toggleAccordion("team")}
										className='w-full flex items-center justify-between p-4 text-left hover:bg-[var(--color-surface)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'>
										<div className='flex items-center gap-2'>
											<span className='font-medium text-[var(--color-text-primary)]'>Team</span>
											{validationErrors.team && (
												<ExclamationTriangleIcon className='w-5 h-5 text-red-400' aria-label="Validation error" />
											)}
										</div>
										{accordionSections.find((s) => s.id === "team")?.isOpen ? (
											<ChevronUpIcon className='w-5 h-5 text-[var(--color-text-primary)]/60' />
										) : (
											<ChevronDownIcon className='w-5 h-5 text-[var(--color-text-primary)]/60' />
										)}
									</button>

									{accordionSections.find((s) => s.id === "team")?.isOpen && (
										<div className='px-4 pb-4'>
											{filterData.teams.length === 0 ? (
												<div className='text-sm text-[var(--color-text-primary)]/60'>Loading teams...</div>
											) : (
												<>
													<div className='grid grid-cols-2 gap-2 mb-3'>
														{filterData.teams.map((team) => (
															<label key={team.name} className='flex items-center min-h-[36px]'>
																<input
																	type='checkbox'
																	checked={(playerFilters?.teams || []).includes(team.name)}
																	onChange={() => handleTeamToggle(team.name)}
																	className='mr-2 accent-dorkinians-yellow w-5 h-5 md:w-4 md:h-4 focus:outline-none focus:ring-2 focus:ring-[var(--color-field-focus)] focus:ring-offset-2 focus:ring-offset-transparent'
																/>
																<span className='text-base md:text-sm text-[var(--color-text-primary)]/80'>{team.name}</span>
															</label>
														))}
													</div>
													<div className='flex gap-2'>
														<button
															type='button'
															onClick={handleTeamCheckAll}
															className='flex-1 px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]/80 bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'>
															Check all
														</button>
														<button
															type='button'
															onClick={handleTeamClearAll}
															className='flex-1 px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]/80 bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'>
															Clear all
														</button>
													</div>
												</>
											)}
											{/* Inline validation error for Team */}
											{validationErrors.team && (
												<div className='px-4 pb-0 pt-4'>
													<p className='text-sm text-red-400 flex items-center gap-1'>
														<ExclamationTriangleIcon className='w-4 h-4' />
														{validationErrors.team}
													</p>
												</div>
											)}
										</div>
									)}
									</div>
								)}

								{/* Location Section */}
								{availableFilters.includes("location") && (
									<div className={`border rounded-lg bg-[var(--color-surface)]/50 ${validationErrors.location ? 'border-red-500/50' : 'border-[var(--color-border)]'}`} data-testid="filter-location">
									<button
										onClick={() => toggleAccordion("location")}
										className='w-full flex items-center justify-between p-4 text-left hover:bg-[var(--color-surface)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'>
										<div className='flex items-center gap-2'>
											<span className='font-medium text-[var(--color-text-primary)]'>Home vs Away</span>
											{validationErrors.location && (
												<ExclamationTriangleIcon className='w-5 h-5 text-red-400' aria-label="Validation error" />
											)}
										</div>
										{accordionSections.find((s) => s.id === "location")?.isOpen ? (
											<ChevronUpIcon className='w-5 h-5 text-[var(--color-text-primary)]/60' />
										) : (
											<ChevronDownIcon className='w-5 h-5 text-[var(--color-text-primary)]/60' />
										)}
									</button>

									{accordionSections.find((s) => s.id === "location")?.isOpen && (
										<div className='px-4 pb-4'>
											<div className='grid grid-cols-2 gap-2'>
												{["Home", "Away"].map((location) => (
													<label key={location} className='flex items-center min-h-[36px]'>
														<input
															type='checkbox'
															checked={(playerFilters?.location || []).includes(location as "Home" | "Away")}
															onChange={() => handleLocationToggle(location as "Home" | "Away")}
															className='mr-2 accent-dorkinians-yellow w-5 h-5 md:w-4 md:h-4'
														/>
														<span className='text-base md:text-sm text-[var(--color-text-primary)]/80'>{location}</span>
													</label>
												))}
											</div>
											{/* Inline validation error for Location */}
											{validationErrors.location && (
												<div className='px-4 pb-0 pt-4'>
													<p className='text-sm text-red-400 flex items-center gap-1'>
														<ExclamationTriangleIcon className='w-4 h-4' />
														{validationErrors.location}
													</p>
												</div>
											)}
										</div>
									)}
									</div>
								)}

								{/* Opposition Section */}
								{availableFilters.includes("opposition") && (
									<div className='border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)]/50' data-testid="filter-opposition">
									<button
										onClick={() => toggleAccordion("opposition")}
										className='w-full flex items-center justify-between p-4 text-left hover:bg-[var(--color-surface)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'>
										<span className='font-medium text-[var(--color-text-primary)]'>Opposition</span>
										{accordionSections.find((s) => s.id === "opposition")?.isOpen ? (
											<ChevronUpIcon className='w-5 h-5 text-[var(--color-text-primary)]/60' />
										) : (
											<ChevronDownIcon className='w-5 h-5 text-[var(--color-text-primary)]/60' />
										)}
									</button>

									{accordionSections.find((s) => s.id === "opposition")?.isOpen && (
										<div className='px-4 pb-4 space-y-1.5'>
											<label className='flex items-center min-h-[36px]'>
												<input
													type='radio'
													name='oppositionMode'
													checked={(playerFilters?.opposition?.mode ?? "all") === "all"}
													onChange={() =>
														updatePlayerFilters({
															opposition: { 
																...(playerFilters?.opposition || { mode: "all", searchTerm: "" }), 
																mode: "all",
																searchTerm: ""
															},
														})
													}
													className='mr-2 accent-dorkinians-yellow w-5 h-5 md:w-4 md:h-4'
												/>
												<span className='text-base md:text-sm text-[var(--color-text-primary)]/80'>All Opposition</span>
											</label>

											<label className='flex items-center min-h-[36px]'>
												<input
													type='radio'
													name='oppositionMode'
													checked={(playerFilters?.opposition?.mode ?? "all") === "club"}
													onChange={() =>
														updatePlayerFilters({
															opposition: { 
																...(playerFilters?.opposition || { mode: "all", searchTerm: "" }), 
																mode: "club"
															},
														})
													}
													className='mr-2 accent-dorkinians-yellow w-5 h-5 md:w-4 md:h-4'
												/>
												<span className='text-base md:text-sm text-[var(--color-text-primary)]/80'>Individual Club</span>
											</label>

											<label className='flex items-center min-h-[36px]'>
												<input
													type='radio'
													name='oppositionMode'
													checked={(playerFilters?.opposition?.mode ?? "all") === "team"}
													onChange={() =>
														updatePlayerFilters({
															opposition: { 
																...(playerFilters?.opposition || { mode: "all", searchTerm: "" }), 
																mode: "team"
															},
														})
													}
													className='mr-2 accent-dorkinians-yellow w-5 h-5 md:w-4 md:h-4'
												/>
												<span className='text-base md:text-sm text-[var(--color-text-primary)]/80'>Individual Team</span>
											</label>

											<div className='relative'>
												<Input
													type='text'
													label='Search Opposition'
													placeholder={(playerFilters?.opposition?.mode ?? "all") === "club" ? 'Search clubs...' : 'Search opposition teams...'}
													value={playerFilters?.opposition?.searchTerm || ""}
													onChange={(e) => handleOppositionSearch(e.target.value)}
													onKeyDown={handleOppositionKeyDown}
													onFocus={() => {
														setShowOppositionDropdown(true);
														setOppositionHighlightedIndex(-1);
													}}
													onBlur={() => {
														setTimeout(() => {
															setShowOppositionDropdown(false);
															setOppositionHighlightedIndex(-1);
														}, 200);
													}}
													disabled={(playerFilters?.opposition?.mode ?? "all") === "all"}
													aria-disabled={(playerFilters?.opposition?.mode ?? "all") === "all"}
													size="md"
													className='w-full'
												/>
												{showOppositionDropdown && (playerFilters?.opposition?.mode ?? "all") !== "all" && (
													<div ref={oppositionDropdownRef} className='absolute z-50 w-full mt-1 bg-[var(--color-surface)] backdrop-blur-sm border border-[var(--color-border)] rounded-md max-h-48 overflow-y-auto'>
														{(playerFilters?.opposition?.mode ?? "all") === "club" ? (
															filteredOppositionClubs.length > 0 ? (
																filteredOppositionClubs.map((club, index) => (
																	<button
																		key={club.shortTeamName}
																		type='button'
																		onClick={() => handleOppositionSelect(club.shortTeamName)}
																		onMouseEnter={() => setOppositionHighlightedIndex(index)}
																		className={`w-full text-left px-3 py-2 text-base md:text-sm text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
																			index === oppositionHighlightedIndex 
																				? 'bg-[var(--color-surface-elevated)]' 
																				: 'hover:bg-[var(--color-surface-elevated)]'
																		}`}
																	>
																		{club.shortTeamName}
																	</button>
																))
															) : (
																<div className='px-3 py-2 text-base md:text-sm text-[var(--color-text-primary)]/60 text-center'>
																	No results found
																</div>
															)
														) : (
															filteredOpposition.length > 0 ? (
																filteredOpposition.map((opp, index) => (
																	<button
																		key={opp.name}
																		type='button'
																		onClick={() => handleOppositionSelect(opp.name)}
																		onMouseEnter={() => setOppositionHighlightedIndex(index)}
																		className={`w-full text-left px-3 py-2 text-base md:text-sm text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
																			index === oppositionHighlightedIndex 
																				? 'bg-[var(--color-surface-elevated)]' 
																				: 'hover:bg-[var(--color-surface-elevated)]'
																		}`}
																	>
																		{opp.name}
																	</button>
																))
															) : (
																<div className='px-3 py-2 text-base md:text-sm text-[var(--color-text-primary)]/60 text-center'>
																	No results found
																</div>
															)
														)}
													</div>
												)}
											</div>
										</div>
									)}
									</div>
								)}

								{/* Competition Section */}
								{availableFilters.includes("competition") && (
									<div className={`border rounded-lg bg-[var(--color-surface)]/50 ${validationErrors.competition ? 'border-red-500/50' : 'border-[var(--color-border)]'}`} data-testid="filter-competition">
									<button
										onClick={() => toggleAccordion("competition")}
										className='w-full flex items-center justify-between p-4 text-left hover:bg-[var(--color-surface)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'>
										<div className='flex items-center gap-2'>
											<span className='font-medium text-[var(--color-text-primary)]'>Competition</span>
											{validationErrors.competition && (
												<ExclamationTriangleIcon className='w-5 h-5 text-red-400' aria-label="Validation error" />
											)}
										</div>
										{accordionSections.find((s) => s.id === "competition")?.isOpen ? (
											<ChevronUpIcon className='w-5 h-5 text-[var(--color-text-primary)]/60' />
										) : (
											<ChevronDownIcon className='w-5 h-5 text-[var(--color-text-primary)]/60' />
										)}
									</button>

									{accordionSections.find((s) => s.id === "competition")?.isOpen && (
										<div className='px-4 pb-4 space-y-1.5'>
											<div>
												<label className='block text-base md:text-sm font-medium text-[var(--color-text-primary)]/90 mb-0.5'>Competition Types</label>
												<div className='grid grid-cols-2 gap-1'>
													{["League", "Cup", "Friendly"].map((type) => (
														<label key={type} className='flex items-center min-h-[36px]'>
															<input
																type='checkbox'
																checked={(playerFilters?.competition?.types || []).includes(type as any)}
																onChange={() => handleCompetitionTypeToggle(type as any)}
																disabled={(playerFilters?.competition?.mode ?? "types") === "individual"}
																aria-disabled={(playerFilters?.competition?.mode ?? "types") === "individual"}
																className='mr-2 accent-dorkinians-yellow w-5 h-5 md:w-4 md:h-4 focus:outline-none focus:ring-2 focus:ring-[var(--color-field-focus)] focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed'
															/>
															<span className='text-base md:text-sm text-[var(--color-text-primary)]/80'>{type}</span>
														</label>
													))}
												</div>
											</div>

											<div>
												<label className='block text-base md:text-sm font-medium text-[var(--color-text-primary)]/90 mb-0.5 mt-2'>Competition Name</label>
												<label className='flex items-center min-h-[36px]'>
													<input
														type='checkbox'
														checked={(playerFilters?.competition?.mode ?? "types") === "individual"}
														onChange={(e) => {
															const newMode = e.target.checked ? "individual" : "types";
															updatePlayerFilters({
																competition: {
																	...(playerFilters?.competition || { mode: "types", types: ["League", "Cup", "Friendly"], searchTerm: "" }),
																	mode: newMode,
																	searchTerm: newMode === "types" ? "" : (playerFilters?.competition?.searchTerm || ""),
																},
															});
														}}
														className='mr-2 accent-dorkinians-yellow w-5 h-5 md:w-4 md:h-4'
													/>
													<span className='text-base md:text-sm text-[var(--color-text-primary)]/80'>Individual Competition</span>
												</label>
											</div>

											<div className='relative'>
												<Input
													type='text'
													label='Search Competition'
													placeholder='Search competitions...'
													value={playerFilters?.competition?.searchTerm || ""}
													onChange={(e) => handleCompetitionSearch(e.target.value)}
													onKeyDown={handleCompetitionKeyDown}
													onFocus={() => {
														setShowCompetitionDropdown(true);
														setCompetitionHighlightedIndex(-1);
													}}
													onBlur={() => {
														setTimeout(() => {
															setShowCompetitionDropdown(false);
															setCompetitionHighlightedIndex(-1);
														}, 200);
													}}
													disabled={(playerFilters?.competition?.mode ?? "types") === "types"}
													aria-disabled={(playerFilters?.competition?.mode ?? "types") === "types"}
													size="md"
													className='w-full'
												/>
												{showCompetitionDropdown && (playerFilters?.competition?.mode ?? "types") === "individual" && (
													<div ref={competitionDropdownRef} className='absolute z-50 w-full mt-1 bg-[var(--color-surface)] backdrop-blur-sm border border-[var(--color-border)] rounded-md max-h-48 overflow-y-auto'>
														{filteredCompetitions.length > 0 ? (
															filteredCompetitions.map((comp, index) => (
																<button
																	key={`${comp.name}-${comp.type}-${index}`}
																	type='button'
																	onClick={() => handleCompetitionSelect(comp.name)}
																	onMouseEnter={() => setCompetitionHighlightedIndex(index)}
																	className={`w-full text-left px-3 py-2 text-base md:text-sm text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
																		index === competitionHighlightedIndex 
																			? 'bg-[var(--color-surface-elevated)]' 
																			: 'hover:bg-[var(--color-surface-elevated)]'
																	}`}
																>
																	{comp.name}
																</button>
															))
														) : (
															<div className='px-3 py-2 text-base md:text-sm text-[var(--color-text-primary)]/60 text-center'>
																No results found
															</div>
														)}
													</div>
												)}
											</div>
											{/* Inline validation error for Competition */}
											{validationErrors.competition && (
												<div className='px-4 pb-0 pt-4'>
													<p className='text-sm text-red-400 flex items-center gap-1'>
														<ExclamationTriangleIcon className='w-4 h-4' />
														{validationErrors.competition}
													</p>
												</div>
											)}
										</div>
									)}
									</div>
								)}

								{/* Result Section */}
								{availableFilters.includes("result") && (
									<div className={`border rounded-lg bg-[var(--color-surface)]/50 ${validationErrors.result ? 'border-red-500/50' : 'border-[var(--color-border)]'}`} data-testid="filter-result">
									<button
										onClick={() => toggleAccordion("result")}
										className='w-full flex items-center justify-between p-4 text-left hover:bg-[var(--color-surface)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'>
										<div className='flex items-center gap-2'>
											<span className='font-medium text-[var(--color-text-primary)]'>Result</span>
											{validationErrors.result && (
												<ExclamationTriangleIcon className='w-5 h-5 text-red-400' aria-label="Validation error" />
											)}
										</div>
										{accordionSections.find((s) => s.id === "result")?.isOpen ? (
											<ChevronUpIcon className='w-5 h-5 text-[var(--color-text-primary)]/60' />
										) : (
											<ChevronDownIcon className='w-5 h-5 text-[var(--color-text-primary)]/60' />
										)}
									</button>

									{accordionSections.find((s) => s.id === "result")?.isOpen && (
										<div className='px-4 pb-4'>
											<div className='grid grid-cols-2 gap-1'>
												{["Win", "Draw", "Loss"].map((result) => (
													<label key={result} className='flex items-center min-h-[36px]'>
														<input
															type='checkbox'
															checked={(playerFilters?.result || []).includes(result as any)}
															onChange={() => handleResultToggle(result as any)}
															className='mr-2 accent-dorkinians-yellow w-5 h-5 md:w-4 md:h-4'
														/>
														<span className='text-base md:text-sm text-[var(--color-text-primary)]/80'>{result}</span>
													</label>
												))}
											</div>
											{/* Inline validation error for Result */}
											{validationErrors.result && (
												<div className='px-4 pb-0 pt-4'>
													<p className='text-sm text-red-400 flex items-center gap-1'>
														<ExclamationTriangleIcon className='w-4 h-4' />
														{validationErrors.result}
													</p>
												</div>
											)}
										</div>
									)}
									</div>
								)}

								{/* Position Section */}
								{availableFilters.includes("position") && (
									<div className={`border rounded-lg bg-[var(--color-surface)]/50 ${validationErrors.position ? 'border-red-500/50' : 'border-[var(--color-border)]'}`} data-testid="filter-position">
									<button
										onClick={() => toggleAccordion("position")}
										className='w-full flex items-center justify-between p-4 text-left hover:bg-[var(--color-surface)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'>
										<div className='flex items-center gap-2'>
											<span className='font-medium text-[var(--color-text-primary)]'>Position</span>
											{validationErrors.position && (
												<ExclamationTriangleIcon className='w-5 h-5 text-red-400' aria-label="Validation error" />
											)}
										</div>
										{accordionSections.find((s) => s.id === "position")?.isOpen ? (
											<ChevronUpIcon className='w-5 h-5 text-[var(--color-text-primary)]/60' />
										) : (
											<ChevronDownIcon className='w-5 h-5 text-[var(--color-text-primary)]/60' />
										)}
									</button>

									{accordionSections.find((s) => s.id === "position")?.isOpen && (
										<div className='px-4 pb-4'>
											<div className='grid grid-cols-2 gap-1 mb-3'>
												{[
													{ value: "GK", label: "Goalkeeper" },
													{ value: "DEF", label: "Defender" },
													{ value: "MID", label: "Midfielder" },
													{ value: "FWD", label: "Forward" },
												].map((position) => (
													<label key={position.value} className='flex items-center min-h-[36px]'>
														<input
															type='checkbox'
															checked={(playerFilters?.position || []).includes(position.value as any)}
															onChange={() => handlePositionToggle(position.value as any)}
															className='mr-2 accent-dorkinians-yellow w-5 h-5 md:w-4 md:h-4'
														/>
														<span className='text-base md:text-sm text-[var(--color-text-primary)]/80'>
															{position.label}
														</span>
													</label>
												))}
											</div>
											<div className='flex gap-2'>
												<Button
													variant="tertiary"
													size="sm"
													onClick={handlePositionCheckAll}
													fullWidth
													className="flex-1">
													Check all
												</Button>
												<Button
													variant="tertiary"
													size="sm"
													onClick={handlePositionClearAll}
													fullWidth
													className="flex-1">
													Clear all
												</Button>
											</div>
										</div>
									)}
									</div>
								)}
							</div>

							{/* Footer */}
							<div className='border-t border-[var(--color-border)] p-4' style={{ marginBottom: '10px' }}>
								{showProgressIndicator && (
									<div className='mb-3'>
										<ProgressIndicator 
											isVisible={showProgressIndicator}
											size="md"
										/>
									</div>
								)}
								<div className='flex space-x-3'>
									<Button
										variant="tertiary"
										size="md"
										onClick={handleClose}
										className='flex-1'>
										Close
									</Button>
									<div className="relative flex-1">
										<Button
											variant="secondary"
											size="md"
											onClick={handleApply}
											disabled={!hasFilterChanges() || !isFilterValid()}
											className='w-full whitespace-nowrap'
											title={!isFilterValid() ? getValidationMessage() || "Please fix validation errors" : undefined}>
											Apply Filters
										</Button>
										{!isFilterValid() && !hasFilterChanges() && (
											<p className="text-xs text-red-400 mt-1 text-center">{getValidationMessage()}</p>
										)}
									</div>
								</div>
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
		{/* Clear All Confirmation Modal */}
		<ConfirmModal
			isOpen={showClearAllConfirm}
			onClose={() => setShowClearAllConfirm(false)}
			onConfirm={handleClearAllConfirm}
			title="Confirm"
			message="Are you sure you want to reset filters to defaults (All Time, All Teams)?"
		/>
		{/* Unsaved Changes Confirmation Modal */}
		<ConfirmModal
			isOpen={showUnsavedChangesConfirm}
			onClose={() => setShowUnsavedChangesConfirm(false)}
			onConfirm={handleUnsavedChangesConfirm}
			title="Unsaved Changes"
			message="You have unsaved filter changes. Are you sure you want to close without applying them?"
		/>
		</>
	);
}
