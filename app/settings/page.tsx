"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigationStore } from "@/lib/stores/navigation";
import { 
	HomeIcon, 
	ChartBarIcon, 
	TrophyIcon, 
	InformationCircleIcon,
	ArrowLeftIcon,
	ArrowPathIcon
} from "@heroicons/react/24/outline";
import Header from "@/components/Header";
import { pwaUpdateService } from "@/lib/services/pwaUpdateService";
import UpdateToast from "@/components/UpdateToast";
import { appConfig } from "@/lib/config/app";

const navigationItems = [
	{ 
		id: "home", 
		icon: HomeIcon, 
		label: "Home", 
		subPages: []
	},
	{ 
		id: "stats", 
		icon: ChartBarIcon, 
		label: "Stats", 
		subPages: [
			{ id: "player-stats", label: "Player Stats" },
			{ id: "team-stats", label: "Team Stats" },
			{ id: "club-stats", label: "Club Stats" },
			{ id: "comparison", label: "Comparison" }
		]
	},
	{ 
		id: "totw", 
		icon: TrophyIcon, 
		label: "TOTW", 
		subPages: [
			{ id: "totw", label: "Team of the Week" },
			{ id: "players-of-month", label: "Players of the Month" }
		]
	},
	{ 
		id: "club-info", 
		icon: InformationCircleIcon, 
		label: "Club Info", 
		subPages: [
			{ id: "club-information", label: "Club Information" },
			{ id: "match-information", label: "Match Information" },
			{ id: "club-captains", label: "Club Captains" },
			{ id: "club-awards", label: "Club Awards" },
			{ id: "useful-links", label: "Useful Links" }
		]
	},
];

