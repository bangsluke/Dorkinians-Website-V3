"use client";

import React from "react";
import { motion, PanInfo } from "framer-motion";
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
			<div className='flex justify-center space-x-3 py-4 pb-0'>
				{clubInfoSubPages.map((page, index) => (
					<button
						key={page.id}
						onClick={() => setClubInfoSubPage(page.id)}
						className={`w-2 h-2 rounded-full transition-all duration-200 ${
							currentClubInfoSubPage === page.id 
								? "bg-dorkinians-yellow scale-125" 
								: "bg-gray-400 border-2 border-gray-400 hover:bg-gray-300 hover:border-gray-300"
						}`}
						aria-label={`Go to ${page.label}`}
					/>
				))}
			</div>

			{/* Swipeable Content */}
			<motion.div
				key={currentClubInfoSubPage}
				initial={{ x: 300, opacity: 0 }}
				animate={{ x: 0, opacity: 1 }}
				exit={{ x: -300, opacity: 0 }}
				transition={{ type: "spring", stiffness: 300, damping: 30 }}
				drag='x'
				dragConstraints={{ left: 0, right: 0 }}
				onDragEnd={handleDragEnd}
				className='h-full'>
				{clubInfoSubPages[currentIndex] ? React.createElement(clubInfoSubPages[currentIndex].component) : null}
			</motion.div>
		</div>
	);
}
