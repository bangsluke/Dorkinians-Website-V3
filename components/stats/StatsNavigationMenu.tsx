"use client";

import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useNavigationStore, type StatsSubPage } from "@/lib/stores/navigation";
import { useState } from "react";

interface StatsNavigationMenuProps {
	isOpen: boolean;
	onClose: () => void;
}

const statsNavigationItems = [
	{
		id: "player-stats" as StatsSubPage,
		label: "Player Stats",
		sections: [
			{ id: "key-performance-stats", label: "Key Performance Stats" },
			{ id: "seasonal-performance", label: "Seasonal Performance" },
			{ id: "team-performance", label: "Team Performance" },
			{ id: "monthly-performance", label: "Monthly Performance" },
			{ id: "defensive-record", label: "Defensive Record" },
			{ id: "penalty-stats", label: "Penalty Stats" },
			{ id: "minutes-per-stats", label: "Minutes per Stats" },
			{ id: "fantasy-points", label: "Fantasy Points" },
			{ id: "opposition-map", label: "Opposition Map" },
			{ id: "opposition-performance", label: "Opposition Performance" },
			{ id: "game-details", label: "Game Details" },
			{ id: "awards-and-achievements", label: "Awards and Achievements" },
		],
	},
	{
		id: "team-stats" as StatsSubPage,
		label: "Team Stats",
		sections: [],
	},
	{
		id: "club-stats" as StatsSubPage,
		label: "Club Stats",
		sections: [],
	},
	{
		id: "comparison" as StatsSubPage,
		label: "Comparison",
		sections: [],
	},
];

export default function StatsNavigationMenu({ isOpen, onClose }: StatsNavigationMenuProps) {
	const { setStatsSubPage, currentStatsSubPage } = useNavigationStore();
	const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({
		"player-stats": true,
		"team-stats": true,
		"club-stats": true,
		"comparison": true,
	});

	const togglePage = (pageId: string) => {
		setExpandedPages((prev) => ({
			...prev,
			[pageId]: !prev[pageId],
		}));
	};

	const handleSectionClick = (pageId: StatsSubPage, sectionId?: string) => {
		setStatsSubPage(pageId);
		onClose();
		
		// Scroll to section if provided
		if (sectionId) {
			setTimeout(() => {
				const element = document.getElementById(sectionId);
				if (element) {
					element.scrollIntoView({ behavior: "smooth", block: "start" });
				}
			}, 100);
		}
	};

	if (!isOpen) return null;

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className='fixed inset-0 bg-black/80 z-50'
					/>

					{/* Menu */}
					<motion.div
						initial={{ x: "-100%" }}
						animate={{ x: 0 }}
						exit={{ x: "-100%" }}
						transition={{ type: "spring", stiffness: 300, damping: 30 }}
						className='fixed left-0 top-0 bottom-0 w-full max-w-md bg-gradient-to-br from-gray-900 via-black to-gray-900 z-50 overflow-y-auto'
					>
						<div className='p-4 md:p-6'>
							{/* Header */}
							<div className='flex items-center justify-between mb-6'>
								<h2 className='text-2xl font-bold text-white'>Stats Navigation</h2>
								<motion.button
									onClick={onClose}
									className='p-2 rounded-full hover:bg-white/20 transition-colors'
									whileHover={{ scale: 1.1 }}
									whileTap={{ scale: 0.9 }}
									title='Close menu'>
									<XMarkIcon className='w-6 h-6 text-white' />
								</motion.button>
							</div>

							{/* Navigation Items */}
							<div className='space-y-4'>
								{statsNavigationItems.map((item) => {
									const isExpanded = expandedPages[item.id];
									const hasSections = item.sections.length > 0;

									return (
										<div key={item.id} className='space-y-2'>
											{/* Main Page Button */}
											<motion.button
												onClick={() => {
													if (hasSections) {
														togglePage(item.id);
													} else {
														handleSectionClick(item.id);
													}
												}}
												className={`w-full p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 text-left ${
													currentStatsSubPage === item.id ? "ring-2 ring-dorkinians-yellow" : ""
												}`}
												whileHover={{ scale: 1.02 }}
												whileTap={{ scale: 0.98 }}>
												<div className='flex items-center justify-between'>
													<h3 className='text-lg font-semibold text-white'>{item.label}</h3>
													{hasSections && (
														<div className='text-dorkinians-yellow'>
															<svg
																className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
																fill='none'
																stroke='currentColor'
																viewBox='0 0 24 24'>
																<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
															</svg>
														</div>
													)}
												</div>
											</motion.button>

											{/* Sections */}
											{hasSections && isExpanded && (
												<div className='space-y-2 ml-4'>
													{item.sections.map((section) => (
														<motion.button
															key={section.id}
															onClick={() => handleSectionClick(item.id, section.id)}
															className='w-full p-3 rounded-lg bg-white/5 hover:bg-white/15 transition-all duration-200 text-left'
															whileHover={{ scale: 1.01 }}
															whileTap={{ scale: 0.99 }}>
															<div className='flex items-center justify-between'>
																<div className='flex items-center space-x-3'>
																	<div className='w-2 h-2 rounded-full bg-dorkinians-yellow/60'></div>
																	<span className='text-sm text-gray-300'>{section.label}</span>
																</div>
																<div className='text-dorkinians-yellow/60'>
																	<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																		<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
																	</svg>
																</div>
															</div>
														</motion.button>
													))}
												</div>
											)}
										</div>
									);
								})}
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