export default function SettingsPage() {
	const { setMainPage, setStatsSubPage, setTOTWSubPage, setClubInfoSubPage } = useNavigationStore();
	const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
	const [updateStatus, setUpdateStatus] = useState<string | null>(null);

	const handleNavigationClick = (pageId: string) => {
		setMainPage(pageId as any);
	};

	const handleSubPageClick = (mainPageId: string, subPageId: string) => {
		setMainPage(mainPageId as any);
		
		// Set the appropriate sub-page based on the main page
		switch (mainPageId) {
			case "stats":
				setStatsSubPage(subPageId as any);
				break;
			case "totw":
				setTOTWSubPage(subPageId as any);
				break;
			case "club-info":
				setClubInfoSubPage(subPageId as any);
				break;
		}
	};

	const handleBackClick = () => {
		window.location.href = "/";
	};

	const handleSettingsClick = () => {
		window.location.href = "/";
	};

	const handleCheckForUpdate = async () => {
		setIsCheckingUpdate(true);
		setUpdateStatus(null);
		
		try {
			const updateInfo = await pwaUpdateService.checkForUpdates();
			if (updateInfo.isUpdateAvailable) {
				setUpdateStatus(`Update available: Version ${updateInfo.version}`);
				// Show update toast on settings page
				setShowUpdateToast(true);
			} else {
				setUpdateStatus("No updates available");
			}
		} catch (error) {
			setUpdateStatus("Error checking for updates");
		} finally {
			setIsCheckingUpdate(false);
		}
	};

	const [showUpdateToast, setShowUpdateToast] = useState(false);

	return (
		<>
			{/* Header */}
			<Header onSettingsClick={handleSettingsClick} isSettingsPage={true} />

			{/* Settings Content */}
			<div className='h-full flex flex-col'>
				{/* Header */}
				<div className='flex items-center mb-8 p-6 pb-0'>
					<motion.button
						onClick={handleBackClick}
						className='p-2 rounded-full hover:bg-white/20 transition-colors mr-4'
						whileHover={{ scale: 1.1 }}
						whileTap={{ scale: 0.9 }}>
						<ArrowLeftIcon className='w-6 h-6 text-white' />
					</motion.button>
					<h1 className='text-3xl font-bold text-white'>Settings</h1>
				</div>

				{/* Navigation List */}
				<div className='flex-1 px-6 pb-6 overflow-y-auto'>
					<div className='space-y-4'>
						<h2 className='text-xl font-semibold text-white mb-6'>Available Screens</h2>
						{navigationItems.map((item) => {
							const Icon = item.icon;
							return (
								<div key={item.id} className='space-y-2'>
									{/* Main Navigation Item */}
									<motion.button
										onClick={() => handleNavigationClick(item.id)}
										className='w-full p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 text-left'
										whileHover={{ scale: 1.02 }}
										whileTap={{ scale: 0.98 }}>
										<div className='flex items-center space-x-3'>
											<div className='p-2 rounded-full bg-dorkinians-yellow/20'>
												<Icon className='w-4 h-4 text-dorkinians-yellow' />
											</div>
											<div className='flex-1'>
												<h3 className='text-sm font-semibold text-white'>{item.label}</h3>
											</div>
											<div className='text-dorkinians-yellow'>
												<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
													<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
												</svg>
											</div>
										</div>
									</motion.button>

									{/* Sub-pages */}
									{item.subPages.length > 0 && (
										<div className='space-y-2'>
											{item.subPages.map((subPage) => (
												<motion.button
													key={subPage.id}
													onClick={() => handleSubPageClick(item.id, subPage.id)}
													className='w-full p-3 rounded-lg bg-white/5 hover:bg-white/15 transition-all duration-200 text-left'
													whileHover={{ scale: 1.01 }}
													whileTap={{ scale: 0.99 }}>
													<div className='flex items-center justify-between'>
														<div className='flex items-center space-x-3'>
															<div className='w-2 h-2 rounded-full bg-dorkinians-yellow/60'></div>
															<span className='text-sm text-gray-300'>{subPage.label}</span>
														</div>
														<div className='text-dorkinians-yellow/60'>
															<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
															</svg>
														</div>
													</div>
												</motion.button>
											))}
										</div>
									)}
								</div>
							);
						})}
					</div>

					{/* Additional Settings Section */}
					<div className='mt-12 space-y-4'>
						<h2 className='text-xl font-semibold text-white mb-6'>App Settings</h2>
						<div className='space-y-3'>
							{/* Check for Updates */}
							<div className='p-4 rounded-lg bg-white/10'>
								<div className='flex items-center justify-between'>
									<div>
										<h3 className='text-lg font-semibold text-white mb-2'>Check for Updates</h3>
										<p className='text-sm text-gray-300'>Check if a new version is available</p>
										{updateStatus && (
											<p className='text-xs text-dorkinians-yellow mt-1'>{updateStatus}</p>
										)}
									</div>
									<motion.button
										onClick={handleCheckForUpdate}
										disabled={isCheckingUpdate}
										className='px-4 py-2 bg-dorkinians-yellow text-dorkinians-blue font-semibold rounded-lg hover:bg-dorkinians-yellow/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}>
										{isCheckingUpdate ? (
											<div className='flex items-center space-x-2'>
												<div className='w-4 h-4 border-2 border-dorkinians-blue border-t-transparent rounded-full animate-spin'></div>
												<span>Checking...</span>
											</div>
										) : (
											<div className='flex items-center space-x-2'>
												<ArrowPathIcon className='w-4 h-4' />
												<span>Check</span>
											</div>
										)}
									</motion.button>
								</div>
							</div>
							
							<div className='p-4 rounded-lg bg-white/10'>
								<h3 className='text-lg font-semibold text-white mb-2'>Theme</h3>
								<p className='text-sm text-gray-300'>Customize the app appearance</p>
							</div>
							<div className='p-4 rounded-lg bg-white/10'>
								<h3 className='text-lg font-semibold text-white mb-2'>Notifications</h3>
								<p className='text-sm text-gray-300'>Manage push notifications</p>
							</div>
							<div className='p-4 rounded-lg bg-white/10'>
								<h3 className='text-lg font-semibold text-white mb-2'>Data & Privacy</h3>
								<p className='text-sm text-gray-300'>Manage your data and privacy settings</p>
							</div>
						</div>
					</div>

					{/* Version Information */}
					<div className='mt-8 text-center'>
						<p className='text-xs text-gray-400'>
							Version {appConfig.version}
						</p>
					</div>
				</div>
			</div>

			{/* Update Toast */}
			{showUpdateToast && (
				<UpdateToast onClose={() => setShowUpdateToast(false)} />
			)}
		</>
	);
}
