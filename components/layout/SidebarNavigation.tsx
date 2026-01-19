"use client";

import { motion } from "framer-motion";
import { Cog6ToothIcon, XMarkIcon, FunnelIcon, Bars3Icon, HomeIcon, ChartBarIcon, TrophyIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { useNavigationStore, type MainPage, type StatsSubPage, type TOTWSubPage, type ClubInfoSubPage } from "@/lib/stores/navigation";
import Image from "next/image";
import { log } from "@/lib/utils/logger";
import Button from "@/components/ui/Button";
import { useState, useEffect } from "react";

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
	const { currentMainPage, setMainPage, setStatsSubPage, setTOTWSubPage, setClubInfoSubPage, currentStatsSubPage, currentTOTWSubPage, currentClubInfoSubPage } = useNavigationStore();
	const [showTooltip, setShowTooltip] = useState(false);
	const [hasAnimated, setHasAnimated] = useState(false);
	
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
				// Hide tooltip after 5 seconds
				const timer = setTimeout(() => {
					setShowTooltip(false);
					localStorage.setItem("stats-nav-menu-tooltip-seen", "true");
				}, 5000);
				return () => clearTimeout(timer);
			}
		}
	}, [showMenuIcon]);

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
									className='p-2 rounded-full hover:bg-[var(--color-surface)] transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
									whileHover={{ scale: 1.1 }}
									whileTap={{ scale: 0.9 }}
									initial={hasAnimated ? {} : { scale: 1 }}
									animate={hasAnimated ? {} : { scale: [1, 1.15, 1] }}
									transition={hasAnimated ? {} : { duration: 0.6, repeat: 2, delay: 0.5 }}
									title={showTooltip ? "Click to navigate sections" : "Open stats navigation"}
									aria-label='Open stats navigation'>
									<Bars3Icon className='w-7 h-7 text-[var(--color-text-primary)]' />
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
							<motion.button
								data-testid="nav-sidebar-filter"
								onClick={onFilterClick}
								className='p-2 rounded-full hover:bg-[var(--color-surface)] transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
								whileHover={{ scale: 1.1 }}
								whileTap={{ scale: 0.9 }}
								title='Open filters'
								aria-label='Open filters'>
								<FunnelIcon className='w-7 h-7 text-[var(--color-text-primary)]' />
							</motion.button>
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
										className={`group w-full flex items-center space-x-3 px-3 py-2.5 justify-start rounded-2xl bg-transparent border-none outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorkinians-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
											isActive ? "text-dorkinians-yellow-text bg-[var(--color-primary)]/40" : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
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

