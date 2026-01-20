"use client";

import React from "react";
import { motion, PanInfo, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigationStore, type StatsSubPage } from "@/lib/stores/navigation";
import PlayerStats from "./PlayerStats";
import TeamStats from "./TeamStats";
import ClubStats from "./ClubStats";
import Comparison from "./Comparison";
import { log } from "@/lib/utils/logger";

// Define page arrays outside component to avoid dependency issues
const statsSubPages = [
	{ id: "player-stats" as StatsSubPage, component: PlayerStats, label: "Player Stats" },
	{ id: "team-stats" as StatsSubPage, component: TeamStats, label: "Team Stats" },
	{ id: "club-stats" as StatsSubPage, component: ClubStats, label: "Club Stats" },
	{ id: "comparison" as StatsSubPage, component: Comparison, label: "Player Comparison" },
];

export default function StatsContainer() {
	const { currentStatsSubPage, setStatsSubPage, nextStatsSubPage, previousStatsSubPage, currentMainPage } = useNavigationStore();
	const [showSwipeTooltip, setShowSwipeTooltip] = useState(false);
	const swipeTooltipTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

	const currentIndex = statsSubPages.findIndex((page) => page.id === currentStatsSubPage);

	// Dismiss tooltip on click/touch
	const dismissSwipeTooltip = () => {
		if (swipeTooltipTimeoutRef.current) {
			clearTimeout(swipeTooltipTimeoutRef.current);
			swipeTooltipTimeoutRef.current = null;
		}
		setShowSwipeTooltip(false);
		localStorage.setItem("stats-nav-swipe-tooltip-seen", "true");
	};

	// Check if swipe tooltip should be shown on mobile (after filter tooltip)
	useEffect(() => {
		if (typeof window !== "undefined" && window.innerWidth < 768) {
			const checkAndShow = () => {
				const hasSeenSwipeTooltip = localStorage.getItem("stats-nav-swipe-tooltip-seen");
				const hasSeenFilterTooltip = localStorage.getItem("stats-nav-filter-tooltip-seen");
				
				if (!hasSeenSwipeTooltip && hasSeenFilterTooltip) {
					// Wait 500ms after filter tooltip disappears, then show swipe tooltip
					setTimeout(() => {
						setShowSwipeTooltip(true);
						swipeTooltipTimeoutRef.current = setTimeout(() => {
							dismissSwipeTooltip();
						}, 5000);
					}, 500);
					return true;
				}
				return false;
			};
			
			// Check immediately
			if (!checkAndShow()) {
				// If filter tooltip not seen yet, check periodically
				const interval = setInterval(() => {
					if (checkAndShow()) {
						clearInterval(interval);
					}
				}, 500);
				
				// Stop checking after 15 seconds
				const timeout = setTimeout(() => clearInterval(interval), 15000);
				return () => {
					clearInterval(interval);
					clearTimeout(timeout);
				};
			}
		}
	}, []);

	// Handle click/touch to dismiss tooltip
	useEffect(() => {
		if (!showSwipeTooltip) return;

		const handleClick = () => {
			dismissSwipeTooltip();
		};

		document.addEventListener('click', handleClick, true);
		document.addEventListener('touchstart', handleClick, true);

		return () => {
			document.removeEventListener('click', handleClick, true);
			document.removeEventListener('touchstart', handleClick, true);
		};
	}, [showSwipeTooltip]);

	// If current page is not found, default to the first page (Player Stats)
	const validCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
	const currentPage = statsSubPages[validCurrentIndex];

	// Auto-switch to Player Stats if current page is not found
	useEffect(() => {
		if (currentMainPage === "stats" && currentIndex < 0) {
			log("info", "🔄 [StatsContainer] Current page not found, switching to Player Stats");
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
			{/* Backdrop overlay when tooltip is showing */}
			{showSwipeTooltip && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className='fixed inset-0 bg-black/20 z-40'
					onClick={dismissSwipeTooltip}
					onTouchStart={dismissSwipeTooltip}
				/>
			)}

			{/* Stats Sub-Page Dot Indicators - Mobile only */}
			<div className='md:hidden flex justify-center space-x-3 pt-2.5 pb-0 relative z-50'>
				{statsSubPages.map((page, index) => (
					<button
						key={page.id}
						data-testid={`stats-subpage-indicator-${index}`}
						onClick={() => {
							dismissSwipeTooltip();
							setStatsSubPage(page.id);
						}}
						className={`w-[6.4px] h-[6.4px] rounded-full transition-all transition-normal ${
							showSwipeTooltip
								? currentStatsSubPage === page.id
									? "bg-dorkinians-yellow scale-150 border-2 border-dorkinians-yellow"
									: "bg-dorkinians-yellow/70 scale-125 border-2 border-dorkinians-yellow/60"
								: currentStatsSubPage === page.id
								? "bg-dorkinians-yellow scale-125"
								: "bg-gray-400 border-2 border-gray-400 hover:bg-gray-300 hover:border-gray-300"
						}`}
						aria-label={`Go to ${page.label}`}
					/>
				))}
				{/* Swipe Tooltip - appears below dots on mobile */}
				{showSwipeTooltip && (
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						className='absolute top-full mt-2 px-3 py-2 bg-dorkinians-yellow text-black text-xs font-medium rounded-lg shadow-lg whitespace-nowrap z-50'
						style={{ left: 'calc(50% - 40px)', transform: 'translateX(-50%)' }}
						onClick={(e) => e.stopPropagation()}>
						Swipe left or right to navigate
						<div className='absolute bottom-full -mb-1 border-4 border-transparent border-b-dorkinians-yellow' style={{ left: '50%', transform: 'translateX(-50%)' }} />
					</motion.div>
				)}
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
