"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigationStore } from "@/lib/stores/navigation";
import PWAInstallButton from "@/components/admin/PWAInstallButton";
import { seedingStatusService } from "@/lib/services/seedingStatusService";
import Button from "@/components/ui/Button";
import {
	HomeIcon,
	ChartBarIcon,
	TrophyIcon,
	InformationCircleIcon,
	ArrowLeftIcon,
	ClockIcon,
	CheckCircleIcon,
	XCircleIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

const navigationItems = [
	{
		id: "home",
		icon: HomeIcon,
		label: "Home",
		subPages: [],
	},
	{
		id: "stats",
		icon: ChartBarIcon,
		label: "Stats",
		subPages: [
			{ id: "player-stats", label: "Player Stats" },
			{ id: "team-stats", label: "Team Stats" },
			{ id: "club-stats", label: "Club Stats" },
			{ id: "comparison", label: "Comparison" },
		],
	},
	{
		id: "totw",
		icon: TrophyIcon,
		label: "TOTW",
		subPages: [
			{ id: "totw", label: "Team of the Week" },
			{ id: "players-of-month", label: "Players of the Month" },
		],
	},
	{
		id: "club-info",
		icon: InformationCircleIcon,
		label: "Club Info",
		subPages: [
			{ id: "club-information", label: "Club Information" },
			{ id: "league-information", label: "League Information" },
			{ id: "club-captains", label: "Club Captains" },
			{ id: "club-awards", label: "Club Awards" },
			{ id: "useful-links", label: "Useful Links" },
		],
	},
];

export default function Settings() {
	const { setMainPage, setStatsSubPage, setTOTWSubPage, setClubInfoSubPage } = useNavigationStore();
	const [seedingStatus, setSeedingStatus] = useState(seedingStatusService.getSeedingStatus());
	const [isAvailableScreensExpanded, setIsAvailableScreensExpanded] = useState(true);

	// Update seeding status on component mount
	useEffect(() => {
		setSeedingStatus(seedingStatusService.getSeedingStatus());
	}, []);

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
		setMainPage("home");
	};

	const handleCloseClick = () => {
		setMainPage("home");
	};

	return (
		<div className='h-full flex flex-col'>
			{/* Header */}
			<div className='flex items-center justify-between mb-4 p-4 pb-0 pl-6'>
				<div className='flex items-center'>
					<motion.div
						whileHover={{ scale: 1.1 }}
						whileTap={{ scale: 0.9 }}>
						<Button
							variant="icon"
							onClick={handleBackClick}
							aria-label='Go back to home'
							className="mr-4"
							icon={<ArrowLeftIcon className='w-6 h-6 text-white' />} />
					</motion.div>
					<h1 data-testid="settings-heading" className='text-3xl font-bold text-white'>Settings</h1>
				</div>
				{/* Desktop Close Button */}
				<motion.div
					className="hidden md:flex"
					whileHover={{ scale: 1.1 }}
					whileTap={{ scale: 0.9 }}>
					<Button
						variant="icon"
						onClick={handleCloseClick}
						aria-label="Close settings"
						icon={<XMarkIcon className='w-6 h-6 text-white' />} />
				</motion.div>
			</div>

			{/* Navigation List */}
			<div 
				className='flex-1 px-6 pb-6 overflow-y-auto'
				style={{ WebkitOverflowScrolling: 'touch' }}>
				<div className='space-y-4'>
					<Button
						variant="ghost"
						fullWidth
						onClick={() => setIsAvailableScreensExpanded(!isAvailableScreensExpanded)}
						className='flex items-center justify-between text-left mb-6'>
						<h2 className='text-xl font-semibold text-white'>Available Screens</h2>
						{isAvailableScreensExpanded ? (
							<ChevronUpIcon className='w-5 h-5 text-white' />
						) : (
							<ChevronDownIcon className='w-5 h-5 text-white' />
						)}
					</Button>
					{isAvailableScreensExpanded && (
						<div className='space-y-4 mb-6'>
							{navigationItems.map((item) => {
						const Icon = item.icon;
						return (
							<div key={item.id} className='space-y-2'>
								{/* Main Navigation Item */}
								<motion.div
									whileHover={{ scale: 1.02 }}
									whileTap={{ scale: 0.98 }}>
									<Button
										variant="tertiary"
										fullWidth
										data-testid={`settings-nav-${item.id}`}
										onClick={() => handleNavigationClick(item.id)}
										className='w-full p-2 text-left'>
										<div className='flex items-center space-x-4'>
											<div className='p-2 rounded-full bg-dorkinians-yellow/20'>
												<Icon className='w-3 h-3 text-dorkinians-yellow-text' />
											</div>
											<div className='flex-1'>
												<h3 className='text-lg font-semibold text-white'>{item.label}</h3>
											</div>
											<div className='text-dorkinians-yellow-text'>
												<svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
													<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
												</svg>
											</div>
										</div>
									</Button>
								</motion.div>

								{/* Sub-pages */}
								{item.subPages.length > 0 && (
									<div className='ml-12 space-y-2'>
										{item.subPages.map((subPage) => (
											<motion.div
												key={subPage.id}
												whileHover={{ scale: 1.01 }}
												whileTap={{ scale: 0.99 }}>
												<Button
													variant="ghost"
													fullWidth
													onClick={() => handleSubPageClick(item.id, subPage.id)}
													className='w-full p-2 bg-white/5 hover:bg-white/15 text-left'>
													<div className='flex items-center space-x-3'>
														<div className='w-2 h-2 rounded-full bg-dorkinians-yellow/60'></div>
														<span className='text-sm text-gray-300'>{subPage.label}</span>
														<div className='text-dorkinians-yellow-text/60'>
															<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
															</svg>
														</div>
													</div>
												</Button>
											</motion.div>
										))}
									</div>
								)}
							</div>
						);
					})}
						</div>
					)}
				</div>

				{/* Database Status Section */}
				<div className='mt-12 space-y-4'>
					<h2 className='text-xl font-semibold text-white mb-6'>Database Status</h2>
					<div className='bg-white/10 rounded-lg p-4 space-y-3'>
						<div className='flex items-center space-x-3'>
							{seedingStatus.lastSeedingStatus === "success" && <CheckCircleIcon className='w-5 h-5 text-green-400' />}
							{seedingStatus.lastSeedingStatus === "failed" && <XCircleIcon className='w-5 h-5 text-red-400' />}
							{seedingStatus.lastSeedingStatus === "running" && <ClockIcon className='w-5 h-5 text-yellow-400 animate-pulse' />}
							{!seedingStatus.lastSeedingStatus && <ClockIcon className='w-5 h-5 text-gray-400' />}
							<div className='flex-1'>
								<p className='text-sm text-gray-300'>{seedingStatusService.getStatusSummary()}</p>
								{seedingStatus.lastSeedingStatus === "success" && seedingStatus.lastSeedingNodesCreated && (
									<p className='text-xs text-gray-400 mt-1'>
										Created {seedingStatus.lastSeedingNodesCreated.toLocaleString()} nodes and{" "}
										{seedingStatus.lastSeedingRelationshipsCreated?.toLocaleString()} relationships
									</p>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* PWA Install Section */}
				<div className='mt-12 space-y-4'>
					<h2 className='text-xl font-semibold text-white mb-6'>Install App</h2>
					<PWAInstallButton />
				</div>
			</div>
		</div>
	);
}
