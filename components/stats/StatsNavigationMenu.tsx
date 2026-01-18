"use client";

import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useNavigationStore, type StatsSubPage } from "@/lib/stores/navigation";
import { useState, useEffect } from "react";

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
			{ id: "positional-stats", label: "Positional Stats" },
			{ id: "match-results", label: "Match Results" },
			{ id: "game-details", label: "Game Details" },
			{ id: "monthly-performance", label: "Monthly Performance" },
			{ id: "defensive-record", label: "Defensive Record" },
			{ id: "distance-travelled", label: "Distance Travelled" },
			{ id: "opposition-locations", label: "Opposition Locations" },
			{ id: "minutes-per-stats", label: "Minutes per Stats" },
			{ id: "opposition-performance", label: "Opposition Performance" },
			{ id: "fantasy-points", label: "Fantasy Points" },
			{ id: "penalty-stats", label: "Penalty Stats" },
			{ id: "awards-and-achievements", label: "Awards and Achievements" },
			{ id: "player-data-table", label: "Data Table", isDataTable: true },
		],
	},
	{
		id: "team-stats" as StatsSubPage,
		label: "Team Stats",
		sections: [
			{ id: "team-key-performance-stats", label: "Key Performance Stats" },
			{ id: "team-recent-games", label: "Recent Form" },
			{ id: "team-top-players", label: "Top Players" },
			{ id: "team-seasonal-performance", label: "Seasonal Performance" },
			{ id: "team-match-results", label: "Match Results" },
			{ id: "team-goals-scored-conceded", label: "Goals Scored vs Conceded" },
			{ id: "team-home-away-performance", label: "Home vs Away Performance" },
			{ id: "team-key-team-stats", label: "Key Team Stats" },
			{ id: "team-unique-player-stats", label: "Unique Player Stats" },
			{ id: "team-best-season-finish", label: "Best Season Finish" },
			{ id: "team-data-table", label: "Data Table", isDataTable: true },
		],
	},
	{
		id: "club-stats" as StatsSubPage,
		label: "Club Stats",
		sections: [
			{ id: "club-key-performance-stats", label: "Key Club Stats" },
			{ id: "club-team-comparison", label: "Team Comparison" },
			{ id: "club-top-players", label: "Top Players" },
			{ id: "club-seasonal-performance", label: "Seasonal Performance" },
			{ id: "club-player-distribution", label: "Player Distribution" },
			{ id: "club-player-tenure", label: "Player Tenure" },
			{ id: "club-stats-distribution", label: "Stats Distribution" },
			{ id: "club-match-results", label: "Match Results" },
			{ id: "club-game-details", label: "Game Details" },
			{ id: "club-big-club-numbers", label: "Big Club Numbers" },
			{ id: "club-goals-scored-conceded", label: "Goals Scored vs Conceded" },
			{ id: "club-home-away-performance", label: "Home vs Away Performance" },
			{ id: "club-other-club-stats", label: "Other Club Stats" },
			{ id: "club-unique-player-stats", label: "Unique Player Stats" },
			{ id: "club-data-table", label: "Data Table", isDataTable: true },
		],
	},
	{
		id: "comparison" as StatsSubPage,
		label: "Comparison",
		sections: [
			{ id: "comparison-radar-chart", label: "Radar Chart" },
			{ id: "comparison-full-comparison", label: "Full Comparison" },
		],
	},
];

