"use client";

import React from "react";
import { motion, PanInfo, AnimatePresence } from "framer-motion";
import { useNavigationStore, type ClubInfoSubPage } from "@/lib/stores/navigation";
import ClubInformation from "./club-info/ClubInformation";
import MatchInformation from "./club-info/MatchInformation";
import ClubCaptains from "./club-info/ClubCaptains";
import ClubAwards from "./club-info/ClubAwards";
import UsefulLinks from "./club-info/UsefulLinks";

const clubInfoSubPages = [
	{ id: "club-information" as ClubInfoSubPage, component: ClubInformation, label: "Club Information" },
	{ id: "match-information" as ClubInfoSubPage, component: MatchInformation, label: "Match Information" },
	{ id: "club-captains" as ClubInfoSubPage, component: ClubCaptains, label: "Club Captains" },
	{ id: "club-awards" as ClubInfoSubPage, component: ClubAwards, label: "Club Awards" },
	{ id: "useful-links" as ClubInfoSubPage, component: UsefulLinks, label: "Useful Links" },
];

export default function ClubInfoContainer() {
	const { currentClubInfoSubPage, setClubInfoSubPage, nextClubInfoSubPage, previousClubInfoSubPage } = useNavigationStore();

	const currentIndex = clubInfoSubPages.findIndex((page) => page.id === currentClubInfoSubPage);

	const handleDragEnd = (event: any, info: PanInfo) => {
		const swipeThreshold = 50;
		const { offset } = info;

		if (Math.abs(offset.x) > swipeThreshold) {
			if (offset.x > 0) {
				// Swiped right - go to previous page
				previousClubInfoSubPage();
			} else {
				// Swiped left - go to next page
				nextClubInfoSubPage();
			}
		}
	};

	return (
		<div className='h-full overflow-hidden'>
			{/* Club Info Sub-Page Dot Indicators */}
			<div className='flex justify-center space-x-3 pt-2.5 pb-0'>
				{clubInfoSubPages.map((page, index) => (
					<button
						key={page.id}
						onClick={() => setClubInfoSubPage(page.id)}
						className={`w-[6.4px] h-[6.4px] rounded-full transition-all duration-200 ${
							currentClubInfoSubPage === page.id
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
					key={currentClubInfoSubPage}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2 }}
					drag='x'
					dragConstraints={{ left: 0, right: 0 }}
					onDragEnd={handleDragEnd}
					style={{ position: 'relative' }}
					className='h-full'>
					{clubInfoSubPages[currentIndex] ? React.createElement(clubInfoSubPages[currentIndex].component) : null}
				</motion.div>
			</AnimatePresence>
		</div>
	);
}
