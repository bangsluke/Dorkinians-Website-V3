"use client";

import { motion } from "framer-motion";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";

interface HeaderProps {
	onSettingsClick: () => void;
}

export default function Header({ onSettingsClick }: HeaderProps) {
	return (
		<motion.header
			className='fixed top-0 left-0 right-0 z-50 frosted-glass w-full'
			initial={{ y: -100 }}
			animate={{ y: 0 }}
			transition={{ type: "spring", stiffness: 300, damping: 30 }}>
			<div className='flex items-center justify-between px-4 py-3'>
				{/* Club Logo */}
				<motion.div className='flex items-center space-x-2' whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
					<div className='w-8 h-8 bg-dorkinians-blue rounded-full flex items-center justify-center'>
						<span className='text-white font-bold text-sm'>D</span>
					</div>
					<span className='font-bold text-lg text-white'>Dorkinians FC</span>
				</motion.div>

				{/* Settings Icon */}
				<motion.button
					onClick={onSettingsClick}
					className='p-2 rounded-full hover:bg-white/20 transition-colors'
					whileHover={{ scale: 1.1 }}
					whileTap={{ scale: 0.9 }}>
					<Cog6ToothIcon className='w-6 h-6 text-white' />
				</motion.button>
			</div>
		</motion.header>
	);
}
