"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigationStore } from "@/lib/stores/navigation";
import Header from "@/components/Header";
import FooterNavigation from "@/components/FooterNavigation";
import StatsContainer from "@/components/StatsContainer";
import TOTWContainer from "@/components/TOTWContainer";
import ClubInfoContainer from "@/components/ClubInfoContainer";
import Settings from "@/components/pages/Settings";
import ChatbotInterface from "@/components/ChatbotInterface";
import PlayerSelection from "@/components/PlayerSelection";
import UpdateToast from "@/components/UpdateToast";

export default function HomePage() {
	const {
		currentMainPage,
		selectedPlayer,
		isPlayerSelected,
		isEditMode,
		selectPlayer,
		enterEditMode,
		initializeFromStorage,
		validateAndRefreshPlayerData,
		setMainPage,
	} = useNavigationStore();

	console.log("🏠 [HomePage] Component rendered with state:", {
		currentMainPage,
		selectedPlayer,
		isPlayerSelected,
		isEditMode,
	});
	const [showChatbot, setShowChatbot] = useState(false);
	const [showUpdateToast, setShowUpdateToast] = useState(true);

	// Initialize from localStorage after mount
	useEffect(() => {
		initializeFromStorage();
	}, [initializeFromStorage]);

	// Show chatbot when player is loaded from localStorage and not in edit mode
	useEffect(() => {
		console.log("🤖 [HomePage] Chatbot useEffect triggered with:", {
			isPlayerSelected,
			selectedPlayer,
			isEditMode,
			showChatbot,
		});

		if (isPlayerSelected && selectedPlayer && !isEditMode) {
			console.log("✅ [HomePage] Showing chatbot for player:", selectedPlayer);
			setShowChatbot(true);
		} else {
			setShowChatbot(false);
		}
	}, [isPlayerSelected, selectedPlayer, isEditMode]);

	// Validate and refresh player data on app load and when player changes
	useEffect(() => {
		if (selectedPlayer) {
			validateAndRefreshPlayerData(selectedPlayer);
		}
	}, [selectedPlayer, validateAndRefreshPlayerData]);

	const handlePlayerSelect = (playerName: string) => {
		selectPlayer(playerName);
		// Trigger chatbot reveal after a brief delay
		setTimeout(() => setShowChatbot(true), 500);
	};

	const handleEditClick = () => {
		enterEditMode();
		setShowChatbot(false);
	};

	const handleClearPlayer = () => {
		// This function can be empty if not needed, but it's required by the component
	};

	const handleSettingsClick = () => {
		window.location.href = "/settings";
	};

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
						<div className='pt-4 pb-4 md:pt-8 md:pb-6'>
							{/* Welcome Header and Subtitle */}
							<AnimatePresence mode='wait'>
								{!isPlayerSelected && (
									<motion.div
										key='welcome'
										initial={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -50 }}
										transition={{ duration: 0.5 }}
										className='text-center mb-4 md:mb-8'>
										<h1 className='text-lg md:text-xl font-bold text-white mb-3 md:mb-6'>Welcome to the Dorkinians FC Statistics Website</h1>
										<p className='text-sm md:text-base text-gray-300 max-w-md mx-auto'>
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
											<h2 className='text-lg md:text-xl font-semibold text-white'>{selectedPlayer}</h2>
											<button
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
				console.log("📊 [HomePage] Rendering stats page");
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
				console.log("🏆 [HomePage] Rendering TOTW page");
				return (
					<motion.div key='totw' initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className='h-full'>
						<TOTWContainer />
					</motion.div>
				);

			case "club-info":
				console.log("ℹ️ [HomePage] Rendering club-info page");
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
				console.log("⚙️ [HomePage] Rendering settings page");
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
				console.log("❌ [HomePage] Unknown page:", currentMainPage);
				return null;
		}
	};

	return (
		<>
			<div className='min-h-screen'>
				{/* Header */}
				<Header onSettingsClick={handleSettingsClick} />

				{/* Main Content */}
				<main className='main-content-container'>
					<div className='frosted-container'>
						<div className='h-full overflow-y-auto'>
							<AnimatePresence mode='wait'>{renderCurrentPage()}</AnimatePresence>
						</div>
					</div>
				</main>

				{/* Footer Navigation */}
				<FooterNavigation />
			</div>

			{/* Update Toast */}
			{showUpdateToast && <UpdateToast onClose={() => setShowUpdateToast(false)} />}
		</>
	);
}
