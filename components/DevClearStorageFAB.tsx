"use client";

import { motion } from "framer-motion";
import { TrashIcon } from "@heroicons/react/24/outline";

export default function DevClearStorageFAB() {
	// Only render in development mode
	if (process.env.NODE_ENV !== "development") {
		return null;
	}

	const handleClearStorage = () => {
		if (typeof window !== "undefined") {
			localStorage.clear();
			console.log("🧹 [DevClearStorageFAB] All localStorage cleared!");
			// Optional: Reload page to see fresh state
			// window.location.reload();
		}
	};

	return (
		<motion.button
			onClick={handleClearStorage}
			className="fixed bottom-20 right-4 md:right-8 z-[60] w-12 h-12 md:w-14 md:h-14 rounded-full bg-dorkinians-yellow/90 backdrop-blur-sm shadow-lg hover:bg-dorkinians-yellow hover:shadow-xl transition-all flex items-center justify-center border-2 border-dorkinians-yellow-dark"
			aria-label="Clear all localStorage (Development only)"
			whileHover={{ scale: 1.1 }}
			whileTap={{ scale: 0.9 }}
			initial={{ opacity: 0, scale: 0 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ type: "spring", stiffness: 300, damping: 20 }}>
			<TrashIcon className="w-6 h-6 md:w-7 md:h-7 text-gray-900" />
			{/* DEV badge */}
			<span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
				DEV
			</span>
		</motion.button>
	);
}

