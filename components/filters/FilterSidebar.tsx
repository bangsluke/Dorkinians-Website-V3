"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon, CheckIcon } from "@heroicons/react/24/outline";
import { useNavigationStore, type PlayerFilters } from "@/lib/stores/navigation";
import { statsPageConfig } from "@/config/config";

interface FilterSidebarProps {
	isOpen: boolean;
	onClose: () => void;
}

interface AccordionSection {
	id: string;
	title: string;
	isOpen: boolean;
}

export default function FilterSidebar({ isOpen, onClose }: FilterSidebarProps) {
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

	// State for autocomplete dropdowns
	const [showOppositionDropdown, setShowOppositionDropdown] = useState(false);
	const [showCompetitionDropdown, setShowCompetitionDropdown] = useState(false);
	
	// State to track initial filter state when sidebar opens
	const [initialFilterSnapshot, setInitialFilterSnapshot] = useState<PlayerFilters | null>(null);
	// Ref to track if snapshot has been captured for current sidebar opening
	const snapshotCapturedRef = useRef(false);
	// Ref to track user-initiated clears to prevent auto-initialization
	const userClearedRef = useRef<{ teams?: boolean; position?: boolean }>({});
	// State for validation warning modal
	const [validationWarning, setValidationWarning] = useState<string[] | null>(null);

	// Get available filters for current page
	const availableFilters: string[] = useMemo(() => {
		const config = statsPageConfig[currentStatsSubPage];
		return config?.availableFilters ? [...config.availableFilters] : [];
	}, [currentStatsSubPage]);

	// All possible accordion sections
	const allAccordionSections: AccordionSection[] = useMemo(
		() => [
			{ id: "timeRange", title: "Time Range", isOpen: true },
			{ id: "team", title: "Team", isOpen: false },
			{ id: "location", title: "Location", isOpen: false },
			{ id: "opposition", title: "Opposition", isOpen: false },
			{ id: "competition", title: "Competition", isOpen: false },
			{ id: "result", title: "Result", isOpen: false },
			{ id: "position", title: "Position", isOpen: false },
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

	// Load filter data on mount if not already loaded
	useEffect(() => {
		if (isOpen && !isFilterDataLoaded) {
			loadFilterData();
		}
	}, [isOpen, isFilterDataLoaded, loadFilterData]);

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
					...(playerFilters.competition || { types: [], searchTerm: "" }),
					types: ["League", "Cup", "Friendly"],
				};
				needsUpdate = true;
			}

			if (needsUpdate) {
				updatePlayerFilters(updates);
			}
		}
	}, [isOpen, isFilterDataLoaded, filterData, playerFilters, updatePlayerFilters]);

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
					allOpposition: playerFilters.opposition?.allOpposition ?? true,
					searchTerm: playerFilters.opposition?.searchTerm || "",
				},
				competition: {
					types: [...competitionTypesForSnapshot],
					searchTerm: playerFilters.competition?.searchTerm || "",
				},
				result: [...(playerFilters.result || [])],
				position: [...positionForSnapshot],
			};
			setInitialFilterSnapshot(snapshot);
			snapshotCapturedRef.current = true;
		} else if (!isOpen) {
			// Clear snapshot and reset refs when sidebar closes
			setInitialFilterSnapshot(null);
			snapshotCapturedRef.current = false;
			userClearedRef.current = {};
			setValidationWarning(null);
		}
	}, [isOpen, isFilterDataLoaded, filterData, playerFilters]);

	const toggleAccordion = (sectionId: string) => {
		setAccordionSections((prev) => prev.map((section) => (section.id === sectionId ? { ...section, isOpen: !section.isOpen } : section)));
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
				...(playerFilters.opposition || { allOpposition: true, searchTerm: "" }),
				searchTerm,
			},
		});
		setShowOppositionDropdown(true);
	};

	// Filter opposition based on search term
	const filteredOpposition = useMemo(() => {
		if (!filterData?.opposition) return [];
		const searchTerm = (playerFilters?.opposition?.searchTerm || "").toLowerCase();
		if (!searchTerm) {
			return filterData.opposition.slice(0, 50); // Show all options (limited to 50) when searchTerm is empty
		}
		return filterData.opposition
			.filter(opp => opp.name.toLowerCase().includes(searchTerm))
			.slice(0, 50); // Limit to 50 results
	}, [filterData?.opposition, playerFilters?.opposition?.searchTerm]);

	const handleOppositionSelect = (oppositionName: string) => {
		if (!playerFilters) return;
		updatePlayerFilters({
			opposition: {
				...(playerFilters.opposition || { allOpposition: true, searchTerm: "" }),
				searchTerm: oppositionName,
			},
		});
		setShowOppositionDropdown(false);
	};

	const handleCompetitionSearch = (searchTerm: string) => {
		if (!playerFilters) return;
		updatePlayerFilters({
			competition: {
				...(playerFilters.competition || { types: ["League", "Cup", "Friendly"], searchTerm: "" }),
				searchTerm,
			},
		});
		setShowCompetitionDropdown(true);
	};

	// Filter competitions based on search term
	const filteredCompetitions = useMemo(() => {
		if (!filterData?.competitions) return [];
		const searchTerm = (playerFilters?.competition?.searchTerm || "").toLowerCase();
		if (!searchTerm) {
			return filterData.competitions.slice(0, 50); // Show all options (limited to 50) when searchTerm is empty
		}
		return filterData.competitions
			.filter(comp => comp.name.toLowerCase().includes(searchTerm))
			.slice(0, 50); // Limit to 50 results
	}, [filterData?.competitions, playerFilters?.competition?.searchTerm]);

	const handleCompetitionSelect = (competitionName: string) => {
		if (!playerFilters) return;
		updatePlayerFilters({
			competition: {
				...(playerFilters.competition || { types: ["League", "Cup", "Friendly"], searchTerm: "" }),
				searchTerm: competitionName,
			},
		});
		setShowCompetitionDropdown(false);
	};

	const handleCompetitionTypeToggle = (type: "League" | "Cup" | "Friendly") => {
		if (!playerFilters) return;
		const currentTypes = playerFilters.competition?.types || [];
		const newTypes = currentTypes.includes(type) ? currentTypes.filter((t) => t !== type) : [...currentTypes, type];

		updatePlayerFilters({
			competition: {
				...(playerFilters.competition || { types: ["League", "Cup", "Friendly"], searchTerm: "" }),
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

	const validateRequiredFilters = (): string[] => {
		const missingSections: string[] = [];
		
		if (availableFilters.includes("team") && (playerFilters?.teams?.length || 0) === 0) {
			missingSections.push("Team");
		}
		
		if (availableFilters.includes("position") && (playerFilters?.position?.length || 0) === 0) {
			missingSections.push("Position");
		}
		
		if (availableFilters.includes("location") && (playerFilters?.location?.length || 0) === 0) {
			missingSections.push("Location");
		}
		
		if (availableFilters.includes("result") && (playerFilters?.result?.length || 0) === 0) {
			missingSections.push("Result");
		}
		
		if (availableFilters.includes("competition") && (playerFilters?.competition?.types?.length || 0) === 0) {
			missingSections.push("Competition");
		}
		
		return missingSections;
	};

	const handleApply = async () => {
		const missingSections = validateRequiredFilters();
		
		if (missingSections.length > 0) {
			setValidationWarning(missingSections);
			return;
		}
		
		await applyPlayerFilters();
		// Reset snapshot and cleared flags after applying filters
		setInitialFilterSnapshot(null);
		snapshotCapturedRef.current = false;
		userClearedRef.current = {};
	};

	const handleReset = () => {
		resetPlayerFilters();
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
			!opposition?.allOpposition ||
			(opposition?.searchTerm || "") !== "" ||
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
			(playerFilters.opposition?.allOpposition ?? true) !== (initialFilterSnapshot.opposition?.allOpposition ?? true) ||
			(playerFilters.opposition?.searchTerm || "") !== (initialFilterSnapshot.opposition?.searchTerm || "")
		) {
			return true;
		}

		// Compare competition
		if (
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
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Validation Warning Modal */}
					{validationWarning && (
						<>
							<motion.div
								className='fixed inset-0 bg-black/70 z-[60]'
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								onClick={() => setValidationWarning(null)}
							/>
							<motion.div
								className='fixed inset-0 z-[70] flex items-center justify-center p-4'
								initial={{ opacity: 0, scale: 0.9 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.9 }}
								onClick={(e) => e.stopPropagation()}>
								<div className='bg-[#0f0f0f] border border-white/20 rounded-lg p-6 max-w-md w-full'>
									<h3 className='text-lg font-semibold text-white mb-4'>Missing Required Filters</h3>
									<p className='text-white/80 mb-4'>
										You must select at least one option from each section. The following sections are missing selections:
									</p>
									<ul className='list-disc list-inside text-white/80 mb-6 space-y-1'>
										{validationWarning.map((section) => (
											<li key={section}>{section}</li>
										))}
									</ul>
									<button
										onClick={() => setValidationWarning(null)}
										className='w-full px-4 py-2 bg-dorkinians-yellow text-black font-medium rounded-md hover:bg-dorkinians-yellow/90 transition-colors'>
										OK
									</button>
								</div>
							</motion.div>
						</>
					)}

					{/* Backdrop */}
					<motion.div
						className='fixed inset-0 bg-black/50 z-40'
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
					/>

					{/* Sidebar */}
					<motion.div
						data-testid="filter-sidebar"
						className='fixed right-0 top-0 h-full w-full max-w-md z-50 shadow-xl'
						style={{ backgroundColor: '#0f0f0f' }}
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ type: "spring", stiffness: 300, damping: 30 }}>
						<div className='h-full flex flex-col'>
							{/* Header */}
							<div className='flex items-center justify-between p-4 border-b border-white/20'>
								<h2 className='text-lg font-semibold text-white'>Filter Options</h2>
								<div className='flex items-center space-x-2'>
									<button
										onClick={handleReset}
										className='px-3 py-1 text-sm text-white/80 hover:text-white hover:bg-white/20 rounded transition-colors'>
										Reset
									</button>
									<button data-testid="filter-sidebar-close" onClick={onClose} className='p-2 text-white/60 hover:text-white hover:bg-white/20 rounded-full transition-colors' aria-label='Close filter sidebar'>
										<XMarkIcon className='w-5 h-5' />
									</button>
								</div>
							</div>

							{/* Filter Content */}
							<div 
								className='flex-1 overflow-y-auto p-4 space-y-2'
								style={{ WebkitOverflowScrolling: 'touch' }}>
								{/* Time Range Section */}
								{availableFilters.includes("timeRange") && (
									<div className='border border-white/20 rounded-lg bg-white/5' data-testid="filter-timeRange">
									<button
										onClick={() => toggleAccordion("timeRange")}
										className='w-full flex items-center justify-between p-4 text-left hover:bg-white/10 transition-colors'>
										<span className='font-medium text-white'>Time Range</span>
										{accordionSections.find((s) => s.id === "timeRange")?.isOpen ? (
											<ChevronUpIcon className='w-5 h-5 text-white/60' />
										) : (
											<ChevronDownIcon className='w-5 h-5 text-white/60' />
										)}
									</button>

									{accordionSections.find((s) => s.id === "timeRange")?.isOpen && (
										<div className='px-4 pb-4 space-y-2'>
											{/* Time Range Type Selection */}
											<div className='space-y-1'>
												<label className='block text-sm font-medium text-white/90'>Time Range Type</label>
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
																className='mr-2 accent-dorkinians-yellow w-5 h-5 md:w-4 md:h-4'
															/>
															<span className='text-base md:text-sm text-white/80'>{option.label}</span>
														</label>
													))}
												</div>
											</div>

											{/* Season Selection */}
											{(playerFilters?.timeRange?.type || "allTime") === "season" && (
												<div className='space-y-1'>
													<label className='block text-sm font-medium text-white/90'>Seasons</label>
													{filterData.seasons.length === 0 ? (
														<div className='text-sm text-white/60'>Loading seasons...</div>
													) : (
														<div className='relative'>
															<div className='max-h-32 overflow-y-auto'>
																<div className='grid grid-cols-2 gap-1'>
																	{filterData.seasons.map((season) => (
																		<label key={season.season} className='flex items-center min-h-[36px]'>
																			<input
																				type='checkbox'
																				checked={(playerFilters?.timeRange?.seasons || []).includes(season.season)}
																				onChange={() => handleSeasonToggle(season.season)}
																				className='mr-2 accent-dorkinians-yellow w-5 h-5 md:w-4 md:h-4'
																			/>
																			<span className='text-base md:text-sm text-white/80'>{season.season}</span>
																		</label>
																	))}
																</div>
															</div>
															<div className='absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0f0f0f] to-transparent pointer-events-none' />
														</div>
													)}
												</div>
											)}

											{/* Date Inputs */}
											{(playerFilters?.timeRange?.type || "allTime") === "beforeDate" && (
												<div>
													<label className='block text-base md:text-sm font-medium text-white/90 mb-1'>Before Date</label>
													<input
														type='date'
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
														className='w-[95%] md:w-full px-3 py-3 md:py-2 bg-white/10 border border-white/20 rounded-md text-base md:text-sm text-white placeholder-white/60 focus:border-dorkinians-yellow focus:ring-1 focus:ring-dorkinians-yellow'
													/>
												</div>
											)}

											{(playerFilters?.timeRange?.type || "allTime") === "afterDate" && (
												<div>
													<label className='block text-base md:text-sm font-medium text-white/90 mb-1'>After Date</label>
													<input
														type='date'
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
														className='w-[95%] md:w-full px-3 py-3 md:py-2 bg-white/10 border border-white/20 rounded-md text-base md:text-sm text-white placeholder-white/60 focus:border-dorkinians-yellow focus:ring-1 focus:ring-dorkinians-yellow'
													/>
												</div>
											)}

											{(playerFilters?.timeRange?.type || "allTime") === "betweenDates" && (
												<div className='space-y-1'>
													<div>
														<label className='block text-base md:text-sm font-medium text-white/90 mb-1'>Start Date</label>
														<input
															type='date'
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
															className='w-[95%] md:w-full px-3 py-3 md:py-2 bg-white/10 border border-white/20 rounded-md text-base md:text-sm text-white placeholder-white/60 focus:border-dorkinians-yellow focus:ring-1 focus:ring-dorkinians-yellow'
														/>
													</div>
													<div>
														<label className='block text-base md:text-sm font-medium text-white/90 mb-1'>End Date</label>
														<input
															type='date'
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
															className='w-[95%] md:w-full px-3 py-3 md:py-2 bg-white/10 border border-white/20 rounded-md text-base md:text-sm text-white placeholder-white/60 focus:border-dorkinians-yellow focus:ring-1 focus:ring-dorkinians-yellow'
														/>
													</div>
												</div>
											)}
										</div>
									)}
									</div>
								)}

								{/* Team Section */}
								{availableFilters.includes("team") && (
									<div className='border border-white/20 rounded-lg bg-white/5' data-testid="filter-team">
									<button
										onClick={() => toggleAccordion("team")}
										className='w-full flex items-center justify-between p-4 text-left hover:bg-white/10 transition-colors'>
										<span className='font-medium text-white'>Team</span>
										{accordionSections.find((s) => s.id === "team")?.isOpen ? (
											<ChevronUpIcon className='w-5 h-5 text-white/60' />
										) : (
											<ChevronDownIcon className='w-5 h-5 text-white/60' />
										)}
									</button>

									{accordionSections.find((s) => s.id === "team")?.isOpen && (
										<div className='px-4 pb-4'>
											{filterData.teams.length === 0 ? (
												<div className='text-sm text-white/60'>Loading teams...</div>
											) : (
												<>
													<div className='grid grid-cols-2 gap-2 mb-3'>
														{filterData.teams.map((team) => (
															<label key={team.name} className='flex items-center min-h-[36px]'>
																<input
																	type='checkbox'
																	checked={(playerFilters?.teams || []).includes(team.name)}
																	onChange={() => handleTeamToggle(team.name)}
																	className='mr-2 accent-dorkinians-yellow w-5 h-5 md:w-4 md:h-4'
																/>
																<span className='text-base md:text-sm text-white/80'>{team.name}</span>
															</label>
														))}
													</div>
													<div className='flex gap-2'>
														<button
															type='button'
															onClick={handleTeamCheckAll}
															className='flex-1 px-3 py-2 text-sm font-medium text-white/80 bg-white/10 hover:bg-white/20 rounded-md transition-colors'>
															Check all
														</button>
														<button
															type='button'
															onClick={handleTeamClearAll}
															className='flex-1 px-3 py-2 text-sm font-medium text-white/80 bg-white/10 hover:bg-white/20 rounded-md transition-colors'>
															Clear all
														</button>
													</div>
												</>
											)}
										</div>
									)}
									</div>
								)}

								{/* Location Section */}
								{availableFilters.includes("location") && (
									<div className='border border-white/20 rounded-lg bg-white/5' data-testid="filter-location">
									<button
										onClick={() => toggleAccordion("location")}
										className='w-full flex items-center justify-between p-4 text-left hover:bg-white/10 transition-colors'>
										<span className='font-medium text-white'>Location</span>
										{accordionSections.find((s) => s.id === "location")?.isOpen ? (
											<ChevronUpIcon className='w-5 h-5 text-white/60' />
										) : (
											<ChevronDownIcon className='w-5 h-5 text-white/60' />
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
														<span className='text-base md:text-sm text-white/80'>{location}</span>
													</label>
												))}
											</div>
										</div>
									)}
									</div>
								)}

								{/* Opposition Section */}
								{availableFilters.includes("opposition") && (
									<div className='border border-white/20 rounded-lg bg-white/5' data-testid="filter-opposition">
									<button
										onClick={() => toggleAccordion("opposition")}
										className='w-full flex items-center justify-between p-4 text-left hover:bg-white/10 transition-colors'>
										<span className='font-medium text-white'>Opposition</span>
										{accordionSections.find((s) => s.id === "opposition")?.isOpen ? (
											<ChevronUpIcon className='w-5 h-5 text-white/60' />
										) : (
											<ChevronDownIcon className='w-5 h-5 text-white/60' />
										)}
									</button>

									{accordionSections.find((s) => s.id === "opposition")?.isOpen && (
										<div className='px-4 pb-4 space-y-1.5'>
											<label className='flex items-center min-h-[36px]'>
												<input
													type='checkbox'
													checked={playerFilters?.opposition?.allOpposition ?? true}
													onChange={(e) =>
														updatePlayerFilters({
															opposition: { 
																...(playerFilters?.opposition || { allOpposition: true, searchTerm: "" }), 
																allOpposition: e.target.checked 
															},
														})
													}
													className='mr-2 accent-dorkinians-yellow w-5 h-5 md:w-4 md:h-4'
												/>
												<span className='text-base md:text-sm text-white/80'>All Opposition</span>
											</label>

											<div className='relative'>
												<label className='block text-base md:text-sm font-medium text-white/90 mb-1'>Search Opposition</label>
												<input
													type='text'
													placeholder='Search opposition teams...'
													value={playerFilters?.opposition?.searchTerm || ""}
													onChange={(e) => handleOppositionSearch(e.target.value)}
													onFocus={() => setShowOppositionDropdown(true)}
													onBlur={() => setTimeout(() => setShowOppositionDropdown(false), 200)}
													className='w-full px-3 py-3 md:py-2 bg-white/10 border border-white/20 rounded-md text-base md:text-sm text-white placeholder-white/60 focus:border-dorkinians-yellow focus:ring-1 focus:ring-dorkinians-yellow'
												/>
												{showOppositionDropdown && (
													<div className='absolute z-50 w-full mt-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-md max-h-48 overflow-y-auto'>
														{filteredOpposition.length > 0 ? (
															filteredOpposition.map((opp) => (
																<button
																	key={opp.name}
																	type='button'
																	onClick={() => handleOppositionSelect(opp.name)}
																	className='w-full text-left px-3 py-2 text-base md:text-sm text-white hover:bg-white/20 transition-colors'
																>
																	{opp.name}
																</button>
															))
														) : (
															<div className='px-3 py-2 text-base md:text-sm text-white/60 text-center'>
																No results found
															</div>
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
									<div className='border border-white/20 rounded-lg bg-white/5' data-testid="filter-competition">
									<button
										onClick={() => toggleAccordion("competition")}
										className='w-full flex items-center justify-between p-4 text-left hover:bg-white/10 transition-colors'>
										<span className='font-medium text-white'>Competition</span>
										{accordionSections.find((s) => s.id === "competition")?.isOpen ? (
											<ChevronUpIcon className='w-5 h-5 text-white/60' />
										) : (
											<ChevronDownIcon className='w-5 h-5 text-white/60' />
										)}
									</button>

									{accordionSections.find((s) => s.id === "competition")?.isOpen && (
										<div className='px-4 pb-4 space-y-1.5'>
											<div>
												<label className='block text-base md:text-sm font-medium text-white/90 mb-0.5'>Competition Types</label>
												<div className='grid grid-cols-2 gap-1'>
													{["League", "Cup", "Friendly"].map((type) => (
														<label key={type} className='flex items-center min-h-[36px]'>
															<input
																type='checkbox'
																checked={(playerFilters?.competition?.types || []).includes(type as any)}
																onChange={() => handleCompetitionTypeToggle(type as any)}
																className='mr-2 accent-dorkinians-yellow w-5 h-5 md:w-4 md:h-4'
															/>
															<span className='text-base md:text-sm text-white/80'>{type}</span>
														</label>
													))}
												</div>
											</div>

											<div className='relative'>
												<label className='block text-base md:text-sm font-medium text-white/90 mb-1'>Search Competition</label>
												<input
													type='text'
													placeholder='Search competitions...'
													value={playerFilters?.competition?.searchTerm || ""}
													onChange={(e) => handleCompetitionSearch(e.target.value)}
													onFocus={() => setShowCompetitionDropdown(true)}
													onBlur={() => setTimeout(() => setShowCompetitionDropdown(false), 200)}
													className='w-full px-3 py-3 md:py-2 bg-white/10 border border-white/20 rounded-md text-base md:text-sm text-white placeholder-white/60 focus:border-dorkinians-yellow focus:ring-1 focus:ring-dorkinians-yellow'
												/>
												{showCompetitionDropdown && (
													<div className='absolute z-50 w-full mt-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-md max-h-48 overflow-y-auto'>
														{filteredCompetitions.length > 0 ? (
															filteredCompetitions.map((comp, index) => (
																<button
																	key={`${comp.name}-${comp.type}-${index}`}
																	type='button'
																	onClick={() => handleCompetitionSelect(comp.name)}
																	className='w-full text-left px-3 py-2 text-base md:text-sm text-white hover:bg-white/20 transition-colors'
																>
																	{comp.name}
																</button>
															))
														) : (
															<div className='px-3 py-2 text-base md:text-sm text-white/60 text-center'>
																No results found
															</div>
														)}
													</div>
												)}
											</div>
										</div>
									)}
									</div>
								)}

								{/* Result Section */}
								{availableFilters.includes("result") && (
									<div className='border border-white/20 rounded-lg bg-white/5' data-testid="filter-result">
									<button
										onClick={() => toggleAccordion("result")}
										className='w-full flex items-center justify-between p-4 text-left hover:bg-white/10 transition-colors'>
										<span className='font-medium text-white'>Result</span>
										{accordionSections.find((s) => s.id === "result")?.isOpen ? (
											<ChevronUpIcon className='w-5 h-5 text-white/60' />
										) : (
											<ChevronDownIcon className='w-5 h-5 text-white/60' />
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
														<span className='text-base md:text-sm text-white/80'>{result}</span>
													</label>
												))}
											</div>
										</div>
									)}
									</div>
								)}

								{/* Position Section */}
								{availableFilters.includes("position") && (
									<div className='border border-white/20 rounded-lg bg-white/5' data-testid="filter-position">
									<button
										onClick={() => toggleAccordion("position")}
										className='w-full flex items-center justify-between p-4 text-left hover:bg-white/10 transition-colors'>
										<span className='font-medium text-white'>Position</span>
										{accordionSections.find((s) => s.id === "position")?.isOpen ? (
											<ChevronUpIcon className='w-5 h-5 text-white/60' />
										) : (
											<ChevronDownIcon className='w-5 h-5 text-white/60' />
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
														<span className='text-base md:text-sm text-white/80'>
															{position.label}
														</span>
													</label>
												))}
											</div>
											<div className='flex gap-2'>
												<button
													type='button'
													onClick={handlePositionCheckAll}
													className='flex-1 px-3 py-2 text-sm font-medium text-white/80 bg-white/10 hover:bg-white/20 rounded-md transition-colors'>
													Check all
												</button>
												<button
													type='button'
													onClick={handlePositionClearAll}
													className='flex-1 px-3 py-2 text-sm font-medium text-white/80 bg-white/10 hover:bg-white/20 rounded-md transition-colors'>
													Clear all
												</button>
											</div>
										</div>
									)}
									</div>
								)}
							</div>

							{/* Footer */}
							<div className='border-t border-white/20 p-4' style={{ marginBottom: '10px' }}>
								<div className='flex space-x-3'>
									<button
										onClick={onClose}
										className='flex-1 px-4 py-2 text-sm font-medium text-white/80 bg-white/10 hover:bg-white/20 rounded-md transition-colors'>
										Close
									</button>
									<button
										onClick={handleApply}
										disabled={!hasFilterChanges()}
										className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
											hasFilterChanges()
												? "bg-dorkinians-yellow text-black hover:bg-dorkinians-yellow/90"
												: "bg-white/10 text-white/40 cursor-not-allowed"
										}`}>
										Apply Filters
									</button>
								</div>
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
