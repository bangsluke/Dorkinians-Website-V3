"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigationStore } from "@/lib/stores/navigation";
import Header from "@/components/Header";
import FooterNavigation from "@/components/FooterNavigation";
import StatsContainer from "@/components/StatsContainer";
import TOTW from "@/components/pages/TOTW";
import ClubInfo from "@/components/pages/ClubInfo";
import ChatbotInterface from "@/components/ChatbotInterface";

export default function HomePage() {
	const { currentMainPage } = useNavigationStore();

	const renderCurrentPage = () => {
		switch (currentMainPage) {
			case "home":
				return (
					<motion.div
						key='home'
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}
						className='flex flex-col items-center justify-center h-full text-center px-6'>
						<h1 className='text-4xl font-bold text-gray-900 mb-6'>Welcome to Dorkinians FC</h1>
						<p className='text-xl text-gray-600 mb-8 max-w-md'>
							Your comprehensive source for club statistics, player performance, and team insights.
						</p>

						{/* Chatbot Interface */}
						<ChatbotInterface />
					</motion.div>
				);

			case "stats":
				return <StatsContainer />;

			case "totw":
				return <TOTW />;

			case "club-info":
				return <ClubInfo />;

			default:
				return null;
		}
	};

	return (
		<div className='min-h-screen bg-gray-50'>
			{/* Header */}
			<Header onSettingsClick={() => console.log("Settings clicked")} />

			{/* Main Content */}
			<main className='pt-20 pb-24 px-4 h-screen'>
				<AnimatePresence mode='wait'>{renderCurrentPage()}</AnimatePresence>
			</main>

			{/* Footer Navigation */}
			<FooterNavigation />
		</div>
	);
}
