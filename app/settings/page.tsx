"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigationStore } from "@/lib/stores/navigation";
import {
	HomeIcon,
	ChartBarIcon,
	TrophyIcon,
	InformationCircleIcon,
	ArrowLeftIcon,
	ArrowPathIcon,
	BugAntIcon,
	ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import Header from "@/components/Header";
import { appConfig } from "@/config/config";
import dynamic from "next/dynamic";
import FeedbackModal from "@/components/modals/FeedbackModal";
import DataPrivacyModal from "@/components/modals/DataPrivacyModal";

// Dynamically import PWA components to avoid SSR issues
const UpdateToast = dynamic(() => import("@/components/UpdateToast"), { ssr: false });

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
			{ id: "club-stats", label: "Club Stats" },
			{ id: "comparison", label: "Player Comparison" },
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
			{ id: "match-information", label: "Match Information" },
			{ id: "club-captains", label: "Club Captains" },
			{ id: "club-awards", label: "Club Awards" },
			{ id: "useful-links", label: "Useful Links" },
		],
	},
];

interface SiteDetails {
	lastSeededStats: string | null;
	versionReleaseDetails: string | null;
	updatesToCome: string | null;
	statLimitations: string | null;
}

export default function SettingsPage() {
	const { setMainPage, setStatsSubPage, setTOTWSubPage, setClubInfoSubPage } = useNavigationStore();
	const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
	const [updateStatus, setUpdateStatus] = useState<string | null>(null);
	const [showFeedbackModal, setShowFeedbackModal] = useState(false);
	const [showDataPrivacyModal, setShowDataPrivacyModal] = useState(false);
	const [siteDetails, setSiteDetails] = useState<SiteDetails | null>(null);
	const [expandedCards, setExpandedCards] = useState<{ [key: string]: boolean }>({
		isSiteNavigationExpanded: false,
		versionReleaseDetails: false,
		updatesToCome: false,
		statLimitations: false,
	});

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
			// Dynamically import PWA service to avoid SSR issues
			const { pwaUpdateService } = await import("@/lib/services/pwaUpdateService");
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

	// Fetch site details on mount
	useEffect(() => {
		const fetchSiteDetails = async () => {
			try {
				const response = await fetch("/api/site-details");
				if (response.ok) {
					const data = await response.json();
					setSiteDetails(data);
				}
			} catch (error) {
				console.error("Failed to fetch site details:", error);
			}
		};
		fetchSiteDetails();
	}, []);

	const formatDate = (dateString: string | null) => {
		if (!dateString) return "Never";
		try {
			return new Date(dateString).toLocaleString();
		} catch {
			return dateString;
		}
	};

	const toggleCard = (cardKey: string) => {
		setExpandedCards((prev) => ({
			...prev,
			[cardKey]: !prev[cardKey],
		}));
	};

	return (
		<>
			{/* Header */}
			<Header onSettingsClick={handleSettingsClick} isSettingsPage={true} />

			{/* Settings Content */}
			<div className='h-full flex flex-col md:px-[15%]'>
				{/* Header */}
				<div className='flex items-center pt-2 pb-2 px-6'>
					<h1 className='text-2xl font-bold text-white'>Settings</h1>
				</div>

				{/* Navigation List */}
				<div className='flex-1 px-6 pb-6 overflow-y-auto'>
					<div className='space-y-4'>
						{/* Site Navigation - Collapsible */}
						<motion.div
							className='w-full p-4 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 cursor-pointer'
							onClick={() => toggleCard("isSiteNavigationExpanded")}
							whileHover={{ scale: 1.02 }}
							whileTap={{ scale: 0.98 }}>
							<div className='flex items-center justify-between'>
								<h2 className='text-lg font-semibold text-white'>Site Navigation</h2>
								<div className='text-dorkinians-yellow'>
									<svg
										className={`w-5 h-5 transition-transform ${expandedCards.isSiteNavigationExpanded ? "rotate-180" : ""}`}
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
									</svg>
								</div>
							</div>
							{expandedCards.isSiteNavigationExpanded && (
								<div className='mt-4 space-y-2'>
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
					)}
					</motion.div>
					</div>

					{/* Additional Settings Section */}
					<div className='mt-12 space-y-4'>
						<h2 className='text-xl font-semibold text-white mb-6'>App Settings</h2>
						<div className='space-y-3'>
							{/* Check for Updates */}
							<div className='p-4 rounded-lg bg-white/10'>
								<div className='flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0'>
									<div>
										<h3 className='text-lg font-semibold text-white mb-2'>Check for Updates</h3>
										<p className='text-sm text-gray-300'>Check if a new version is available</p>
										{updateStatus && <p className='text-xs text-dorkinians-yellow mt-1'>{updateStatus}</p>}
									</div>
									<motion.button
										onClick={handleCheckForUpdate}
										disabled={isCheckingUpdate}
										className='CTA self-center md:self-auto w-fit md:w-auto'
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

							{/* Version Release Details */}
							{siteDetails?.versionReleaseDetails && (
								<motion.div
									className='w-full p-4 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 cursor-pointer'
									onClick={() => toggleCard("versionReleaseDetails")}
									whileHover={{ scale: 1.02 }}
									whileTap={{ scale: 0.98 }}>
									<div className='flex items-center justify-between'>
										<h3 className='text-lg font-semibold text-white'>Version Release Details</h3>
										<div className='text-dorkinians-yellow'>
											<svg
												className={`w-5 h-5 transition-transform ${expandedCards.versionReleaseDetails ? "rotate-180" : ""}`}
												fill='none'
												stroke='currentColor'
												viewBox='0 0 24 24'>
												<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
											</svg>
										</div>
									</div>
									{expandedCards.versionReleaseDetails && (
										<div className='mt-3 pt-3 border-t border-white/20'>
											<p className='text-sm text-gray-300 whitespace-pre-wrap'>{siteDetails.versionReleaseDetails}</p>
										</div>
									)}
								</motion.div>
							)}

							{/* Updates To Come */}
							{siteDetails?.updatesToCome && (
								<motion.div
									className='w-full p-4 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 cursor-pointer'
									onClick={() => toggleCard("updatesToCome")}
									whileHover={{ scale: 1.02 }}
									whileTap={{ scale: 0.98 }}>
									<div className='flex items-center justify-between'>
										<h3 className='text-lg font-semibold text-white'>Updates To Come</h3>
										<div className='text-dorkinians-yellow'>
											<svg
												className={`w-5 h-5 transition-transform ${expandedCards.updatesToCome ? "rotate-180" : ""}`}
												fill='none'
												stroke='currentColor'
												viewBox='0 0 24 24'>
												<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
											</svg>
										</div>
									</div>
									{expandedCards.updatesToCome && (
										<div className='mt-3 pt-3 border-t border-white/20'>
											<p className='text-sm text-gray-300 whitespace-pre-wrap'>{siteDetails.updatesToCome}</p>
										</div>
									)}
								</motion.div>
							)}

							{/* Stat Limitations */}
							{siteDetails?.statLimitations && (
								<motion.div
									className='w-full p-4 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 cursor-pointer'
									onClick={() => toggleCard("statLimitations")}
									whileHover={{ scale: 1.02 }}
									whileTap={{ scale: 0.98 }}>
									<div className='flex items-center justify-between'>
										<h3 className='text-lg font-semibold text-white'>Stat Limitations</h3>
										<div className='text-dorkinians-yellow'>
											<svg
												className={`w-5 h-5 transition-transform ${expandedCards.statLimitations ? "rotate-180" : ""}`}
												fill='none'
												stroke='currentColor'
												viewBox='0 0 24 24'>
												<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
											</svg>
										</div>
									</div>
									{expandedCards.statLimitations && (
										<div className='mt-3 pt-3 border-t border-white/20'>
											<p className='text-sm text-gray-300 whitespace-pre-wrap'>{siteDetails.statLimitations}</p>
										</div>
									)}
								</motion.div>
							)}

							{/* Report Bug/Feature Request */}
							<motion.button
								onClick={() => setShowFeedbackModal(true)}
								className='w-full p-4 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 text-left'
								whileHover={{ scale: 1.02 }}
								whileTap={{ scale: 0.98 }}>
								<div className='flex items-center space-x-3'>
									<div className='p-2 rounded-full bg-dorkinians-yellow/20'>
										<BugAntIcon className='w-5 h-5 text-dorkinians-yellow' />
									</div>
									<div className='flex-1'>
										<h3 className='text-lg font-semibold text-white mb-1'>Report Bug / Request Feature</h3>
										<p className='text-sm text-gray-300'>Send feedback or report issues</p>
									</div>
									<div className='text-dorkinians-yellow'>
										<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
											<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
										</svg>
									</div>
								</div>
							</motion.button>

							{/* Database last updated */}
							<motion.div
								className='w-full p-4 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200'
								whileHover={{ scale: 1.02 }}
								whileTap={{ scale: 0.98 }}>
								<div className='flex items-center space-x-3'>
									<div className='p-2 rounded-full bg-dorkinians-yellow/20'>
										<ArrowPathIcon className='w-5 h-5 text-dorkinians-yellow' />
									</div>
									<div className='flex-1'>
										<h3 className='text-lg font-semibold text-white mb-1'>Database last updated</h3>
										<p className='text-sm text-gray-300'>{formatDate(siteDetails?.lastSeededStats || null)}</p>
									</div>
								</div>
							</motion.div>

							{/* Data & Privacy */}
							<motion.button
								onClick={() => setShowDataPrivacyModal(true)}
								className='w-full p-4 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 text-left'
								whileHover={{ scale: 1.02 }}
								whileTap={{ scale: 0.98 }}>
								<div className='flex items-center space-x-3'>
									<div className='p-2 rounded-full bg-dorkinians-yellow/20'>
										<ShieldCheckIcon className='w-5 h-5 text-dorkinians-yellow' />
									</div>
									<div className='flex-1'>
										<h3 className='text-lg font-semibold text-white mb-1'>Data & Privacy</h3>
										<p className='text-sm text-gray-300'>Request data removal</p>
									</div>
									<div className='text-dorkinians-yellow'>
										<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
											<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
										</svg>
									</div>
								</div>
							</motion.button>
						</div>
					</div>

					{/* Version Information */}
					<div className='mt-8 text-center'>
						<p className='text-xs text-gray-400'>Version {appConfig.version}</p>
					</div>
				</div>
			</div>

			{/* Update Toast */}
			{showUpdateToast && <UpdateToast onClose={() => setShowUpdateToast(false)} />}

			{/* Modals */}
			<FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />
			<DataPrivacyModal isOpen={showDataPrivacyModal} onClose={() => setShowDataPrivacyModal(false)} />
		</>
	);
}
