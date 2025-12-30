"use client";

import { motion, AnimatePresence } from "framer-motion";
import { TrashIcon, CheckIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

export default function DevClearStorageFAB() {
	const [showToast, setShowToast] = useState(false);

	// Only render in development mode
	if (process.env.NODE_ENV !== "development") {
		return null;
	}

	const handleClearStorage = () => {
		if (typeof window !== "undefined") {
			localStorage.clear();
			console.log("🧹 [DevClearStorageFAB] All localStorage cleared!");
			setShowToast(true);
			// Hide toast after 3 seconds
			setTimeout(() => {
				setShowToast(false);
			}, 3000);
			// Optional: Reload page to see fresh state
			// window.location.reload();
		}
	};

	return (
		<>
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

			{/* Toast Notification */}
			<AnimatePresence>
				{showToast && (
					<motion.div
						initial={{ y: 100, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						exit={{ y: 100, opacity: 0 }}
						transition={{ type: "spring", stiffness: 300, damping: 30 }}
						className="fixed bottom-32 right-4 md:right-8 z-[61]">
						<motion.div
							className="bg-dorkinians-green rounded-lg shadow-lg border border-white/20 p-4 flex items-center space-x-3">
							<div className="p-2 rounded-full bg-dorkinians-yellow/20">
								<CheckIcon className="w-5 h-5 text-dorkinians-yellow" />
							</div>
							<div>
								<p className="text-white font-semibold text-sm">Local storage cleared</p>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}

