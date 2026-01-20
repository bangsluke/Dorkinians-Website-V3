"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigationStore } from "@/lib/stores/navigation";
import Header from "@/components/layout/Header";
import FooterNavigation from "@/components/layout/FooterNavigation";
import StatsContainer from "@/components/stats/StatsContainer";
import TOTWContainer from "@/components/totw/TOTWContainer";
import ClubInfoContainer from "@/components/club-info/ClubInfoContainer";
import Settings from "@/components/pages/Settings";
import ChatbotInterface from "@/components/chatbot/ChatbotInterface";

export default function HomePage() {
	const { currentMainPage, setMainPage } = useNavigationStore();

	const handleSettingsClick = () => {
		setMainPage("settings");
	};

	const renderCurrentPage = () => {
		switch (currentMainPage) {
			case "home":
				return (
					<motion.div
						key='home'
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						className='flex flex-col items-center justify-center h-full text-center px-6'>
						<h1 className='text-4xl font-bold text-gray-900 mb-6'>Welcome to Dorkinians FC</h1>
						<p className='text-sm md:text-base text-gray-300 mb-8 max-w-md'>
							Your comprehensive source for club statistics, player performance, and team insights
						</p>

						{/* Chatbot Interface */}
						<ChatbotInterface />
					</motion.div>
				);

			case "stats":
				return (
					<motion.div
						key='stats'
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						style={{ position: 'relative', width: '100%', height: '100%' }}>
						<StatsContainer />
					</motion.div>
				);

			case "totw":
				return (
					<motion.div
						key='totw'
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						style={{ position: 'relative', width: '100%', height: '100%' }}>
						<TOTWContainer />
					</motion.div>
				);

			case "club-info":
				return (
					<motion.div
						key='club-info'
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						style={{ position: 'relative', width: '100%', height: '100%' }}>
						<ClubInfoContainer />
					</motion.div>
				);

			case "settings":
				return (
					<motion.div
						key='settings'
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						style={{ position: 'relative', width: '100%', height: '100%' }}>
						<Settings />
					</motion.div>
				);

			default:
				return null;
		}
	};

	return (
		<div className='min-h-screen bg-gray-50'>
			{/* Header */}
			<Header onSettingsClick={handleSettingsClick} />

			{/* Main Content */}
			<main className='pt-20 pb-24 px-4 min-h-screen'>
				<AnimatePresence mode='wait'>{renderCurrentPage()}</AnimatePresence>
			</main>

			{/* Footer Navigation */}
			<FooterNavigation />
		</div>
	);
}
