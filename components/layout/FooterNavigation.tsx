"use client";

import { motion } from "framer-motion";
import { HomeIcon, ChartBarIcon, TrophyIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { useNavigationStore, type MainPage } from "@/lib/stores/navigation";
import { log } from "@/lib/utils/logger";

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
			className='md:hidden fixed bottom-0 left-0 right-0 z-50 w-full'
			initial={{ y: 100 }}
			animate={{ y: 0 }}
			transition={{ type: "spring", stiffness: 300, damping: 30 }}>
			<div className='flex items-center px-2 md:px-[15%] py-2 pb-[calc(1rem+5px)] md:pb-[calc(0.75rem+5px)] gap-[5px] mx-5'>
				{navigationItems.map((item) => {
					const Icon = item.icon;
					const isActive = currentMainPage === item.id;

					return (
						<motion.div
							key={item.id}
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							className="flex-1 flex items-center justify-center">
							<button
								data-testid={`nav-footer-${item.id}`}
								onClick={() => {
									log("info", "🔘 [FooterNavigation] Button clicked:", item.id);
									setMainPage(item.id);
								}}
								className={`w-full flex flex-col items-center justify-center space-y-1.5 md:space-y-0 md:space-x-2 md:flex-row px-4 py-2 rounded-xl bg-transparent border-none outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorkinians-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
									isActive ? "text-yellow-400 bg-yellow-400/20" : "text-white hover:text-yellow-300 hover:bg-white/20"
								}`}>
								<Icon className={`w-6 h-6 ${isActive ? "text-yellow-400" : "text-white"}`} />
								<span className={`text-sm font-medium whitespace-nowrap ${isActive ? "text-yellow-400" : "text-white"}`}>{item.label}</span>
							</button>
						</motion.div>
					);
				})}
			</div>
		</motion.nav>
	);
}
