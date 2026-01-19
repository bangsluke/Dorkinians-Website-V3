"use client";

import { motion } from "framer-motion";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface PageNavigationArrowsProps {
	onPrevious: () => void;
	onNext: () => void;
	hasPrevious: boolean;
	hasNext: boolean;
}

export default function PageNavigationArrows({ onPrevious, onNext, hasPrevious, hasNext }: PageNavigationArrowsProps) {
	return (
		<div className='hidden md:flex items-center'>
			<motion.button
				onClick={onPrevious}
				disabled={!hasPrevious}
				className={`p-2 rounded-full transition-colors ${
					hasPrevious ? "text-white hover:text-yellow-300 hover:bg-white/20" : "text-gray-500 cursor-not-allowed opacity-50"
				}`}
				whileHover={hasPrevious ? { scale: 1.1 } : {}}
				whileTap={hasPrevious ? { scale: 0.9 } : {}}
				title='Previous page'>
				<ChevronLeftIcon className='w-6 h-6' />
			</motion.button>
			<motion.button
				onClick={onNext}
				disabled={!hasNext}
				className={`p-2 rounded-full transition-colors ${
					hasNext ? "text-white hover:text-yellow-300 hover:bg-white/20" : "text-gray-500 cursor-not-allowed opacity-50"
				}`}
				whileHover={hasNext ? { scale: 1.1 } : {}}
				whileTap={hasNext ? { scale: 0.9 } : {}}
				title='Next page'>
				<ChevronRightIcon className='w-6 h-6' />
			</motion.button>
		</div>
	);
}

