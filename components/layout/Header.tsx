"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useMemo, useRef } from "react";
import React from "react";
import { Cog6ToothIcon, XMarkIcon, FunnelIcon, Bars3Icon } from "@heroicons/react/24/outline";
import { useNavigationStore } from "@/lib/stores/navigation";
import Image from "next/image";
import Button from "@/components/ui/Button";

interface HeaderProps {
	onSettingsClick: () => void;
	isSettingsPage?: boolean;
	onFilterClick?: () => void;
	showFilterIcon?: boolean;
	onMenuClick?: () => void;
	showMenuIcon?: boolean;
}

export default function Header({ onSettingsClick, isSettingsPage = false, onFilterClick, showFilterIcon = false, onMenuClick, showMenuIcon = false }: HeaderProps) {
	const { setMainPage, playerFilters, filterData } = useNavigationStore();
	const [showMenuTooltip, setShowMenuTooltip] = useState(false);
	const [showFilterTooltip, setShowFilterTooltip] = useState(false);
	const [hasAnimated, setHasAnimated] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const menuTooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const filterTooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Dismiss tooltips
	const dismissMenuTooltip = () => {
		if (menuTooltipTimeoutRef.current) {
			clearTimeout(menuTooltipTimeoutRef.current);
			menuTooltipTimeoutRef.current = null;
		}
		setShowMenuTooltip(false);
		localStorage.setItem("stats-nav-menu-tooltip-seen", "true");
	};

	const dismissFilterTooltip = () => {
		if (filterTooltipTimeoutRef.current) {
			clearTimeout(filterTooltipTimeoutRef.current);
			filterTooltipTimeoutRef.current = null;
		}
		setShowFilterTooltip(false);
		localStorage.setItem("stats-nav-filter-tooltip-seen", "true");
	};

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
		filterChecks.teams = { counted: !!teamsCounted, value: playerFilters.teams, reason: teamsCounted ? `teams selection is subset (${teams.length}/${allTeams.length})` : hasAllTeams ? 'all teams selected (no filter)' : 'teams array is empty or missing' };
		
		// Count location if not both Home and Away selected (length < 2 means filter is active)
		const locationCounted = !!(playerFilters.location?.length && playerFilters.location.length < 2);
		if (locationCounted) count++;
		filterChecks.location = { counted: !!locationCounted, value: playerFilters.location, reason: locationCounted ? `location array has ${playerFilters.location?.length} items (need 2)` : `location array has ${playerFilters.location?.length || 0} items (both selected)` };
		
		// Count opposition if allOpposition is explicitly false or searchTerm has value
		const oppositionAllOpp = playerFilters.opposition?.allOpposition;
		const oppositionSearchTerm = playerFilters.opposition?.searchTerm;
		const oppositionSearchTermTrimmed = oppositionSearchTerm?.trim() || "";
		const oppositionCounted = !!(playerFilters.opposition && (oppositionAllOpp === false || (oppositionSearchTerm && oppositionSearchTermTrimmed !== "")));
		if (oppositionCounted) count++;
		filterChecks.opposition = { counted: !!oppositionCounted, value: { allOpposition: oppositionAllOpp, searchTerm: oppositionSearchTerm, searchTermTrimmed: oppositionSearchTermTrimmed }, reason: oppositionCounted ? (oppositionAllOpp === false ? 'allOpposition is false' : `searchTerm has value: "${oppositionSearchTermTrimmed}"`) : 'allOpposition is true and searchTerm is empty' };
		
		// Count competition if types array has fewer than all 3 types (default is all 3) or searchTerm has value
		const defaultCompetitionTypes: ("League" | "Cup" | "Friendly")[] = ["League", "Cup", "Friendly"];
		const competitionTypes = playerFilters.competition?.types || [];
		const hasAllCompetitionTypes = defaultCompetitionTypes.every(type => competitionTypes.includes(type as any)) && competitionTypes.length === defaultCompetitionTypes.length;
		const competitionCounted = !!(playerFilters.competition && ((!hasAllCompetitionTypes && competitionTypes.length > 0) || (playerFilters.competition.searchTerm && playerFilters.competition.searchTerm.trim() !== "")));
		if (competitionCounted) count++;
		filterChecks.competition = { counted: !!competitionCounted, value: { types: competitionTypes, hasAll: hasAllCompetitionTypes, searchTerm: playerFilters.competition?.searchTerm }, reason: competitionCounted ? (!hasAllCompetitionTypes ? `missing types (has ${competitionTypes.length}/3)` : `searchTerm has value: "${playerFilters.competition?.searchTerm}"`) : 'all 3 types selected and searchTerm empty' };
		
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

	// Detect mobile on mount and resize
	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 768);
		};
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	}, []);

	// Sequential tooltips on mobile
	useEffect(() => {
		if (showMenuIcon && typeof window !== "undefined" && isMobile) {
			const hasSeenMenuTooltip = localStorage.getItem("stats-nav-menu-tooltip-seen");
			if (!hasSeenMenuTooltip) {
				setShowMenuTooltip(true);
				// Hide menu tooltip after 5 seconds, then show filter tooltip
				menuTooltipTimeoutRef.current = setTimeout(() => {
					dismissMenuTooltip();
					
					// Show filter tooltip after a brief delay
					if (showFilterIcon) {
						const hasSeenFilterTooltip = localStorage.getItem("stats-nav-filter-tooltip-seen");
						if (!hasSeenFilterTooltip) {
							setTimeout(() => {
								setShowFilterTooltip(true);
								filterTooltipTimeoutRef.current = setTimeout(() => {
									dismissFilterTooltip();
								}, 5000);
							}, 500);
						}
					}
				}, 5000);
				return () => {
					if (menuTooltipTimeoutRef.current) {
						clearTimeout(menuTooltipTimeoutRef.current);
					}
					if (filterTooltipTimeoutRef.current) {
						clearTimeout(filterTooltipTimeoutRef.current);
					}
				};
			}
		}
	}, [showMenuIcon, showFilterIcon, isMobile]);

	// Handle click/touch to dismiss tooltips
	useEffect(() => {
		if (!showMenuTooltip && !showFilterTooltip) return;

		const handleClick = () => {
			if (showMenuTooltip) dismissMenuTooltip();
			if (showFilterTooltip) dismissFilterTooltip();
		};

		document.addEventListener('click', handleClick, true);
		document.addEventListener('touchstart', handleClick, true);

		return () => {
			document.removeEventListener('click', handleClick, true);
			document.removeEventListener('touchstart', handleClick, true);
		};
	}, [showMenuTooltip, showFilterTooltip]);

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
		if (typeof window !== "undefined") {
			window.location.href = "/";
		}
	};

	const showAnyTooltip = showMenuTooltip || showFilterTooltip;

	return (
		<>
			{/* Backdrop overlay when any tooltip is showing */}
			{showAnyTooltip && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className='fixed inset-0 bg-black/20 z-40'
					onClick={() => {
						if (showMenuTooltip) dismissMenuTooltip();
						if (showFilterTooltip) dismissFilterTooltip();
					}}
					onTouchStart={() => {
						if (showMenuTooltip) dismissMenuTooltip();
						if (showFilterTooltip) dismissFilterTooltip();
					}}
				/>
			)}
			<motion.header
				className='md:hidden fixed top-0 left-0 right-0 z-50 w-full'
				initial={isSettingsPage ? { y: 0 } : { y: -100 }}
				animate={{ y: 0 }}
				transition={isSettingsPage ? {} : { type: "spring", stiffness: 300, damping: 30 }}>
				<div className='flex items-center justify-between px-4 md:px-[15%] py-3 min-w-0'>
				{/* Club Logo and Dorkinians FC Text */}
				<motion.button
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
					onClick={handleLogoClick}
					title='Click to return to homepage'
					aria-label='Return to homepage'
					className="flex-shrink-0 min-w-fit inline-flex items-center space-x-2 p-0 bg-transparent border-none h-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent">
					<div className='w-8 h-8 flex items-center justify-center flex-shrink-0'>
						<Image src='/icons/icon-96x96.png' alt='Dorkinians FC Logo' width={32} height={32} className='rounded-full' />
					</div>
					<span className='font-bold text-xl text-[var(--color-text-primary)] whitespace-nowrap flex-shrink-0'>Dorkinians FC</span>
				</motion.button>

				{/* Right side icons */}
				<div className='flex items-center space-x-2 flex-shrink-0'>
					{/* Burger Menu Icon - only show on stats pages */}
					{showMenuIcon && onMenuClick && (
						<div className='relative'>
							<motion.button
								data-testid="header-menu"
								onClick={() => {
									dismissMenuTooltip();
									onMenuClick();
								}}
								className={`p-2 rounded-full hover:bg-[var(--color-surface)] transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
									showMenuTooltip ? 'bg-dorkinians-yellow/20' : ''
								}`}
								whileHover={{ scale: 1.1 }}
								whileTap={{ scale: 0.9 }}
								initial={hasAnimated && !showMenuTooltip ? {} : { scale: 1 }}
								animate={
									showMenuTooltip
										? { scale: [1, 1.15, 1] }
										: hasAnimated
										? {}
										: { scale: [1, 1.15, 1] }
								}
								transition={
									showMenuTooltip
										? { duration: 0.6, repeat: Infinity }
										: hasAnimated
										? {}
										: { duration: 0.6, repeat: 2, delay: 0.5 }
								}
								title={showMenuTooltip ? "Click to navigate sections" : "Open stats navigation"}
								aria-label='Open stats navigation'>
								<Bars3Icon className={`w-6 h-6 ${showMenuTooltip ? 'text-dorkinians-yellow' : 'text-[var(--color-text-primary)]'}`} />
							</motion.button>
							{/* Tooltip - bottom left on mobile, top center on desktop */}
							{showMenuTooltip && (
								<motion.div
									initial={{ opacity: 0, y: isMobile ? 10 : -10 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: isMobile ? 10 : -10 }}
									className={`absolute ${isMobile ? 'top-full -left-8 mt-2' : 'bottom-full left-1/2 transform -translate-x-1/2 mb-2'} px-3 py-2 bg-dorkinians-yellow text-black text-xs font-medium rounded-lg shadow-lg whitespace-nowrap z-50`}
									onClick={(e) => e.stopPropagation()}>
									Click to navigate sections
									<div className={`absolute ${isMobile ? 'bottom-full left-8 -mb-1 border-4 border-transparent border-b-dorkinians-yellow' : 'top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-dorkinians-yellow'}`} />
								</motion.div>
							)}
						</div>
					)}
					{/* Filter Icon - only show on stats pages */}
					{showFilterIcon && onFilterClick && (
						<div className='relative'>
							<motion.button
								data-testid="header-filter"
								onClick={() => {
									dismissFilterTooltip();
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
								<FunnelIcon className={`w-6 h-6 ${showFilterTooltip ? 'text-dorkinians-yellow' : 'text-[var(--color-text-primary)]'}`} />
							{/* Active filter count badge */}
							{activeFilterCount > 0 && (
								<span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-dorkinians-yellow text-black text-xs font-bold rounded-full">
									{activeFilterCount > 99 ? '99+' : activeFilterCount}
								</span>
							)}
							</motion.button>
							{/* Filter Tooltip - bottom left on mobile */}
							{showFilterTooltip && isMobile && (
								<motion.div
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: 10 }}
									className='absolute top-full mt-2 px-3 py-2 bg-dorkinians-yellow text-black text-xs font-medium rounded-lg shadow-lg whitespace-nowrap z-50'
									style={{ left: '-72px' }}
									onClick={(e) => e.stopPropagation()}>
									Click to open stats filters
									<div className='absolute bottom-full -mb-1 border-4 border-transparent border-b-dorkinians-yellow' style={{ left: '72px' }} />
								</motion.div>
							)}
						</div>
					)}

					{/* Settings/Close Icon */}
					<motion.button
						data-testid="header-settings"
						onClick={onSettingsClick}
						className='p-2 rounded-full hover:bg-[var(--color-surface)] transition-colors flex items-center justify-center'
						whileHover={{ scale: 1.1 }}
						whileTap={{ scale: 0.9 }}
						title={isSettingsPage ? "Close settings" : "Open settings"}
						aria-label={isSettingsPage ? "Close settings" : "Open settings"}>
						{isSettingsPage ? <XMarkIcon className='w-6 h-6 text-[var(--color-text-primary)]' /> : <Cog6ToothIcon className='w-6 h-6 text-[var(--color-text-primary)]' />}
					</motion.button>
				</div>
			</div>
		</motion.header>
		</>
	);
}