export default function StatsNavigationMenu({ isOpen, onClose }: StatsNavigationMenuProps) {
	const { setStatsSubPage, currentStatsSubPage, setDataTableMode, preloadStatsData } = useNavigationStore();
	// Initialize with only the current page expanded
	const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>(() => {
		const initial: Record<string, boolean> = {
			"player-stats": false,
			"team-stats": false,
			"club-stats": false,
			"comparison": false,
		};
		// Expand the current page's section by default
		if (currentStatsSubPage) {
			initial[currentStatsSubPage] = true;
		}
		return initial;
	});

	// Trigger preload when menu opens
	useEffect(() => {
		if (isOpen) {
			// Start preloading asynchronously - don't await, let it run in background
			preloadStatsData().catch(() => {
				// Silently fail - preloading is best effort
			});
		}
	}, [isOpen, preloadStatsData]);

	// Sync expansion state with current page when menu opens or page changes
	useEffect(() => {
		if (isOpen && currentStatsSubPage) {
			setExpandedPages({
				"player-stats": currentStatsSubPage === "player-stats",
				"team-stats": currentStatsSubPage === "team-stats",
				"club-stats": currentStatsSubPage === "club-stats",
				"comparison": currentStatsSubPage === "comparison",
			});
		}
	}, [isOpen, currentStatsSubPage]);

	const togglePage = (pageId: string) => {
		setExpandedPages((prev) => ({
			...prev,
			[pageId]: !prev[pageId],
		}));
	};

	const handleSectionClick = (pageId: StatsSubPage, sectionId?: string, isDataTable?: boolean) => {
		// Handle data table mode
		if (isDataTable) {
			setDataTableMode(true);
			setStatsSubPage(pageId);
			onClose();
			return;
		}
		
		setDataTableMode(false);
		const pageChanged = currentStatsSubPage !== pageId;
		setStatsSubPage(pageId);
		onClose();
		
		// Scroll to section if provided
		if (sectionId) {
			// Wait longer if page changed to allow for transition
			const delay = pageChanged ? 600 : 100;
			
			setTimeout(() => {
				scrollToSection(sectionId);
			}, delay);
		}
	};

	const scrollToSection = (sectionId: string) => {
		const element = document.getElementById(sectionId);
		if (!element) {
			// Retry after a short delay if element not found yet (max 3 retries)
			const retryCount = (scrollToSection as any).retryCount || 0;
			if (retryCount < 3) {
				(scrollToSection as any).retryCount = retryCount + 1;
				setTimeout(() => {
					scrollToSection(sectionId);
				}, 200);
			} else {
				(scrollToSection as any).retryCount = 0;
			}
			return;
		}
		
		// Reset retry count on success
		(scrollToSection as any).retryCount = 0;

		// Find the scrollable container that contains the element
		const findScrollableContainer = (el: HTMLElement): HTMLElement | null => {
			let current: HTMLElement | null = el;
			while (current && current !== document.body) {
				const style = window.getComputedStyle(current);
				const overflowY = style.overflowY;
				const overflowX = style.overflowX;
				
				// Check if this element is scrollable
				if ((overflowY === 'auto' || overflowY === 'scroll') && 
					current.scrollHeight > current.clientHeight) {
					return current;
				}
				
				current = current.parentElement;
			}
			return null;
		};

		const scrollableContainer = findScrollableContainer(element) as HTMLElement | null;

		// iOS detection for smooth scroll compatibility
		const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
			(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

		// Calculate offset for fixed headers and navigation
		const offset = 120;

		if (scrollableContainer) {
			// Scroll within the container
			const containerRect = scrollableContainer.getBoundingClientRect();
			const elementRect = element.getBoundingClientRect();
			
			// Calculate position relative to container
			const scrollTop = scrollableContainer.scrollTop;
			const elementTop = elementRect.top - containerRect.top + scrollTop;
			const targetPosition = Math.max(0, elementTop - offset);

			if (isIOS) {
				// Manual smooth scroll for iOS
				const start = scrollableContainer.scrollTop;
				const distance = targetPosition - start;
				const duration = 600;
				let startTime: number | null = null;
				
				const animateScroll = (currentTime: number) => {
					if (startTime === null) startTime = currentTime;
					const timeElapsed = currentTime - startTime;
					const progress = Math.min(timeElapsed / duration, 1);
					// Easing function (ease-in-out)
					const ease = progress < 0.5 
						? 2 * progress * progress 
						: 1 - Math.pow(-2 * progress + 2, 2) / 2;
					
					scrollableContainer.scrollTop = start + distance * ease;
					
					if (timeElapsed < duration) {
						requestAnimationFrame(animateScroll);
					}
				};
				requestAnimationFrame(animateScroll);
			} else {
				// Use native smooth scroll for non-iOS
				scrollableContainer.scrollTo({
					top: targetPosition,
					behavior: 'smooth'
				});
			}
		} else {
			// Fallback to window scroll if no container found
			const elementPosition = element.getBoundingClientRect().top + window.scrollY;
			const offsetPosition = Math.max(0, elementPosition - offset);
			
			if (isIOS) {
				// Manual smooth scroll for iOS window
				const start = window.scrollY;
				const distance = offsetPosition - start;
				const duration = 600;
				let startTime: number | null = null;
				
				const animateScroll = (currentTime: number) => {
					if (startTime === null) startTime = currentTime;
					const timeElapsed = currentTime - startTime;
					const progress = Math.min(timeElapsed / duration, 1);
					const ease = progress < 0.5 
						? 2 * progress * progress 
						: 1 - Math.pow(-2 * progress + 2, 2) / 2;
					
					window.scrollTo(0, start + distance * ease);
					
					if (timeElapsed < duration) {
						requestAnimationFrame(animateScroll);
					}
				};
				requestAnimationFrame(animateScroll);
			} else {
				window.scrollTo({
					top: offsetPosition,
					behavior: 'smooth'
				});
			}
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
						className='fixed inset-0 bg-black z-50'
					/>

					{/* Menu */}
					<motion.div
						initial={{ x: "-100%" }}
						animate={{ x: 0 }}
						exit={{ x: "-100%" }}
						transition={{ type: "spring", stiffness: 300, damping: 30 }}
						className='fixed left-0 top-0 bottom-0 w-full max-w-md z-50 flex flex-col'
						style={{ backgroundColor: '#0f0f0f' }}
					>
						<div className='flex-1 overflow-y-auto p-4 md:p-6 pb-24'>
							{/* Header */}
							<div className='flex items-center justify-between mb-6'>
								<h2 className='text-2xl font-bold text-white'>Stats Navigation</h2>
								<motion.button
									onClick={onClose}
									className='p-2 rounded-full hover:bg-white/20 transition-colors'
									whileHover={{ scale: 1.1 }}
									whileTap={{ scale: 0.9 }}
									title='Close menu'
									aria-label='Close stats navigation menu'>
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
												data-testid={`stats-nav-menu-${item.id}`}
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
															onClick={() => handleSectionClick(item.id, section.id, (section as any).isDataTable)}
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
						
						{/* Yellow Close Button at Bottom - Always Visible */}
						<div className='flex-shrink-0 flex justify-center p-4 border-t border-white/20' style={{ backgroundColor: '#0f0f0f' }}>
							<motion.button
								onClick={onClose}
								className='px-5 py-2 bg-dorkinians-yellow text-black text-sm font-semibold rounded-lg hover:bg-dorkinians-yellow/90 transition-colors'
								whileHover={{ scale: 1.02 }}
								whileTap={{ scale: 0.98 }}>
								Close
							</motion.button>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}

