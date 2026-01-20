"use client";

import { motion } from "framer-motion";
import { Cog6ToothIcon, XMarkIcon, FunnelIcon, Bars3Icon, HomeIcon, ChartBarIcon, TrophyIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { useNavigationStore, type MainPage, type StatsSubPage, type TOTWSubPage, type ClubInfoSubPage } from "@/lib/stores/navigation";
import Image from "next/image";
import { log } from "@/lib/utils/logger";
import Button from "@/components/ui/Button";
import { useState, useEffect, useMemo } from "react";

interface SidebarNavigationProps {
	onSettingsClick: () => void;
	isSettingsPage?: boolean;
	onFilterClick?: () => void;
	showFilterIcon?: boolean;
	onMenuClick?: () => void;
	showMenuIcon?: boolean;
}

const navigationItems = [
	{ id: "home" as MainPage, icon: HomeIcon, label: "Home", subPages: [] },
	{ 
		id: "stats" as MainPage, 
		icon: ChartBarIcon, 
		label: "Stats",
		subPages: [
			{ id: "player-stats" as StatsSubPage, label: "Player Stats" },
			{ id: "team-stats" as StatsSubPage, label: "Team Stats" },
			{ id: "club-stats" as StatsSubPage, label: "Club Stats" },
			{ id: "comparison" as StatsSubPage, label: "Player Comparison" },
		]
	},
	{ 
		id: "totw" as MainPage, 
		icon: TrophyIcon, 
		label: "TOTW",
		subPages: [
			{ id: "totw" as TOTWSubPage, label: "Team of the Week" },
			{ id: "players-of-month" as TOTWSubPage, label: "Players of the Month" },
		]
	},
	{ 
		id: "club-info" as MainPage, 
		icon: InformationCircleIcon, 
		label: "Club Info",
		subPages: [
			{ id: "club-information" as ClubInfoSubPage, label: "Club Information" },
			{ id: "league-information" as ClubInfoSubPage, label: "League Information" },
			{ id: "club-captains" as ClubInfoSubPage, label: "Club Captains" },
			{ id: "club-awards" as ClubInfoSubPage, label: "Club Awards" },
			{ id: "useful-links" as ClubInfoSubPage, label: "Useful Links" },
		]
	},
];

export default function SidebarNavigation({ onSettingsClick, isSettingsPage = false, onFilterClick, showFilterIcon = false, onMenuClick, showMenuIcon = false }: SidebarNavigationProps) {
	const { currentMainPage, setMainPage, setStatsSubPage, setTOTWSubPage, setClubInfoSubPage, currentStatsSubPage, currentTOTWSubPage, currentClubInfoSubPage, playerFilters, filterData } = useNavigationStore();
	const [showTooltip, setShowTooltip] = useState(false);
	const [showFilterTooltip, setShowFilterTooltip] = useState(false);
	const [hasAnimated, setHasAnimated] = useState(false);

	// Calculate active filter count
	const activeFilterCount = useMemo(() => {
		if (!playerFilters) return 0;
		let count = 0;
		const filterChecks: Record<string, { counted: boolean; reason?: string; value?: any }> = {};
		
		// Count timeRange if not "allTime"
		const timeRangeCounted = playerFilters.timeRange?.type && playerFilters.timeRange.type !== "allTime";
		if (timeRangeCounted) count++;
		filterChecks.timeRange = { counted: timeRangeCounted, value: playerFilters.timeRange?.type, reason: timeRangeCounted ? `type is ${playerFilters.timeRange?.type}` : 'type is allTime or missing' };
		
		// Count teams if selection deviates from "all teams" (similar to position/result/competition)
		// Empty array = all teams (no filter), so don't count
		// Non-empty array = check if it's all teams or a subset
		const allTeams = filterData?.teams?.map(team => team.name) || [];
		const teams = playerFilters.teams || [];
		const hasAllTeams = teams.length === 0 || (allTeams.length > 0 && teams.length === allTeams.length && allTeams.every(team => teams.includes(team)));
		const teamsCounted = !hasAllTeams && teams.length > 0;
		if (teamsCounted) count++;
		filterChecks.teams = { counted: teamsCounted, value: playerFilters.teams, reason: teamsCounted ? `teams selection is subset (${teams.length}/${allTeams.length})` : hasAllTeams ? 'all teams selected (no filter)' : 'teams array is empty or missing' };
		
		// Count location if not both Home and Away selected (length < 2 means filter is active)
		const locationCounted = !!(playerFilters.location?.length && playerFilters.location.length < 2);
		if (locationCounted) count++;
		filterChecks.location = { counted: locationCounted, value: playerFilters.location, reason: locationCounted ? `location array has ${playerFilters.location?.length} items (need 2)` : `location array has ${playerFilters.location?.length || 0} items (both selected)` };
		
		// Count opposition if allOpposition is explicitly false or searchTerm has value
		const oppositionAllOpp = playerFilters.opposition?.allOpposition;
		const oppositionSearchTerm = playerFilters.opposition?.searchTerm;
		const oppositionSearchTermTrimmed = oppositionSearchTerm?.trim() || "";
		const oppositionCounted = !!(playerFilters.opposition && (oppositionAllOpp === false || (oppositionSearchTerm && oppositionSearchTermTrimmed !== "")));
		if (oppositionCounted) count++;
		filterChecks.opposition = { counted: oppositionCounted, value: { allOpposition: oppositionAllOpp, searchTerm: oppositionSearchTerm, searchTermTrimmed: oppositionSearchTermTrimmed }, reason: oppositionCounted ? (oppositionAllOpp === false ? 'allOpposition is false' : `searchTerm has value: "${oppositionSearchTermTrimmed}"`) : 'allOpposition is true and searchTerm is empty' };
		
		// Count competition if types array has fewer than all 3 types (default is all 3) or searchTerm has value
		const defaultCompetitionTypes: ("League" | "Cup" | "Friendly")[] = ["League", "Cup", "Friendly"];
		const competitionTypes = playerFilters.competition?.types || [];
		const hasAllCompetitionTypes = defaultCompetitionTypes.every(type => competitionTypes.includes(type as any)) && competitionTypes.length === defaultCompetitionTypes.length;
		const competitionCounted = !!(playerFilters.competition && ((!hasAllCompetitionTypes && competitionTypes.length > 0) || (playerFilters.competition.searchTerm && playerFilters.competition.searchTerm.trim() !== "")));
		if (competitionCounted) count++;
		filterChecks.competition = { counted: competitionCounted, value: { types: competitionTypes, hasAll: hasAllCompetitionTypes, searchTerm: playerFilters.competition?.searchTerm }, reason: competitionCounted ? (!hasAllCompetitionTypes ? `missing types (has ${competitionTypes.length}/3)` : `searchTerm has value: "${playerFilters.competition?.searchTerm}"`) : 'all 3 types selected and searchTerm empty' };
		
		// Count result if array has fewer than all 3 results (default is all 3)
		const defaultResults: ("Win" | "Draw" | "Loss")[] = ["Win", "Draw", "Loss"];
		const results = playerFilters.result || [];
		const hasAllResults = defaultResults.every(result => results.includes(result as any)) && results.length === defaultResults.length;
		const resultCounted = !hasAllResults && results.length > 0;
		if (resultCounted) count++;
		filterChecks.result = { counted: resultCounted, value: results, reason: resultCounted ? `missing results (has ${results.length}/3)` : `all 3 results selected (${results.length}/3)` };
		
		// Count position if array has fewer than all 4 positions (default is all 4)
		const defaultPositions: ("GK" | "DEF" | "MID" | "FWD")[] = ["GK", "DEF", "MID", "FWD"];
		const positions = playerFilters.position || [];
		const hasAllPositions = defaultPositions.every(pos => positions.includes(pos as any)) && positions.length === defaultPositions.length;
		const positionCounted = !hasAllPositions && positions.length > 0;
		if (positionCounted) count++;
		filterChecks.position = { counted: positionCounted, value: positions, reason: positionCounted ? `missing positions (has ${positions.length}/4)` : `all 4 positions selected (${positions.length}/4)` };
		
		return count;
	}, [playerFilters, filterData]);
	
	// Check if sidebar has been animated before in this session
	const [shouldAnimate, setShouldAnimate] = useState<boolean>(() => {
		if (typeof window !== "undefined") {
			const hasAnimated = sessionStorage.getItem("sidebar-animated");
			return !hasAnimated;
		}
		return true; // Default to animating on SSR
	});

	// Mark as animated in sessionStorage after mount
	useEffect(() => {
		if (typeof window !== "undefined" && shouldAnimate) {
			sessionStorage.setItem("sidebar-animated", "true");
		}
	}, [shouldAnimate]);

	// Check if tooltip should be shown on first visit
	useEffect(() => {
		if (showMenuIcon && typeof window !== "undefined") {
			const hasSeenTooltip = localStorage.getItem("stats-nav-menu-tooltip-seen");
			if (!hasSeenTooltip) {
				setShowTooltip(true);
				// Hide tooltip after 5 seconds, then show filter tooltip
				const timer = setTimeout(() => {
					setShowTooltip(false);
					localStorage.setItem("stats-nav-menu-tooltip-seen", "true");
					
					// Show filter tooltip after a brief delay
					if (showFilterIcon) {
						const hasSeenFilterTooltip = localStorage.getItem("stats-nav-filter-tooltip-seen");
						if (!hasSeenFilterTooltip) {
							setTimeout(() => {
								setShowFilterTooltip(true);
								const filterTimer = setTimeout(() => {
									setShowFilterTooltip(false);
									localStorage.setItem("stats-nav-filter-tooltip-seen", "true");
								}, 5000);
								return () => clearTimeout(filterTimer);
							}, 500);
						}
					}
				}, 5000);
				return () => clearTimeout(timer);
			} else if (showFilterIcon) {
				// If menu tooltip was already seen, check for filter tooltip
				const hasSeenFilterTooltip = localStorage.getItem("stats-nav-filter-tooltip-seen");
				if (!hasSeenFilterTooltip) {
					setShowFilterTooltip(true);
					const filterTimer = setTimeout(() => {
						setShowFilterTooltip(false);
						localStorage.setItem("stats-nav-filter-tooltip-seen", "true");
					}, 5000);
					return () => clearTimeout(filterTimer);
				}
			}
		}
	}, [showMenuIcon, showFilterIcon]);

	// Add animation on first visit
	useEffect(() => {
		if (showMenuIcon && typeof window !== "undefined" && !hasAnimated) {
			const hasAnimatedBefore = localStorage.getItem("stats-nav-menu-animated");
			if (!hasAnimatedBefore) {
				setHasAnimated(true);
				localStorage.setItem("stats-nav-menu-animated", "true");
			}
		}
	}, [showMenuIcon, hasAnimated]);

	const handleLogoClick = () => {
		setMainPage("home");
	};

	const handleSubPageClick = (mainPageId: MainPage, subPageId: string) => {
		setMainPage(mainPageId);
		if (mainPageId === "stats") {
			setStatsSubPage(subPageId as StatsSubPage);
		} else if (mainPageId === "totw") {
			setTOTWSubPage(subPageId as TOTWSubPage);
		} else if (mainPageId === "club-info") {
			setClubInfoSubPage(subPageId as ClubInfoSubPage);
		}
	};

	const isSubPageActive = (mainPageId: MainPage, subPageId: string): boolean => {
		if (mainPageId === "stats" && currentMainPage === "stats") {
			return currentStatsSubPage === subPageId;
		} else if (mainPageId === "totw" && currentMainPage === "totw") {
			return currentTOTWSubPage === subPageId;
		} else if (mainPageId === "club-info" && currentMainPage === "club-info") {
			return currentClubInfoSubPage === subPageId;
		}
		return false;
	};

	return (
		<motion.aside
			className='hidden md:flex fixed left-0 top-0 bottom-0 z-50 w-[220px] flex-col'
			style={shouldAnimate ? undefined : { transform: 'translateX(0)' }}
			initial={shouldAnimate ? { x: -220 } : { x: 0 }}
			animate={{ x: 0 }}
			transition={shouldAnimate ? { type: "spring", stiffness: 300, damping: 30 } : { duration: 0 }}>
			{/* Sidebar container */}
			<div className='h-full w-full flex flex-col'>
				{/* Header Section */}
				<div className='flex flex-col items-center px-4 py-4 border-b border-white/10'>
					{/* Club Logo */}
					<motion.button
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
						onClick={handleLogoClick}
						title='Click to return to homepage'
						aria-label='Return to homepage'
						className='flex flex-col items-center space-y-2.5 mb-3 p-0 bg-transparent border-none h-auto w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'>
						<div className='w-16 h-16 flex items-center justify-center'>
							<Image src='/icons/icon-96x96.png' alt='Dorkinians FC Logo' width={64} height={64} className='rounded-full' />
						</div>
						<span className='font-bold text-xl text-[var(--color-text-primary)] text-center whitespace-nowrap'>Dorkinians FC</span>
					</motion.button>

					{/* Action Icons */}
					<div className='flex items-center justify-center space-x-2 w-full'>
						{/* Burger Menu Icon - only show on stats pages */}
						{showMenuIcon && onMenuClick && (
							<div className='relative'>
								<motion.button
									data-testid="nav-sidebar-menu"
									onClick={() => {
										setShowTooltip(false);
										onMenuClick();
									}}
									className={`p-2 rounded-full hover:bg-[var(--color-surface)] transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
										showTooltip ? 'bg-dorkinians-yellow/20' : ''
									}`}
									whileHover={{ scale: 1.1 }}
									whileTap={{ scale: 0.9 }}
									initial={hasAnimated ? {} : { scale: 1 }}
									animate={hasAnimated ? {} : { scale: [1, 1.15, 1] }}
									transition={hasAnimated ? {} : { duration: 0.6, repeat: 2, delay: 0.5 }}
									title={showTooltip ? "Click to navigate sections" : "Open stats navigation"}
									aria-label='Open stats navigation'>
									<Bars3Icon className={`w-7 h-7 ${showTooltip ? 'text-dorkinians-yellow' : 'text-[var(--color-text-primary)]'}`} />
								</motion.button>
								{/* Tooltip */}
								{showTooltip && (
									<motion.div
										initial={{ opacity: 0, y: -10 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -10 }}
										className='absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-dorkinians-yellow text-black text-xs font-medium rounded-lg shadow-lg whitespace-nowrap z-50'>
										Click to navigate sections
										<div className='absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-dorkinians-yellow' />
									</motion.div>
								)}
							</div>
						)}
						{/* Filter Icon - only show on stats pages */}
						{showFilterIcon && onFilterClick && (
							<div className='relative'>
								<motion.button
									data-testid="nav-sidebar-filter"
									onClick={() => {
										setShowFilterTooltip(false);
										onFilterClick();
									}}
									className={`p-2 rounded-full hover:bg-[var(--color-surface)] transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
										showFilterTooltip ? 'bg-dorkinians-yellow/20' : ''
									}`}
									whileHover={{ scale: 1.1 }}
									whileTap={{ scale: 0.9 }}
									initial={showFilterTooltip ? { scale: 1 } : {}}
									animate={showFilterTooltip ? { scale: [1, 1.15, 1] } : {}}
									transition={showFilterTooltip ? { duration: 0.6, repeat: Infinity } : {}}
									title={showFilterTooltip ? "Click to open filters" : "Open filters"}
									aria-label='Open filters'>
									<FunnelIcon className={`w-7 h-7 ${showFilterTooltip ? 'text-dorkinians-yellow' : 'text-[var(--color-text-primary)]'}`} />
								{/* Active filter count badge */}
								{activeFilterCount > 0 && (
									<span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-dorkinians-yellow text-black text-xs font-bold rounded-full">
										{activeFilterCount > 99 ? '99+' : activeFilterCount}
									</span>
								)}
								</motion.button>
								{/* Filter Tooltip */}
								{showFilterTooltip && (
									<motion.div
										initial={{ opacity: 0, y: -10 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -10 }}
										className='absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-dorkinians-yellow text-black text-xs font-medium rounded-lg shadow-lg whitespace-nowrap z-50'>
										Click to open stats filters
										<div className='absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-dorkinians-yellow' />
									</motion.div>
								)}
							</div>
						)}
						{/* Settings Icon */}
						<motion.button
							data-testid="nav-sidebar-settings"
							onClick={onSettingsClick}
							className={`p-2 rounded-full transition-colors flex items-center justify-center ${
								isSettingsPage ? "bg-[var(--color-secondary)]/20 hover:bg-[var(--color-secondary)]/30" : "hover:bg-[var(--color-surface)]"
							}`}
							whileHover={{ scale: 1.1 }}
							whileTap={{ scale: 0.9 }}
							title={isSettingsPage ? "Close settings" : "Open settings"}
							aria-label={isSettingsPage ? "Close settings" : "Open settings"}>
							{isSettingsPage ? <XMarkIcon className='w-7 h-7 text-dorkinians-yellow-text' /> : <Cog6ToothIcon className='w-7 h-7 text-[var(--color-text-primary)]' />}
						</motion.button>
					</div>
				</div>

				{/* Navigation Section */}
				<nav className='flex-1 flex flex-col px-3 py-3 space-y-1.5 overflow-y-auto'>
					{navigationItems.map((item) => {
						const Icon = item.icon;
						const isActive = currentMainPage === item.id && !isSettingsPage;
						const hasSubPages = item.subPages && item.subPages.length > 0;

						return (
							<div key={item.id} className='space-y-1'>
								<motion.div
									whileHover={{ scale: 1.02 }}
									whileTap={{ scale: 0.98 }}>
									<button
										data-testid={`nav-sidebar-${item.id}`}
										onClick={() => {
											log("info", "?? [SidebarNavigation] Button clicked:", item.id);
											setMainPage(item.id);
											
											// Set default sub-page for pages with sub-pages
											if (item.id === "stats") {
												setStatsSubPage("player-stats");
											} else if (item.id === "totw") {
												setTOTWSubPage("totw");
											} else if (item.id === "club-info") {
												setClubInfoSubPage("club-information");
											}
										}}
										className={`group w-full flex items-center space-x-3 px-3 py-2.5 justify-start rounded-2xl border-none outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorkinians-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
											isActive ? "text-dorkinians-yellow-text bg-[var(--color-primary)]/40" : "bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
										}`}>
										<Icon className={`w-7 h-7 flex-shrink-0 ${isActive ? "text-dorkinians-yellow-text" : "text-[var(--color-text-primary)] group-hover:text-dorkinians-yellow-text-hover"}`} />
										<span className={`text-base font-medium flex-1 text-left ${isActive ? "text-dorkinians-yellow-text" : "text-[var(--color-text-primary)] group-hover:text-dorkinians-yellow-text-hover"}`}>{item.label}</span>
									</button>
								</motion.div>
								{hasSubPages && (
									<div className='pl-4 space-y-0.5'>
										{item.subPages.map((subPage) => {
											const isSubActive = isSubPageActive(item.id, subPage.id) && !isSettingsPage;
											return (
												<motion.div
													key={subPage.id}
													whileHover={{ scale: 1.02 }}
													whileTap={{ scale: 0.98 }}>
													<button
														data-testid={`nav-sidebar-${subPage.id}`}
														onClick={() => handleSubPageClick(item.id, subPage.id)}
														className={`group w-full flex items-center px-3 py-1.5 text-left justify-start rounded-2xl bg-transparent border-none outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorkinians-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
															isSubActive
																? "text-dorkinians-yellow-text bg-[var(--color-primary)]/35"
																: "text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
														}`}>
														<span className={`text-sm font-medium ${isSubActive ? "text-dorkinians-yellow-text" : "text-[var(--color-text-primary)] group-hover:text-dorkinians-yellow-text-hover"}`}>{subPage.label}</span>
													</button>
												</motion.div>
											);
										})}
									</div>
								)}
							</div>
						);
					})}
				</nav>
			</div>
		</motion.aside>
	);
}

