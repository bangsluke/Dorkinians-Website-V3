"use client";

import { motion, PanInfo } from "framer-motion";
import { useNavigationStore, type StatsSubPage } from "@/lib/stores/navigation";
import PlayerStats from "./stats/PlayerStats";
import TeamStats from "./stats/TeamStats";
import ClubStats from "./stats/ClubStats";
import Comparison from "./stats/Comparison";

const statsSubPages = [
	{ id: "player-stats" as StatsSubPage, component: PlayerStats, label: "Player Stats" },
	{ id: "team-stats" as StatsSubPage, component: TeamStats, label: "Team Stats" },
	{ id: "club-stats" as StatsSubPage, component: ClubStats, label: "Club Stats" },
	{ id: "comparison" as StatsSubPage, component: Comparison, label: "Comparison" },
];

export default function StatsContainer() {
	const { currentStatsSubPage, setStatsSubPage, nextStatsSubPage, previousStatsSubPage } = useNavigationStore();

	const currentIndex = statsSubPages.findIndex((page) => page.id === currentStatsSubPage);

	const handleDragEnd = (event: any, info: PanInfo) => {
		const swipeThreshold = 50;
		const { offset } = info;

		if (Math.abs(offset.x) > swipeThreshold) {
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
			{/* Stats Sub-Page Dot Indicators */}
			<div className='flex justify-center space-x-3 py-6'>
				{statsSubPages.map((page, index) => (
					<button
						key={page.id}
						onClick={() => setStatsSubPage(page.id)}
						className={`w-3 h-3 rounded-full transition-all duration-200 ${
							currentStatsSubPage === page.id 
								? "bg-dorkinians-yellow scale-125" 
								: "bg-gray-400 border-2 border-gray-400 hover:bg-gray-300 hover:border-gray-300"
						}`}
						aria-label={`Go to ${page.label}`}
					/>
				))}
			</div>

			{/* Swipeable Content */}
			<motion.div
				key={currentStatsSubPage}
				initial={{ x: 300, opacity: 0 }}
				animate={{ x: 0, opacity: 1 }}
				exit={{ x: -300, opacity: 0 }}
				transition={{ type: "spring", stiffness: 300, damping: 30 }}
				drag='x'
				dragConstraints={{ left: 0, right: 0 }}
				onDragEnd={handleDragEnd}
				className='h-full'>
				{statsSubPages[currentIndex]?.component()}
			</motion.div>
		</div>
	);
}
