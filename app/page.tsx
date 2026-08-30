"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigationStore } from "@/lib/stores/navigation";
import Header from "@/components/layout/Header";
import FooterNavigation from "@/components/layout/FooterNavigation";
import SidebarNavigation from "@/components/layout/SidebarNavigation";
import dynamic from "next/dynamic";
import { wrapDynamicImport } from "@/lib/utils/chunkLoadRetry";
import { useAppRouter } from "@/lib/hooks/useAppRouter";

// Dynamically import sidebar/menu components - only load when opened
const FilterSidebar = dynamic(() => wrapDynamicImport(() => import("@/components/filters/FilterSidebar")), {
	ssr: false,
});

const StatsNavigationMenu = dynamic(() => wrapDynamicImport(() => import("@/components/stats/StatsNavigationMenu")), {
	ssr: false,
});

// Dynamically import ChatbotInterface to reduce initial bundle size (only loads when player is selected)
const ChatbotInterface = dynamic(() => wrapDynamicImport(() => import("@/components/chatbot/ChatbotInterface")), {
	loading: () => <LoadingState message="Loading chatbot..." />,
	ssr: false,
});

import PlayerSelection from "@/components/PlayerSelection";
import { LoadingState } from "@/components/ui/StateComponents";

// Dynamically import page containers to reduce initial bundle size
// These are only loaded when their respective pages are accessed
const StatsContainer = dynamic(() => wrapDynamicImport(() => import("@/components/stats/StatsContainer")), {
	loading: () => <LoadingState message="Loading stats..." />,
	ssr: false,
});

const TOTWContainer = dynamic(() => wrapDynamicImport(() => import("@/components/totw/TOTWContainer")), {
	loading: () => <LoadingState message="Loading Team of the Week..." />,
	ssr: false,
});

const ClubInfoContainer = dynamic(() => wrapDynamicImport(() => import("@/components/club-info/ClubInfoContainer")), {
	loading: () => <LoadingState message="Loading club information..." />,
	ssr: false,
});

const Settings = dynamic(() => wrapDynamicImport(() => import("@/components/pages/Settings")), {
	loading: () => <LoadingState message="Loading settings..." />,
	ssr: false,
});

import UpdateToast from "@/components/admin/UpdateToast";
import DevClearStorageFAB from "@/components/admin/DevClearStorageFAB";
import ToastContainer from "@/components/ui/ToastContainer";
import Neo4jPreWarm from "@/components/Neo4jPreWarm";
import ClearChunkRetryFlag from "@/components/system/ClearChunkRetryFlag";
import { useToast } from "@/lib/hooks/useToast";
import { initializeCurrentSeason, getCurrentSeasonFromStorage } from "@/lib/services/currentSeasonService";
import { preloadCaptainsData } from "@/lib/services/captainsPreloadService";
import {
	COLD_START_RECOVERED_TOAST_MESSAGE,
	COLD_START_STILL_FAILING_TOAST_MESSAGE,
	COLD_START_TOAST_MESSAGE,
	getActiveColdStartToastId,
	resetColdStartNotifierState,
	setColdStartNotifier,
} from "@/lib/services/coldStartNotifier";
import { log } from "@/lib/utils/logger";

const RECENT_PLAYERS_KEY = "dorkinians-recent-players";
const recentPlayersListeners = new Set<() => void>();
/** Stable empty snapshot — useSyncExternalStore requires getServerSnapshot to return a cached reference. */
const EMPTY_RECENT_PLAYERS: string[] = [];

function subscribeRecentPlayers(onStoreChange: () => void) {
	recentPlayersListeners.add(onStoreChange);
	return () => {
		recentPlayersListeners.delete(onStoreChange);
	};
}

function readRecentPlayers(): string[] {
	if (typeof window === "undefined") return EMPTY_RECENT_PLAYERS;
	try {
		const saved = localStorage.getItem(RECENT_PLAYERS_KEY);
		if (!saved) return EMPTY_RECENT_PLAYERS;
		const players = JSON.parse(saved);
		return Array.isArray(players) ? players : EMPTY_RECENT_PLAYERS;
	} catch {
		return EMPTY_RECENT_PLAYERS;
	}
}

