"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useMemo, useRef } from "react";
import React from "react";
import { Cog6ToothIcon, XMarkIcon, FunnelIcon, Bars3Icon } from "@heroicons/react/24/outline";
import { useNavigationStore } from "@/lib/stores/navigation";
import { getActiveFilterCount } from "@/lib/utils/filterUtils";
import Image from "next/image";
import Button from "@/components/ui/Button";

interface HeaderProps {
	onSettingsClick: () => void;
	isSettingsPage?: boolean;
	onFilterClick?: () => void;
	showFilterIcon?: boolean;
	onMenuClick?: () => void;
	showMenuIcon?: boolean;
}

export default function Header({ onSettingsClick, isSettingsPage = false, onFilterClick, showFilterIcon = false, onMenuClick, showMenuIcon = false }: HeaderProps) {
	const { setMainPage, playerFilters, filterData } = useNavigationStore();
	const [showMenuTooltip, setShowMenuTooltip] = useState(false);
	const [showFilterTooltip, setShowFilterTooltip] = useState(false);
	const [hasAnimated, setHasAnimated] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const menuTooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const filterTooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Dismiss tooltips
	const dismissMenuTooltip = () => {
		if (menuTooltipTimeoutRef.current) {
			clearTimeout(menuTooltipTimeoutRef.current);
			menuTooltipTimeoutRef.current = null;
		}
		setShowMenuTooltip(false);
		localStorage.setItem("stats-nav-menu-tooltip-seen", "true");
	};

	const dismissFilterTooltip = () => {
		if (filterTooltipTimeoutRef.current) {
			clearTimeout(filterTooltipTimeoutRef.current);
			filterTooltipTimeoutRef.current = null;
		}
		setShowFilterTooltip(false);
		localStorage.setItem("stats-nav-filter-tooltip-seen", "true");
	};

	const activeFilterCount = useMemo(
		() => getActiveFilterCount(playerFilters, filterData),
		[playerFilters, filterData]
	);

	// Detect mobile on mount and resize
	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 768);
		};
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	}, []);

	// Sequential tooltips on mobile
	useEffect(() => {
		if (showMenuIcon && typeof window !== "undefined" && isMobile) {
			const hasSeenMenuTooltip = localStorage.getItem("stats-nav-menu-tooltip-seen");
			if (!hasSeenMenuTooltip) {
				setShowMenuTooltip(true);
				// Hide menu tooltip after 5 seconds, then show filter tooltip
				menuTooltipTimeoutRef.current = setTimeout(() => {
					dismissMenuTooltip();
					
					// Show filter tooltip after a brief delay
					if (showFilterIcon) {
						const hasSeenFilterTooltip = localStorage.getItem("stats-nav-filter-tooltip-seen");
						if (!hasSeenFilterTooltip) {
							setTimeout(() => {
								setShowFilterTooltip(true);
								filterTooltipTimeoutRef.current = setTimeout(() => {
									dismissFilterTooltip();
								}, 5000);
							}, 500);
						}
					}
				}, 5000);
				return () => {
					if (menuTooltipTimeoutRef.current) {
						clearTimeout(menuTooltipTimeoutRef.current);
					}
					if (filterTooltipTimeoutRef.current) {
						clearTimeout(filterTooltipTimeoutRef.current);
					}
				};
			}
		}
	}, [showMenuIcon, showFilterIcon, isMobile]);

	// Handle click/touch to dismiss tooltips
	useEffect(() => {
		if (!showMenuTooltip && !showFilterTooltip) return;

		const handleClick = () => {
			if (showMenuTooltip) dismissMenuTooltip();
			if (showFilterTooltip) dismissFilterTooltip();
		};

		document.addEventListener('click', handleClick, true);
		document.addEventListener('touchstart', handleClick, true);

		return () => {
			document.removeEventListener('click', handleClick, true);
			document.removeEventListener('touchstart', handleClick, true);
		};
	}, [showMenuTooltip, showFilterTooltip]);

	// Add animation on first visit
	useEffect(() => {
		if (showMenuIcon && typeof window !== "undefined" && !hasAnimated) {
			const hasAnimatedBefore = localStorage.getItem("stats-nav-menu-animated");
			if (!hasAnimatedBefore) {
				setHasAnimated(true);
				localStorage.setItem("stats-nav-menu-animated", "true");
			}
		}
	}, [showMenuIcon, hasAnimated]);

	const handleLogoClick = () => {
		setMainPage("home");
		if (typeof window !== "undefined") {
			window.location.href = "/";
		}
	};

	const showAnyTooltip = showMenuTooltip || showFilterTooltip;

	return (
		<>
			{/* Backdrop overlay when any tooltip is showing */}
			{showAnyTooltip && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className='fixed inset-0 bg-black/20 z-40'
					onClick={() => {
						if (showMenuTooltip) dismissMenuTooltip();
						if (showFilterTooltip) dismissFilterTooltip();
					}}
					onTouchStart={() => {
						if (showMenuTooltip) dismissMenuTooltip();
						if (showFilterTooltip) dismissFilterTooltip();
					}}
				/>
			)}
			<motion.header
				className='md:hidden fixed top-0 left-0 right-0 z-50 w-full'
				initial={isSettingsPage ? { y: 0 } : { y: -100 }}
				animate={{ y: 0 }}
				transition={isSettingsPage ? {} : { type: "spring", stiffness: 300, damping: 30 }}>
				<div className='flex items-center justify-between px-4 md:px-[15%] py-3 min-w-0'>
				{/* Club Logo and Dorkinians FC Text */}
				<motion.button
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
					onClick={handleLogoClick}
					title='Click to return to homepage'
					aria-label='Return to homepage'
					className="flex-shrink-0 min-w-fit inline-flex items-center space-x-2 p-0 bg-transparent border-none h-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent">
					<div className='w-8 h-8 flex items-center justify-center flex-shrink-0'>
						<Image src='/icons/icon-96x96.png' alt='Dorkinians FC Logo' width={32} height={32} loading="eager" className='rounded-full' />
					</div>
					<span className='font-bold text-xl text-[var(--color-text-primary)] whitespace-nowrap flex-shrink-0'>Dorkinians FC</span>
				</motion.button>

				{/* Right side icons */}
				<div className='flex items-center space-x-2 flex-shrink-0'>
					{/* Burger Menu Icon - only show on stats pages */}
					{showMenuIcon && onMenuClick && (
						<div className='relative'>
							<motion.button
								data-testid="header-menu"
								onClick={() => {
									dismissMenuTooltip();
									onMenuClick();
								}}
								className={`p-2 rounded-full hover:bg-[var(--color-surface)] transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
									showMenuTooltip ? 'bg-dorkinians-yellow/20' : ''
								}`}
								whileHover={{ scale: 1.1 }}
								whileTap={{ scale: 0.9 }}
								initial={hasAnimated && !showMenuTooltip ? {} : { scale: 1 }}
								animate={
									showMenuTooltip
										? { scale: [1, 1.15, 1] }
										: hasAnimated
										? {}
										: { scale: [1, 1.15, 1] }
								}
								transition={
									showMenuTooltip
										? { duration: 0.6, repeat: Infinity }
										: hasAnimated
										? {}
										: { duration: 0.6, repeat: 2, delay: 0.5 }
								}
								title={showMenuTooltip ? "Click to navigate sections" : "Open stats navigation"}
								aria-label='Open stats navigation'>
								<Bars3Icon className={`w-6 h-6 ${showMenuTooltip ? 'text-dorkinians-yellow' : 'text-[var(--color-text-primary)]'}`} />
							</motion.button>
							{/* Tooltip - bottom left on mobile, top center on desktop */}
							{showMenuTooltip && (
								<motion.div
									initial={{ opacity: 0, y: isMobile ? 10 : -10 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: isMobile ? 10 : -10 }}
									className={`absolute ${isMobile ? 'top-full -left-8 mt-2' : 'bottom-full left-1/2 transform -translate-x-1/2 mb-2'} px-3 py-2 bg-dorkinians-yellow text-black text-xs font-medium rounded-lg shadow-lg whitespace-nowrap z-50`}
									onClick={(e) => e.stopPropagation()}>
									Click to navigate sections
									<div className={`absolute ${isMobile ? 'bottom-full left-8 -mb-1 border-4 border-transparent border-b-dorkinians-yellow' : 'top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-dorkinians-yellow'}`} />
								</motion.div>
							)}
						</div>
					)}
					{/* Filter Icon - only show on stats pages */}
					{showFilterIcon && onFilterClick && (
						<div className='relative'>
							<motion.button
								data-testid="header-filter"
								onClick={() => {
									dismissFilterTooltip();
									onFilterClick();
								}}
								className={`p-2 rounded-full hover:bg-[var(--color-surface)] transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
									showFilterTooltip ? 'bg-dorkinians-yellow/20' : ''
								}`}
								whileHover={{ scale: 1.1 }}
								whileTap={{ scale: 0.9 }}
								initial={showFilterTooltip ? { scale: 1 } : {}}
								animate={showFilterTooltip ? { scale: [1, 1.15, 1] } : {}}
								transition={showFilterTooltip ? { duration: 0.6, repeat: Infinity } : {}}
								title={showFilterTooltip ? "Click to open filters" : "Open filters"}
								aria-label='Open filters'>
								<FunnelIcon className={`w-6 h-6 ${showFilterTooltip ? 'text-dorkinians-yellow' : 'text-[var(--color-text-primary)]'}`} />
							{/* Active filter count badge */}
							{activeFilterCount > 0 && (
								<span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-dorkinians-yellow text-black text-xs font-bold rounded-full">
									{activeFilterCount > 99 ? '99+' : activeFilterCount}
								</span>
							)}
							</motion.button>
							{/* Filter Tooltip - bottom left on mobile */}
							{showFilterTooltip && isMobile && (
								<motion.div
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: 10 }}
									className='absolute top-full mt-2 px-3 py-2 bg-dorkinians-yellow text-black text-xs font-medium rounded-lg shadow-lg whitespace-nowrap z-50'
									style={{ left: '-72px' }}
									onClick={(e) => e.stopPropagation()}>
									Click to open stats filters
									<div className='absolute bottom-full -mb-1 border-4 border-transparent border-b-dorkinians-yellow' style={{ left: '72px' }} />
								</motion.div>
							)}
						</div>
					)}

					{/* Settings/Close Icon */}
					<motion.button
						data-testid="header-settings"
						onClick={onSettingsClick}
						className='p-2 rounded-full hover:bg-[var(--color-surface)] transition-colors flex items-center justify-center'
						whileHover={{ scale: 1.1 }}
						whileTap={{ scale: 0.9 }}
						title={isSettingsPage ? "Close settings" : "Open settings"}
						aria-label={isSettingsPage ? "Close settings" : "Open settings"}>
						{isSettingsPage ? <XMarkIcon className='w-6 h-6 text-[var(--color-text-primary)]' /> : <Cog6ToothIcon className='w-6 h-6 text-[var(--color-text-primary)]' />}
					</motion.button>
				</div>
			</div>
		</motion.header>
		</>
	);
}
