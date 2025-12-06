"use client";

import { motion } from "framer-motion";
import { Cog6ToothIcon, XMarkIcon, FunnelIcon } from "@heroicons/react/24/outline";
import { useNavigationStore } from "@/lib/stores/navigation";
import Image from "next/image";

interface HeaderProps {
	onSettingsClick: () => void;
	isSettingsPage?: boolean;
	onFilterClick?: () => void;
	showFilterIcon?: boolean;
}

export default function Header({ onSettingsClick, isSettingsPage = false, onFilterClick, showFilterIcon = false }: HeaderProps) {
	const { setMainPage } = useNavigationStore();

	const handleLogoClick = () => {
		setMainPage("home");
	};

	return (
		<motion.header
			className='fixed top-0 left-0 right-0 z-50 w-full'
			initial={isSettingsPage ? { y: 0 } : { y: -100 }}
			animate={{ y: 0 }}
			transition={isSettingsPage ? {} : { type: "spring", stiffness: 300, damping: 30 }}>
			<div className='flex items-center justify-between px-4 md:px-[15%] py-3'>
				{/* Club Logo */}
				<motion.div
					className='flex items-center space-x-2 cursor-pointer'
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
					onClick={handleLogoClick}
					title='Click to return to homepage'>
					<div className='w-8 h-8 flex items-center justify-center'>
						<Image src='/icons/icon-96x96.png' alt='Dorkinians FC Logo' width={32} height={32} className='rounded-full' />
					</div>
					<span className='font-bold text-xl text-white'>Dorkinians FC</span>
				</motion.div>

				{/* Right side icons */}
				<div className='flex items-center space-x-2'>
					{/* Filter Icon - only show on Player Stats page */}
					{showFilterIcon && onFilterClick && (
						<motion.button
							onClick={onFilterClick}
							className='p-2 rounded-full hover:bg-white/20 transition-colors'
							whileHover={{ scale: 1.1 }}
							whileTap={{ scale: 0.9 }}
							title='Open filters'>
							<FunnelIcon className='w-6 h-6 text-white' />
						</motion.button>
					)}

					{/* Settings/Close Icon */}
					<motion.button
						onClick={onSettingsClick}
						className='p-2 rounded-full hover:bg-white/20 transition-colors'
						whileHover={{ scale: 1.1 }}
						whileTap={{ scale: 0.9 }}
						title={isSettingsPage ? "Close settings" : "Open settings"}>
						{isSettingsPage ? <XMarkIcon className='w-6 h-6 text-white' /> : <Cog6ToothIcon className='w-6 h-6 text-white' />}
					</motion.button>
				</div>
			</div>
		</motion.header>
	);
}