let recentPlayersSnapshot: string[] = EMPTY_RECENT_PLAYERS;

function getRecentPlayersSnapshot(): string[] {
	const next = readRecentPlayers();
	if (
		next.length === recentPlayersSnapshot.length &&
		next.every((player, index) => player === recentPlayersSnapshot[index])
	) {
		return recentPlayersSnapshot;
	}
	recentPlayersSnapshot = next;
	return recentPlayersSnapshot;
}

function getRecentPlayersServerSnapshot(): string[] {
	return EMPTY_RECENT_PLAYERS;
}

function writeRecentPlayers(players: string[]) {
	try {
		localStorage.setItem(RECENT_PLAYERS_KEY, JSON.stringify(players));
		recentPlayersSnapshot = players;
		recentPlayersListeners.forEach((listener) => listener());
	} catch (e) {
		console.warn("Failed to update recent players:", e);
	}
}

export default function HomePage() {
	const {
		currentMainPage,
		currentStatsSubPage,
		selectedPlayer,
		isPlayerSelected,
		isEditMode,
		selectPlayer,
		enterEditMode,
		initializeFromStorage,
		validateAndRefreshPlayerData,
		setMainPage,
		openFilterSidebar,
		closeFilterSidebar,
		isFilterSidebarOpen,
		isAllGamesModalOpen,
		loadFilterData,
	} = useNavigationStore();
	const router = useAppRouter();

	const [chatbotRevealReady, setChatbotRevealReady] = useState(true);
	const [showUpdateToast, setShowUpdateToast] = useState(true);
	const recentPlayers = useSyncExternalStore(
		subscribeRecentPlayers,
		getRecentPlayersSnapshot,
		getRecentPlayersServerSnapshot
	);
	const [showStatsMenu, setShowStatsMenu] = useState(false);
	const { toasts, dismissToast, showSuccess, showInfo, showWarning } = useToast();

	const showChatbot =
		currentMainPage === "home" &&
		isPlayerSelected &&
		!!selectedPlayer &&
		!isEditMode &&
		chatbotRevealReady;

	// Register cold-start toast callbacks with the page-level toast stack (once per mount).
	useEffect(() => {
		resetColdStartNotifierState();
		setColdStartNotifier({
			onColdStart: () =>
				showInfo(COLD_START_TOAST_MESSAGE, 15000),
			onRecovered: () => {
				const toastId = getActiveColdStartToastId();
				if (toastId) {
					dismissToast(toastId);
				}
				showSuccess(COLD_START_RECOVERED_TOAST_MESSAGE, 3000);
			},
			onStillFailing: () => {
				const toastId = getActiveColdStartToastId();
				if (toastId) {
					dismissToast(toastId);
				}
				showWarning(COLD_START_STILL_FAILING_TOAST_MESSAGE, 8000);
			},
		});
		return () => {
			setColdStartNotifier(null);
			resetColdStartNotifierState();
		};
	}, [showInfo, showSuccess, showWarning, dismissToast]);

	// Initialize from localStorage and load filter data after mount
	useEffect(() => {
		initializeFromStorage();
		loadFilterData(); // Load filter data asynchronously

		// Initialize currentSeason and preload captains data
		const initAndPreload = async () => {
			await initializeCurrentSeason();
			// Preload captains data for current season asynchronously
			const currentSeason = getCurrentSeasonFromStorage();
			if (currentSeason) {
				void preloadCaptainsData(currentSeason);
			}
		};
		initAndPreload();
	}, [initializeFromStorage, loadFilterData]);

	// Persist recent players when selection changes (external store — no component setState)
	useEffect(() => {
		if (!isPlayerSelected || !selectedPlayer) return;
		const current = getRecentPlayersSnapshot();
		const players = [selectedPlayer, ...current.filter((p) => p !== selectedPlayer)].slice(0, 5);
		if (
			players.length !== current.length ||
			players.some((player, index) => player !== current[index])
		) {
			writeRecentPlayers(players);
		}
	}, [isPlayerSelected, selectedPlayer]);

	// Validate and refresh player data on app load and when player changes
	useEffect(() => {
		if (selectedPlayer) {
			validateAndRefreshPlayerData(selectedPlayer);
		}
	}, [selectedPlayer, validateAndRefreshPlayerData]);

	const handlePlayerSelect = (playerName: string, source: "picker" | "recent" = "picker") => {
		selectPlayer(playerName, source);
		// Brief delay before chatbot reveal for smoother transition
		setChatbotRevealReady(false);
		setTimeout(() => setChatbotRevealReady(true), 500);
	};

	const handleEditClick = () => {
		enterEditMode();
	};

	const handleClearPlayer = () => {
		// This function can be empty if not needed, but it's required by the component
	};

	const handleSettingsClick = () => {
		// Store current main page as previous before navigating to settings
		if (typeof window !== "undefined") {
			localStorage.setItem("dorkinians-previous-main-page", currentMainPage);
		}
		router.push("/settings");
	};

	const handleFilterClick = () => {
		openFilterSidebar();
	};

	const handleMenuClick = () => {
		setShowStatsMenu(true);
	};

	// Check if we should show the filter icon (on all stats sub-pages)
	const showFilterIcon = currentMainPage === "stats";
	const showMenuIcon = currentMainPage === "stats";

	const renderCurrentPage = () => {
		switch (currentMainPage) {
			case "home":
				return (
					<motion.div
						key='home'
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}
						className='flex flex-col h-full px-6 md:px-6'>
						{/* Top Section: Welcome Header and Player Selection */}
						<div className='pt-4 pb-0 md:pt-8 md:pb-6'>
							{/* Welcome Header and Subtitle */}
							<AnimatePresence mode='wait'>
								{!isPlayerSelected && (
									<motion.div
										key='welcome'
										initial={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -50 }}
										transition={{ duration: 0.5 }}
										className='text-center mb-4 md:mb-8'>
										<h1 data-testid="home-welcome-heading" className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-3 md:mb-6'>Welcome to the Dorkinians FC Statistics Website</h1>
										<p className='text-sm text-white max-w-md mx-auto'>
											Your comprehensive source for club statistics, player performance, and team insights.
										</p>
									</motion.div>
								)}
							</AnimatePresence>

							{/* Player Selection or Player Name Display */}
							<AnimatePresence mode='wait'>
								{(!showChatbot || isEditMode) && (
									<motion.div
										key='player-selection'
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -20 }}
										transition={{ duration: 0.5 }}
										className='w-full'>
										<PlayerSelection
											onPlayerSelect={handlePlayerSelect}
											onEditClick={handleEditClick}
											onClearPlayer={handleClearPlayer}
											selectedPlayer={selectedPlayer}
											isEditMode={isEditMode}
										/>
									</motion.div>
								)}
							</AnimatePresence>

							{/* Recently Selected Players */}
							{!isPlayerSelected && recentPlayers.length > 0 && (
								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.5, delay: 0.2 }}
									className='w-full max-w-md mx-auto mt-4 md:mt-6'>
									<h3 className='text-sm md:text-base font-semibold text-white mb-3 text-center'>Recently Selected Players</h3>
									<div className='space-y-2 md:space-y-3'>
										{recentPlayers.map((playerName, index) => (
											<motion.div
												key={playerName}
												initial={{ opacity: 0, x: -20 }}
												animate={{ opacity: 1, x: 0 }}
												transition={{ delay: index * 0.1 }}
												className='rounded-lg p-3 md:p-4 cursor-pointer hover:bg-yellow-400/5 transition-colors bg-gradient-to-b from-white/[0.22] to-white/[0.05]'
												onClick={() => handlePlayerSelect(playerName, "recent")}>
												<p className='font-medium text-white text-xs md:text-sm'>{playerName}</p>
											</motion.div>
										))}
									</div>
								</motion.div>
							)}

							{/* Player Name Display when chatbot is visible and not in edit mode */}
							<AnimatePresence mode='wait'>
								{showChatbot && !isEditMode && selectedPlayer && (
									<motion.div
										key='player-name-display'
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -20 }}
										transition={{ duration: 0.5 }}
										className='text-center mb-4'>
										<div className='flex items-center justify-center space-x-2 md:space-x-3'>
											<h2 className='text-xl md:text-2xl font-semibold text-dorkinians-yellow'>{selectedPlayer}</h2>
											<button
												data-testid="home-edit-player-button"
												onClick={handleEditClick}
												className='p-1.5 md:p-2 text-yellow-300 hover:text-yellow-200 hover:bg-yellow-400/10 rounded-full transition-colors'
												title='Edit player selection'>
												<svg className='h-4 w-4 md:h-5 md:w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
													<path
														strokeLinecap='round'
														strokeLinejoin='round'
														strokeWidth={2}
														d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
													/>
												</svg>
											</button>
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>

						{/* Chatbot Interface - Positioned at top below player name */}
						<AnimatePresence mode='wait'>
							{showChatbot && (
								<motion.div
									key='chatbot'
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.6, delay: 0.2 }}
									className='w-full'>
									<div className='w-full max-w-lg md:max-w-2xl mx-auto'>
										<ChatbotInterface />
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</motion.div>
				);

			case "stats":
				return (
					<motion.div
						key='stats'
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}
						className='h-full'>
						<StatsContainer />
					</motion.div>
				);

			case "totw":
				return (
					<motion.div key='totw' initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className='h-full'>
						<TOTWContainer />
					</motion.div>
				);

			case "club-info":
				return (
					<motion.div
						key='club-info'
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}
						className='h-full'>
						<ClubInfoContainer />
					</motion.div>
				);

			case "settings":
				return (
					<motion.div
						key='settings'
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}
						className='h-full'>
						<Settings />
					</motion.div>
				);

			default:
				log("error", "❌ [HomePage] Unknown page:", currentMainPage);
				return null;
		}
	};

	return (
		<>
			<ClearChunkRetryFlag />
			<div className='min-h-screen'>
				{/* Desktop Sidebar Navigation */}
				<SidebarNavigation 
					onSettingsClick={handleSettingsClick} 
					onFilterClick={handleFilterClick} 
					showFilterIcon={showFilterIcon}
					onMenuClick={handleMenuClick}
					showMenuIcon={showMenuIcon}
				/>

				{/* Mobile Header */}
				<Header 
					onSettingsClick={handleSettingsClick} 
					onFilterClick={handleFilterClick} 
					showFilterIcon={showFilterIcon}
					onMenuClick={handleMenuClick}
					showMenuIcon={showMenuIcon}
				/>

				{/* Main Content */}
				<main className='main-content-container'>
					<div className='frosted-container'>
						<div 
							className='h-full overflow-y-auto'
							style={{ 
								WebkitOverflowScrolling: 'touch',
								touchAction: 'pan-y'
							}}>
							<AnimatePresence mode='wait'>{renderCurrentPage()}</AnimatePresence>
						</div>
					</div>
				</main>

				{/* Mobile Footer Navigation */}
				<FooterNavigation />

				{/* Filter Sidebar */}
				<FilterSidebar isOpen={isFilterSidebarOpen} onClose={closeFilterSidebar} onSuccess={showSuccess} renderAboveAllGamesModal={isAllGamesModalOpen} />
				
				{/* Stats Navigation Menu */}
				<StatsNavigationMenu isOpen={showStatsMenu} onClose={() => setShowStatsMenu(false)} />
			</div>

			{/* Update Toast */}
			{showUpdateToast && <UpdateToast onClose={() => setShowUpdateToast(false)} />}

			{/* Toast Notifications */}
			<ToastContainer toasts={toasts} onDismiss={dismissToast} />

			{/* Development Clear Storage FAB */}
			<DevClearStorageFAB />

			{/* Pre-warm Neo4j connection when chatbot becomes visible */}
			{showChatbot && <Neo4jPreWarm />}
		</>
	);
}
