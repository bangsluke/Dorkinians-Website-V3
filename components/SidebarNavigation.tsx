"use client";

import { motion } from "framer-motion";
import { Cog6ToothIcon, XMarkIcon, FunnelIcon, Bars3Icon, HomeIcon, ChartBarIcon, TrophyIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { useNavigationStore, type MainPage, type StatsSubPage, type TOTWSubPage, type ClubInfoSubPage } from "@/lib/stores/navigation";
import Image from "next/image";

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
			{ id: "team-of-the-week" as TOTWSubPage, label: "Team of the Week" },
			{ id: "players-of-the-month" as TOTWSubPage, label: "Players of the Month" },
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

	const handleLogoClick = () => {
		setMainPage("home");
		if (typeof window !== "undefined") {
			window.location.href = "/";
		}
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
			initial={{ x: -220 }}
			animate={{ x: 0 }}
			transition={{ type: "spring", stiffness: 300, damping: 30 }}>
			{/* Sidebar container */}
			<div className='h-full w-full flex flex-col'>
				{/* Header Section */}
				<div className='flex flex-col items-center px-4 py-6 border-b border-white/10'>
					{/* Club Logo */}
					<motion.div
						className='flex flex-col items-center space-y-3 cursor-pointer mb-4'
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
						onClick={handleLogoClick}
						title='Click to return to homepage'>
					<div className='w-[72px] h-[72px] flex items-center justify-center'>
						<Image src='/icons/icon-96x96.png' alt='Dorkinians FC Logo' width={66} height={66} className='rounded-full' />
					</div>
					<span className='font-bold text-[22px] text-white text-center'>Dorkinians FC</span>
					</motion.div>

					{/* Action Icons */}
					<div className='flex items-center justify-center space-x-2 w-full'>
						{/* Burger Menu Icon - only show on stats pages */}
						{showMenuIcon && onMenuClick && (
							<motion.button
								data-testid="nav-sidebar-menu"
								onClick={onMenuClick}
								className='p-2 rounded-full hover:bg-white/20 transition-colors'
								whileHover={{ scale: 1.1 }}
								whileTap={{ scale: 0.9 }}
								title='Open stats navigation'>
								<Bars3Icon className='w-8 h-8 text-white' />
							</motion.button>
						)}
						{/* Filter Icon - only show on stats pages */}
						{showFilterIcon && onFilterClick && (
							<motion.button
								data-testid="nav-sidebar-filter"
								onClick={onFilterClick}
								className='p-2 rounded-full hover:bg-white/20 transition-colors'
								whileHover={{ scale: 1.1 }}
								whileTap={{ scale: 0.9 }}
								title='Open filters'>
								<FunnelIcon className='w-8 h-8 text-white' />
							</motion.button>
						)}
						{/* Settings Icon */}
						<motion.button
							data-testid="nav-sidebar-settings"
							onClick={onSettingsClick}
							className='p-2 rounded-full hover:bg-white/20 transition-colors'
							whileHover={{ scale: 1.1 }}
							whileTap={{ scale: 0.9 }}
							title={isSettingsPage ? "Close settings" : "Open settings"}>
							{isSettingsPage ? <XMarkIcon className='w-8 h-8 text-white' /> : <Cog6ToothIcon className='w-8 h-8 text-white' />}
						</motion.button>
					</div>
				</div>

				{/* Navigation Section */}
				<nav className='flex-1 flex flex-col px-3 py-4 space-y-2 overflow-y-auto'>
					{navigationItems.map((item) => {
						const Icon = item.icon;
						const isActive = currentMainPage === item.id;
						const hasSubPages = item.subPages && item.subPages.length > 0;

						return (
							<div key={item.id} className='space-y-1'>
								<motion.button
									data-testid={`nav-sidebar-${item.id}`}
									onClick={() => {
										console.log("🔘 [SidebarNavigation] Button clicked:", item.id);
										setMainPage(item.id);
									}}
									className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
										isActive ? "text-yellow-400 bg-yellow-400/20" : "text-white hover:text-yellow-300 hover:bg-white/20"
									}`}
									whileHover={{ scale: 1.02 }}
									whileTap={{ scale: 0.98 }}>
									<Icon className={`w-8 h-8 flex-shrink-0 ${isActive ? "text-yellow-400" : ""}`} />
									<span className={`text-[16px] font-medium flex-1 text-left ${isActive ? "text-yellow-400" : ""}`}>{item.label}</span>
								</motion.button>
								{hasSubPages && (
									<div className='pl-4 space-y-1'>
										{item.subPages.map((subPage) => {
											const isSubActive = isSubPageActive(item.id, subPage.id);
											return (
												<motion.button
													key={subPage.id}
													data-testid={`nav-sidebar-${subPage.id}`}
													onClick={() => handleSubPageClick(item.id, subPage.id)}
													className={`w-full flex items-center px-4 py-2 rounded-lg transition-colors text-left ${
														isSubActive
															? "text-yellow-400 bg-yellow-400/20"
															: "text-white hover:text-yellow-300 hover:bg-white/20"
													}`}
													whileHover={{ scale: 1.02 }}
													whileTap={{ scale: 0.98 }}>
													<span className={`text-[14px] font-medium ${isSubActive ? "text-yellow-400" : ""}`}>{subPage.label}</span>
												</motion.button>
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

