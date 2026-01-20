"use client";

import React from "react";
import { motion, PanInfo, AnimatePresence } from "framer-motion";
import { useNavigationStore, type TOTWSubPage } from "@/lib/stores/navigation";
import TeamOfTheWeek from "./TeamOfTheWeek";
import PlayersOfMonth from "./PlayersOfMonth";

const totwSubPages = [
	{ id: "totw" as TOTWSubPage, component: TeamOfTheWeek, label: "Team of the Week" },
	{ id: "players-of-month" as TOTWSubPage, component: PlayersOfMonth, label: "Players of the Month" },
];

export default function TOTWContainer() {
	const { currentTOTWSubPage, setTOTWSubPage, nextTOTWSubPage, previousTOTWSubPage } = useNavigationStore();

	const currentIndex = totwSubPages.findIndex((page) => page.id === currentTOTWSubPage);

	const handleDragEnd = (event: any, info: PanInfo) => {
		const swipeThreshold = 50;
		const { offset } = info;

		// Only trigger if horizontal movement is significantly greater than vertical
		// and exceeds threshold
		if (Math.abs(offset.x) > Math.abs(offset.y) && Math.abs(offset.x) > swipeThreshold) {
			if (offset.x > 0) {
				// Swiped right - go to previous page
				previousTOTWSubPage();
			} else {
				// Swiped left - go to next page
				nextTOTWSubPage();
			}
		}
	};

	return (
		<div className='w-full'>

			{/* TOTW Sub-Page Dot Indicators - Mobile only */}
			<div className='md:hidden flex justify-center space-x-3 pt-2.5 pb-0'>
				{totwSubPages.map((page, index) => (
					<button
						key={page.id}
						data-testid={`totw-subpage-indicator-${page.id}`}
						onClick={() => setTOTWSubPage(page.id)}
						className={`w-[6.4px] h-[6.4px] rounded-full transition-all transition-normal ${
							currentTOTWSubPage === page.id
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
					key={currentTOTWSubPage}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2 }}
					drag='x'
					dragConstraints={{ left: 0, right: 0 }}
					dragElastic={0.1}
					onDragEnd={handleDragEnd}
					style={{ 
						position: 'relative',
						touchAction: 'pan-y pinch-zoom',
						willChange: 'transform'
					}}
					className='w-full'>
					{totwSubPages[currentIndex] ? React.createElement(totwSubPages[currentIndex].component) : null}
				</motion.div>
			</AnimatePresence>
		</div>
	);
}
