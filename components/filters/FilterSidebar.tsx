"use client";

import { useState, useEffect, useMemo } from "react";
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

	const optionLabelClass = "flex items-center gap-3 py-2 text-base md:text-sm text-white/80";
	const compactOptionLabelClass = "flex items-center gap-3 py-1.5 text-base md:text-sm text-white/80";
	const checkboxInputClass = "mr-3 w-5 h-5 md:w-4 md:h-4 accent-dorkinians-yellow";

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
					...playerFilters.timeRange,
					type,
				},
			});
		}
	};

	const handleSeasonToggle = (season: string) => {
		const currentSeasons = playerFilters.timeRange.seasons;
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
		const currentTeams = playerFilters.teams;
		const newTeams = currentTeams.includes(team) ? currentTeams.filter((t) => t !== team) : [...currentTeams, team];

		updatePlayerFilters({
			teams: newTeams,
		});
	};

	const handleLocationToggle = (location: "Home" | "Away") => {
		const currentLocation = playerFilters.location;
		const newLocation = currentLocation.includes(location) ? currentLocation.filter((l) => l !== location) : [...currentLocation, location];

		updatePlayerFilters({
			location: newLocation,
		});
	};

	const handleOppositionSearch = (searchTerm: string) => {
		updatePlayerFilters({
			opposition: {
				...playerFilters.opposition,
				searchTerm,
			},
		});
	};

	const handleOppositionSuggestionSelect = (name: string) => {
		updatePlayerFilters({
			opposition: {
				...playerFilters.opposition,
				searchTerm: name,
				allOpposition: false,
			},
		});
	};

	const handleCompetitionSearch = (searchTerm: string) => {
		updatePlayerFilters({
			competition: {
				...playerFilters.competition,
				searchTerm,
			},
		});
	};

	const handleCompetitionSuggestionSelect = (name: string) => {
		updatePlayerFilters({
			competition: {
				...playerFilters.competition,
				searchTerm: name,
			},
		});
	};

	const handleCompetitionTypeToggle = (type: "League" | "Cup" | "Friendly") => {
		const currentTypes = playerFilters.competition.types;
		const newTypes = currentTypes.includes(type) ? currentTypes.filter((t) => t !== type) : [...currentTypes, type];

		updatePlayerFilters({
			competition: {
				...playerFilters.competition,
				types: newTypes,
			},
		});
	};

	const handleResultToggle = (result: "Win" | "Draw" | "Loss") => {
		const currentResults = playerFilters.result;
		const newResults = currentResults.includes(result) ? currentResults.filter((r) => r !== result) : [...currentResults, result];

		updatePlayerFilters({
			result: newResults,
		});
	};

	const handlePositionToggle = (position: "GK" | "DEF" | "MID" | "FWD") => {
		const currentPositions = playerFilters.position;
		const newPositions = currentPositions.includes(position)
			? currentPositions.filter((p) => p !== position)
			: [...currentPositions, position];

		updatePlayerFilters({
			position: newPositions,
		});
	};

	const filteredOppositionOptions = useMemo(() => {
		const options = filterData?.opposition || [];
		const term = playerFilters.opposition.searchTerm.trim().toLowerCase();
		if (!term) return options.slice(0, 10);
		return options.filter((option) => option.name?.toLowerCase().includes(term)).slice(0, 10);
	}, [filterData?.opposition, playerFilters.opposition.searchTerm]);

	const filteredCompetitionOptions = useMemo(() => {
		const options = filterData?.competitions || [];
		const term = playerFilters.competition.searchTerm.trim().toLowerCase();
		if (!term) return options.slice(0, 10);
		return options.filter((option) => option.name?.toLowerCase().includes(term)).slice(0, 10);
	}, [filterData?.competitions, playerFilters.competition.searchTerm]);

	const handleApply = async () => {
		await applyPlayerFilters();
	};

	const handleReset = () => {
		resetPlayerFilters();
	};

	const hasActiveFilters = () => {
		const { timeRange, teams, location, opposition, competition, result, position } = playerFilters;

		return (
			timeRange.seasons.length > 0 ||
			timeRange.beforeDate !== "" ||
			timeRange.afterDate !== "" ||
			timeRange.startDate !== "" ||
			timeRange.endDate !== "" ||
			teams.length > 0 ||
			location.length < 2 ||
			!opposition.allOpposition ||
			opposition.searchTerm !== "" ||
			competition.types.length < 2 ||
			competition.searchTerm !== "" ||
			result.length < 3 ||
			position.length > 0
		);
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<>
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
									<button onClick={onClose} className='p-2 text-white/60 hover:text-white hover:bg-white/20 rounded-full transition-colors'>
										<XMarkIcon className='w-5 h-5' />
									</button>
								</div>
							</div>

							{/* Filter Content */}
							<div 
								className='flex-1 overflow-y-auto p-4 space-y-4'
								style={{ WebkitOverflowScrolling: 'touch' }}>
								{/* Time Range Section */}
								{availableFilters.includes("timeRange") && (
									<div className='border border-white/20 rounded-lg bg-white/5'>
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
										<div className='px-4 pb-4 space-y-4'>
											{/* Time Range Type Selection */}
											<div className='space-y-2'>
												<label className='block text-sm font-medium text-white/90'>Time Range Type</label>
												<div className='space-y-2'>
													{[
														{ value: "allTime", label: "All Time" },
														{ value: "season", label: "Season" },
														{ value: "beforeDate", label: "Before Date" },
														{ value: "afterDate", label: "After Date" },
														{ value: "betweenDates", label: "Between Dates" },
													].map((option) => (
														<label key={option.value} className={optionLabelClass}>
															<input
																type='radio'
																name='timeRangeType'
																value={option.value}
																checked={playerFilters.timeRange.type === option.value}
																onChange={() => handleTimeRangeTypeChange(option.value as any)}
																className={checkboxInputClass}
															/>
															<span className='text-white/90'>{option.label}</span>
														</label>
													))}
												</div>
											</div>

											{/* Season Selection */}
											{playerFilters.timeRange.type === "season" && (
												<div className='space-y-2'>
													<label className='block text-sm font-medium text-white/90'>Seasons</label>
													{filterData.seasons.length === 0 ? (
														<div className='text-sm text-white/60'>Loading seasons...</div>
													) : (
														<div className='max-h-40 overflow-y-auto'>
															<div className='grid grid-cols-2 gap-2'>
																{filterData.seasons.map((season) => (
																	<label key={season.season} className={compactOptionLabelClass}>
																		<input
																			type='checkbox'
																			checked={playerFilters.timeRange.seasons.includes(season.season)}
																			onChange={() => handleSeasonToggle(season.season)}
																			className={checkboxInputClass}
																		/>
																		<span>{season.season}</span>
																	</label>
																))}
															</div>
														</div>
													)}
												</div>
											)}

											{/* Date Inputs */}
											{playerFilters.timeRange.type === "beforeDate" && (
												<div>
													<label className='block text-sm font-medium text-white/90 mb-1'>Before Date</label>
													<div className='flex justify-center md:justify-start'>
														<input
															type='date'
															value={playerFilters.timeRange.beforeDate}
															onChange={(e) =>
																updatePlayerFilters({
																	timeRange: { ...playerFilters.timeRange, beforeDate: e.target.value },
																})
															}
															className='w-11/12 md:w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-base md:text-sm text-white placeholder-white/60 focus:border-dorkinians-yellow focus:ring-1 focus:ring-dorkinians-yellow'
														/>
													</div>
												</div>
											)}

											{playerFilters.timeRange.type === "afterDate" && (
												<div>
													<label className='block text-sm font-medium text-white/90 mb-1'>After Date</label>
													<div className='flex justify-center md:justify-start'>
														<input
															type='date'
															value={playerFilters.timeRange.afterDate}
															onChange={(e) =>
																updatePlayerFilters({
																	timeRange: { ...playerFilters.timeRange, afterDate: e.target.value },
																})
															}
															className='w-11/12 md:w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-base md:text-sm text-white placeholder-white/60 focus:border-dorkinians-yellow focus:ring-1 focus:ring-dorkinians-yellow'
														/>
													</div>
												</div>
											)}

											{playerFilters.timeRange.type === "betweenDates" && (
												<div className='space-y-2'>
													<div>
														<label className='block text-sm font-medium text-white/90 mb-1'>Start Date</label>
														<div className='flex justify-center md:justify-start'>
															<input
																type='date'
																value={playerFilters.timeRange.startDate}
																onChange={(e) =>
																	updatePlayerFilters({
																		timeRange: { ...playerFilters.timeRange, startDate: e.target.value },
																	})
																}
																className='w-11/12 md:w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-base md:text-sm text-white placeholder-white/60 focus:border-dorkinians-yellow focus:ring-1 focus:ring-dorkinians-yellow'
															/>
														</div>
													</div>
													<div>
														<label className='block text-sm font-medium text-white/90 mb-1'>End Date</label>
														<div className='flex justify-center md:justify-start'>
															<input
																type='date'
																value={playerFilters.timeRange.endDate}
																onChange={(e) =>
																	updatePlayerFilters({
																		timeRange: { ...playerFilters.timeRange, endDate: e.target.value },
																	})
																}
																className='w-11/12 md:w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-base md:text-sm text-white placeholder-white/60 focus:border-dorkinians-yellow focus:ring-1 focus:ring-dorkinians-yellow'
															/>
														</div>
													</div>
												</div>
											)}
										</div>
									)}
									</div>
								)}

								{/* Team Section */}
								{availableFilters.includes("team") && (
									<div className='border border-white/20 rounded-lg bg-white/5'>
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
												<div className='max-h-48 overflow-y-auto'>
													<div className='grid grid-cols-2 gap-2'>
														{filterData.teams.map((team) => (
															<label key={team.name} className={compactOptionLabelClass}>
																<input
																	type='checkbox'
																	checked={playerFilters.teams.includes(team.name)}
																	onChange={() => handleTeamToggle(team.name)}
																	className={checkboxInputClass}
																/>
																<span>{team.name}</span>
															</label>
														))}
													</div>
												</div>
											)}
										</div>
									)}
									</div>
								)}

								{/* Location Section */}
								{availableFilters.includes("location") && (
									<div className='border border-white/20 rounded-lg bg-white/5'>
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
										<div className='px-4 pb-4 space-y-1'>
											{["Home", "Away"].map((location) => (
												<label key={location} className={optionLabelClass}>
													<input
														type='checkbox'
														checked={playerFilters.location.includes(location as "Home" | "Away")}
														onChange={() => handleLocationToggle(location as "Home" | "Away")}
														className={checkboxInputClass}
													/>
													<span className='text-white/90'>{location}</span>
												</label>
											))}
										</div>
									)}
									</div>
								)}

								{/* Opposition Section */}
								{availableFilters.includes("opposition") && (
									<div className='border border-white/20 rounded-lg bg-white/5'>
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
										<div className='px-4 pb-4 space-y-3'>
											<label className={optionLabelClass}>
												<input
													type='checkbox'
													checked={playerFilters.opposition.allOpposition}
													onChange={(e) =>
														updatePlayerFilters({
															opposition: { ...playerFilters.opposition, allOpposition: e.target.checked },
														})
													}
													className={checkboxInputClass}
												/>
												<span className='text-white/90'>All Opposition</span>
											</label>

											<div>
												<label className='block text-sm font-medium text-white/90 mb-1'>Search Opposition</label>
												<input
													type='text'
													placeholder='Search opposition teams...'
													value={playerFilters.opposition.searchTerm}
													onChange={(e) => handleOppositionSearch(e.target.value)}
													className='w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-sm text-white placeholder-white/60 focus:border-dorkinians-yellow focus:ring-1 focus:ring-dorkinians-yellow'
												/>
												{playerFilters.opposition.searchTerm && (
													filteredOppositionOptions.length > 0 ? (
														<div className='mt-2 max-h-36 overflow-y-auto space-y-1'>
															{filteredOppositionOptions.map((option) => (
																<button
																	type='button'
																	key={option.name}
																	onClick={() => handleOppositionSuggestionSelect(option.name)}
																	className='w-full text-left px-3 py-2 bg-white/10 hover:bg-white/20 rounded-md text-sm text-white transition-colors'>
																	{option.name}
																</button>
															))}
														</div>
													) : (
														<p className='mt-2 text-xs text-white/60'>No opposition found.</p>
													)
												)}
											</div>
										</div>
									)}
									</div>
								)}

								{/* Competition Section */}
								{availableFilters.includes("competition") && (
									<div className='border border-white/20 rounded-lg bg-white/5'>
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
										<div className='px-4 pb-4 space-y-3'>
											<div className='space-y-1'>
												<label className='block text-sm font-medium text-white/90'>Competition Types</label>
												{["League", "Cup", "Friendly"].map((type) => (
													<label key={type} className={optionLabelClass}>
														<input
															type='checkbox'
															checked={playerFilters.competition.types.includes(type as any)}
															onChange={() => handleCompetitionTypeToggle(type as any)}
															className={checkboxInputClass}
														/>
														<span className='text-white/90'>{type}</span>
													</label>
												))}
											</div>

											<div>
												<label className='block text-sm font-medium text-white/90 mb-1'>Search Competition</label>
												<input
													type='text'
													placeholder='Search competitions...'
													value={playerFilters.competition.searchTerm}
													onChange={(e) => handleCompetitionSearch(e.target.value)}
													className='w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-sm text-white placeholder-white/60 focus:border-dorkinians-yellow focus:ring-1 focus:ring-dorkinians-yellow'
												/>
												{playerFilters.competition.searchTerm && (
													filteredCompetitionOptions.length > 0 ? (
														<div className='mt-2 max-h-36 overflow-y-auto space-y-1'>
															{filteredCompetitionOptions.map((option) => (
																<button
																	type='button'
																	key={`${option.name}-${option.type}`}
																	onClick={() => handleCompetitionSuggestionSelect(option.name)}
																	className='w-full text-left px-3 py-2 bg-white/10 hover:bg-white/20 rounded-md text-sm text-white transition-colors'>
																	<div className='flex justify-between items-center'>
																		<span>{option.name}</span>
																		<span className='text-xs text-white/60'>{option.type}</span>
																	</div>
																</button>
															))}
														</div>
													) : (
														<p className='mt-2 text-xs text-white/60'>No competitions found.</p>
													)
												)}
											</div>
										</div>
									)}
									</div>
								)}

								{/* Result Section */}
								{availableFilters.includes("result") && (
									<div className='border border-white/20 rounded-lg bg-white/5'>
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
										<div className='px-4 pb-4 space-y-1'>
											{["Win", "Draw", "Loss"].map((result) => (
												<label key={result} className={optionLabelClass}>
													<input
														type='checkbox'
														checked={playerFilters.result.includes(result as any)}
														onChange={() => handleResultToggle(result as any)}
														className={checkboxInputClass}
													/>
													<span className='text-white/90'>{result}</span>
												</label>
											))}
										</div>
									)}
									</div>
								)}

								{/* Position Section */}
								{availableFilters.includes("position") && (
									<div className='border border-white/20 rounded-lg bg-white/5'>
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
										<div className='px-4 pb-4 space-y-1'>
											{[
												{ value: "GK", label: "Goalkeeper" },
												{ value: "DEF", label: "Defender" },
												{ value: "MID", label: "Midfielder" },
												{ value: "FWD", label: "Forward" },
											].map((position) => (
												<label key={position.value} className={optionLabelClass}>
													<input
														type='checkbox'
														checked={playerFilters.position.includes(position.value as any)}
														onChange={() => handlePositionToggle(position.value as any)}
														className={checkboxInputClass}
													/>
													<span className='text-white/90'>
														{position.label} ({position.value})
													</span>
												</label>
											))}
										</div>
									)}
									</div>
								)}
							</div>

							{/* Footer */}
							<div className='border-t border-white/20 p-4'>
								<div className='flex space-x-3'>
									<button
										onClick={onClose}
										className='flex-1 px-4 py-2 text-sm font-medium text-white/80 bg-white/10 hover:bg-white/20 rounded-md transition-colors'>
										Close
									</button>
									<button
										onClick={handleApply}
										disabled={!hasActiveFilters()}
										className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
											hasActiveFilters()
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
