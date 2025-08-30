"use client";

import { motion, PanInfo } from "framer-motion";
import { useNavigationStore, type TOTWSubPage } from "@/lib/stores/navigation";
import TeamOfTheWeek from "./totw/TeamOfTheWeek";
import PlayersOfMonth from "./totw/PlayersOfMonth";

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

		if (Math.abs(offset.x) > swipeThreshold) {
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
		<div className='h-full overflow-hidden'>
			{/* TOTW Sub-Page Dot Indicators */}
			<div className='flex justify-center space-x-3 py-4 pb-0'>
				{totwSubPages.map((page, index) => (
					<button
						key={page.id}
						onClick={() => setTOTWSubPage(page.id)}
						className={`w-2 h-2 rounded-full transition-all duration-200 ${
							currentTOTWSubPage === page.id 
								? "bg-dorkinians-yellow scale-125" 
								: "bg-gray-400 border-2 border-gray-400 hover:bg-gray-300 hover:border-gray-300"
						}`}
						aria-label={`Go to ${page.label}`}
					/>
				))}
			</div>

			{/* Swipeable Content */}
			<motion.div
				key={currentTOTWSubPage}
				initial={{ x: 300, opacity: 0 }}
				animate={{ x: 0, opacity: 1 }}
				exit={{ x: -300, opacity: 0 }}
				transition={{ type: "spring", stiffness: 300, damping: 30 }}
				drag='x'
				dragConstraints={{ left: 0, right: 0 }}
				onDragEnd={handleDragEnd}
				className='h-full'>
				{totwSubPages[currentIndex]?.component()}
			</motion.div>
		</div>
	);
}
