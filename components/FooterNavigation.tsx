"use client";

import { motion } from "framer-motion";
import { HomeIcon, ChartBarIcon, TrophyIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { useNavigationStore, type MainPage } from "@/lib/stores/navigation";

const navigationItems = [
	{ id: "home" as MainPage, icon: HomeIcon, label: "Home" },
	{ id: "stats" as MainPage, icon: ChartBarIcon, label: "Stats" },
	{ id: "totw" as MainPage, icon: TrophyIcon, label: "TOTW" },
	{ id: "club-info" as MainPage, icon: InformationCircleIcon, label: "Club Info" },
];

export default function FooterNavigation() {
	const { currentMainPage, setMainPage } = useNavigationStore();

	// Hide footer navigation on settings page
	if (currentMainPage === "settings") {
		return null;
	}

	return (
		<motion.nav
			className='fixed bottom-0 left-0 right-0 z-50 w-full'
			initial={{ y: 100 }}
			animate={{ y: 0 }}
			transition={{ type: "spring", stiffness: 300, damping: 30 }}>
			<div className='flex items-center gap-2 px-2 md:px-[15%] py-2 pb-[1.3125rem] md:pb-[1.0625rem]'>
				{navigationItems.map((item) => {
					const Icon = item.icon;
					const isActive = currentMainPage === item.id;

					return (
						<motion.button
							key={item.id}
							onClick={() => {
								console.log('🔘 [FooterNavigation] Button clicked:', item.id);
								setMainPage(item.id);
							}}
							className={`flex flex-1 items-center justify-center space-y-1 md:space-y-0 md:space-x-2 flex-col md:flex-row px-3 py-2 rounded-lg transition-colors ${
								isActive ? "text-yellow-400 bg-yellow-400/20" : "text-white hover:text-yellow-300 hover:bg-white/20"
							}`}
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}>
							<Icon className={`w-6 h-6 ${isActive ? "text-yellow-400" : ""}`} />
							<span className={`text-xs font-medium ${isActive ? "text-yellow-400" : ""}`}>{item.label}</span>
						</motion.button>
					);
				})}
			</div>
		</motion.nav>
	);
}
