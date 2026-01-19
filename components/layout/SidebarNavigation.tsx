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
				<div className='flex flex-col items-center px-4 py-6 border-b border-white/10'>
					{/* Club Logo */}
					<motion.button
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
						onClick={handleLogoClick}
						title='Click to return to homepage'
						aria-label='Return to homepage'
						className='flex flex-col items-center space-y-3 mb-4 p-0 bg-transparent border-none h-auto w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'>
						<div className='w-[72px] h-[72px] flex items-center justify-center'>
							<Image src='/icons/icon-96x96.png' alt='Dorkinians FC Logo' width={66} height={66} className='rounded-full' />
						</div>
						<span className='font-bold text-[22px] text-[var(--color-text-primary)] text-center whitespace-nowrap'>Dorkinians FC</span>
					</motion.button>

					{/* Action Icons */}
					<div className='flex items-center justify-center space-x-2 w-full'>
						{/* Burger Menu Icon - only show on stats pages */}
						{showMenuIcon && onMenuClick && (
							<motion.button
								data-testid="nav-sidebar-menu"
								onClick={onMenuClick}
								className='p-2 rounded-full hover:bg-[var(--color-surface)] transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
								whileHover={{ scale: 1.1 }}
								whileTap={{ scale: 0.9 }}
								title='Open stats navigation'
								aria-label='Open stats navigation'>
								<Bars3Icon className='w-8 h-8 text-[var(--color-text-primary)]' />
							</motion.button>
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
								<FunnelIcon className='w-8 h-8 text-[var(--color-text-primary)]' />
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
							{isSettingsPage ? <XMarkIcon className='w-8 h-8 text-dorkinians-yellow-text' /> : <Cog6ToothIcon className='w-8 h-8 text-[var(--color-text-primary)]' />}
						</motion.button>
					</div>
				</div>

				{/* Navigation Section */}
				<nav className='flex-1 flex flex-col px-3 py-4 space-y-2 overflow-y-auto'>
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
										className={`group w-full flex items-center space-x-3 px-4 py-3 justify-start rounded-2xl bg-transparent border-none outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorkinians-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
											isActive ? "text-dorkinians-yellow-text bg-[var(--color-primary)]/40" : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
										}`}>
										<Icon className={`w-8 h-8 flex-shrink-0 ${isActive ? "text-dorkinians-yellow-text" : "text-[var(--color-text-primary)] group-hover:text-dorkinians-yellow-text-hover"}`} />
										<span className={`text-[16px] font-medium flex-1 text-left ${isActive ? "text-dorkinians-yellow-text" : "text-[var(--color-text-primary)] group-hover:text-dorkinians-yellow-text-hover"}`}>{item.label}</span>
									</button>
								</motion.div>
								{hasSubPages && (
									<div className='pl-4 space-y-1'>
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
														className={`group w-full flex items-center px-4 py-2 text-left justify-start rounded-2xl bg-transparent border-none outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorkinians-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
															isSubActive
																? "text-dorkinians-yellow-text bg-[var(--color-primary)]/35"
																: "text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
														}`}>
														<span className={`text-[14px] font-medium ${isSubActive ? "text-dorkinians-yellow-text" : "text-[var(--color-text-primary)] group-hover:text-dorkinians-yellow-text-hover"}`}>{subPage.label}</span>
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

