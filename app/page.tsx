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
	const { currentMainPage, selectedPlayer, isPlayerSelected, isEditMode, selectPlayer, enterEditMode, initializeFromStorage, setMainPage } = useNavigationStore();
	const [showChatbot, setShowChatbot] = useState(false);
	const [showUpdateToast, setShowUpdateToast] = useState(true);

	// Initialize from localStorage after mount
	useEffect(() => {
		initializeFromStorage();
	}, [initializeFromStorage]);

	// Show chatbot when player is loaded from localStorage
	useEffect(() => {
		if (isPlayerSelected && selectedPlayer) {
			setShowChatbot(true);
		}
	}, [isPlayerSelected, selectedPlayer]);

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
										<h1 className='text-lg md:text-xl font-bold text-white mb-3 md:mb-6'>Welcome to Dorkinians FC</h1>
										<p className='text-sm md:text-base text-gray-300 max-w-md mx-auto'>
											Your comprehensive source for club statistics, player performance, and team insights.
										</p>
									</motion.div>
								)}
							</AnimatePresence>

							{/* Player Selection or Player Name Display */}
							<AnimatePresence mode='wait'>
								{!isPlayerSelected ? (
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
								) : (
									<motion.div
										key='player-name'
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
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
									<div className='w-[95%] md:w-full max-w-lg md:max-w-2xl mx-auto'>
										<ChatbotInterface />
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</motion.div>
				);

			case "stats":
				return <StatsContainer />;

			case "totw":
				return <TOTWContainer />;

			case "club-info":
				return <ClubInfoContainer />;

			case "settings":
				return <Settings />;

			default:
				return null;
		}
	};

	return (
		<>
			<div className='min-h-screen'>
				{/* Header */}
				<Header onSettingsClick={handleSettingsClick} />

				{/* Main Content */}
				<main className='pt-20 pb-24 px-4 h-screen'>
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
			{showUpdateToast && (
				<UpdateToast onClose={() => setShowUpdateToast(false)} />
			)}
		</>
	);
}
