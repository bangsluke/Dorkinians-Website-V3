"use client";

import React from "react";
import { motion, PanInfo, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { useNavigationStore, type StatsSubPage } from "@/lib/stores/navigation";
import PlayerStats from "./stats/PlayerStats";
import TeamStats from "./stats/TeamStats";
import ClubStats from "./stats/ClubStats";
import Comparison from "./stats/Comparison";

// Define page arrays outside component to avoid dependency issues
const statsSubPages = [
	{ id: "player-stats" as StatsSubPage, component: PlayerStats, label: "Player Stats" },
	{ id: "team-stats" as StatsSubPage, component: TeamStats, label: "Team Stats" },
	{ id: "club-stats" as StatsSubPage, component: ClubStats, label: "Club Stats" },
	{ id: "comparison" as StatsSubPage, component: Comparison, label: "Player Comparison" },
];

export default function StatsContainer() {
	const { currentStatsSubPage, setStatsSubPage, nextStatsSubPage, previousStatsSubPage, currentMainPage } = useNavigationStore();

	const currentIndex = statsSubPages.findIndex((page) => page.id === currentStatsSubPage);

	// If current page is not found, default to the first page (Player Stats)
	const validCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
	const currentPage = statsSubPages[validCurrentIndex];

	// Auto-switch to Player Stats if current page is not found
	useEffect(() => {
		if (currentMainPage === "stats" && currentIndex < 0) {
			console.log("🔄 [StatsContainer] Current page not found, switching to Player Stats");
			setStatsSubPage("player-stats");
		}
	}, [currentMainPage, currentIndex, setStatsSubPage]);

	// Check if touch event originates from filter pills area
	const isFilterPillsArea = (event: MouseEvent | TouchEvent | PointerEvent | Event): boolean => {
		const target = (event.target || (event as any).currentTarget) as HTMLElement;
		if (!target) return false;
		
		// Check if target or any parent has the filter pills data attribute
		let element: HTMLElement | null = target;
		while (element) {
			if (element.hasAttribute('data-filter-pills-container')) {
				return true;
			}
			element = element.parentElement;
		}
		return false;
	};

	// Conditionally enable drag based on whether touch starts in filter pills area
	// Returns 'x' to allow horizontal drag, or false to disable drag
	const shouldAllowDrag = (event: PointerEvent): boolean | "x" | "y" | undefined => {
		if (isFilterPillsArea(event)) {
			return false;
		}
		return 'x';
	};

	const handleDragEnd = (event: any, info: PanInfo) => {
		const swipeThreshold = 50;
		const velocityThreshold = 500;
		const { offset, velocity } = info;

		// Calculate movement ratio to ensure horizontal movement is clearly dominant
		const horizontalRatio = Math.abs(offset.x) / (Math.abs(offset.y) + 1);
		const velocityRatio = Math.abs(velocity.x) / (Math.abs(velocity.y) + 1);

		// Only trigger if:
		// 1. Horizontal movement is at least 2x greater than vertical (prevents scroll interference)
		// 2. Horizontal movement exceeds threshold
		// 3. Horizontal velocity is significantly greater than vertical (for quick swipes)
		if (
			horizontalRatio >= 2 &&
			Math.abs(offset.x) > swipeThreshold &&
			(velocityRatio >= 1.5 || Math.abs(velocity.x) > velocityThreshold)
		) {
			if (offset.x > 0) {
				// Swiped right - go to previous page
				previousStatsSubPage();
			} else {
				// Swiped left - go to next page
				nextStatsSubPage();
			}
		}
	};

	return (
		<div className='h-full overflow-hidden'>
			{/* Stats Sub-Page Dot Indicators - Mobile only */}
			<div className='md:hidden flex justify-center space-x-3 pt-2.5 pb-0'>
				{statsSubPages.map((page, index) => (
					<button
						key={page.id}
						onClick={() => setStatsSubPage(page.id)}
						className={`w-[6.4px] h-[6.4px] rounded-full transition-all duration-200 ${
							currentStatsSubPage === page.id
								? "bg-dorkinians-yellow scale-125"
								: "bg-gray-400 border-2 border-gray-400 hover:bg-gray-300 hover:border-gray-300"
						}`}
						aria-label={`Go to ${page.label}`}
					/>
				))}
			</div>

			{/* Swipeable Content */}
			<AnimatePresence mode='wait'>
				<motion.div
					key={currentPage?.id || "default"}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2 }}
					drag={shouldAllowDrag as any}
					dragConstraints={{ left: 0, right: 0 }}
					dragElastic={0.05}
					dragDirectionLock={true}
					onDragEnd={handleDragEnd}
					style={{ 
						position: 'relative',
						touchAction: 'pan-y pan-x pinch-zoom'
					}}
					className='h-full'>
					{currentPage ? React.createElement(currentPage.component) : null}
				</motion.div>
			</AnimatePresence>
		</div>
	);
}
