"use client";

import { useNavigationStore, type PlayerData } from "@/lib/stores/navigation";
import { statObject, statsPageConfig, appConfig, calculateCardFineTotal, featureFlags } from "@/config/config";
import Image from "next/image";
import Link from "next/link";
import { useState, useMemo, useRef, useEffect } from "react";
import { cachedFetch, generatePageCacheKey } from "@/lib/utils/pageCache";
import { createPortal } from "react-dom";
/* COMMENTED OUT: Share Stats functionality - will be re-added in the future */
// import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import PenOnPaperIcon from "@/components/icons/PenOnPaperIcon";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import FilterPills from "@/components/filters/FilterPills";
import dynamic from "next/dynamic";
import LazyWhenVisible from "@/components/perf/LazyWhenVisible";
/* COMMENTED OUT: Share Stats functionality - will be re-added in the future */
// import ShareableStatsCard from "@/components/stats/ShareableStatsCard";
// import ShareVisualizationModal from "@/components/stats/ShareVisualizationModal";
// import IOSSharePreviewModal from "@/components/stats/IOSSharePreviewModal";
// import SharePreviewModal from "@/components/stats/SharePreviewModal";
// import { generateShareImage, shareImage, performIOSShare, performNonIOSShare, getAvailableVisualizations } from "@/lib/utils/shareUtils";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/utils/pwaDebug";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { ChartSkeleton, TableSkeleton, StatCardSkeleton, AwardsListSkeleton, DataTableSkeleton } from "@/components/skeletons";
import { log } from "@/lib/utils/logger";
import { UmamiEvents } from "@/lib/analytics/events";
import { trackStatsStatSelected } from "@/lib/analytics/statsTracking";
import { trackEvent } from "@/lib/utils/trackEvent";
import Button from "@/components/ui/Button";
import { calculateFTPBreakdown } from "@/lib/utils/fantasyPoints";
import { ErrorState, EmptyState } from "@/components/ui/StateComponents";
import { useToast } from "@/lib/hooks/useToast";
import AllGamesModal from "@/components/stats/AllGamesModal";
import PlayerRecentFormBoxes, { type PlayerFormRecentMatch } from "@/components/stats/PlayerRecentFormBoxes";
import { type EarnedBadgeRow, type ProgressRow } from "@/components/stats/PlayerBadgeMilestoneGrid";
import { getPlayerProfileHref } from "@/lib/profile/slug";
import type { LiveStreakPayload, StreakDateRange, StreakTooltipMeta } from "@/lib/stats/playerStreaksComputation";
import { matchRatingCircleStyle } from "@/lib/utils/matchRatingDisplay";
import { formatXiTeamLabel } from "@/lib/utils/formatXiTeamLabel";
import RecordingsSection from "@/components/stats/RecordingsSection";
import type { RecordingFixture } from "@/lib/utils/recordingsDisplay";

// Dynamically import OppositionMap to reduce initial bundle size (includes Google Maps)
const OppositionMap = dynamic(() => import("@/components/maps/OppositionMap"), {
	loading: () => <div className="text-white/60 text-sm p-4">Loading map...</div>,
	ssr: false,
});
const OppositionPerformanceScatter = dynamic(
	() => import("@/components/stats/OppositionPerformanceScatter"),
	{ ssr: false, loading: () => <ChartSkeleton /> },
);
const FormComposedChart = dynamic(() => import("./player-stats/FormComposedChart"), {
	ssr: false,
	loading: () => <ChartSkeleton />,
});
const SeasonalPerformanceChart = dynamic(() => import("./player-stats/SeasonalPerformanceChart"), {
	ssr: false,
	loading: () => <ChartSkeleton />,
});
const TeamPerformanceChart = dynamic(() => import("./player-stats/TeamPerformanceChart"), {
	ssr: false,
	loading: () => <ChartSkeleton />,
});
const MatchResultsPieChart = dynamic(() => import("./player-stats/MatchResultsPieChart"), {
	ssr: false,
	loading: () => <ChartSkeleton />,
});
const MonthlyPerformanceChart = dynamic(() => import("./player-stats/MonthlyPerformanceChart"), {
	ssr: false,
	loading: () => <ChartSkeleton />,
});

type PlayerStatsTableMode = "totals" | "perApp" | "per90";
type PlayerStatsKeyMode = "totals" | "per90";
type PartnershipSortMode = "bestWinRate" | "mostImprovedWinRate" | "mostGames";
type FormTrend = "rising" | "declining" | "stable";

const PER90_STAT_NAMES = new Set([
	"goalsPer90",
	"assistsPer90",
	"goalInvolvementsPer90",
	"ftpPer90",
	"cleanSheetsPer90",
	"concededPer90",
	"savesPer90",
	"cardsPer90",
	"momPer90",
]);

function formatFormWeekLabel(value: string | null | undefined): string {
	if (!value) return "-";
	const label = value.trim();
	const seasonWeek = label.match(/^(.+)-(\d+)$/);
	if (seasonWeek) {
		return `${seasonWeek[1]} Week ${seasonWeek[2]}`;
	}
	return label;
}

// Page-specific skeleton components (Player Stats only)
function PositionalStatsSkeleton() {
	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<Skeleton height={20} width="40%" className="mb-2" />
			<div className='w-full relative' style={{ height: '200px', overflow: 'hidden' }}>
				{/* Pitch outline */}
				<Skeleton height="100%" className="rounded" />
				{/* Position sections */}
				<div className='absolute inset-0 flex'>
					<Skeleton height="100%" width="33.33%" className="opacity-50" />
					<Skeleton height="100%" width="33.33%" className="opacity-50" />
					<Skeleton height="100%" width="33.33%" className="opacity-50" />
				</div>
			</div>
		</div>
	);
}

function PenaltyStatsSkeleton() {
	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<Skeleton height={20} width="40%" className="mb-2" />
			<div className='w-full relative' style={{ height: '200px', overflow: 'hidden' }}>
				<Skeleton height="100%" className="rounded" />
				{/* Goal and penalty circles */}
				<div className='absolute inset-0'>
					<Skeleton circle height={40} width={40} style={{ position: 'absolute', top: '30%', left: '35%' }} />
					<Skeleton circle height={40} width={40} style={{ position: 'absolute', top: '30%', left: '55%' }} />
					<Skeleton circle height={40} width={40} style={{ position: 'absolute', top: '20%', left: '70%' }} />
					<Skeleton circle height={40} width={40} style={{ position: 'absolute', top: '60%', left: '30%' }} />
				</div>
			</div>
			<div className='mt-2'>
				<TableSkeleton rows={4} />
			</div>
		</div>
	);
}

// Page-specific skeleton components (keep in this file)

function StreakStatTile({
	label,
	current,
	seasonBest,
	allTimeBest,
	tip,
	currentLine,
	seasonBestLine,
	allTimeBestLine,
}: {
	label: string;
	current: number;
	seasonBest: string;
	allTimeBest: string;
	tip: string;
	currentLine: string;
	seasonBestLine: string;
	allTimeBestLine: string;
}) {
	const lit = current > 0;
	return (
		<div
			tabIndex={0}
			className={`relative group rounded-md p-2 flex flex-col items-center text-center gap-1 cursor-help outline-none focus-visible:ring-2 focus-visible:ring-dorkinians-yellow/80 ${
				lit ? "bg-white/12" : "bg-white/5 opacity-75"
			}`}
		>
			<div
				className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold ${
					lit ? "bg-dorkinians-yellow text-black" : "bg-white/15 text-white/80"
				}`}
			>
				{current}
			</div>
			<p className='text-white/85 text-[11px] md:text-xs leading-tight'>{label}</p>
			<p className='text-white/45 text-[10px] leading-tight w-full'>Season best: {seasonBest}</p>
			<p className='text-white/45 text-[10px] leading-tight w-full'>All-time best: {allTimeBest}</p>
			<div className='pointer-events-none absolute left-1/2 bottom-full z-40 mb-2 hidden w-[17rem] -translate-x-1/2 rounded-md bg-black/95 p-2 text-left text-[11px] text-white shadow-xl ring-1 ring-white/15 group-hover:block group-focus-within:block'>
				<p className='text-white/95 leading-snug'>{tip}</p>
				<div className='mt-2 pt-2 border-t border-white/20 space-y-1 text-white/90'>
					<p>{currentLine}</p>
					<p>{seasonBestLine}</p>
					<p>{allTimeBestLine}</p>
				</div>
			</div>
		</div>
	);
}

function FantasyPointsSkeleton() {
	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<Skeleton height={20} width="40%" className="mb-4" />
			{/* Total points card */}
			<div className='mb-4'>
				<Skeleton height={60} className="rounded-lg" />
			</div>
			{/* Breakdown table */}
			<TableSkeleton rows={5} />
		</div>
	);
}

function StatRow({
	stat,
	value,
	playerData,
	tableMode,
}: {
	stat: any;
	value: any;
	playerData: PlayerData;
	tableMode: PlayerStatsTableMode;
}) {
	const [showTooltip, setShowTooltip] = useState(false);
	const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number; placement: 'above' | 'below' } | null>(null);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);
	const rowRef = useRef<HTMLTableRowElement>(null);
	const tooltipRef = useRef<HTMLDivElement | null>(null);

	// Find all scroll containers up the DOM tree
	const findScrollContainers = (element: HTMLElement | null): HTMLElement[] => {
		const containers: HTMLElement[] = [];
		let current: HTMLElement | null = element;
		
		while (current && current !== document.body) {
			const style = window.getComputedStyle(current);
			const overflowY = style.overflowY;
			const overflowX = style.overflowX;
			
			if (overflowY === 'auto' || overflowY === 'scroll' || overflowX === 'auto' || overflowX === 'scroll') {
				containers.push(current);
			}
			
			current = current.parentElement;
		}
		
		return containers;
	};

	const updateTooltipPosition = () => {
		if (!rowRef.current) return;
		
		const rect = rowRef.current.getBoundingClientRect();
		const viewportHeight = window.innerHeight;
		const viewportWidth = window.innerWidth;
		
		// Find scroll containers
		const scrollContainers = findScrollContainers(rowRef.current);
		
		// Calculate tooltip dimensions - use actual if available, otherwise estimate
		let tooltipHeight = 60; // Default estimate
		const tooltipWidth = 256; // w-64 = 16rem = 256px
		
		// Try to measure actual tooltip if it exists
		if (tooltipRef.current) {
			const tooltipRect = tooltipRef.current.getBoundingClientRect();
			tooltipHeight = tooltipRect.height || 60;
		}
		
		// Calculate available space above and below
		const spaceBelow = viewportHeight - rect.bottom;
		const spaceAbove = rect.top;
		const margin = 10; // Minimum margin from viewport edge
		const arrowHeight = 8; // Height of arrow
		const spacing = 8; // Space between row and tooltip
		
		// Determine placement based on available space
		let placement: 'above' | 'below' = 'below';
		let top: number;
		
		const neededSpaceBelow = tooltipHeight + arrowHeight + spacing + margin;
		const neededSpaceAbove = tooltipHeight + arrowHeight + spacing + margin;
		
		if (spaceBelow < neededSpaceBelow && spaceAbove > neededSpaceAbove) {
			// Show above if not enough space below but enough above
			placement = 'above';
			top = rect.top + window.scrollY - tooltipHeight - arrowHeight - spacing;
		} else if (spaceBelow >= neededSpaceBelow) {
			// Show below if enough space
			placement = 'below';
			top = rect.bottom + window.scrollY + spacing;
		} else {
			// Default to above if neither has enough space (prefer above to avoid going off bottom)
			placement = 'above';
			top = Math.max(margin, rect.top + window.scrollY - tooltipHeight - arrowHeight - spacing);
		}
		
		// Calculate horizontal position (center on row, but keep within viewport)
		let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipWidth / 2);
		
		// Ensure tooltip stays within viewport with margin
		if (left < window.scrollX + margin) {
			left = window.scrollX + margin;
		} else if (left + tooltipWidth > window.scrollX + viewportWidth - margin) {
			left = window.scrollX + viewportWidth - tooltipWidth - margin;
		}
		
		setTooltipPosition({ top, left, placement });
	};

	// Update position when tooltip becomes visible (to measure actual dimensions)
	useEffect(() => {
		if (showTooltip) {
			// Use a small delay to ensure tooltip is rendered and we can measure it
			const timeoutId = setTimeout(() => {
				updateTooltipPosition();
			}, 0);
			return () => clearTimeout(timeoutId);
		}
	}, [showTooltip]);

	// Add scroll listeners
	useEffect(() => {
		if (!showTooltip || !rowRef.current) return;
		
		const scrollContainers = findScrollContainers(rowRef.current);
		const handleScroll = () => {
			updateTooltipPosition();
		};
		
		// Add listeners to window and all scroll containers
		window.addEventListener('scroll', handleScroll, true);
		scrollContainers.forEach(container => {
			container.addEventListener('scroll', handleScroll, true);
		});
		
		return () => {
			window.removeEventListener('scroll', handleScroll, true);
			scrollContainers.forEach(container => {
				container.removeEventListener('scroll', handleScroll, true);
			});
		};
	}, [showTooltip]);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	const handleMouseEnter = () => {
		updateTooltipPosition();
		// Use animation token: --delay-tooltip-mouse (300ms)
		timeoutRef.current = setTimeout(() => {
			setShowTooltip(true);
		}, 300);
	};

	const handleMouseLeave = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		setShowTooltip(false);
		setTooltipPosition(null);
	};

	const handleTouchStart = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		updateTooltipPosition();
		// Use animation token: --delay-tooltip-touch (500ms)
		timeoutRef.current = setTimeout(() => {
			setShowTooltip(true);
		}, 500);
	};

	const handleTouchEnd = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		setShowTooltip(false);
		setTooltipPosition(null);
	};

	const isPer90Stat = PER90_STAT_NAMES.has(stat.statName);
	const isPer90ThresholdMet = toNumber(playerData.minutes) >= 360;
	const showPer90ThresholdMessage = tableMode === "per90" && isPer90Stat && !isPer90ThresholdMet;

	return (
		<>
			<tr
				ref={rowRef}
				className={`border-b border-white/10 transition-colors relative group cursor-help ${
					showPer90ThresholdMessage ? "opacity-55" : "hover:bg-white/5"
				}`}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}>
				<td className='px-3 md:px-4 py-2 md:py-3'>
					<div className='flex items-center justify-center w-6 h-6 md:w-8 md:h-8'>
						<Image
							src={`/stat-icons/${stat.iconName}.svg`}
							alt={stat.displayText}
							width={24}
							height={24}
							className='w-6 h-6 md:w-8 md:h-8 object-contain'
						/>
					</div>
				</td>
				<td className='px-3 md:px-4 py-2 md:py-3'>
					<span className='text-white font-medium text-xs md:text-sm'>{stat.displayText}</span>
				</td>
				<td className='px-3 md:px-4 py-2 md:py-3 text-right whitespace-nowrap'>
					<span className='text-white font-mono text-xs md:text-sm'>
						{(() => {
							if (showPer90ThresholdMessage) {
								return "Min. 360 mins";
							}
							const formatted = formatStatValue(value, stat.statFormat, stat.numberDecimalPlaces, (stat as any).statUnit);
							if (stat.statName === "minutes") {
								// Extract number and unit, format number with commas
								const match = formatted.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
								if (match) {
									const num = parseFloat(match[1]);
									const unit = match[2] || "";
									const numWithCommas = Math.round(num).toLocaleString();
									return unit ? `${numWithCommas} ${unit}` : numWithCommas;
								}
							}
							return formatted;
						})()}
					</span>
				</td>
			</tr>
			{showTooltip && tooltipPosition && typeof document !== 'undefined' && createPortal(
				<div 
					ref={tooltipRef}
					className='fixed z-[9999] px-3 py-2 text-sm text-white rounded-lg shadow-lg w-64 text-center pointer-events-none' 
					style={{ 
						backgroundColor: '#0f0f0f',
						top: `${tooltipPosition.top}px`,
						left: `${tooltipPosition.left}px`
					}}>
					{tooltipPosition.placement === 'above' ? (
						<div className='absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent mt-1' style={{ borderTopColor: '#0f0f0f' }}></div>
					) : (
						<div className='absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent mb-1' style={{ borderBottomColor: '#0f0f0f' }}></div>
					)}
					{showPer90ThresholdMessage ? "Min. 360 minutes required" : stat.description}
				</div>,
				document.body
			)}
		</>
	);
}

function formatStatValue(value: any, statFormat: string, decimalPlaces: number, statUnit?: string): string {
	if (value === null || value === undefined) return "N/A";

	// Helper to convert Neo4j Integer objects or any value to a number
	const toNumber = (val: any): number => {
		if (val === null || val === undefined) return 0;
		if (typeof val === "number") {
			if (isNaN(val)) return 0;
			return val;
		}
		// Handle Neo4j Integer objects
		if (typeof val === "object") {
			if ("toNumber" in val && typeof val.toNumber === "function") {
				return val.toNumber();
			}
			if ("low" in val && "high" in val) {
				// Neo4j Integer format: low + high * 2^32
				const low = val.low || 0;
				const high = val.high || 0;
				return low + high * 4294967296;
			}
		}
		const num = Number(val);
		return isNaN(num) ? 0 : num;
	};

	const numValue = toNumber(value);

	let formattedValue: string;
	switch (statFormat) {
		case "Integer":
			formattedValue = Math.round(numValue).toString();
			break;
		case "Decimal1":
			formattedValue = numValue.toFixed(1);
			break;
		case "Decimal2":
			formattedValue = numValue.toFixed(decimalPlaces);
			break;
		case "Percentage":
			formattedValue = `${numValue.toFixed(1)}%`;
			break;
		case "String":
			formattedValue = String(value);
			break;
		default:
			formattedValue = String(value);
	}

	return statUnit ? `${formattedValue} ${statUnit}` : formattedValue;
}

// Helper to convert PlayerData values to numbers
function toNumber(val: any): number {
	if (val === null || val === undefined) return 0;
	if (typeof val === "number") {
		if (isNaN(val)) return 0;
		return val;
	}
	if (typeof val === "object") {
		if ("toNumber" in val && typeof val.toNumber === "function") {
			return val.toNumber();
		}
		if ("low" in val && "high" in val) {
			const low = val.low || 0;
			const high = val.high || 0;
			return low + high * 4294967296;
		}
	}
	const num = Number(val);
	return isNaN(num) ? 0 : num;
}

function formatTooltipDate(dateIso: string | null): string {
	if (!dateIso) return "";
	const [year, month, day] = dateIso.split("-");
	if (!year || !month || !day) return dateIso;
	return `${day}/${month}/${year}`;
}

function formatTooltipDateRange(range: StreakDateRange | null | undefined): string {
	const start = formatTooltipDate(range?.startDate ?? null);
	const end = formatTooltipDate(range?.endDate ?? null);
	if (!start && !end) return "";
	if (start && end) {
		return start === end ? ` (${start})` : ` (${start} - ${end})`;
	}
	return ` (${start || end})`;
}

function formatStreakCountLabel(count: number, singular: string, plural: string): string {
	return `${count} ${count === 1 ? singular : plural}`;
}

// Penalty Stats Visualization Component
function PenaltyStatsVisualization({ scored, missed, saved, conceded, penaltyShootoutScored, penaltyShootoutMissed, penaltyShootoutSaved }: { scored: number; missed: number; saved: number; conceded: number; penaltyShootoutScored: number; penaltyShootoutMissed: number; penaltyShootoutSaved: number }) {
	
	// Calculate sizes (max size 120px, min size 30px) - increased by 50%
	const maxValue = Math.max(scored, missed, saved, conceded, penaltyShootoutScored, penaltyShootoutMissed, penaltyShootoutSaved, 1);
	const scoredSize = Math.max(30, Math.min(120, (scored / maxValue) * 120));
	const missedSize = Math.max(30, Math.min(120, (missed / maxValue) * 120));
	const savedSize = Math.max(30, Math.min(120, (saved / maxValue) * 120)); // Same scaling as scored
	const concededWidth = Math.max(30, Math.min(150, (conceded / maxValue) * 150));
	const concededHeight = Math.max(22.5, Math.min(60, (conceded / maxValue) * 60));
	const penaltyShootoutScoredSize = Math.max(30, Math.min(120, (penaltyShootoutScored / maxValue) * 120));
	const penaltyShootoutSavedSize = Math.max(30, Math.min(120, (penaltyShootoutSaved / maxValue) * 120));
	const penaltyShootoutMissedSize = Math.max(30, Math.min(120, (penaltyShootoutMissed / maxValue) * 120));
	
	// Goal dimensions
	const goalWidth = 200;
	const goalHeight = 120;
	const goalX = 150;
	const goalY = 50;
	
	// Center positions
	const goalCenterX = goalX + goalWidth / 2;
	const goalCenterY = goalY + goalHeight / 2;
	
	// Penalty box dimensions (semi-circle in front of goal)
	const penaltyBoxRadius = 60;
	const penaltyBoxCenterY = goalY + goalHeight;
	
	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Penalty Stats</h3>
			<div className='w-full relative' style={{ height: '200px', overflow: 'hidden' }}>
				{/* Background SVG from TOTW - zoomed 3.5x, showing top center with less vertical height, trimmed more from bottom */}
				<div className='absolute inset-0 w-full' style={{ top: '30px', bottom: '40px' }}>
					<Image
						src='/totw-images/TOTWBackground.svg'
						alt='Football Pitch'
						fill
						className='object-cover w-full h-full'
						style={{ 
							objectPosition: 'center top',
							transform: 'scale(4)',
							transformOrigin: 'center top'
						}}
						loading="lazy"
					/>
				</div>
				
				<svg width='100%' height='300' viewBox='0 0 500 300' preserveAspectRatio='xMidYMid meet' className='relative z-10'>
					
					{/* Green circle - Scored (left side of center line, moved up more and separated further) */}
					{scored > 0 && (
						<g>
							{/* Larger invisible hit area */}
							<circle
								cx={goalCenterX - 65}
								cy={goalCenterY - 80}
								r={scoredSize / 2 + 15}
								fill='transparent'
								cursor='pointer'
							/>
							<circle
								cx={goalCenterX - 65}
								cy={goalCenterY - 80}
								r={scoredSize / 2}
								fill='#22c55e'
								cursor='pointer'
								style={{ transition: 'opacity 0.2s', opacity: '0.8' }}
								onMouseOver={(e) => {
									e.currentTarget.style.opacity = '1';
								}}
								onMouseOut={(e) => {
									e.currentTarget.style.opacity = '0.8';
								}}
							/>
							<text
								x={goalCenterX - 65}
								y={goalCenterY - 80}
								textAnchor='middle'
								dominantBaseline='middle'
								fill='#ffffff'
								fontSize='24'
								fontWeight='bold'
								pointerEvents='none'
								style={{ zIndex: 9999 }}
							>
								{scored}
							</text>
						</g>
					)}
					
					{/* Blue circle - Saved (right side of center line, moved up more and separated further) */}
					{saved > 0 && (
						<g>
							{/* Larger invisible hit area */}
							<circle
								cx={goalCenterX + 60}
								cy={goalCenterY - 80}
								r={savedSize / 2 + 15}
								fill='transparent'
								cursor='pointer'
							/>
							<circle
								cx={goalCenterX + 60}
								cy={goalCenterY - 80}
								r={savedSize / 2}
								fill='#60a5fa'
								cursor='pointer'
								style={{ transition: 'opacity 0.2s', opacity: '0.8' }}
								onMouseOver={(e) => {
									e.currentTarget.style.opacity = '1';
								}}
								onMouseOut={(e) => {
									e.currentTarget.style.opacity = '0.8';
								}}
							/>
							<text
								x={goalCenterX + 60}
								y={goalCenterY - 80}
								textAnchor='middle'
								dominantBaseline='middle'
								fill='#ffffff'
								fontSize='20'
								fontWeight='bold'
								pointerEvents='none'
								style={{ zIndex: 9999 }}
							>
								{saved}
							</text>
						</g>
					)}
					
					{/* Dark blue circle - Penalty Shootout Saved (same position as Saved but 20px left) */}
					{penaltyShootoutSaved > 0 && (
						<g>
							{/* Larger invisible hit area */}
							<circle
								cx={goalCenterX + 20}
								cy={goalCenterY - 80}
								r={penaltyShootoutSavedSize / 2 + 15}
								fill='transparent'
								cursor='pointer'
							/>
							<circle
								cx={goalCenterX + 20}
								cy={goalCenterY - 80}
								r={penaltyShootoutSavedSize / 2}
								fill='#1e40af'
								cursor='pointer'
								style={{ transition: 'opacity 0.2s', opacity: '0.8' }}
								onMouseOver={(e) => {
									e.currentTarget.style.opacity = '1';
								}}
								onMouseOut={(e) => {
									e.currentTarget.style.opacity = '0.8';
								}}
							/>
							<text
								x={goalCenterX + 20}
								y={goalCenterY - 80}
								textAnchor='middle'
								dominantBaseline='middle'
								fill='#ffffff'
								fontSize='20'
								fontWeight='bold'
								pointerEvents='none'
								style={{ zIndex: 9999 }}
							>
								{penaltyShootoutSaved}
							</text>
						</g>
					)}
					
					{/* Red circle - Missed (wide of goal, to the right, moved up more) */}
					{missed > 0 && (
						<g>
							{/* Larger invisible hit area */}
							<circle
								cx={goalX + goalWidth + 50 + missedSize / 2 + 10}
								cy={goalCenterY - 130}
								r={missedSize / 2 + 15}
								fill='transparent'
								cursor='pointer'
							/>
							<circle
								cx={goalX + goalWidth + 50 + missedSize / 2 + 10}
								cy={goalCenterY - 130}
								r={missedSize / 2}
								fill='#ef4444'
								cursor='pointer'
								style={{ transition: 'opacity 0.2s', opacity: '0.8' }}
								onMouseOver={(e) => {
									e.currentTarget.style.opacity = '1';
								}}
								onMouseOut={(e) => {
									e.currentTarget.style.opacity = '0.8';
								}}
							/>
							<text
								x={goalX + goalWidth + 50 + missedSize / 2 + 10}
								y={goalCenterY - 130}
								textAnchor='middle'
								dominantBaseline='middle'
								fill='#ffffff'
								fontSize='24'
								fontWeight='bold'
								pointerEvents='none'
								style={{ zIndex: 9999 }}
							>
								{missed}
							</text>
						</g>
					)}
					
					{/* Dark red circle - Penalty Shootout Missed (opposite side of Missed, same height) */}
					{penaltyShootoutMissed > 0 && (
						<g>
							{/* Larger invisible hit area */}
							<circle
								cx={goalX - 50 - penaltyShootoutMissedSize / 2 - 10}
								cy={goalCenterY - 130}
								r={penaltyShootoutMissedSize / 2 + 15}
								fill='transparent'
								cursor='pointer'
							/>
							<circle
								cx={goalX - 50 - penaltyShootoutMissedSize / 2 - 10}
								cy={goalCenterY - 130}
								r={penaltyShootoutMissedSize / 2}
								fill='#991b1b'
								cursor='pointer'
								style={{ transition: 'opacity 0.2s', opacity: '0.8' }}
								onMouseOver={(e) => {
									e.currentTarget.style.opacity = '1';
								}}
								onMouseOut={(e) => {
									e.currentTarget.style.opacity = '0.8';
								}}
							/>
							<text
								x={goalX - 50 - penaltyShootoutMissedSize / 2 - 10}
								y={goalCenterY - 130}
								textAnchor='middle'
								dominantBaseline='middle'
								fill='#ffffff'
								fontSize='24'
								fontWeight='bold'
								pointerEvents='none'
								style={{ zIndex: 9999 }}
							>
								{penaltyShootoutMissed}
							</text>
						</g>
					)}
					
					{/* Orange ellipse - Conceded (in front of goal, below, moved left and up more) */}
					{conceded > 0 && (
						<g>
							{/* Larger invisible hit area */}
							<ellipse
								cx={goalCenterX - 120}
								cy={goalY + goalHeight + 30 + concededHeight / 2 - 45}
								rx={concededWidth / 2 + 20}
								ry={concededHeight / 2 + 15}
								fill='transparent'
								cursor='pointer'
							/>
							<ellipse
								cx={goalCenterX - 120}
								cy={goalY + goalHeight + 30 + concededHeight / 2 - 45}
								rx={concededWidth / 2}
								ry={concededHeight / 2}
								fill='#f97316'
								cursor='pointer'
								style={{ transition: 'opacity 0.2s', opacity: '0.8' }}
								onMouseOver={(e) => {
									e.currentTarget.style.opacity = '1';
								}}
								onMouseOut={(e) => {
									e.currentTarget.style.opacity = '0.8';
								}}
							/>
							<text
								x={goalCenterX - 120}
								y={goalY + goalHeight + 30 + concededHeight / 2 - 45}
								textAnchor='middle'
								dominantBaseline='middle'
								fill='#ffffff'
								fontSize='20'
								fontWeight='bold'
								pointerEvents='none'
								style={{ zIndex: 9999 }}
							>
								{conceded}
							</text>
						</g>
					)}
					
					{/* Dark green circle - Penalty Shootout Scored (same vertical position as Scored, 40px more to the left) */}
					{penaltyShootoutScored > 0 && (
						<g>
							{/* Larger invisible hit area */}
							<circle
								cx={goalCenterX - 110}
								cy={goalCenterY - 80}
								r={penaltyShootoutScoredSize / 2 + 15}
								fill='transparent'
								cursor='pointer'
							/>
							<circle
								cx={goalCenterX - 110}
								cy={goalCenterY - 80}
								r={penaltyShootoutScoredSize / 2}
								fill='#15803d'
								cursor='pointer'
								style={{ transition: 'opacity 0.2s', opacity: '0.8' }}
								onMouseOver={(e) => {
									e.currentTarget.style.opacity = '1';
								}}
								onMouseOut={(e) => {
									e.currentTarget.style.opacity = '0.8';
								}}
							/>
							<text
								x={goalCenterX - 110}
								y={goalCenterY - 80}
								textAnchor='middle'
								dominantBaseline='middle'
								fill='#ffffff'
								fontSize='24'
								fontWeight='bold'
								pointerEvents='none'
								style={{ zIndex: 9999 }}
							>
								{penaltyShootoutScored}
							</text>
						</g>
					)}
				</svg>
			</div>
			{/* Stats Table */}
			<div className='mt-2'>
				<table className='w-full text-white text-sm'>
					<thead>
						<tr className='border-b border-white/20'>
							<th className='text-left py-1 px-2'>Stat</th>
							<th className='text-right py-1 px-2'>Value</th>
						</tr>
					</thead>
					<tbody>
						{scored > 0 && (
							<tr className='border-b border-white/10'>
								<td className='py-1 px-2'>
									<span className='inline-block w-3 h-3 rounded-full bg-[var(--color-success)] mr-2'></span>
									Penalties Scored
								</td>
								<td className='text-right py-1 px-2 font-mono'>{scored}</td>
							</tr>
						)}
						{missed > 0 && (
							<tr className='border-b border-white/10'>
								<td className='py-1 px-2'>
									<span className='inline-block w-3 h-3 rounded-full bg-[var(--color-error)] mr-2'></span>
									Penalties Missed
								</td>
								<td className='text-right py-1 px-2 font-mono'>{missed}</td>
							</tr>
						)}
						{saved > 0 && (
							<tr className='border-b border-white/10'>
								<td className='py-1 px-2'>
									<span className='inline-block w-3 h-3 rounded-full bg-[var(--color-info)] mr-2'></span>
									Penalties Saved
								</td>
								<td className='text-right py-1 px-2 font-mono'>{saved}</td>
							</tr>
						)}
						{conceded > 0 && (
							<tr className='border-b border-white/10'>
								<td className='py-1 px-2'>
									<span className='inline-block w-3 h-3 rounded-full bg-orange-500 mr-2'></span>
									Penalties Conceded
								</td>
								<td className='text-right py-1 px-2 font-mono'>{conceded}</td>
							</tr>
						)}
						{penaltyShootoutScored > 0 && (
							<tr className='border-b border-white/10'>
								<td className='py-1 px-2'>
									<span className='inline-block w-3 h-3 rounded-full bg-green-700 mr-2'></span>
									Penalty Shootout Scored
								</td>
								<td className='text-right py-1 px-2 font-mono'>{penaltyShootoutScored}</td>
							</tr>
						)}
						{penaltyShootoutMissed > 0 && (
							<tr className='border-b border-white/10'>
								<td className='py-1 px-2'>
									<span className='inline-block w-3 h-3 rounded-full bg-red-800 mr-2'></span>
									Penalty Shootout Misses
								</td>
								<td className='text-right py-1 px-2 font-mono'>{penaltyShootoutMissed}</td>
							</tr>
						)}
						{penaltyShootoutSaved > 0 && (
							<tr>
								<td className='py-1 px-2'>
									<span className='inline-block w-3 h-3 rounded-full bg-blue-800 mr-2'></span>
									Penalty Shootout Saves
								</td>
								<td className='text-right py-1 px-2 font-mono'>{penaltyShootoutSaved}</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}

// Fantasy Points Section Component
function FantasyPointsSection({ 
	playerName, 
	fantasyBreakdown, 
	isLoading 
}: { 
	playerName: string; 
	fantasyBreakdown: any; 
	isLoading: boolean;
}) {
	const [isMonthExpanded, setIsMonthExpanded] = useState(false);

	if (isLoading) {
		return (
			<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
				<FantasyPointsSkeleton />
			</SkeletonTheme>
		);
	}

	if (!fantasyBreakdown || fantasyBreakdown.totalFantasyPoints === 0) {
		return null;
	}

	// Helper to truncate long team names
	const truncateTeamName = (text: string, maxLength: number = 35): string => {
		if (text.length <= maxLength) return text;
		// Find the last space before maxLength to avoid cutting words
		const truncated = text.substring(0, maxLength);
		const lastSpace = truncated.lastIndexOf(' ');
		// If we find a space reasonably close to the end, cut there
		if (lastSpace > 20) {
			return truncated.substring(0, lastSpace).trim();
		}
		// Otherwise just truncate at maxLength
		return truncated.trim();
	};

	// Get match summary helper
	const getMatchSummary = (match: any): { teamOpposition: string; resultScore: string } => {
		const team = match.team || "";
		const opposition = match.opposition || "";
		const result = match.result || "";
		const score = match.matchSummary || "";

		if (team && opposition && result && score) {
			const scoreTrimmed = score.trim();
			let resultScoreText = "";
			if (scoreTrimmed.match(/^(W|D|L)\s/)) {
				resultScoreText = scoreTrimmed;
			} else {
				resultScoreText = `${result} ${scoreTrimmed}`;
			}
			const teamOppositionFull = `${team} vs ${opposition}`;
			return {
				teamOpposition: truncateTeamName(teamOppositionFull, 35),
				resultScore: resultScoreText,
			};
		}

		if (match.matchSummary) {
			return {
				teamOpposition: truncateTeamName(match.matchSummary, 35),
				resultScore: "",
			};
		}
		const teamOppositionFull = `${match.team} - ${match.date || ""}`;
		return {
			teamOpposition: truncateTeamName(teamOppositionFull, 35),
			resultScore: "",
		};
	};

	// Calculate total fantasy points for a match
	const getMatchPoints = (match: any): number => {
		const breakdown = calculateFTPBreakdown({
			class: match.class,
			min: match.min,
			mom: match.mom,
			goals: match.goals,
			assists: match.assists,
			conceded: match.conceded,
			cleanSheets: match.conceded === 0 ? 1 : 0,
			yellowCards: match.yellowCards,
			redCards: match.redCards,
			saves: match.saves,
			ownGoals: match.ownGoals,
			penaltiesScored: match.penaltiesScored,
			penaltiesMissed: match.penaltiesMissed,
			penaltiesConceded: match.penaltiesConceded,
			penaltiesSaved: match.penaltiesSaved,
		});
		return breakdown.reduce((sum, stat) => sum + stat.points, 0);
	};

	// Get match stats summary with points first
	const getMatchStatsSummary = (match: any): string => {
		const points = getMatchPoints(match);
		const parts: string[] = [];
		
		// Always show minutes if available (player appeared in match)
		const minutes = match.min !== undefined && match.min !== null ? Math.round(match.min) : 0;
		parts.push(`${minutes.toLocaleString()} Mins`);
		
		if (match.goals && match.goals > 0) {
			parts.push(`${match.goals} ${match.goals === 1 ? "Goal" : "Goals"}`);
		}
		if (match.assists && match.assists > 0) {
			parts.push(`${match.assists} ${match.assists === 1 ? "Assist" : "Assists"}`);
		}
		// Check for clean sheet - check fixture conceded is 0 (no goals conceded by Dorkinians)
		const hasCleanSheet = match.conceded !== undefined && match.conceded !== null && Number(match.conceded) === 0;
		if (hasCleanSheet) {
			parts.push("1 Clean Sheet");
		}
		
		const statsText = parts.join(", ");
		return `${points} point${points !== 1 ? "s" : ""} (${statsText})`;
	};

	// Stat order mapping for Total Points Breakdown
	const statOrder: { [key: string]: number } = {
		"Minutes played": 1,
		"Man of the Match": 2,
		"Goals scored": 3,
		"Assists": 4,
		"Clean Sheets": 5,
		"Saves": 6,
		"Goals Conceded": 7,
		"Own Goals": 8,
		"Yellow Cards": 9,
		"Red Cards": 10,
		"Penalties Missed": 11,
		"Penalties Saved": 12,
	};

	// Convert breakdown object to sorted array with values
	const breakdownEntries = Object.entries(fantasyBreakdown.breakdown || {})
		.map(([stat, points]) => ({ 
			stat, 
			points: points as number,
			value: fantasyBreakdown.breakdownValues?.[stat] || 0
		}))
		.filter((entry) => entry.points !== 0)
		.sort((a, b) => {
			const orderA = statOrder[a.stat] ?? 999;
			const orderB = statOrder[b.stat] ?? 999;
			return orderA - orderB;
		});

	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<h3 className='text-white font-semibold text-sm md:text-base mb-4'>Fantasy Points</h3>
			
			{/* Player Name and Total Score Display - Kit and info side by side */}
			<div className='flex items-center justify-center gap-3 md:gap-4 mb-4'>
				{/* Kit Image */}
				<div className='relative w-12 h-16 md:w-14 md:h-18 flex-shrink-0'>
					<Image
						src='/totw-images/Kit.svg'
						alt='Player Kit'
						fill
						className='object-contain'
					/>
				</div>
				{/* Player name and score - no background */}
				<div className='text-center'>
					<p className='text-white text-xs md:text-sm font-medium mb-1'>{playerName}</p>
					<p className='text-2xl md:text-3xl font-bold text-white leading-none'>
						{Math.round(fantasyBreakdown.totalFantasyPoints || 0)}
					</p>
				</div>
			</div>

			{/* Breakdown Table */}
			{breakdownEntries.length > 0 && (
				<div className='mb-6'>
					<h4 className='text-white font-semibold text-xs md:text-sm mb-2'>Total Points Breakdown</h4>
					<div className='overflow-x-auto'>
						<table className='w-full text-white text-sm'>
							<thead>
								<tr className='border-b border-white/20'>
									<th className='text-left py-2 px-2 text-xs md:text-sm'>Stat</th>
									<th className='text-center py-2 px-2 text-xs md:text-sm'>Value</th>
									<th className='text-right py-2 px-2 text-xs md:text-sm'>Points</th>
								</tr>
							</thead>
							<tbody>
								{breakdownEntries.map((entry, index) => (
									<tr key={index} className='border-b border-white/10'>
										<td className='py-2 px-2 text-xs md:text-sm'>{entry.stat}</td>
										<td className='text-center py-2 px-2 font-mono text-xs md:text-sm'>
											{Math.round(entry.value).toLocaleString()}
										</td>
										<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>
											{entry.points > 0 ? "+" : ""}{entry.points.toLocaleString()}
										</td>
									</tr>
								))}
								<tr className='border-t-2 border-dorkinians-yellow font-bold'>
									<td className='py-2 px-2 text-xs md:text-sm'>Total</td>
									<td className='text-center py-2 px-2 font-mono text-xs md:text-sm'></td>
									<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>
										{Math.round(fantasyBreakdown.totalFantasyPoints || 0).toLocaleString()}
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Highest Scoring Week */}
			{fantasyBreakdown.highestScoringWeek && (
				<div className='mb-6'>
					<h4 className='text-white font-semibold text-xs md:text-sm mb-2'>
						Highest Scoring Week
					</h4>
					<div className='bg-white/5 rounded-lg p-3 md:p-4'>
						<div className='mb-2 flex justify-between items-center'>
							<p className='text-white text-xs md:text-sm'>
								{fantasyBreakdown.highestScoringWeek.weekAdjusted || fantasyBreakdown.highestScoringWeek.week ? (
									<span className='font-semibold'>
										Week {fantasyBreakdown.highestScoringWeek.weekAdjusted || fantasyBreakdown.highestScoringWeek.week}
										{fantasyBreakdown.highestScoringWeek.dateLookup && (
											<span className='text-white/70 ml-2'>
												- {fantasyBreakdown.highestScoringWeek.dateLookup}
											</span>
										)}
									</span>
								) : null}
							</p>
							<p className='text-dorkinians-yellow text-lg md:text-xl font-bold'>
								{Math.round(fantasyBreakdown.highestScoringWeek.totalPoints)} points
							</p>
						</div>
						<div className='mt-3 space-y-1'>
							{fantasyBreakdown.highestScoringWeek.matches.map((match: any, index: number) => {
								const summary = getMatchSummary(match);
								const statsSummary = getMatchStatsSummary(match);
								return (
									<div key={index} className='text-white text-xs md:text-sm border-b border-white/10 pb-1 last:border-0 last:pb-0'>
										<div className='flex justify-between items-center'>
											<p className='font-medium'>{summary.teamOpposition}</p>
											{summary.resultScore && (
												<p className='text-white/70 ml-2'>{summary.resultScore}</p>
											)}
										</div>
										{statsSummary && (
											<p className='text-white/70 text-xs mt-1'>{statsSummary}</p>
										)}
									</div>
								);
							})}
						</div>
					</div>
				</div>
			)}

			{/* Highest Scoring Month */}
			{fantasyBreakdown.highestScoringMonth && (
				<div>
					<h4 className='text-white font-semibold text-xs md:text-sm mb-2'>
						Highest Scoring Month
					</h4>
					<div className='bg-white/5 rounded-lg p-3 md:p-4'>
						<div className='mb-2 flex justify-between items-center'>
							<div>
								<p className='text-white text-xs md:text-sm'>
									{(fantasyBreakdown.highestScoringMonth.month || fantasyBreakdown.highestScoringMonth.year) && (
										<span className='font-semibold'>
											{fantasyBreakdown.highestScoringMonth.month || ""}
											{fantasyBreakdown.highestScoringMonth.month && fantasyBreakdown.highestScoringMonth.year ? " " : ""}
											{fantasyBreakdown.highestScoringMonth.year || ""}
										</span>
									)}
								</p>
								<p className='text-white/70 text-xs mt-1'>
									{fantasyBreakdown.highestScoringMonth.matches.length} match
									{fantasyBreakdown.highestScoringMonth.matches.length !== 1 ? "es" : ""}
								</p>
							</div>
							<p className='text-dorkinians-yellow text-lg md:text-xl font-bold'>
								{Math.round(fantasyBreakdown.highestScoringMonth.totalPoints)} points
							</p>
						</div>
						<div className='mt-3 space-y-1'>
							{(isMonthExpanded ? fantasyBreakdown.highestScoringMonth.matches : fantasyBreakdown.highestScoringMonth.matches.slice(0, 5)).map((match: any, index: number) => {
								const summary = getMatchSummary(match);
								const statsSummary = getMatchStatsSummary(match);
								return (
									<div key={index} className='text-white text-xs md:text-sm border-b border-white/10 pb-1 last:border-0 last:pb-0'>
										<div className='flex justify-between items-center'>
											<p className='font-medium'>{summary.teamOpposition}</p>
											{summary.resultScore && (
												<p className='text-white/70 ml-2'>{summary.resultScore}</p>
											)}
										</div>
										{statsSummary && (
											<p className='text-white/70 text-xs mt-1'>{statsSummary}</p>
										)}
									</div>
								);
							})}
							{fantasyBreakdown.highestScoringMonth.matches.length > 5 && !isMonthExpanded && (
								<button
									onClick={() => setIsMonthExpanded(true)}
									className='text-white/70 text-xs mt-2 hover:text-white cursor-pointer transition-colors underline underline-offset-2'
								>
									+ {fantasyBreakdown.highestScoringMonth.matches.length - 5} more match
									{fantasyBreakdown.highestScoringMonth.matches.length - 5 !== 1 ? "es" : ""}
								</button>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

// Distance Travelled Section Component
function DistanceTravelledSection({
	distance,
	awayGames
}: {
	distance: number;
	awayGames: number;
}) {
	// Distance thresholds
	const UK_LENGTH = 600; // miles
	const EUROPE_LENGTH = 3411; // miles
	const EARTH_CIRCUMFERENCE = 24901; // miles
	
	// Determine which map and comparison to show
	let mapImage: string;
	let comparisonText: string;
	
	if (distance < 1200) {
		// UK comparison - show percentage
		const percentage = (distance / UK_LENGTH) * 100;
		mapImage = '/stat-images/uk-map.svg';
		comparisonText = `${percentage.toFixed(1)}% of the length of the UK`;
	} else if (distance < 6400) {
		// Europe comparison - show times
		const times = distance / EUROPE_LENGTH;
		mapImage = '/stat-images/europe-map.svg';
		comparisonText = `${times.toFixed(2)} times the length of Europe`;
	} else {
		// Earth comparison - show times
		const times = distance / EARTH_CIRCUMFERENCE;
		mapImage = '/stat-images/world-map.svg';
		comparisonText = `${times.toFixed(2)} times around the Earth`;
	}

	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Distance Travelled</h3>
			<div className='w-full relative' style={{ height: '210px', overflow: 'hidden', borderRadius: '0.5rem' }}>
				{/* Background Map Image */}
				<div className='absolute inset-0 w-full h-full' style={{ borderRadius: '0.5rem', overflow: 'hidden' }}>
					<Image
						src={mapImage}
						alt={distance < 1200 ? 'UK Map' : distance < 6400 ? 'Europe Map' : 'World Map'}
						fill
						className='object-contain w-full h-full brightness-0 invert'
						style={{
							objectPosition: 'center',
							borderRadius: '0.5rem'
						}}
						loading="lazy"
					/>
				</div>
				
				{/* Content Overlay */}
				<div className='relative z-10 h-full flex flex-col justify-center px-3 md:px-4'>
					<div className='bg-black/60 backdrop-blur-sm rounded-lg p-3 md:p-4'>
						<table className='w-full text-white text-sm'>
							<thead>
								<tr className='border-b border-white/20'>
									<th className='text-left py-2 px-2 text-xs md:text-sm'>Stat</th>
									<th className='text-right py-2 px-2 text-xs md:text-sm'>Value</th>
								</tr>
							</thead>
							<tbody>
								<tr className='border-b border-white/10'>
									<td className='py-2 px-2 text-xs md:text-sm'>Away Games</td>
									<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>{awayGames}</td>
								</tr>
								<tr className='border-b border-white/10'>
									<td className='py-2 px-2 text-xs md:text-sm'>Distance Travelled</td>
									<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>{distance.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} miles</td>
								</tr>
								<tr>
									<td colSpan={2} className='py-2 px-2 text-xs md:text-sm text-center text-white/90'>
										{comparisonText}
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
}

// Defensive Record Section Component
function DefensiveRecordSection({
	conceded,
	cleanSheets,
	ownGoals,
	appearances,
	gk,
	saves,
	concededPerApp,
	gkCleanSheets
}: {
	conceded: number;
	cleanSheets: number;
	ownGoals: number;
	appearances: number;
	gk: number;
	saves: number;
	concededPerApp: number;
	gkCleanSheets: number;
}) {
	// Calculate derived statistics
	const avgGoalsConcededPerGame = appearances > 0 ? (conceded / appearances) : 0;
	const gamesPerCleanSheet = cleanSheets > 0 ? (appearances / cleanSheets) : 0;
	
	// Dynamic height: increase when GK stats are shown
	const sectionHeight = gk > 0 ? '360px' : '260px';

	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Defensive Record</h3>
			<div className='w-full relative' style={{ height: sectionHeight, overflow: 'hidden', borderRadius: '0.5rem' }}>
				{/* Background Brick Wall */}
				<div className='absolute inset-0 w-full h-full' style={{ borderRadius: '0.5rem', overflow: 'hidden' }}>
					<Image
						src='/stat-images/brick-wall.jpg'
						alt='Brick Wall'
						fill
						className='object-cover w-full h-full'
						style={{
							objectPosition: 'center',
							transform: 'scale(1.5)',
							transformOrigin: 'center',
							borderRadius: '0.5rem'
						}}
						loading="lazy"
					/>
				</div>
				
				{/* Content Overlay */}
				<div className='relative z-10 h-full flex flex-col justify-center pt-4 pb-4 px-3 md:px-4'>
					<div className='bg-black/60 backdrop-blur-sm rounded-lg p-3 md:p-4'>
						<table className='w-full text-white text-sm'>
							<thead>
								<tr className='border-b border-white/20'>
									<th className='text-left py-2 px-2 text-xs md:text-sm'>Stat</th>
									<th className='text-right py-2 px-2 text-xs md:text-sm'>Value</th>
								</tr>
							</thead>
							<tbody>
								<tr className='border-b border-white/10'>
									<td className='py-2 px-2 text-xs md:text-sm'>Goals Conceded</td>
									<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>{conceded}</td>
								</tr>
								<tr className='border-b border-white/10'>
									<td className='py-2 px-2 text-xs md:text-sm'>Clean Sheets</td>
									<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>{cleanSheets}</td>
								</tr>
								<tr className='border-b border-white/10'>
									<td className='py-2 px-2 text-xs md:text-sm'>Avg Goals Conceded / Game</td>
									<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>
										{avgGoalsConcededPerGame > 0 ? avgGoalsConcededPerGame.toFixed(2) : '0.00'}
									</td>
								</tr>
								<tr className='border-b border-white/10'>
									<td className='py-2 px-2 text-xs md:text-sm'>Games per Clean Sheet</td>
									<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>
										{gamesPerCleanSheet > 0 ? gamesPerCleanSheet.toFixed(1) : 'N/A'}
									</td>
								</tr>
								<tr className='border-b border-white/10'>
									<td className='py-2 px-2 text-xs md:text-sm'>Own Goals</td>
									<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>{ownGoals}</td>
								</tr>
								{gk > 0 && (
									<>
										<tr className='border-b border-white/10'>
											<td className='py-2 px-2 text-xs md:text-sm'>GK Appearances</td>
											<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>{gk}</td>
										</tr>
										<tr className='border-b border-white/10'>
											<td className='py-2 px-2 text-xs md:text-sm'>GK Clean Sheets</td>
											<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>{gkCleanSheets}</td>
										</tr>
										<tr>
											<td className='py-2 px-2 text-xs md:text-sm'>Saves</td>
											<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>{saves}</td>
										</tr>
									</>
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
}

// Minutes per Stats Section Component
function MinutesPerStatsSection({
	minutes,
	allGoalsScored,
	assists,
	mom,
	conceded,
	cleanSheets,
	gk,
	gkMinutes,
	saves
}: {
	minutes: number;
	allGoalsScored: number;
	assists: number;
	mom: number;
	conceded: number;
	cleanSheets: number;
	gk?: number;
	gkMinutes?: number;
	saves?: number;
}) {
	// Calculate minutes per stat
	const minutesPerGoal = allGoalsScored > 0 ? (minutes / allGoalsScored) : 0;
	const minutesPerAssist = assists > 0 ? (minutes / assists) : 0;
	const minutesPerMoM = mom > 0 ? (minutes / mom) : 0;
	const minutesPerConceded = conceded > 0 ? (minutes / conceded) : 0;
	const minutesPerCleanSheet = cleanSheets > 0 ? (minutes / cleanSheets) : 0;
	const minutesPerSave = saves && saves > 0 ? (minutes / saves) : 0;

	// Format number with commas for thousands and 1 decimal place
	const formatMinutesPerStat = (value: number): string => {
		if (value <= 0) return 'N/A';
		return value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
	};

	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Minutes per Stats</h3>
			<div className='w-full relative' style={{ minHeight: '200px', borderRadius: '0.5rem' }}>
				{/* Background Stopwatch */}
				<div className='absolute inset-0 w-full h-full' style={{ borderRadius: '0.5rem', overflow: 'hidden' }}>
					<Image
						src='/stat-images/stopwatch.svg'
						alt='Stopwatch'
						fill
						className='object-contain w-full h-full brightness-0 invert'
						style={{
							objectPosition: 'center',
							transform: 'scale(0.8, 0.8)',
							transformOrigin: 'center',
							borderRadius: '0.5rem'
						}}
						loading="lazy"
					/>
				</div>
				
				{/* Content Overlay */}
				<div className='relative z-10 flex flex-col justify-center px-3 md:px-4 py-2'>
					<div className='bg-black/60 backdrop-blur-sm rounded-lg p-3 md:p-4' style={{ borderRadius: '0.5rem', overflow: 'hidden' }}>
						<table className='w-full text-white text-sm'>
							<thead>
								<tr className='border-b border-white/20'>
									<th className='text-left py-2 px-2 text-xs md:text-sm'>Stat</th>
									<th className='text-right py-2 px-2 text-xs md:text-sm'>Value</th>
								</tr>
							</thead>
							<tbody>
								<tr className='border-b border-white/10'>
									<td className='py-2 px-2 text-xs md:text-sm'>Minutes per Goal</td>
									<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>
										{formatMinutesPerStat(minutesPerGoal)}
									</td>
								</tr>
								<tr className='border-b border-white/10'>
									<td className='py-2 px-2 text-xs md:text-sm'>Minutes per Assist</td>
									<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>
										{formatMinutesPerStat(minutesPerAssist)}
									</td>
								</tr>
								<tr className='border-b border-white/10'>
									<td className='py-2 px-2 text-xs md:text-sm'>Minutes per MoM</td>
									<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>
										{formatMinutesPerStat(minutesPerMoM)}
									</td>
								</tr>
								<tr className='border-b border-white/10'>
									<td className='py-2 px-2 text-xs md:text-sm'>Minutes per Conceded</td>
									<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>
										{formatMinutesPerStat(minutesPerConceded)}
									</td>
								</tr>
								<tr className='border-b border-white/10'>
									<td className='py-2 px-2 text-xs md:text-sm'>Minutes per Clean Sheet</td>
									<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>
										{formatMinutesPerStat(minutesPerCleanSheet)}
									</td>
								</tr>
								{gk !== undefined && gk > 0 && saves !== undefined && saves > 0 && (
									<tr className='border-b border-white/10'>
										<td className='py-2 px-2 text-xs md:text-sm'>Minutes per Save</td>
										<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>
											{formatMinutesPerStat(minutesPerSave)}
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
}

// Positional Stats Visualization Component
function PositionalStatsVisualization({ gk, def, mid, fwd, appearances, gkMinutes, defMinutes, midMinutes, fwdMinutes }: { gk: number; def: number; mid: number; fwd: number; appearances: number; gkMinutes: number; defMinutes: number; midMinutes: number; fwdMinutes: number }) {
	// SVG dimensions: 127x87 (width x height)
	const svgWidth = 127;
	const svgHeight = 87;
	const thirdWidth = svgWidth / 3;
	
	// Calculate percentages
	const totalPositionAppearances = gk + def + mid + fwd;
	const gkPercent = totalPositionAppearances > 0 ? (gk / totalPositionAppearances * 100) : 0;
	const defPercent = totalPositionAppearances > 0 ? (def / totalPositionAppearances * 100) : 0;
	const midPercent = totalPositionAppearances > 0 ? (mid / totalPositionAppearances * 100) : 0;
	const fwdPercent = totalPositionAppearances > 0 ? (fwd / totalPositionAppearances * 100) : 0;
	
	// Calculate percentage of total appearances
	const gkPercentOfTotal = appearances > 0 ? (gk / appearances * 100) : 0;
	const defPercentOfTotal = appearances > 0 ? (def / appearances * 100) : 0;
	const midPercentOfTotal = appearances > 0 ? (mid / appearances * 100) : 0;
	const fwdPercentOfTotal = appearances > 0 ? (fwd / appearances * 100) : 0;
	
	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
			<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Positional Stats</h3>
			<div className='w-full relative' style={{ height: '200px', overflow: 'hidden' }}>
				{/* Background SVG - horizontal pitch */}
				<div className='absolute inset-0 w-full h-full'>
					<Image
						src='/stat-images/horizontal-pitch.svg'
						alt='Football Pitch'
						fill
						className='object-contain w-full h-full'
						loading="lazy"
					/>
				</div>
				
				{/* Overlay boxes for each third */}
				<svg width='100%' height='100%' viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio='xMidYMid meet' className='relative z-10'>
					{/* DEF - Left third */}
					<rect
						x='0'
						y='0'
						width={thirdWidth}
						height={svgHeight}
						fill='rgba(139, 69, 19, 0.3)'
						stroke='rgba(255, 255, 255, 0.5)'
						strokeWidth='1'
					/>
					<text
						x={thirdWidth / 2}
						y={svgHeight / 2 - 8}
						textAnchor='middle'
						dominantBaseline='middle'
						fill='#ffffff'
						fontSize='20'
						fontWeight='bold'
						pointerEvents='none'
					>
						{def}
					</text>
					<text
						x={thirdWidth / 2}
						y={svgHeight / 2 + 12}
						textAnchor='middle'
						dominantBaseline='middle'
						fill='#ffffff'
						fontSize='12'
						pointerEvents='none'
					>
						{defPercentOfTotal.toFixed(1)}%
					</text>
					
					{/* MID - Middle third */}
					<rect
						x={thirdWidth}
						y='0'
						width={thirdWidth}
						height={svgHeight}
						fill='rgba(144, 238, 144, 0.3)'
						stroke='rgba(255, 255, 255, 0.5)'
						strokeWidth='1'
					/>
					<text
						x={thirdWidth + thirdWidth / 2}
						y={svgHeight / 2 - 8}
						textAnchor='middle'
						dominantBaseline='middle'
						fill='#ffffff'
						fontSize='20'
						fontWeight='bold'
						pointerEvents='none'
					>
						{mid}
					</text>
					<text
						x={thirdWidth + thirdWidth / 2}
						y={svgHeight / 2 + 12}
						textAnchor='middle'
						dominantBaseline='middle'
						fill='#ffffff'
						fontSize='12'
						pointerEvents='none'
					>
						{midPercentOfTotal.toFixed(1)}%
					</text>
					
					{/* FWD - Right third */}
					<rect
						x={thirdWidth * 2}
						y='0'
						width={thirdWidth}
						height={svgHeight}
						fill='rgba(64, 224, 208, 0.3)'
						stroke='rgba(255, 255, 255, 0.5)'
						strokeWidth='1'
					/>
					<text
						x={thirdWidth * 2 + thirdWidth / 2}
						y={svgHeight / 2 - 8}
						textAnchor='middle'
						dominantBaseline='middle'
						fill='#ffffff'
						fontSize='20'
						fontWeight='bold'
						pointerEvents='none'
					>
						{fwd}
					</text>
					<text
						x={thirdWidth * 2 + thirdWidth / 2}
						y={svgHeight / 2 + 12}
						textAnchor='middle'
						dominantBaseline='middle'
						fill='#ffffff'
						fontSize='12'
						pointerEvents='none'
					>
						{fwdPercentOfTotal.toFixed(1)}%
					</text>
				</svg>
			</div>
			{/* Stats Table */}
			<div className='mt-4'>
				<table className='w-full text-white text-sm'>
					<thead>
						<tr className='border-b border-white/20'>
							<th className='text-left py-2 px-2'>Position</th>
							<th className='text-right py-2 px-2'>Apps</th>
							<th className='text-right py-2 px-2'>Percentage</th>
							<th className='text-right py-2 px-2'>Mins</th>
						</tr>
					</thead>
					<tbody>
						<tr className='border-b border-white/10'>
							<td className='py-2 px-2'>
								<span className='px-2 py-1 rounded text-xs font-medium bg-purple-600/30 text-purple-300'>GK</span>
							</td>
							<td className='text-right py-2 px-2 font-mono'>{gk}</td>
							<td className='text-right py-2 px-2 font-mono'>{gkPercentOfTotal.toFixed(1)}%</td>
							<td className='text-right py-2 px-2 font-mono'>{gkMinutes.toLocaleString()}</td>
						</tr>
						<tr className='border-b border-white/10'>
							<td className='py-2 px-2'>
								<span className='px-2 py-1 rounded text-xs font-medium bg-amber-700/30 text-amber-200'>DEF</span>
							</td>
							<td className='text-right py-2 px-2 font-mono'>{def}</td>
							<td className='text-right py-2 px-2 font-mono'>{defPercentOfTotal.toFixed(1)}%</td>
							<td className='text-right py-2 px-2 font-mono'>{defMinutes.toLocaleString()}</td>
						</tr>
						<tr className='border-b border-white/10'>
							<td className='py-2 px-2'>
								<span className='px-2 py-1 rounded text-xs font-medium bg-green-600/30 text-green-300'>MID</span>
							</td>
							<td className='text-right py-2 px-2 font-mono'>{mid}</td>
							<td className='text-right py-2 px-2 font-mono'>{midPercentOfTotal.toFixed(1)}%</td>
							<td className='text-right py-2 px-2 font-mono'>{midMinutes.toLocaleString()}</td>
						</tr>
						<tr>
							<td className='py-2 px-2'>
								<span className='px-2 py-1 rounded text-xs font-medium bg-teal-600/30 text-teal-300'>FWD</span>
							</td>
							<td className='text-right py-2 px-2 font-mono'>{fwd}</td>
							<td className='text-right py-2 px-2 font-mono'>{fwdPercentOfTotal.toFixed(1)}%</td>
							<td className='text-right py-2 px-2 font-mono'>{fwdMinutes.toLocaleString()}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}

export default function PlayerStats() {
	const {
		selectedPlayer,
		cachedPlayerData,
		isLoadingPlayerData,
		enterEditMode,
		setMainPage,
		setStatsSubPage,
		selectPlayer,
		currentStatsSubPage,
		playerFilters,
		filterData,
		getCachedPageData,
		setCachedPageData,
		hasUnsavedFilters,
		isFilterSidebarOpen,
		openAllGamesModal,
		closeAllGamesModal,
		isAllGamesModalOpen,
	} = useNavigationStore();
	const { showError } = useToast();
	const [error, setError] = useState<string | null>(null);
	
	// State for seasonal and team performance charts
	const [seasonalSelectedStat, setSeasonalSelectedStat] = useState<string>("Apps");
	const [teamSelectedStat, setTeamSelectedStat] = useState<string>("Apps");
	const [seasonalStats, setSeasonalStats] = useState<any[]>([]);
	const [teamStats, setTeamStats] = useState<any[]>([]);
	const [isLoadingSeasonalStats, setIsLoadingSeasonalStats] = useState(false);
	const [isLoadingTeamStats, setIsLoadingTeamStats] = useState(false);
	const [showTrend, setShowTrend] = useState(true);
	
	// State for monthly performance chart
	const [monthlySelectedStat, setMonthlySelectedStat] = useState<string>("Apps");
	const [monthlyStats, setMonthlyStats] = useState<any[]>([]);
	const [isLoadingMonthlyStats, setIsLoadingMonthlyStats] = useState(false);

	// State for fantasy points breakdown
	const [fantasyBreakdown, setFantasyBreakdown] = useState<any>(null);
	const [isLoadingFantasyBreakdown, setIsLoadingFantasyBreakdown] = useState(false);

	// State for opposition map data
	const [oppositionMapData, setOppositionMapData] = useState<any[]>([]);
	const [isLoadingOppositionMap, setIsLoadingOppositionMap] = useState(false);

	// State for opposition performance data
	const [oppositionPerformanceData, setOppositionPerformanceData] = useState<any[]>([]);
	const [isLoadingOppositionPerformance, setIsLoadingOppositionPerformance] = useState(false);

	// State for game details data
	const [gameDetails, setGameDetails] = useState<any>(null);
	const [isLoadingGameDetails, setIsLoadingGameDetails] = useState(false);
	const [formData, setFormData] = useState<Array<{ week: string; date: string; rawScore: number; ewmaReactive: number; ewmaBaseline: number }>>([]);
	const [formSummary, setFormSummary] = useState<{ formCurrent: number | null; formBaseline: number | null; formTrend: FormTrend; formPeak: number | null; formPeakWeek: string | null; seasonAvg: number | null } | null>(null);
	const [goldenCrosses, setGoldenCrosses] = useState<Array<{ week: string; date: string }>>([]);
	const [isLoadingFormData, setIsLoadingFormData] = useState(false);
	const [recentFormMatches, setRecentFormMatches] = useState<PlayerFormRecentMatch[]>([]);
	const [liveStreaks, setLiveStreaks] = useState<LiveStreakPayload | null>(null);

	// State for awards data
	const [awardsData, setAwardsData] = useState<any>(null);
	const [isLoadingAwards, setIsLoadingAwards] = useState(false);

	// State for captain history data
	const [captainHistory, setCaptainHistory] = useState<Array<{ season: string; team: string }>>([]);
	const [totalCaptaincies, setTotalCaptaincies] = useState<number>(0);
	const [isLoadingCaptainHistory, setIsLoadingCaptainHistory] = useState(false);

	// State for award history data
	const [awardHistory, setAwardHistory] = useState<Array<{ season: string; awardName: string }>>([]);
	const [totalAwards, setTotalAwards] = useState<number>(0);
	const [isLoadingAwardHistory, setIsLoadingAwardHistory] = useState(false);

	const [playerRecordings, setPlayerRecordings] = useState<RecordingFixture[]>([]);

	// Feature 9 - milestone badges (Neo4j PlayerBadge + progress)
	const [badgePayload, setBadgePayload] = useState<{
		totalBadges: number;
		highestBadgeTier: string | null;
		earned: EarnedBadgeRow[];
		progress: ProgressRow[];
	} | null>(null);
	const [isLoadingBadges, setIsLoadingBadges] = useState(false);

	// State for view mode toggle - initialize from localStorage
	const [isDataTableMode, setIsDataTableMode] = useState<boolean>(() => {
		if (typeof window !== "undefined") {
			const saved = safeLocalStorageGet("player-stats-view-mode");
			if (saved === "true") return true;
			if (saved === "false") return false;
		}
		return false;
	});
	const [tableStatMode, setTableStatMode] = useState<PlayerStatsTableMode>(() => {
		if (typeof window !== "undefined") {
			const saved = safeLocalStorageGet("player-stats-table-mode");
			if (saved === "totals" || saved === "perApp" || saved === "per90") {
				return saved;
			}
		}
		return "totals";
	});
	const [keyPerformanceMode, setKeyPerformanceMode] = useState<PlayerStatsKeyMode>("totals");
	const [partnershipSortMode, setPartnershipSortMode] = useState<PartnershipSortMode>("bestWinRate");

	useEffect(() => {
		if (!featureFlags.playerStatsDataTablePer90 && tableStatMode === "per90") {
			setTableStatMode("totals");
		}
	}, [tableStatMode]);

	useEffect(() => {
		if (!featureFlags.playerStatsKeyPerformance && keyPerformanceMode === "per90") {
			setKeyPerformanceMode("totals");
		}
	}, [keyPerformanceMode]);

	// Persist view mode to localStorage when it changes
	useEffect(() => {
		if (typeof window !== "undefined") {
			safeLocalStorageSet("player-stats-view-mode", isDataTableMode ? "true" : "false");
		}
	}, [isDataTableMode]);
	useEffect(() => {
		if (typeof window !== "undefined") {
			safeLocalStorageSet("player-stats-table-mode", tableStatMode);
		}
	}, [tableStatMode]);

	/* COMMENTED OUT: Share Stats functionality - will be re-added in the future */
	// State for share functionality
	// const [isGeneratingShare, setIsGeneratingShare] = useState(false);
	// const [isShareModalOpen, setIsShareModalOpen] = useState(false);
	// const [selectedShareVisualization, setSelectedShareVisualization] = useState<{ type: string; data?: any } | null>(null);
	// const [shareBackgroundColor, setShareBackgroundColor] = useState<"yellow" | "green">("yellow");
	// const [isIOSPreviewOpen, setIsIOSPreviewOpen] = useState(false);
	// const [isNonIOSPreviewOpen, setIsNonIOSPreviewOpen] = useState(false);
	// const [generatedImageDataUrl, setGeneratedImageDataUrl] = useState<string>("");
	// const shareCardRef = useRef<HTMLDivElement>(null);


	// Get stats to display for current page
	const statsToDisplay = useMemo(() => {
		return [...(statsPageConfig[currentStatsSubPage]?.statsToDisplay || [])];
	}, [currentStatsSubPage]);

	// Filter statObject entries to only include stats in statsToDisplay
	const filteredStatEntries = useMemo(() => {
		return Object.entries(statObject).filter(([key]) => statsToDisplay.includes(key as keyof typeof statObject));
	}, [statsToDisplay]);
	const displayedStatEntries = useMemo(() => {
		return filteredStatEntries.filter(([, stat]) => {
			const statName = String(stat?.statName || "");
			const isPer90 = PER90_STAT_NAMES.has(statName);
			const isPerApp = String(stat?.statCategory || "") === "Per App/Minute Stat";

			if (tableStatMode === "per90") return isPer90;
			if (tableStatMode === "perApp") return isPerApp && !isPer90;
			return !isPer90 && !isPerApp;
		});
	}, [filteredStatEntries, tableStatMode]);

	const playerData: PlayerData | null = cachedPlayerData?.playerData || null;

	const partnershipList = useMemo(() => {
		const raw = playerData?.partnershipsTopJson;
		if (!raw) return [] as Array<{ name: string; winRate: number; matches: number }>;
		try {
			const parsed = JSON.parse(raw) as unknown;
			if (!Array.isArray(parsed)) return [];
			return parsed
				.filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
				.map((x) => ({
					name: String(x.name ?? ""),
					winRate: typeof x.winRate === "number" ? x.winRate : Number(x.winRate),
					matches: typeof x.matches === "number" ? x.matches : Number(x.matches),
				}))
				.filter((x) => x.name.length > 0 && !Number.isNaN(x.winRate) && !Number.isNaN(x.matches) && x.matches >= 5);
		} catch {
			return [];
		}
	}, [playerData?.partnershipsTopJson]);

	const partnershipListDisplay = useMemo(() => {
		const list = [...partnershipList];
		const base = playerData?.impactWinRateWith;

		if (partnershipSortMode === "mostGames") {
			list.sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name));
		} else if (partnershipSortMode === "mostImprovedWinRate") {
			// Rank by the same value as the green subtitle: partnership win % minus your win rate when you play (percentage points).
			list.sort((a, b) => {
				if (base != null && typeof base === "number" && !Number.isNaN(base)) {
					const da = a.winRate - base;
					const db = b.winRate - base;
					if (db !== da) return db - da;
				}
				return b.winRate - a.winRate || b.matches - a.matches || a.name.localeCompare(b.name);
			});
		} else {
			// bestWinRate: highest partnership win percentage (ties: more shared games first)
			list.sort((a, b) => b.winRate - a.winRate || b.matches - a.matches || a.name.localeCompare(b.name));
		}
		return list.slice(0, 10);
	}, [partnershipList, partnershipSortMode, playerData?.impactWinRateWith]);

	const streakDisplaySource = useMemo((): PlayerData | null => {
		if (!playerData) return null;
		if (!liveStreaks) return playerData;
		const { tooltipMeta: _tooltipMeta, ...streakCounts } = liveStreaks;
		return { ...playerData, ...streakCounts };
	}, [playerData, liveStreaks]);

	const streakTooltipMeta = useMemo((): StreakTooltipMeta | null => {
		return liveStreaks?.tooltipMeta ?? null;
	}, [liveStreaks]);

	// Debug log for position counts (must be before early returns)
	useEffect(() => {
		if (playerData && selectedPlayer) {
			const gk = toNumber(playerData.gk || 0);
			const def = toNumber(playerData.def || 0);
			const mid = toNumber(playerData.mid || 0);
			const fwd = toNumber(playerData.fwd || 0);
			log("info", `[Position Counts] ${selectedPlayer}:`, {
				GK: gk,
				DEF: def,
				MID: mid,
				FWD: fwd,
				Total: gk + def + mid + fwd,
				RawData: {
					gk: playerData.gk,
					def: playerData.def,
					mid: playerData.mid,
					fwd: playerData.fwd
				}
			});
		}
	}, [playerData, selectedPlayer]);

	// Prepare chart data (hooks must be called before early returns)
	const keyPerformanceData = useMemo(() => {
		if (!playerData) return [];
		const totalSeasons = filterData?.seasons?.length || 0;
		const seasonsPlayed = toNumber(playerData.numberSeasonsPlayedFor);
		const seasonsDisplay = totalSeasons > 0 ? `${seasonsPlayed}/${totalSeasons}` : seasonsPlayed.toString();
		if (keyPerformanceMode === "per90") {
			return [
				{ name: "G/90", value: playerData.goalsPer90, isPer90: true },
				{ name: "A/90", value: playerData.assistsPer90, isPer90: true },
				{ name: "GI/90", value: playerData.goalInvolvementsPer90, isPer90: true },
				{ name: "FTP/90", value: playerData.ftpPer90, isPer90: true },
				{ name: "Cards/90", value: playerData.cardsPer90, isPer90: true },
				{ name: "MoM/90", value: playerData.momPer90, isPer90: true },
				{ name: "Avg Rtg", value: playerData.averageMatchRating, isRating: true },
				{ name: "Mins", value: toNumber(playerData.minutes) },
				{ name: "Seasons", value: seasonsDisplay, isString: true },
			];
		}
		return [
			{ name: "Apps", value: toNumber(playerData.appearances) },
			{ name: "Mins", value: toNumber(playerData.minutes) },
			{ name: "Starts", value: toNumber(playerData.starts) },
			{ name: "Seasons", value: seasonsDisplay, isString: true },
			{ name: "MoM", value: toNumber(playerData.mom) },
			{ name: "Avg Rtg", value: playerData.averageMatchRating, isRating: true },
			{ name: "Goals", value: toNumber(playerData.allGoalsScored) },
			{ name: "Assists", value: toNumber(playerData.assists) },
			{ name: "Form", value: formSummary?.formCurrent ?? null, isForm: true },
		];
	}, [playerData, filterData, keyPerformanceMode, formSummary]);

	const cardData = useMemo(() => {
		if (!playerData) return [];
		return [
			{ name: "Yellow Cards", value: toNumber(playerData.yellowCards), color: "#f9ed32" },
			{ name: "Red Cards", value: toNumber(playerData.redCards), color: "#ef4444" },
		];
	}, [playerData]);

	const defensiveData = useMemo(() => {
		if (!playerData) return [];
		return [
			{ name: "Clean Sheets", value: toNumber(playerData.cleanSheets) },
			{ name: "Goals Conceded", value: toNumber(playerData.conceded) },
		];
	}, [playerData]);

	const penaltyData = useMemo(() => {
		if (!playerData) return [];
		return [
			{ name: "Scored", value: toNumber(playerData.penaltiesScored) },
			{ name: "Missed", value: toNumber(playerData.penaltiesMissed) },
			{ name: "Saved", value: toNumber(playerData.penaltiesSaved) },
			{ name: "Conceded", value: toNumber(playerData.penaltiesConceded) },
		];
	}, [playerData]);

	// Component state
	const handleEditClick = () => {
		enterEditMode();
		setMainPage("home");
	};

	// Check if all seasons are selected (must be before early returns)
	const allSeasonsSelected = useMemo(() => {
		if (playerFilters.timeRange.type === "allTime") return true;
		if (playerFilters.timeRange.type === "season" && filterData?.seasons) {
			const selectedSeasons = playerFilters.timeRange.seasons;
			const allSeasons = filterData.seasons.map((s: any) => s.season || s);
			return selectedSeasons.length === allSeasons.length && 
				allSeasons.every((season: string) => selectedSeasons.includes(season));
		}
		return false;
	}, [playerFilters.timeRange, filterData]);

	// Check if all teams are selected (must be before early returns)
	const allTeamsSelected = useMemo(() => {
		if (!filterData?.teams) return playerFilters.teams.length === 0;
		const allTeams = filterData.teams.map(team => typeof team === 'string' ? team : (team?.name || ''));
		// Empty array means all teams selected (default behavior)
		if (playerFilters.teams.length === 0) return true;
		// Check if selected teams array contains all available teams
		return playerFilters.teams.length === allTeams.length && 
		       allTeams.every(team => playerFilters.teams.includes(team));
	}, [playerFilters.teams, filterData]);

	// Stat options for dropdowns (must be before early returns)
	const statOptions = useMemo(() => [
		{ value: "Apps", label: "Apps", statKey: "appearances" },
		{ value: "Minutes", label: "Minutes", statKey: "minutes" },
		{ value: "MoM", label: "MoM", statKey: "mom" },
		{ value: "Goals", label: "Goals", statKey: "goals" },
		{ value: "Assists", label: "Assists", statKey: "assists" },
		{ value: "Fantasy Points", label: "Fantasy Points", statKey: "fantasyPoints" },
		{ value: "Yellow Cards", label: "Yellow Cards", statKey: "yellowCards" },
		{ value: "Red Cards", label: "Red Cards", statKey: "redCards" },
		{ value: "Saves", label: "Saves", statKey: "saves" },
		{ value: "Clean Sheets", label: "Clean Sheets", statKey: "cleanSheets" },
		{ value: "Conceded", label: "Conceded", statKey: "conceded" },
		{ value: "Own Goals", label: "Own Goals", statKey: "ownGoals" },
		{ value: "Penalties Scored", label: "Penalties Scored", statKey: "penaltiesScored" },
		{ value: "Penalties Missed", label: "Penalties Missed", statKey: "penaltiesMissed" },
		{ value: "Penalties Conceded", label: "Penalties Conceded", statKey: "penaltiesConceded" },
		{ value: "Penalties Saved", label: "Penalties Saved", statKey: "penaltiesSaved" },
		{ value: "Distance Travelled", label: "Distance Travelled", statKey: "distance" },
	], []);
	// Priority 1 & 2: Parallelized data fetching for above-the-fold content
	// Fetch seasonal stats, team stats, opposition map, and opposition performance in parallel
	useEffect(() => {
		if (!selectedPlayer) {
			setSeasonalStats([]);
			setTeamStats([]);
			setOppositionMapData([]);
			setOppositionPerformanceData([]);
			setFormData([]);
			setFormSummary(null);
			setGoldenCrosses([]);
			setRecentFormMatches([]);
			return;
		}
		if (appConfig.forceSkeletonView) {
			return;
		}
		if (hasUnsavedFilters || isFilterSidebarOpen) return; // Skip API calls while editing filters or sidebar is open

		const fetchAllAboveFoldData = async () => {
			// Set loading states
			setIsLoadingSeasonalStats(allSeasonsSelected);
			setIsLoadingTeamStats(allTeamsSelected);
			setIsLoadingOppositionMap(true);
			setIsLoadingOppositionPerformance(true);
			if (featureFlags.playerStatsForm) {
				setIsLoadingFormData(true);
			} else {
				setIsLoadingFormData(false);
				setFormData([]);
				setFormSummary(null);
				setGoldenCrosses([]);
				setRecentFormMatches([]);
			}

			try {
				// Build parallel fetch promises
				const fetchPromises: Promise<void>[] = [];

				// Seasonal stats (conditional)
				if (allSeasonsSelected) {
					const cacheKey = generatePageCacheKey("stats", "player-stats", "player-seasonal-stats", {
						playerName: selectedPlayer,
						filters: playerFilters,
					});
					fetchPromises.push(
						cachedFetch("/api/player-seasonal-stats", {
							method: "POST",
							body: {
								playerName: selectedPlayer,
								filters: playerFilters,
							},
							cacheKey,
							getCachedPageData,
							setCachedPageData,
						})
							.then((data) => {
								setSeasonalStats(data.seasonalStats || []);
							})
							.catch((error) => {
								log("error", "Error fetching seasonal stats:", error);
							})
							.finally(() => setIsLoadingSeasonalStats(false))
					);
				} else {
					setSeasonalStats([]);
					setIsLoadingSeasonalStats(false);
				}

				// Team stats (conditional)
				if (allTeamsSelected) {
					const cacheKey = generatePageCacheKey("stats", "player-stats", "player-team-stats", {
						playerName: selectedPlayer,
						filters: playerFilters,
					});
					fetchPromises.push(
						cachedFetch("/api/player-team-stats", {
							method: "POST",
							body: {
								playerName: selectedPlayer,
								filters: playerFilters,
							},
							cacheKey,
							getCachedPageData,
							setCachedPageData,
						})
							.then((data) => {
								setTeamStats(data.teamStats || []);
							})
							.catch((error) => {
								log("error", "Error fetching team stats:", error);
							})
							.finally(() => setIsLoadingTeamStats(false))
					);
				} else {
					setTeamStats([]);
					setIsLoadingTeamStats(false);
				}

				// Opposition map (always fetch)
				const oppositionMapCacheKey = generatePageCacheKey("stats", "player-stats", "player-oppositions-map", {
					playerName: selectedPlayer,
				});
				fetchPromises.push(
					cachedFetch(`/api/player-oppositions-map?playerName=${encodeURIComponent(selectedPlayer)}`, {
						method: "GET",
						cacheKey: oppositionMapCacheKey,
						getCachedPageData,
						setCachedPageData,
					})
						.then((data) => {
							setOppositionMapData(data.oppositions || []);
						})
						.catch((error) => {
							log("error", "Error fetching opposition map data:", error);
							setOppositionMapData([]);
						})
						.finally(() => setIsLoadingOppositionMap(false))
				);

				// Opposition performance (always fetch)
				const oppositionPerfCacheKey = generatePageCacheKey("stats", "player-stats", "player-opposition-performance", {
					playerName: selectedPlayer,
				});
				fetchPromises.push(
					cachedFetch(`/api/player-opposition-performance?playerName=${encodeURIComponent(selectedPlayer)}`, {
						method: "GET",
						cacheKey: oppositionPerfCacheKey,
						getCachedPageData,
						setCachedPageData,
					})
						.then((data) => {
							setOppositionPerformanceData(data.performanceData || []);
						})
						.catch((error) => {
							log("error", "Error fetching opposition performance data:", error);
							setOppositionPerformanceData([]);
						})
						.finally(() => setIsLoadingOppositionPerformance(false))
				);

				// Form curve data (feature-flagged)
				if (featureFlags.playerStatsForm) {
					const playerFormCacheKey = generatePageCacheKey("stats", "player-stats", "player-form", {
						playerName: selectedPlayer,
						filters: playerFilters,
					});
					fetchPromises.push(
						cachedFetch("/api/player-form", {
							method: "POST",
							body: {
								playerName: selectedPlayer,
								filters: playerFilters,
							},
							cacheKey: playerFormCacheKey,
							getCachedPageData,
							setCachedPageData,
						})
							.then((data) => {
								setFormData(data.history || []);
								setFormSummary(data.summary || null);
								setGoldenCrosses(data.goldenCrosses || []);
								setRecentFormMatches(Array.isArray(data.recentFormMatches) ? data.recentFormMatches : []);
							})
							.catch((error) => {
								log("error", "Error fetching player form data:", error);
								setFormData([]);
								setFormSummary(null);
								setGoldenCrosses([]);
								setRecentFormMatches([]);
							})
							.finally(() => setIsLoadingFormData(false))
					);
				}

				// Execute all fetches in parallel
				await Promise.all(fetchPromises);
			} catch (error) {
				log("error", "Error in parallel data fetching:", error);
			}
		};

		fetchAllAboveFoldData();
	}, [selectedPlayer, allSeasonsSelected, allTeamsSelected, playerFilters, hasUnsavedFilters, isFilterSidebarOpen]);

	// Priority 3: Below fold - Parallelized data fetching for filter-dependent content
	// Fetch monthly stats, fantasy breakdown, and game details in parallel
	useEffect(() => {
		if (!selectedPlayer) {
			setMonthlyStats([]);
			setFantasyBreakdown(null);
			setGameDetails(null);
			return;
		}
		if (appConfig.forceSkeletonView) {
			return;
		}
		if (hasUnsavedFilters || isFilterSidebarOpen) return; // Skip API calls while editing filters or sidebar is open

		const fetchAllBelowFoldData = async () => {
			// Set loading states
			setIsLoadingMonthlyStats(true);
			setIsLoadingFantasyBreakdown(true);
			setIsLoadingGameDetails(true);

			try {
				const params = {
					playerName: selectedPlayer,
					filters: playerFilters,
				};

				// Execute all filter-dependent fetches in parallel
				await Promise.all([
					// Monthly stats
					cachedFetch("/api/player-monthly-stats", {
						method: "POST",
						body: params,
						cacheKey: generatePageCacheKey("stats", "player-stats", "player-monthly-stats", params),
						getCachedPageData,
						setCachedPageData,
					})
						.then((data) => {
							setMonthlyStats(data.monthlyStats || []);
						})
						.catch((error) => {
							log("error", "Error fetching monthly stats:", error);
						})
						.finally(() => setIsLoadingMonthlyStats(false)),

					// Fantasy breakdown
					cachedFetch("/api/player-fantasy-breakdown", {
						method: "POST",
						body: params,
						cacheKey: generatePageCacheKey("stats", "player-stats", "player-fantasy-breakdown", params),
						getCachedPageData,
						setCachedPageData,
					})
						.then((data) => {
							setFantasyBreakdown(data);
						})
						.catch((error) => {
							log("error", "Error fetching fantasy breakdown:", error);
						})
						.finally(() => setIsLoadingFantasyBreakdown(false)),

					// Game details
					cachedFetch("/api/player-game-details", {
						method: "POST",
						body: params,
						cacheKey: generatePageCacheKey("stats", "player-stats", "player-game-details", params),
						getCachedPageData,
						setCachedPageData,
					})
						.then((data) => {
							setGameDetails(data);
						})
						.catch((error) => {
							log("error", "Error fetching game details:", error);
							setGameDetails(null);
						})
						.finally(() => setIsLoadingGameDetails(false)),
				]);
			} catch (error) {
				log("error", "Error in parallel below-fold data fetching:", error);
			}
		};

		fetchAllBelowFoldData();
	}, [selectedPlayer, playerFilters, hasUnsavedFilters, isFilterSidebarOpen]);

	// Player recordings (Veo) for fixtures this player played in
	useEffect(() => {
		if (!selectedPlayer) {
			setPlayerRecordings([]);
			return;
		}
		if (!featureFlags.playerStatsPlayerRecordings) {
			setPlayerRecordings([]);
			return;
		}
		if (appConfig.forceSkeletonView) return;
		if (hasUnsavedFilters || isFilterSidebarOpen) return;

		const fetchPlayerRecordings = async () => {
			setPlayerRecordings([]);
			try {
				const requestBody = {
					playerName: selectedPlayer,
					filters: playerFilters,
				};
				const cacheKey = generatePageCacheKey("stats", "player-stats", "player-recordings", requestBody);
				const data = await cachedFetch("/api/player-recordings", {
					method: "POST",
					body: requestBody,
					cacheKey,
					getCachedPageData,
					setCachedPageData,
				});
				setPlayerRecordings((data.fixtures || []) as RecordingFixture[]);
			} catch (err) {
				log("error", "Error fetching player recordings:", err);
				setPlayerRecordings([]);
			}
		};

		fetchPlayerRecordings();
	}, [selectedPlayer, playerFilters, hasUnsavedFilters, isFilterSidebarOpen, getCachedPageData, setCachedPageData]);

	// Live streak metrics (filter-scoped; aligned with chatbot / foundation streak rules)
	useEffect(() => {
		if (!selectedPlayer) {
			setLiveStreaks(null);
			return;
		}
		if (!featureFlags.playerStatsStreaks) {
			setLiveStreaks(null);
			return;
		}
		if (appConfig.forceSkeletonView) return;
		if (hasUnsavedFilters || isFilterSidebarOpen) return;

		let cancelled = false;
		(async () => {
			try {
				const { getCsrfHeaders } = await import("@/lib/middleware/csrf");
				const res = await fetch("/api/player-streaks", {
					method: "POST",
					headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
					body: JSON.stringify({ playerName: selectedPlayer, filters: playerFilters }),
				});
				if (!res.ok) throw new Error(`player-streaks ${res.status}`);
				const data = (await res.json()) as { streaks?: LiveStreakPayload };
				if (!cancelled && data.streaks) setLiveStreaks(data.streaks);
			} catch (e) {
				log("warn", "Live streaks fetch failed; using player payload streaks", e);
				if (!cancelled) setLiveStreaks(null);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [selectedPlayer, playerFilters, hasUnsavedFilters, isFilterSidebarOpen]);

	// Priority 3: Below fold - Captaincies, Awards and Achievements section
	// Fetch awards, captain history, and award history in parallel
	useEffect(() => {
		if (!selectedPlayer) {
			setAwardsData(null);
			setCaptainHistory([]);
			setTotalCaptaincies(0);
			setAwardHistory([]);
			setTotalAwards(0);
			setBadgePayload(null);
			setIsLoadingBadges(false);
			return;
		}
		if (appConfig.forceSkeletonView) {
			return;
		}

		const fetchAllAwardsData = async () => {
			// Set loading states
			setIsLoadingAwards(true);
			setIsLoadingCaptainHistory(true);
			setIsLoadingAwardHistory(true);
			setIsLoadingBadges(featureFlags.achievementBadges);
			if (!featureFlags.achievementBadges) {
				setBadgePayload(null);
			}

			try {
				const playerParams = { playerName: selectedPlayer };
				const parallel: Promise<unknown>[] = [
					// Awards data
					cachedFetch(`/api/player-awards?playerName=${encodeURIComponent(selectedPlayer)}`, {
						method: "GET",
						cacheKey: generatePageCacheKey("stats", "player-stats", "player-awards", playerParams),
						getCachedPageData,
						setCachedPageData,
					})
						.then((data) => {
							setAwardsData(data);
						})
						.catch((error) => {
							log("error", "Error fetching awards:", error);
						})
						.finally(() => setIsLoadingAwards(false)),

					// Captain history
					cachedFetch(`/api/captains/player-history?playerName=${encodeURIComponent(selectedPlayer)}`, {
						method: "GET",
						cacheKey: generatePageCacheKey("stats", "player-stats", "captain-history", playerParams),
						getCachedPageData,
						setCachedPageData,
					})
						.then((data) => {
							setCaptainHistory(data.captaincies || []);
							setTotalCaptaincies(data.totalCaptaincies || 0);
						})
						.catch((error) => {
							log("error", "Error fetching captain history:", error);
							setCaptainHistory([]);
							setTotalCaptaincies(0);
						})
						.finally(() => setIsLoadingCaptainHistory(false)),

					// Award history
					cachedFetch(`/api/awards/player-history?playerName=${encodeURIComponent(selectedPlayer)}`, {
						method: "GET",
						cacheKey: generatePageCacheKey("stats", "player-stats", "award-history", playerParams),
						getCachedPageData,
						setCachedPageData,
					})
						.then((data) => {
							setAwardHistory(data.awards || []);
							setTotalAwards(data.totalAwards || 0);
						})
						.catch((error) => {
							log("error", "Error fetching award history:", error);
							setAwardHistory([]);
							setTotalAwards(0);
						})
						.finally(() => setIsLoadingAwardHistory(false)),
				];

				if (featureFlags.achievementBadges) {
					parallel.push(
						cachedFetch(`/api/player-badges?playerName=${encodeURIComponent(selectedPlayer)}`, {
							method: "GET",
							cacheKey: generatePageCacheKey("stats", "player-stats", "player-badges", playerParams),
							getCachedPageData,
							setCachedPageData,
						})
							.then((data) => {
								if (data && Array.isArray(data.earned) && Array.isArray(data.progress)) {
									setBadgePayload({
										totalBadges: typeof data.totalBadges === "number" ? data.totalBadges : data.earned.length,
										highestBadgeTier: data.highestBadgeTier ?? null,
										earned: data.earned,
										progress: data.progress,
									});
								} else {
									setBadgePayload(null);
								}
							})
							.catch((error) => {
								log("error", "Error fetching player badges:", error);
								setBadgePayload(null);
							})
							.finally(() => setIsLoadingBadges(false)),
					);
				}

				await Promise.all(parallel);
			} catch (error) {
				log("error", "Error in parallel awards data fetching:", error);
				setIsLoadingBadges(false);
			}
		};

		fetchAllAwardsData();
	}, [selectedPlayer]);


	// Calculate linear regression for trendline
	const calculateTrendline = (data: Array<{ name: string; value: number }>) => {
		if (data.length < 2) return [];
		
		const n = data.length;
		let sumX = 0;
		let sumY = 0;
		let sumXY = 0;
		let sumX2 = 0;
		
		data.forEach((point, index) => {
			const x = index;
			const y = point.value;
			sumX += x;
			sumY += y;
			sumXY += x * y;
			sumX2 += x * x;
		});
		
		const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
		const intercept = (sumY - slope * sumX) / n;
		
		return data.map((point, index) => ({
			name: point.name,
			value: slope * index + intercept,
		}));
	};

	// Prepare seasonal chart data with trendline (must be before early returns)
	const seasonalChartData = useMemo(() => {
		if (!seasonalStats.length) return [];
		const selectedOption = statOptions.find(opt => opt.value === seasonalSelectedStat);
		if (!selectedOption) return [];
		
		const baseData = seasonalStats.map(stat => ({
			name: stat.season,
			value: toNumber(stat[selectedOption.statKey] || 0),
		}));

		// Add trendline values if enabled
		if (showTrend && baseData.length >= 2) {
			const trendlinePoints = calculateTrendline(baseData);
			return baseData.map((point, index) => ({
				...point,
				trendline: Math.max(0, trendlinePoints[index]?.value || 0),
			}));
		}

		return baseData;
	}, [seasonalStats, seasonalSelectedStat, statOptions, showTrend]);

	// Force Seasonal Performance Y-axis to start at 0 with integer ticks only
	const seasonalYAxisDomain = useMemo(() => {
		if (!seasonalChartData.length) return [0, 1];
		// Only consider bar values (not trendline) for the max to prevent gap
		const max = Math.max(
			0,
			...seasonalChartData.map((d: any) => toNumber(d?.value ?? 0)),
		);
		const maxRounded = Math.max(1, Math.ceil(max));
		return [0, maxRounded] as [number, number];
	}, [seasonalChartData]);

	// Prepare team chart data (must be before early returns)
	const teamChartData = useMemo(() => {
		if (!teamStats.length) return [];
		const selectedOption = statOptions.find(opt => opt.value === teamSelectedStat);
		if (!selectedOption) return [];
		
		return teamStats.map(stat => ({
			name: stat.team,
			value: toNumber(stat[selectedOption.statKey] || 0),
		}));
	}, [teamStats, teamSelectedStat, statOptions]);

	// Prepare monthly chart data (must be before early returns)
	const monthlyChartData = useMemo(() => {
		if (!monthlyStats.length) return [];
		const selectedOption = statOptions.find(opt => opt.value === monthlySelectedStat);
		if (!selectedOption) return [];
		
		return monthlyStats.map(stat => ({
			name: stat.month,
			value: toNumber(stat[selectedOption.statKey] || 0),
		}));
	}, [monthlyStats, monthlySelectedStat, statOptions]);

	const profileHref = useMemo(() => {
		if (!featureFlags.playerProfile || !selectedPlayer) return null;
		return getPlayerProfileHref(selectedPlayer);
	}, [selectedPlayer]);

	/* COMMENTED OUT: Share Stats functionality - will be re-added in the future */
	// Get available visualizations (must be before early returns)
	// const availableVisualizations = useMemo(() => {
	// 	if (!playerData) return [];
	// 	return getAvailableVisualizations(
	// 		playerData,
	// 		playerFilters,
	// 		allSeasonsSelected,
	// 		allTeamsSelected,
	// 		seasonalChartData,
	// 		teamChartData,
	// 		isLoadingSeasonalStats,
	// 		isLoadingTeamStats,
	// 		oppositionMapData,
	// 		fantasyBreakdown,
	// 		isLoadingFantasyBreakdown,
	// 		gameDetails,
	// 		isLoadingGameDetails,
	// 		monthlyChartData,
	// 		isLoadingMonthlyStats,
	// 		awardsData,
	// 		isLoadingAwards
	// 	);
	// }, [
	// 	playerData,
	// 	playerFilters,
	// 	allSeasonsSelected,
	// 	allTeamsSelected,
	// 	seasonalChartData,
	// 	teamChartData,
	// 	isLoadingSeasonalStats,
	// 	isLoadingTeamStats,
	// 	oppositionMapData,
	// 	fantasyBreakdown,
	// 	isLoadingFantasyBreakdown,
	// 	gameDetails,
	// 	isLoadingGameDetails,
	// ]);

	// Early returns after all hooks to avoid Rules of Hooks violations
	if (!selectedPlayer) {
		return (
			<div className='h-full flex items-center justify-center p-4'>
				<div className='text-center'>
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-2 md:mb-4' data-testid="stats-page-heading">Stats</h2>
					<p className='text-white text-sm md:text-base mb-4'>Select a player to display data here</p>
					<button
						onClick={handleEditClick}
						className='flex items-center justify-center mx-auto w-8 h-8 text-yellow-300 hover:text-yellow-200 hover:bg-yellow-400/10 rounded-full transition-colors'
						title='Select a player'>
						<PenOnPaperIcon className='h-4 w-4 md:h-5 md:w-5' />
					</button>
				</div>
			</div>
		);
	}

	if (isLoadingPlayerData || appConfig.forceSkeletonView) {
		return (
			<div data-testid="loading-skeleton">
				<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
					<div className='h-full flex flex-col'>
					<div className='flex-shrink-0 p-2 md:p-4'>
						<div className='flex items-center justify-center mb-2 md:mb-4 space-x-2 md:space-x-3'>
							<h2
								className='text-xl md:text-2xl font-semibold text-dorkinians-yellow text-center'
								data-testid='stats-page-heading'>
								Stats - {selectedPlayer}
							</h2>
							<button
								type='button'
								data-testid='home-edit-player-button'
								onClick={handleEditClick}
								className='p-1.5 md:p-2 text-yellow-300 hover:text-yellow-200 hover:bg-yellow-400/10 rounded-full transition-colors shrink-0'
								title='Edit player selection'>
								<PenOnPaperIcon className='h-4 w-4 md:h-5 md:w-5' />
							</button>
						</div>
						<div className='flex justify-center mb-2 md:mb-4'>
							<button
								onClick={() => {
									const next = !isDataTableMode;
									trackEvent(UmamiEvents.DataTableToggled, { enabled: next, statsSubPage: "player-stats" });
									setIsDataTableMode(next);
								}}
								className='text-white underline hover:text-white/80 text-sm md:text-base cursor-pointer'>
								{isDataTableMode ? "Switch to data visualisation" : "Switch to data table"}
							</button>
						</div>
						<FilterPills playerFilters={playerFilters} filterData={filterData} currentStatsSubPage={currentStatsSubPage} />
					</div>
					<div className='flex-1 px-2 md:px-4 pb-4 min-h-0 overflow-y-auto space-y-4 md:space-y-0 player-stats-masonry'>
						<div className='player-stats-kpi-form-group flex flex-col gap-4 md:gap-0 md:break-inside-avoid md:mb-4'>
							<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:mb-4'>
								<div className='flex items-center justify-between gap-2 mb-3'>
									<Skeleton height={22} width="45%" className='max-w-[220px]' />
									<Skeleton height={32} width={112} />
								</div>
								<StatCardSkeleton count={9} variant='embedded' />
							</div>
							<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
								<Skeleton height={20} width={56} className='mb-2' />
								<ChartSkeleton />
							</div>
						</div>
						<div className='md:break-inside-avoid md:mb-4'>
							<ChartSkeleton />
						</div>
						<div className='md:break-inside-avoid md:mb-4'>
							<ChartSkeleton />
						</div>
						<div className='md:break-inside-avoid md:mb-4'>
							<ChartSkeleton />
						</div>
					</div>
				</div>
				</SkeletonTheme>
			</div>
		);
	}

	if (error) {
		return (
			<div className='h-full flex items-center justify-center p-4'>
				<ErrorState 
					message="Failed to load player stats" 
					error={error}
					onShowToast={showError}
					showToast={true}
					onRetry={() => {
						setError(null);
						// Data will refresh automatically when selectedPlayer changes
					}}
				/>
			</div>
		);
	}

	if (!cachedPlayerData || !playerData) {
		return (
			<div className='h-full flex items-center justify-center p-4'>
				<EmptyState 
					title="No player data available"
					message="Please select a player to view their statistics."
					action={selectedPlayer ? undefined : {
						label: "Select Player",
						onClick: () => {
							enterEditMode();
							setMainPage("stats");
						}
					}}
				/>
			</div>
		);
	}

	// At this point, playerData is guaranteed to be non-null
	const validPlayerData: PlayerData = playerData;

	/* COMMENTED OUT: Share Stats functionality - will be re-added in the future */
	// Extract visualization data based on selection
	// const getVisualizationData = (vizType: string): { type: string; data?: any } => {
	// 	switch (vizType) {
			// case "seasonal-performance":
			// 	const selectedSeasonalOption = statOptions.find(opt => opt.value === seasonalSelectedStat);
			// 	return {
			// 		type: vizType,
			// 		data: { 
			// 			chartData: seasonalChartData,
			// 			selectedStat: selectedSeasonalOption?.label || seasonalSelectedStat,
			// 		},
			// 	};
			// case "team-performance":
			// 	const selectedTeamOption = statOptions.find(opt => opt.value === teamSelectedStat);
			// 	return {
			// 		type: vizType,
			// 		data: { 
			// 			chartData: teamChartData,
			// 			selectedStat: selectedTeamOption?.label || teamSelectedStat,
			// 		},
			// 	};
			// case "match-results":
			// 	const wins = toNumber(validPlayerData.wins || 0);
			// 	const draws = toNumber(validPlayerData.draws || 0);
			// 	const losses = toNumber(validPlayerData.losses || 0);
			// 	const pieData = [
			// 		{ name: "Wins", value: wins, color: "#22c55e" },
			// 		{ name: "Draws", value: draws, color: "#60a5fa" },
			// 		{ name: "Losses", value: losses, color: "#ef4444" },
			// 	].filter(item => item.value > 0);
			// 	return {
			// 		type: vizType,
			// 		data: { pieData },
			// 	};
			// case "positional-stats":
			// 	return {
			// 		type: vizType,
			// 		data: {
			// 			gk: toNumber(validPlayerData.gk),
			// 			def: toNumber(validPlayerData.def),
			// 			mid: toNumber(validPlayerData.mid),
			// 			fwd: toNumber(validPlayerData.fwd),
			// 			appearances: toNumber(validPlayerData.appearances),
			// 			gkMinutes: toNumber(validPlayerData.gkMinutes || 0),
			// 			defMinutes: toNumber(validPlayerData.defMinutes || 0),
			// 			midMinutes: toNumber(validPlayerData.midMinutes || 0),
			// 			fwdMinutes: toNumber(validPlayerData.fwdMinutes || 0),
			// 		},
			// 	};
			// case "defensive-record":
			// 	return {
			// 		type: vizType,
			// 		data: {
			// 			conceded: toNumber(validPlayerData.conceded),
			// 			cleanSheets: toNumber(validPlayerData.cleanSheets),
			// 			ownGoals: toNumber(validPlayerData.ownGoals),
			// 			appearances: toNumber(validPlayerData.appearances),
			// 			gk: toNumber(validPlayerData.gk),
			// 			saves: toNumber(validPlayerData.saves),
			// 			concededPerApp: toNumber(validPlayerData.concededPerApp || 0),
			// 		},
			// 	};
			// case "card-stats":
			// 	return {
			// 		type: vizType,
			// 		data: {
			// 			yellowCards: toNumber(validPlayerData.yellowCards),
			// 			redCards: toNumber(validPlayerData.redCards),
			// 		},
			// 	};
			// case "penalty-stats":
			// 	return {
			// 		type: vizType,
			// 		data: {
			// 			scored: toNumber(validPlayerData.penaltiesScored),
			// 			missed: toNumber(validPlayerData.penaltiesMissed),
			// 			saved: toNumber(validPlayerData.penaltiesSaved),
			// 			conceded: toNumber(validPlayerData.penaltiesConceded),
			// 			penaltyShootoutScored: toNumber(validPlayerData.penaltyShootoutPenaltiesScored || 0),
			// 			penaltyShootoutMissed: toNumber(validPlayerData.penaltyShootoutPenaltiesMissed || 0),
			// 			penaltyShootoutSaved: toNumber(validPlayerData.penaltyShootoutPenaltiesSaved || 0),
			// 		},
			// 	};
			// case "fantasy-points":
			// 	return {
			// 		type: vizType,
			// 		data: {
			// 			totalPoints: toNumber(validPlayerData.fantasyPoints),
			// 			breakdown: fantasyBreakdown?.breakdown || {},
			// 			breakdownValues: fantasyBreakdown?.breakdownValues || {},
			// 			playerName: selectedPlayer || "",
			// 		},
			// 	};
			// case "distance-travelled":
			// 	return {
			// 		type: vizType,
			// 		data: {
			// 			distance: toNumber(validPlayerData.distance),
			// 			awayGames: toNumber(validPlayerData.awayGames || 0),
			// 		},
			// 	};
			// case "minutes-per-stats":
			// 	const minutes = toNumber(validPlayerData.minutes);
			// 	const allGoalsScored = toNumber(validPlayerData.allGoalsScored);
			// 	const assists = toNumber(validPlayerData.assists);
			// 	const mom = toNumber(validPlayerData.mom);
			// 	const cleanSheets = toNumber(validPlayerData.cleanSheets);
			// 	return {
			// 		type: vizType,
			// 		data: {
			// 			minutesPerGoal: allGoalsScored > 0 ? minutes / allGoalsScored : 0,
			// 			minutesPerAssist: assists > 0 ? minutes / assists : 0,
			// 			minutesPerMoM: mom > 0 ? minutes / mom : 0,
			// 			minutesPerCleanSheet: cleanSheets > 0 ? minutes / cleanSheets : 0,
			// 		},
			// 	};
			// case "game-details":
			// 	return {
			// 		type: vizType,
			// 		data: {
			// 			leagueGames: gameDetails?.leagueGames || 0,
			// 			cupGames: gameDetails?.cupGames || 0,
			// 			friendlyGames: gameDetails?.friendlyGames || 0,
			// 			leagueWins: gameDetails?.leagueWins || 0,
			// 			cupWins: gameDetails?.cupWins || 0,
			// 			friendlyWins: gameDetails?.friendlyWins || 0,
			// 			homeGames: gameDetails?.homeGames || 0,
			// 			awayGames: gameDetails?.awayGames || 0,
			// 			homeWins: gameDetails?.homeWins || 0,
			// 			awayWins: gameDetails?.awayWins || 0,
			// 			uniqueOpponents: gameDetails?.uniqueOpponents || 0,
			// 			uniqueCompetitions: gameDetails?.uniqueCompetitions || 0,
			// 			uniqueTeammates: gameDetails?.uniqueTeammates || 0,
			// 		},
			// 	};
			// case "monthly-performance":
			// 	const selectedMonthlyOption = statOptions.find(opt => opt.value === monthlySelectedStat);
			// 	return {
			// 		type: vizType,
			// 		data: {
			// 			chartData: monthlyChartData,
			// 			selectedStat: selectedMonthlyOption?.label || monthlySelectedStat,
			// 		},
			// 	};
			// case "captaincies-awards-and-achievements":
			// 	return {
			// 		type: vizType,
			// 		data: awardsData,
			// 	};
			// default:
			// 	return { type: vizType };
		// };

	/* COMMENTED OUT: Share Stats functionality - will be re-added in the future */
	// Handle visualization selection
	// const handleVisualizationSelect = async (vizId: string, backgroundColor: "yellow" | "green") => {
		// Set generating state immediately to show blackout overlay
		// setIsGeneratingShare(true);
		
		// const vizData = getVisualizationData(vizId);
		// setSelectedShareVisualization(vizData);
		// setShareBackgroundColor(backgroundColor);
		
		// Close modal immediately - blackout overlay is already in place
		// setIsShareModalOpen(false);
		
		// Wait for React to render and element to be ready
		// const waitForElement = async (maxAttempts = 50): Promise<boolean> => {
		// 	for (let i = 0; i < maxAttempts; i++) {
		// 		if (shareCardRef.current) {
		// 			const cardElement = shareCardRef.current.querySelector('.shareable-stats-card') as HTMLElement;
		// 			if (cardElement && cardElement.offsetWidth > 0 && cardElement.offsetHeight > 0) {
		// 				return true;
		// 			}
		// 		}
		// 		await new Promise(resolve => setTimeout(resolve, 100));
		// 	}
		// 	return false;
		// };

		// const isReady = await waitForElement();
		// if (!isReady || !shareCardRef.current) {
		// 	console.error("[Share] Share card element not ready after waiting");
		// 	alert("Failed to generate share image. The element is not ready. Please try again.");
		// 	setIsGeneratingShare(false);
		// 	setSelectedShareVisualization(null);
		// 	return;
		// }
		
		// try {
		// 	const imageDataUrl = await generateShareImage(shareCardRef.current, 2);
		// 	const shareResult = await shareImage(imageDataUrl, selectedPlayer || "");
			
		// 	if (shareResult.needsIOSPreview) {
		// 		// Show iOS preview modal - keep blackout visible
		// 		setGeneratedImageDataUrl(imageDataUrl);
		// 		setIsIOSPreviewOpen(true);
		// 		// Don't clear selectedShareVisualization yet - wait for user action
		// 		// Keep isGeneratingShare true to maintain blackout
		// 	} else if (shareResult.needsPreview) {
		// 		// Show non-iOS preview modal - keep blackout visible
		// 		setGeneratedImageDataUrl(imageDataUrl);
		// 		setIsNonIOSPreviewOpen(true);
		// 		// Don't clear selectedShareVisualization yet - wait for user action
		// 		// Keep isGeneratingShare true to maintain blackout
		// 	} else {
		// 		// Download fallback (no Web Share API) - clear immediately and remove blackout
		// 		setIsGeneratingShare(false);
		// 		setSelectedShareVisualization(null);
		// 	}
		// } catch (error) {
		// 	console.error("[Share] Error generating share image:", error);
		// 	const errorMessage = error instanceof Error ? error.message : "Unknown error";
		// 	alert(`Failed to generate share image: ${errorMessage}. Please try again.`);
		// 	setIsGeneratingShare(false);
		// 	setSelectedShareVisualization(null);
		// }
	// };

	/* COMMENTED OUT: Share Stats functionality - will be re-added in the future */
	// Regenerate image when background color changes in preview
	// const handleRegenerateImage = async (color: "yellow" | "green") => {
		// setShareBackgroundColor(color);
		
		// if (!shareCardRef.current) {
		// 	return;
		// }

		// Wait for element to be ready
		// const waitForElement = async (maxAttempts = 50): Promise<boolean> => {
		// 	for (let i = 0; i < maxAttempts; i++) {
		// 		if (shareCardRef.current) {
		// 			const cardElement = shareCardRef.current.querySelector('.shareable-stats-card') as HTMLElement;
		// 			if (cardElement && cardElement.offsetWidth > 0 && cardElement.offsetHeight > 0) {
		// 				return true;
		// 			}
		// 		}
		// 		await new Promise(resolve => setTimeout(resolve, 100));
		// 	}
		// 	return false;
		// };

		// const isReady = await waitForElement();
		// if (!isReady || !shareCardRef.current) {
		// 	console.error("[Share] Share card element not ready for regeneration");
		// 	return;
		// }
		
		// try {
		// 	const imageDataUrl = await generateShareImage(shareCardRef.current, 2);
		// 	setGeneratedImageDataUrl(imageDataUrl);
		// } catch (error) {
		// 	console.error("[Share] Error regenerating image:", error);
		// }
	// };

	/* COMMENTED OUT: Share Stats functionality - will be re-added in the future */
	// Handle iOS share continuation
	// const handleIOSShareContinue = async () => {
	// 	setIsIOSPreviewOpen(false);
		
	// 	try {
	// 		await performIOSShare(generatedImageDataUrl, selectedPlayer || "");
	// 	} catch (error) {
	// 		console.error("[Share] Error sharing image:", error);
	// 		alert("Failed to share image. Please try again.");
	// 	} finally {
	// 		setIsGeneratingShare(false);
	// 		setSelectedShareVisualization(null);
	// 		setGeneratedImageDataUrl("");
	// 	}
	// };

	// Handle iOS share close
	// const handleIOSShareClose = () => {
	// 	setIsIOSPreviewOpen(false);
	// 	setIsGeneratingShare(false);
	// 	setSelectedShareVisualization(null);
	// 	setGeneratedImageDataUrl("");
	// };

	// Handle non-iOS share continuation
	// const handleNonIOSShareContinue = async () => {
	// 	setIsNonIOSPreviewOpen(false);
		
	// 	try {
	// 		await performNonIOSShare(generatedImageDataUrl, selectedPlayer || "");
	// 	} catch (error) {
	// 		console.error("[Share] Error sharing image:", error);
	// 		alert("Failed to share image. Please try again.");
	// 	} finally {
	// 		setIsGeneratingShare(false);
	// 		setSelectedShareVisualization(null);
	// 		setGeneratedImageDataUrl("");
	// 	}
	// };

	// Handle non-iOS share close
	// const handleNonIOSShareClose = () => {
	// 	setIsNonIOSPreviewOpen(false);
	// 	setIsGeneratingShare(false);
	// 	setSelectedShareVisualization(null);
	// 	setGeneratedImageDataUrl("");
	// };

	// Share handler - opens modal
	// const handleShare = () => {
	// 	if (!selectedPlayer || !validPlayerData) {
	// 		return;
	// 	}
	// 	setIsShareModalOpen(true);
	// };

	const tooltipStyle = {
		backgroundColor: 'rgb(14, 17, 15)',
		border: '1px solid rgba(249, 237, 50, 0.3)',
		borderRadius: '8px',
		color: '#fff',
	};

	// Custom tooltip formatter for seasonal chart
	const seasonalTooltip = ({ active, payload, label }: any) => {
		if (active && payload && payload.length) {
			const displayLabel = label || payload[0].name || payload[0].payload?.name || '';
			let displayValue = payload[0].value || 0;
			const selectedOption = statOptions.find(opt => opt.value === seasonalSelectedStat);
			if (selectedOption?.statKey === "distance") {
				displayValue = `${Number(displayValue).toFixed(1)} miles`;
			}
			return (
				<div style={tooltipStyle} className='px-3 py-2'>
					<p className='text-white text-sm'>{displayLabel}</p>
					<p className='text-white text-sm'>
						<span className='font-semibold'>Value</span>: {displayValue}
					</p>
				</div>
			);
		}
		return null;
	};

	// Custom tooltip formatter for team chart
	const teamTooltip = ({ active, payload, label }: any) => {
		if (active && payload && payload.length) {
			const displayLabel = label || payload[0].name || payload[0].payload?.name || '';
			let displayValue = payload[0].value || 0;
			const selectedOption = statOptions.find(opt => opt.value === teamSelectedStat);
			if (selectedOption?.statKey === "distance") {
				displayValue = `${Number(displayValue).toFixed(1)} miles`;
			} else if (selectedOption?.statKey === "fantasyPoints") {
				displayValue = Math.round(Number(displayValue));
			}
			return (
				<div style={tooltipStyle} className='px-3 py-2'>
					<p className='text-white text-sm'>{displayLabel}</p>
					<p className='text-white text-sm'>
						<span className='font-semibold'>Value</span>: {displayValue}
					</p>
				</div>
			);
		}
		return null;
	};

	// Custom tooltip formatter to capitalize "value" (for other charts)
	const customTooltip = ({ active, payload, label }: any) => {
		if (active && payload && payload.length) {
			const displayLabel = label || payload[0].name || payload[0].payload?.name || '';
			const displayValue = payload[0].value || 0;
			return (
				<div style={tooltipStyle} className='px-3 py-2'>
					<p className='text-white text-sm'>{displayLabel}</p>
					<p className='text-white text-sm'>
						<span className='font-semibold'>Value</span>: {displayValue}
					</p>
				</div>
			);
		}
		return null;
	};

	const showKpiBlock = Boolean(playerData && keyPerformanceData.length > 0);
	const showFormBlock = Boolean(playerData && featureFlags.playerStatsForm);
	const kpiAndFormGrouped = showKpiBlock && showFormBlock;

	const formSectionInner = (
		<>
			<div className='flex items-center gap-2 mb-2'>
				<h3 className='text-white font-semibold text-sm md:text-base'>Form</h3>
				<div className='relative group'>
					<span className='inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full border border-white/40 text-white/80 cursor-help'>
						i
					</span>
					<div className='pointer-events-none absolute left-0 top-6 z-20 hidden w-72 rounded-md bg-black/90 p-2 text-[11px] text-white shadow-lg group-hover:block'>
						Each point is your match rating for that game (with fantasy-points fallback when needed). The yellow line is current form (5-match EWMA) and the green line is the longer baseline (15-match EWMA). Grey dots are the raw rating for each match.
					</div>
				</div>
			</div>
			{isLoadingFormData ? (
				<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
					<Skeleton height={48} className='rounded mb-3' />
					<Skeleton height={220} className='rounded mb-3' />
					<div className='grid grid-cols-2 md:grid-cols-3 gap-2'>
						<Skeleton height={64} className='rounded' />
						<Skeleton height={64} className='rounded' />
						<Skeleton height={64} className='rounded col-span-2 md:col-span-1' />
					</div>
				</SkeletonTheme>
			) : formData.length > 0 ? (
				<>
					{recentFormMatches.length > 0 ? <PlayerRecentFormBoxes matchesNewestFirst={recentFormMatches} /> : null}
					<LazyWhenVisible rootMargin="120px" className="min-h-[220px] -my-2 md:my-0" fallback={<ChartSkeleton />}>
						<FormComposedChart formData={formData} />
					</LazyWhenVisible>
					<div className='grid grid-cols-2 md:grid-cols-3 gap-2 mt-3'>
						{(() => {
							const v = formSummary?.formCurrent;
							const band = v != null && !Number.isNaN(v) ? matchRatingCircleStyle(v) : null;
							return (
								<div
									className='rounded-md border-2 p-2'
									style={{
										backgroundColor: band?.backgroundColor ?? "rgba(255,255,255,0.05)",
										borderColor: band?.borderColor ?? "rgba(255,255,255,0.12)",
									}}>
									<p className='text-white/75 text-xs'>Current form</p>
									<p className='font-semibold text-sm md:text-base' style={{ color: band?.color ?? "rgba(255,255,255,0.95)" }}>
										{formSummary?.formCurrent != null ? formSummary.formCurrent.toFixed(1) : "-"}{" "}
										{formSummary?.formTrend === "rising" ? "↑" : formSummary?.formTrend === "declining" ? "↓" : "→"}
									</p>
								</div>
							);
						})()}
						{(() => {
							const v = formSummary?.seasonAvg;
							const band = v != null && !Number.isNaN(v) ? matchRatingCircleStyle(v) : null;
							return (
								<div
									className='rounded-md border-2 p-2'
									style={{
										backgroundColor: band?.backgroundColor ?? "rgba(255,255,255,0.05)",
										borderColor: band?.borderColor ?? "rgba(255,255,255,0.12)",
									}}>
									<p className='text-white/75 text-xs'>Season avg</p>
									<p className='font-semibold text-sm md:text-base' style={{ color: band?.color ?? "rgba(255,255,255,0.95)" }}>
										{formSummary?.seasonAvg != null ? formSummary.seasonAvg.toFixed(1) : "-"}
									</p>
								</div>
							);
						})()}
						{(() => {
							const v = formSummary?.formPeak;
							const band = v != null && !Number.isNaN(v) ? matchRatingCircleStyle(v) : null;
							return (
								<div
									className='rounded-md border-2 p-2 col-span-2 md:col-span-1'
									style={{
										backgroundColor: band?.backgroundColor ?? "rgba(255,255,255,0.05)",
										borderColor: band?.borderColor ?? "rgba(255,255,255,0.12)",
									}}>
									<p className='text-white/75 text-xs'>Peak form</p>
									<p className='font-semibold text-sm md:text-base' style={{ color: band?.color ?? "rgba(255,255,255,0.95)" }}>
										{formSummary?.formPeak != null
											? `${formSummary.formPeak.toFixed(1)} (${formatFormWeekLabel(formSummary.formPeakWeek)})`
											: "-"}
									</p>
								</div>
							);
						})()}
					</div>
				</>
			) : (
				<p className='text-white/70 text-xs md:text-sm'>No form data available for the current filters.</p>
			)}
		</>
	);

	const chartContent = (
		<div className='space-y-4 pb-4 md:space-y-0 player-stats-masonry'>
			{(showKpiBlock || showFormBlock) && (
				<div
					className={
						kpiAndFormGrouped
							? "player-stats-kpi-form-group flex flex-col gap-4 md:gap-0 md:break-inside-avoid md:mb-4"
							: showKpiBlock
								? "md:break-inside-avoid md:mb-4"
								: ""
					}>
					{showKpiBlock ? (
						<div id='key-performance-stats' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:mb-4'>
							<div className='flex items-center justify-between gap-2 mb-3'>
								<h3 className='text-white font-semibold text-sm md:text-base'>Key Performance Stats</h3>
								<div className='inline-flex rounded-md overflow-hidden border border-white/20'>
									<button
										type='button'
										onClick={() => setKeyPerformanceMode("totals")}
										className={`px-2 py-1 text-xs md:text-sm ${keyPerformanceMode === "totals" ? "bg-dorkinians-yellow text-black font-semibold" : "bg-transparent text-white"}`}
									>
										Totals
									</button>
									{featureFlags.playerStatsKeyPerformance ? (
										<button
											type='button'
											onClick={() => setKeyPerformanceMode("per90")}
											className={`px-2 py-1 text-xs md:text-sm border-l border-white/20 ${keyPerformanceMode === "per90" ? "bg-dorkinians-yellow text-black font-semibold" : "bg-transparent text-white"}`}
										>
											Per 90
										</button>
									) : null}
								</div>
							</div>
							{isLoadingPlayerData ? (
								<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
									<StatCardSkeleton count={9} variant='embedded' />
								</SkeletonTheme>
							) : (
								<div className='grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4'>
									{keyPerformanceData.map((item, index) => {
										let statKey = "APP";
										if (item.name === "Apps") statKey = "APP";
										else if (item.name === "Starts") statKey = "PlayerStarts";
										else if (item.name === "Mins") statKey = "MIN";
										else if (item.name === "Seasons") statKey = "NumberSeasonsPlayedFor";
										else if (item.name === "MoM") statKey = "MOM";
										else if (item.name === "Form") statKey = "PlayerAvgMatchRating";
										else if (item.name === "Avg Rtg") statKey = "PlayerAvgMatchRating";
										else if (item.name === "Goals") statKey = "AllGSC";
										else if (item.name === "Assists") statKey = "A";
										else if (item.name === "G/90") statKey = "PlayerGoalsPer90";
										else if (item.name === "A/90") statKey = "PlayerAssistsPer90";
										else if (item.name === "GI/90") statKey = "PlayerGI90";
										else if (item.name === "FTP/90") statKey = "PlayerFTP90";
										else if (item.name === "Cards/90") statKey = "PlayerCards90";
										else if (item.name === "MoM/90") statKey = "PlayerMoM90";
										const stat = statObject[statKey as keyof typeof statObject];
										const iconName = item.name === "Goals" ? "Goals-Icon" : (stat?.iconName || "Appearance-Icon");
										const isPriority = index < 3;
										return (
											<div key={item.name} className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
												<div className='flex-shrink-0'>
													<Image
														src={`/stat-icons/${iconName}.svg`}
														alt={stat?.displayText || item.name}
														width={40}
														height={40}
														className='w-8 h-8 md:w-10 md:h-10 object-contain'
														priority={isPriority}
													/>
												</div>
												<div className='flex-1 min-w-0'>
													<div className='text-white/70 text-sm md:text-base mb-1'>
														{item.name}
													</div>
													<div className='text-white font-bold text-xl md:text-2xl'>
														{(item as any).isString ? item.value : (() => {
															if ((item as any).isForm) {
																const v = item.value as number | null | undefined;
																if (v == null) return "-";
																const trend = formSummary?.formTrend || "stable";
																const arrow = trend === "rising" ? "↑" : trend === "declining" ? "↓" : "→";
																return `${v.toFixed(1)} ${arrow}`;
															}
															if ((item as any).isPer90 && toNumber(playerData!.minutes) < 360) {
																return "Min. 360";
															}
															if (item.name === "Mins") {
																return Math.round(toNumber(item.value)).toLocaleString();
															}
															if ((item as any).isRating) {
																const v = item.value as number | null | undefined;
																if (v === null || v === undefined) return "-";
																return formatStatValue(v, stat?.statFormat || "Decimal1", stat?.numberDecimalPlaces ?? 1, (stat as any)?.statUnit);
															}
															return formatStatValue(item.value, stat?.statFormat || "Integer", stat?.numberDecimalPlaces || 0, (stat as any)?.statUnit);
														})()}
													</div>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					) : null}
					{showFormBlock ? (
						<div
							id='form-section'
							className={
								kpiAndFormGrouped
									? "relative z-30 bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4"
									: "relative z-30 bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4"
							}>
							{formSectionInner}
						</div>
					) : null}
				</div>
			)}

			{/* All Games Section */}
			<div id='all-games' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
				<h3 className='text-white font-semibold text-sm md:text-base mb-3'>All Games</h3>
				<div className='flex justify-center pb-4'>
					<button
						type='button'
						onClick={openAllGamesModal}
						className='text-white hover:text-dorkinians-yellow underline text-sm md:text-base transition-colors bg-transparent border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)]'
					>
						Click to show all games and details
					</button>
				</div>
			</div>

			{/* Streaks - live computation for current filter set (foundation / chatbot rules) */}
			{playerData && streakDisplaySource && featureFlags.playerStatsStreaks ? (
				<div id='streaks-section' className='relative z-30 bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
					<div className='flex items-center gap-2 mb-2'>
						<h3 className='text-white font-semibold text-sm md:text-base'>Streaks</h3>
						<div className='relative group'>
							<span
								tabIndex={0}
								className='inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full border border-white/40 text-white/80 cursor-help outline-none focus-visible:ring-2 focus-visible:ring-dorkinians-yellow/80'>
								i
							</span>
							<div className='pointer-events-none absolute left-0 top-6 z-20 hidden w-72 rounded-md bg-black/90 p-2 text-[11px] text-white shadow-lg group-hover:block group-focus-within:block'>
								Streaks are tracked week-by-week using seasonWeek references. Appearance streaks increase for every match you play across any XI
								(including multiple matches in one week), and only break when your most-played team for that season plays in that week and you do not
								appear for any team. For all other streak types (scoring, assists, clean sheets, etc.), weeks you do not play are skipped (they do not
								break the streak); if you play, the streak increments only when you satisfy that streak condition for that match. Streaks carry across
								seasons, use your most-recent team as the tie-break for "most-played team," and are recalculated if fixture statuses change.
							</div>
						</div>
					</div>
					{(() => {
						type StreakCard = {
							label: string;
							cur: keyof PlayerData;
							seasonBest?: keyof PlayerData;
							allTimeBest?: keyof PlayerData;
							tip: string;
							singularUnit: string;
							pluralUnit: string;
						};
						const src = streakDisplaySource;
						const sn = (k: keyof PlayerData) => {
							const v = src[k];
							return typeof v === "number" && !Number.isNaN(v) ? v : 0;
						};
						const fmtOpt = (k?: keyof PlayerData) => {
							if (!k) return "-";
							const v = src[k];
							return typeof v === "number" && !Number.isNaN(v) ? String(v) : "-";
						};
						const activeCards: StreakCard[] = [
							{
								label: "Appearances",
								cur: "currentAppearanceStreak",
								seasonBest: "seasonBestAppearanceStreak",
								allTimeBest: "allTimeBestAppearanceStreak",
								tip: "Consecutive matches played. Weeks with no fixture for your season anchor team are protected; if that anchor team plays and you do not appear, the run breaks.",
								singularUnit: "appearance",
								pluralUnit: "appearances",
							},
							{
								label: "Starts",
								cur: "currentStartStreak",
								seasonBest: "seasonBestStartStreak",
								allTimeBest: "allTimeBestStartStreak",
								tip: "Consecutive matches where you started. A bench cameo in a played match resets the run.",
								singularUnit: "start",
								pluralUnit: "starts",
							},
							{
								label: "Goal involvement",
								cur: "currentGoalInvolvementStreak",
								seasonBest: "seasonBestGoalInvolvementStreak",
								allTimeBest: "allTimeBestGoalInvolvementStreak",
								tip: "Consecutive matches with a goal or assist (or both).",
								singularUnit: "game",
								pluralUnit: "games",
							},
							{
								label: "MoM",
								cur: "currentMomStreak",
								seasonBest: "seasonBestMomStreak",
								allTimeBest: "allTimeBestMomStreak",
								tip: "Consecutive matches where you were named Player of the Match.",
								singularUnit: "MoM",
								pluralUnit: "MoMs",
							},
							{
								label: "Scoring",
								cur: "currentScoringStreak",
								seasonBest: "seasonBestScoringStreak",
								allTimeBest: "allTimeBestScoringStreak",
								tip: "Counts consecutive games where you scored (goals or penalties). A blank scores resets the run.",
								singularUnit: "game",
								pluralUnit: "games",
							},
							{
								label: "Assists",
								cur: "currentAssistStreak",
								seasonBest: "seasonBestAssistStreak",
								allTimeBest: "allTimeBestAssistStreak",
								tip: "Counts consecutive games with at least one assist. A game with no assist resets the run.",
								singularUnit: "game",
								pluralUnit: "games",
							},
							{
								label: "Clean sheet",
								cur: "currentCleanSheetStreak",
								seasonBest: "seasonBestCleanSheetStreak",
								allTimeBest: "allTimeBestCleanSheetStreak",
								tip: "As a defender or keeper: consecutive games where your side conceded zero while you played. Conceding resets the run.",
								singularUnit: "clean sheet",
								pluralUnit: "clean sheets",
							},
							{
								label: "85+ mins",
								cur: "currentFullMatchStreak",
								seasonBest: "seasonBestFullMatchStreak",
								allTimeBest: "allTimeBestFullMatchStreak",
								tip: "Consecutive games with at least 85 minutes played. Subbing earlier resets the run.",
								singularUnit: "match",
								pluralUnit: "matches",
							},
							{
								label: "No cards",
								cur: "currentDisciplineStreak",
								seasonBest: "seasonBestDisciplineStreak",
								allTimeBest: "allTimeBestDisciplineStreak",
								tip: "Consecutive games with no yellow or red card. Any booking resets the run.",
								singularUnit: "match",
								pluralUnit: "matches",
							},
							{
								label: "Wins",
								cur: "currentWinStreak",
								seasonBest: "seasonBestWinStreak",
								allTimeBest: "allTimeBestWinStreak",
								tip: "Consecutive games your side won while you played. A draw or loss resets the run.",
								singularUnit: "win",
								pluralUnit: "wins",
							},
							{
								label: "Unbeaten",
								cur: "currentUnbeatenStreak",
								seasonBest: "seasonBestUnbeatenStreak",
								allTimeBest: "allTimeBestUnbeatenStreak",
								tip: "Consecutive matches without a loss while you played (wins or draws). A loss resets the run.",
								singularUnit: "match",
								pluralUnit: "matches",
							},
						];
						const orderedCards = [...activeCards].sort((a, b) => {
							const aVal = sn(a.cur);
							const bVal = sn(b.cur);
							return Number(bVal > 0) - Number(aVal > 0);
						});
						return (
							<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2'>
								{orderedCards.map(({ label, cur, seasonBest, allTimeBest, tip, singularUnit, pluralUnit }) => {
									const currentValue = sn(cur);
									const seasonBestValue = seasonBest ? sn(seasonBest) : 0;
									const allTimeBestValue = allTimeBest ? sn(allTimeBest) : 0;
									const meta = streakTooltipMeta?.[String(cur)];
									const currentLine = `Current: ${formatStreakCountLabel(currentValue, singularUnit, pluralUnit)}${formatTooltipDateRange(meta?.current)}`;
									const seasonBestLine = `Season best: ${formatStreakCountLabel(seasonBestValue, singularUnit, pluralUnit)}${formatTooltipDateRange(meta?.seasonBest)}`;
									const allTimeBestLine = `All-time best: ${formatStreakCountLabel(allTimeBestValue, singularUnit, pluralUnit)}${formatTooltipDateRange(meta?.allTimeBest)}`;
									return (
										<StreakStatTile
											key={String(cur)}
											label={label}
											current={currentValue}
											seasonBest={fmtOpt(seasonBest)}
											allTimeBest={fmtOpt(allTimeBest)}
											tip={tip}
											currentLine={currentLine}
											seasonBestLine={seasonBestLine}
											allTimeBestLine={allTimeBestLine}
										/>
									);
								})}
							</div>
						);
					})()}
				</div>
			) : null}

			{/* Seasonal Performance Section */}
			<div id='seasonal-performance' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
				{allSeasonsSelected && (
					<div className='flex items-center justify-between mb-2 gap-2'>
						<h3 className='text-white font-semibold text-sm md:text-base flex-shrink-0'>Seasonal Performance</h3>
						<div className='flex-1 max-w-[45%]'>
							<Listbox
								value={seasonalSelectedStat}
								onChange={(v) => {
									setSeasonalSelectedStat(v);
									trackStatsStatSelected("player-stats", "seasonal-performance", v);
								}}>
								<div className='relative'>
									<Listbox.Button className='relative w-full cursor-default dark-dropdown py-2 pl-3 pr-8 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 text-xs md:text-sm'>
										<span className='block truncate text-white'>
											{statOptions.find(opt => opt.value === seasonalSelectedStat)?.label || seasonalSelectedStat}
										</span>
										<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
											<ChevronUpDownIcon className='h-4 w-4 text-yellow-300' aria-hidden='true' />
										</span>
									</Listbox.Button>
									<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-xs md:text-sm shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none'>
										{statOptions.map((option) => (
											<Listbox.Option
												key={option.value}
												className={({ active }) =>
													`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
												}
												value={option.value}>
												{({ selected }) => (
													<span className={`block truncate py-1 px-2 ${selected ? "font-medium" : "font-normal"}`}>
														{option.label}
													</span>
												)}
											</Listbox.Option>
										))}
									</Listbox.Options>
								</div>
							</Listbox>
						</div>
					</div>
				)}
				{allSeasonsSelected && (
					<div className='flex items-center justify-center gap-2 mb-2'>
						<input 
							type='checkbox' 
							checked={showTrend} 
							onChange={(e) => setShowTrend(e.target.checked)}
							className='w-4 h-4 accent-dorkinians-yellow cursor-pointer'
							id='show-trend-checkbox'
							style={{ accentColor: '#f9ed32' }}
						/>
						<label htmlFor='show-trend-checkbox' className='text-white text-xs md:text-sm cursor-pointer'>Show trend</label>
					</div>
				)}
				{allSeasonsSelected ? (
					<>
						{isLoadingSeasonalStats ? (
							<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
								<ChartSkeleton />
							</SkeletonTheme>
						) : seasonalChartData.length > 0 ? (
							<LazyWhenVisible rootMargin="120px" className="min-h-[240px]" fallback={<ChartSkeleton />}>
								<SeasonalPerformanceChart
									data={seasonalChartData}
									showTrend={showTrend}
									tooltipContent={seasonalTooltip}
								/>
							</LazyWhenVisible>
						) : (
							<div className='flex items-center justify-center h-64'>
								<p className='text-white text-sm'>No seasonal data available</p>
							</div>
						)}
					</>
				) : (
					<div className='flex items-center justify-center py-2'>
						<p className='text-white text-xs'>Unfilter time frame to see Seasonal Performance</p>
					</div>
				)}
			</div>

			{/* Team Performance Section */}
			<div id='team-performance' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
				{allTeamsSelected && (
					<div className='flex items-center justify-between mb-2 gap-2'>
						<h3 className='text-white font-semibold text-sm md:text-base flex-shrink-0'>Team Performance</h3>
						<div className='flex-1 max-w-[45%]'>
							<Listbox
								value={teamSelectedStat}
								onChange={(v) => {
									setTeamSelectedStat(v);
									trackStatsStatSelected("player-stats", "team-performance", v);
								}}>
								<div className='relative'>
									<Listbox.Button className='relative w-full cursor-default dark-dropdown py-2 pl-3 pr-8 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 text-xs md:text-sm'>
										<span className='block truncate text-white'>
											{statOptions.find(opt => opt.value === teamSelectedStat)?.label || teamSelectedStat}
										</span>
										<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
											<ChevronUpDownIcon className='h-4 w-4 text-yellow-300' aria-hidden='true' />
										</span>
									</Listbox.Button>
									<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-xs md:text-sm shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none'>
										{statOptions.map((option) => (
											<Listbox.Option
												key={option.value}
												className={({ active }) =>
													`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
												}
												value={option.value}>
												{({ selected }) => (
													<span className={`block truncate py-1 px-2 ${selected ? "font-medium" : "font-normal"}`}>
														{option.label}
													</span>
												)}
											</Listbox.Option>
										))}
									</Listbox.Options>
								</div>
							</Listbox>
						</div>
					</div>
				)}
				{allTeamsSelected ? (
					<>
						{isLoadingTeamStats ? (
							<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
								<ChartSkeleton />
							</SkeletonTheme>
						) : teamChartData.length > 0 ? (
							<LazyWhenVisible rootMargin="120px" className="min-h-[240px]" fallback={<ChartSkeleton />}>
								<TeamPerformanceChart data={teamChartData} tooltipContent={teamTooltip} />
							</LazyWhenVisible>
						) : (
							<div className='flex items-center justify-center h-64'>
								<p className='text-white text-sm'>No team data available</p>
							</div>
						)}
					</>
				) : (
					<div className='flex items-center justify-center py-2'>
						<p className='text-white text-xs'>Unfilter teams to see Team Performance</p>
					</div>
				)}
			</div>

			{/* Positional Stats Visualization */}
			{(toNumber(validPlayerData.gk) > 0 || toNumber(validPlayerData.def) > 0 || toNumber(validPlayerData.mid) > 0 || toNumber(validPlayerData.fwd) > 0) && (
				<div id='positional-stats' className='md:break-inside-avoid md:mb-4'>
				<PositionalStatsVisualization
					gk={toNumber(validPlayerData.gk)}
					def={toNumber(validPlayerData.def)}
					mid={toNumber(validPlayerData.mid)}
					fwd={toNumber(validPlayerData.fwd)}
					appearances={toNumber(validPlayerData.appearances)}
					gkMinutes={toNumber(validPlayerData.gkMinutes || 0)}
					defMinutes={toNumber(validPlayerData.defMinutes || 0)}
					midMinutes={toNumber(validPlayerData.midMinutes || 0)}
					fwdMinutes={toNumber(validPlayerData.fwdMinutes || 0)}
				/>
				</div>
			)}

			{/* Match Results Section */}
			{playerFilters.result.length !== 1 && (() => {
				const wins = toNumber(validPlayerData.wins || 0);
				const draws = toNumber(validPlayerData.draws || 0);
				const losses = toNumber(validPlayerData.losses || 0);
				const gamesPlayed = wins + draws + losses;
				
				if (gamesPlayed === 0) return null;
				
				const pieChartData = [
					{ name: "Wins", value: wins, color: "#22c55e" },
					{ name: "Draws", value: draws, color: "#60a5fa" },
					{ name: "Losses", value: losses, color: "#ef4444" },
				].filter(item => item.value > 0);
				
				if (pieChartData.length === 0) return null;
				
				const pointsPerGame = gamesPlayed > 0 ? ((3 * wins) + (1 * draws)) / gamesPlayed : 0;
				const pointsPerGameFormatted = Math.min(3, Math.max(0, pointsPerGame)).toFixed(1);
				
				return (
					<div id='match-results' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
						<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Match Results</h3>
						<p className='text-white text-sm mb-2 text-center'>Points per game: {pointsPerGameFormatted}</p>
						<LazyWhenVisible rootMargin="120px" className="min-h-[220px] -my-2" fallback={<ChartSkeleton />}>
							<MatchResultsPieChart data={pieChartData} tooltipContent={customTooltip} />
						</LazyWhenVisible>
					</div>
				);
			})()}

			{/* Starting impact - uses filtered aggregates from player-data */}
			{toNumber(validPlayerData.appearances) > 0 && featureFlags.playerStatsStartingImpact && (
				<div id='starting-impact' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
					<h3 className='text-white font-semibold text-sm md:text-base mb-3'>Starting impact</h3>
					<div className='grid grid-cols-2 gap-3 text-sm md:text-base text-white' data-testid='starting-impact-grid'>
						<div className='bg-white/5 rounded-lg p-3'>
							<div className='text-white/70 mb-1'>Starts / subs</div>
							<div className='font-bold text-lg'>
								{toNumber(validPlayerData.starts)} / {toNumber(validPlayerData.subAppearances)}
							</div>
						</div>
						<div className='bg-white/5 rounded-lg p-3'>
							<div className='text-white/70 mb-1'>Start rate</div>
							<div className='font-bold text-lg'>{toNumber(validPlayerData.startRatePercent).toFixed(1)}%</div>
						</div>
						<div className='bg-white/5 rounded-lg p-3'>
							<div className='text-white/70 mb-1'>Win % when starting</div>
							<div className='font-bold text-lg'>{toNumber(validPlayerData.winRateWhenStarting).toFixed(1)}%</div>
						</div>
						<div className='bg-white/5 rounded-lg p-3'>
							<div className='text-white/70 mb-1'>Win % from bench</div>
							<div className='font-bold text-lg'>{toNumber(validPlayerData.winRateFromBench).toFixed(1)}%</div>
						</div>
					</div>
				</div>
			)}

			{/* Game Details Section */}
			{isLoadingGameDetails ? (
				<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
					<div id='game-details' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
						<Skeleton height={20} width="40%" className="mb-4" />
						<TableSkeleton rows={3} />
						<TableSkeleton rows={2} />
						<div className='space-y-2'>
							<Skeleton height={16} width="60%" />
							<Skeleton height={16} width="65%" />
							<Skeleton height={16} width="55%" />
						</div>
					</div>
				</SkeletonTheme>
			) : gameDetails && (
				<div id='game-details' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
					<h3 className='text-white font-semibold text-sm md:text-base mb-4'>Game Details</h3>
					
					{/* CompType Table */}
					<div className='mb-6'>
						<table className='w-full text-white text-sm'>
							<thead>
								<tr className='border-b border-white/20'>
									<th className='text-left py-2 px-2'>Type</th>
									<th className='text-right py-2 px-2'>Count</th>
									<th className='text-right py-2 px-2'>% Won</th>
								</tr>
							</thead>
							<tbody>
								{(gameDetails.leagueGames || 0) > 0 && (
									<tr className='border-b border-white/10'>
										<td className='py-2 px-2'>
											<span className='px-2 py-1 rounded text-xs font-medium mr-2 bg-blue-600/30 text-blue-300'>League</span>
										</td>
										<td className='text-right py-2 px-2 font-mono'>{gameDetails.leagueGames || 0}</td>
										<td className='text-right py-2 px-2 font-mono'>
											{gameDetails.leagueGames > 0 
												? ((gameDetails.leagueWins || 0) / gameDetails.leagueGames * 100).toFixed(1) + '%'
												: '0.0%'}
										</td>
									</tr>
								)}
								{(gameDetails.cupGames || 0) > 0 && (
									<tr className='border-b border-white/10'>
										<td className='py-2 px-2'>
											<span className='px-2 py-1 rounded text-xs font-medium mr-2 bg-purple-600/30 text-purple-300'>Cup</span>
										</td>
										<td className='text-right py-2 px-2 font-mono'>{gameDetails.cupGames || 0}</td>
										<td className='text-right py-2 px-2 font-mono'>
											{gameDetails.cupGames > 0 
												? ((gameDetails.cupWins || 0) / gameDetails.cupGames * 100).toFixed(1) + '%'
												: '0.0%'}
										</td>
									</tr>
								)}
								{(gameDetails.friendlyGames || 0) > 0 && (
									<tr>
										<td className='py-2 px-2'>
											<span className='px-2 py-1 rounded text-xs font-medium mr-2 bg-green-600/30 text-green-300'>Friendly</span>
										</td>
										<td className='text-right py-2 px-2 font-mono'>{gameDetails.friendlyGames || 0}</td>
										<td className='text-right py-2 px-2 font-mono'>
											{gameDetails.friendlyGames > 0 
												? ((gameDetails.friendlyWins || 0) / gameDetails.friendlyGames * 100).toFixed(1) + '%'
												: '0.0%'}
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>

					{/* Home/Away Table */}
					<div className='mb-6'>
						<table className='w-full text-white text-sm'>
							<thead>
								<tr className='border-b border-white/20'>
									<th className='text-left py-2 px-2'>Location</th>
									<th className='text-right py-2 px-2'>Count</th>
									<th className='text-right py-2 px-2'>% Won</th>
								</tr>
							</thead>
							<tbody>
								{(gameDetails.homeGames || 0) > 0 && (
									<tr className='border-b border-white/10'>
										<td className='py-2 px-2'>
											<span className='px-2 py-1 rounded text-xs font-medium mr-2 bg-dorkinians-yellow/20 text-dorkinians-yellow'>Home</span>
										</td>
										<td className='text-right py-2 px-2 font-mono'>{gameDetails.homeGames || 0}</td>
										<td className='text-right py-2 px-2 font-mono'>
											{gameDetails.homeGames > 0 
												? ((gameDetails.homeWins || 0) / gameDetails.homeGames * 100).toFixed(1) + '%'
												: '0.0%'}
										</td>
									</tr>
								)}
								{(gameDetails.awayGames || 0) > 0 && (
									<tr>
										<td className='py-2 px-2'>
											<span className='px-2 py-1 rounded text-xs font-medium mr-2 bg-gray-700 text-gray-300'>Away</span>
										</td>
										<td className='text-right py-2 px-2 font-mono'>{gameDetails.awayGames || 0}</td>
										<td className='text-right py-2 px-2 font-mono'>
											{gameDetails.awayGames > 0 
												? ((gameDetails.awayWins || 0) / gameDetails.awayGames * 100).toFixed(1) + '%'
												: '0.0%'}
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>

					{/* Unique Counts */}
					<div className='space-y-2'>
						<p className='text-white text-sm'>
							<span className='text-white'>Opposition played against: </span>
							<span className='font-mono font-bold'>{gameDetails.uniqueOpponents || 0}</span>
						</p>
						<p className='text-white text-sm'>
							<span className='text-white'>Competitions competed in: </span>
							<span className='font-mono font-bold'>{gameDetails.uniqueCompetitions || 0}</span>
						</p>
						<p className='text-white text-sm'>
							<span className='text-white'>Teammates played with: </span>
							<span className='font-mono font-bold'>{gameDetails.uniqueTeammates || 0}</span>
						</p>
					</div>
				</div>
			)}

			{/* Monthly Performance Section */}
			<div id='monthly-performance' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
				<div className='flex items-center justify-between mb-2 gap-2'>
					<h3 className='text-white font-semibold text-sm md:text-base flex-shrink-0'>Monthly Performance</h3>
					<div className='flex-1 max-w-[45%]'>
						<Listbox
							value={monthlySelectedStat}
							onChange={(v) => {
								setMonthlySelectedStat(v);
								trackStatsStatSelected("player-stats", "monthly-performance", v);
							}}>
							<div className='relative'>
								<Listbox.Button className='relative w-full cursor-default dark-dropdown py-2 pl-3 pr-8 text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-yellow-300 text-xs md:text-sm'>
									<span className='block truncate text-white'>
										{statOptions.find(opt => opt.value === monthlySelectedStat)?.label || monthlySelectedStat}
									</span>
									<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
										<ChevronUpDownIcon className='h-4 w-4 text-yellow-300' aria-hidden='true' />
									</span>
								</Listbox.Button>
								<Listbox.Options className='absolute z-[9999] mt-1 max-h-60 w-full overflow-auto dark-dropdown py-1 text-xs md:text-sm shadow-lg ring-1 ring-yellow-400 ring-opacity-20 focus:outline-none'>
									{statOptions.map((option) => (
										<Listbox.Option
											key={option.value}
											className={({ active }) =>
												`relative cursor-default select-none dark-dropdown-option ${active ? "hover:bg-yellow-400/10 text-yellow-300" : "text-white"}`
											}
											value={option.value}>
											{({ selected }) => (
												<span className={`block truncate py-1 px-2 ${selected ? "font-medium" : "font-normal"}`}>
													{option.label}
												</span>
											)}
										</Listbox.Option>
									))}
								</Listbox.Options>
							</div>
						</Listbox>
					</div>
				</div>
				{isLoadingMonthlyStats ? (
					<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
						<ChartSkeleton />
					</SkeletonTheme>
				) : monthlyChartData.length > 0 ? (
					<LazyWhenVisible rootMargin="120px" className="min-h-[240px]" fallback={<ChartSkeleton />}>
						<MonthlyPerformanceChart data={monthlyChartData} tooltipContent={seasonalTooltip} />
					</LazyWhenVisible>
				) : (
					<div className='flex items-center justify-center h-64'>
						<p className='text-white text-sm'>No monthly data available</p>
					</div>
				)}
			</div>

			{playerData && featureFlags.playerStatsPartnerships ? (
				<div
					id='partnerships-section'
					className='relative z-30 bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
						<div className='flex flex-wrap items-center justify-between gap-2 mb-2'>
							<div className='flex items-center gap-2 min-w-0'>
								<h3 className='text-white font-semibold text-sm md:text-base'>Partnerships</h3>
								<div className='relative group'>
									<span
										tabIndex={0}
										className='inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full border border-white/40 text-white/80 cursor-help outline-none focus-visible:ring-2 focus-visible:ring-dorkinians-yellow/80'>
										i
									</span>
									<div className='pointer-events-none absolute left-0 top-6 z-20 hidden w-[min(100vw-2rem,22rem)] rounded-md bg-black/90 p-2 text-[11px] text-white shadow-lg group-hover:block group-focus-within:block'>
										Win rate in games where you and each teammate both played (minimum five shared games) compared to your baseline win rate when
										you play.
									</div>
								</div>
							</div>
							{partnershipList.length > 0 ? (
								<div className='inline-flex flex-wrap justify-end rounded-md overflow-hidden border border-white/20 shrink-0 max-w-full'>
									<button
										type='button'
										onClick={() => setPartnershipSortMode("bestWinRate")}
										className={`px-2 py-1 text-[10px] md:text-xs whitespace-nowrap ${partnershipSortMode === "bestWinRate" ? "bg-dorkinians-yellow text-black font-semibold" : "bg-transparent text-white"}`}>
										Best win rate
									</button>
									<button
										type='button'
										onClick={() => setPartnershipSortMode("mostImprovedWinRate")}
										className={`px-2 py-1 text-[10px] md:text-xs text-center leading-tight border-l border-white/20 ${partnershipSortMode === "mostImprovedWinRate" ? "bg-dorkinians-yellow text-black font-semibold" : "bg-transparent text-white"}`}>
										Most improved win rate
									</button>
									<button
										type='button'
										onClick={() => setPartnershipSortMode("mostGames")}
										className={`px-2 py-1 text-[10px] md:text-xs whitespace-nowrap border-l border-white/20 ${partnershipSortMode === "mostGames" ? "bg-dorkinians-yellow text-black font-semibold" : "bg-transparent text-white"}`}>
										Most games
									</button>
								</div>
							) : null}
						</div>
						{partnershipList.length === 0 ? (
							<p className='text-white/60 text-xs'>
								No partnership data yet. Run a full seed so graph insights (Feature 7) can populate this section.
							</p>
						) : (
							<ul className='space-y-2'>
								{partnershipListDisplay.map((p) => {
									const base = playerData.impactWinRateWith;
									const deltaPct =
										base != null && typeof p.winRate === "number" && !Number.isNaN(p.winRate)
											? Math.round((p.winRate - base) * 10) / 10
											: null;
									const deltaClass =
										deltaPct != null ? (deltaPct < 0 ? "text-red-400" : deltaPct > 0 ? "text-dorkinians-green-text" : "text-white/50") : "";
									const deltaLabel =
										deltaPct != null ? `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}% vs your win rate` : null;
									return (
										<li key={p.name} className='flex flex-wrap items-baseline justify-between gap-2 bg-white/5 rounded-md px-3 py-2'>
											<div className='min-w-0'>
												<button
													type='button'
													onClick={() => {
														trackEvent(UmamiEvents.PlayerSelected, { source: "player-graph-partner", playerName: p.name });
														selectPlayer(p.name, "picker");
														setMainPage("stats");
														setStatsSubPage("player-stats");
													}}
													className='text-[#E8C547] text-xs md:text-sm font-medium hover:underline text-left'>
													{p.name}
												</button>
												{deltaLabel ? <p className={`text-[10px] mt-0.5 ${deltaClass}`}>{deltaLabel}</p> : null}
											</div>
											<p className='text-white text-xs md:text-sm font-semibold tabular-nums shrink-0'>
												{Math.round(p.winRate * 10) / 10}% · {Math.round(p.matches)} games
											</p>
										</li>
									);
								})}
							</ul>
						)}
				</div>
			) : null}

			{playerData && featureFlags.playerStatsImpact ? (
				<div
					id='impact-section'
					className='relative z-30 bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
					<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Impact</h3>
					{playerData.impactDelta == null ||
					playerData.impactWinRateWith == null ||
					!playerData.mostPlayedForTeam ||
					String(playerData.mostPlayedForTeam).trim() === "" ? (
						<p className='text-white/60 text-xs'>
							Impact compares your most-played XI&apos;s results when you play vs when you don&apos;t (needs enough games without you).
							Filtered fixtures are used so the comparison matches your current filter set. Run a full seed after Feature 7, or check you
							have a primary team set.
						</p>
					) : (
						<>
							<p className='text-white text-sm md:text-base font-medium mb-2'>
								{(() => {
									const teamLine = formatXiTeamLabel(playerData.mostPlayedForTeam);
									const delta = Math.abs(Math.round(playerData.impactDelta * 10) / 10);
									return playerData.impactDelta >= 0 ? (
										<>
											The <span className='text-dorkinians-yellow'>{teamLine}</span> wins{" "}
											<span className='text-dorkinians-yellow font-bold'>{delta}%</span> more often when you play.
										</>
									) : (
										<>
											The <span className='text-dorkinians-yellow'>{teamLine}</span> wins{" "}
											<span className='text-dorkinians-yellow font-bold'>{delta}%</span> less often when you play.
										</>
									);
								})()}
							</p>
							{playerData.impactRatesDisplay ? (
								<p className='text-white/70 text-xs md:text-sm mb-2'>{playerData.impactRatesDisplay}</p>
							) : null}
							{playerData.impactSampleWithout != null && playerData.impactSampleWithout < 10 ? (
								<p className='text-white/50 text-[11px] md:text-xs border-l-2 border-[rgba(232,197,71,0.35)] pl-2'>
									Sample without you is small ({playerData.impactSampleWithout} games) - interpret with care.
								</p>
							) : null}
						</>
					)}
				</div>
			) : null}

			{/* Defensive Record Section */}
			<div id='defensive-record' className='md:break-inside-avoid md:mb-4'>
			{(() => {
				const concededVal = toNumber(validPlayerData.conceded);
				const cleanSheetsVal = toNumber(validPlayerData.cleanSheets);
				const ownGoalsVal = toNumber(validPlayerData.ownGoals);
				const appearancesVal = toNumber(validPlayerData.appearances);
				const gkVal = toNumber(validPlayerData.gk);
				const savesVal = toNumber(validPlayerData.saves);
				const concededPerAppVal = toNumber(validPlayerData.concededPerApp);
				const gkCleanSheetsVal = toNumber(validPlayerData.gkCleanSheets || 0);

				return (
					<DefensiveRecordSection
						conceded={concededVal}
						cleanSheets={cleanSheetsVal}
						ownGoals={ownGoalsVal}
						appearances={appearancesVal}
						gk={gkVal}
						saves={savesVal}
						concededPerApp={concededPerAppVal}
						gkCleanSheets={gkCleanSheetsVal}
					/>
				);
			})()}
			</div>

			{/* Distance Travelled Section */}
			{toNumber(validPlayerData.distance) > 0 && toNumber(validPlayerData.awayGames) > 0 && (
				<div id='distance-travelled' className='md:break-inside-avoid md:mb-4'>
					<DistanceTravelledSection
						distance={toNumber(validPlayerData.distance)}
						awayGames={toNumber(validPlayerData.awayGames)}
					/>
				</div>
			)}

			{/* Opposition Map */}
			{oppositionMapData.length > 0 && (
				<div id='opposition-locations' className='md:break-inside-avoid md:mb-4'>
					<LazyWhenVisible
						rootMargin="180px"
						className="min-h-[280px]"
						fallback={<div className="text-white/60 text-sm p-4">Scroll for map…</div>}
					>
						<OppositionMap oppositions={oppositionMapData} isLoading={isLoadingOppositionMap} />
					</LazyWhenVisible>
				</div>
			)}

			{/* Opposition Performance Section */}
			<div id='opposition-performance' className='md:break-inside-avoid md:mb-4'>
			{(() => {
				const hasGoalsOrAssists = toNumber(validPlayerData.goals) > 0 || toNumber(validPlayerData.assists) > 0;
				const isSingleOppositionSelected = (playerFilters.opposition?.mode ?? "all") !== "all" && playerFilters.opposition?.searchTerm !== "";
				
				if (!hasGoalsOrAssists || isSingleOppositionSelected) {
					return null;
				}

				return (
					<LazyWhenVisible rootMargin="160px" className="min-h-[240px]" fallback={<ChartSkeleton />}>
						<OppositionPerformanceScatter
							data={oppositionPerformanceData}
							isLoading={isLoadingOppositionPerformance}
						/>
					</LazyWhenVisible>
				);
			})()}
			</div>

			{/* Fantasy Points Section */}
			{toNumber(validPlayerData.fantasyPoints) > 0 && (
				<div id='fantasy-points' className='md:break-inside-avoid md:mb-4'>
				<FantasyPointsSection
					playerName={selectedPlayer || ""}
					fantasyBreakdown={fantasyBreakdown}
					isLoading={isLoadingFantasyBreakdown}
				/>
				</div>
			)}

			{/* Card Stats SVG Visualization */}
			{(toNumber(validPlayerData.yellowCards) > 0 || toNumber(validPlayerData.redCards) > 0) && (
				<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4'>
					<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Card Stats</h3>
					<div className='w-full' style={{ height: '108px' }}>
						<svg width='100%' height='100%' viewBox='0 0 400 108' preserveAspectRatio='xMidYMid meet' className='relative z-10'>
							{(() => {
								const yellowCount = toNumber(validPlayerData.yellowCards);
								const redCount = toNumber(validPlayerData.redCards);
								const maxValue = Math.max(yellowCount, redCount, 1);
								const maxHeight = 90;
								const minHeight = 10;
								const cardWidth = 80;
								const spacing = 40;
								const textOffset = 30;
								const centerX = 200;
								const yellowRectX = centerX - cardWidth - spacing / 2;
								const redRectX = centerX + spacing / 2;
								const containerCenterY = 54;
								const baseY = 98;
								
								const yellowHeight = yellowCount === 0 ? minHeight : Math.max(minHeight, (yellowCount / maxValue) * maxHeight);
								const redHeight = redCount === 0 ? 1 : Math.max(minHeight, (redCount / maxValue) * maxHeight);
								
								return (
									<>
										{/* Yellow Card Text - Left of rectangle, vertically centered */}
										<text
											x={yellowRectX - textOffset}
											y={containerCenterY - 6}
											textAnchor='end'
											dominantBaseline='middle'
											fill='#ffffff'
											fontSize='24'
											fontWeight='bold'
										>
											{yellowCount}
										</text>
										<text
											x={yellowRectX - textOffset}
											y={containerCenterY + 16}
											textAnchor='end'
											dominantBaseline='middle'
											fill='#ffffff'
											fontSize='14'
										>
											Yellows
										</text>
										
										{/* Yellow Card Rectangle */}
										<rect
											x={yellowRectX}
											y={baseY - yellowHeight}
											width={cardWidth}
											height={yellowHeight}
											fill='#f9ed32'
											rx='4'
											opacity={0.8}
										/>
										
										{/* Red Card Rectangle */}
										<rect
											x={redRectX}
											y={baseY - redHeight}
											width={cardWidth}
											height={redHeight}
											fill='#ef4444'
											rx='4'
											opacity={0.8}
										/>
										
										{/* Red Card Text - Right of rectangle, vertically centered */}
										<text
											x={redRectX + cardWidth + textOffset}
											y={containerCenterY - 6}
											textAnchor='start'
											dominantBaseline='middle'
											fill='#ffffff'
											fontSize='24'
											fontWeight='bold'
										>
											{redCount}
										</text>
										<text
											x={redRectX + cardWidth + textOffset}
											y={containerCenterY + 16}
											textAnchor='start'
											dominantBaseline='middle'
											fill='#ffffff'
											fontSize='14'
										>
											Reds
										</text>
									</>
								);
							})()}
						</svg>
					</div>
					<div className='text-white text-sm md:text-base mt-2 text-center'>
						Total Cards Cost: £
						{calculateCardFineTotal(
							toNumber(validPlayerData.yellowCards),
							toNumber(validPlayerData.redCards),
						).toLocaleString()}
					</div>
				</div>
			)}

			{/* Penalty Stats Custom Visualization */}
			{(toNumber(validPlayerData.penaltiesScored) > 0 || toNumber(validPlayerData.penaltiesMissed) > 0 || toNumber(validPlayerData.penaltiesSaved) > 0 || toNumber(validPlayerData.penaltiesConceded) > 0 || toNumber(validPlayerData.penaltyShootoutPenaltiesScored) > 0 || toNumber(validPlayerData.penaltyShootoutPenaltiesMissed) > 0 || toNumber(validPlayerData.penaltyShootoutPenaltiesSaved) > 0) && (
				<div id='penalty-stats' className='md:break-inside-avoid md:mb-4'>
				<PenaltyStatsVisualization
					scored={toNumber(validPlayerData.penaltiesScored)}
					missed={toNumber(validPlayerData.penaltiesMissed)}
					saved={toNumber(validPlayerData.penaltiesSaved)}
					conceded={toNumber(validPlayerData.penaltiesConceded)}
					penaltyShootoutScored={toNumber(validPlayerData.penaltyShootoutPenaltiesScored)}
					penaltyShootoutMissed={toNumber(validPlayerData.penaltyShootoutPenaltiesMissed)}
					penaltyShootoutSaved={toNumber(validPlayerData.penaltyShootoutPenaltiesSaved)}
				/>
				</div>
			)}

			{/* Minutes per Stats Section */}
			{toNumber(validPlayerData.minutes) > 0 && (
				<div id='minutes-per-stats' className='md:break-inside-avoid md:mb-4'>
				<MinutesPerStatsSection
					minutes={toNumber(validPlayerData.minutes)}
					allGoalsScored={toNumber(validPlayerData.allGoalsScored)}
					assists={toNumber(validPlayerData.assists)}
					mom={toNumber(validPlayerData.mom)}
					conceded={toNumber(validPlayerData.conceded)}
					cleanSheets={toNumber(validPlayerData.cleanSheets)}
					gk={toNumber(validPlayerData.gk || 0)}
					gkMinutes={toNumber(validPlayerData.gkMinutes || 0)}
					saves={toNumber(validPlayerData.saves || 0)}
				/>
				</div>
			)}

			{featureFlags.playerStatsPlayerRecordings && playerRecordings.length > 0 && (
				<RecordingsSection
					id='player-recordings'
					title='Player Recordings'
					subtitle='Matches you played in that have a recording link, for your current filters.'
					fixtures={playerRecordings}
					testIdPrefix='player-recording'
				/>
			)}

			{/* Captaincies, Awards and Achievements Section */}
			<div id='captaincies-awards-and-achievements' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
				<h3 className='text-white font-semibold text-sm md:text-base mb-4'>Captaincies, Awards and Achievements</h3>
				{isLoadingAwards || isLoadingCaptainHistory || isLoadingAwardHistory || isLoadingBadges ? (
					<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
						<AwardsListSkeleton />
					</SkeletonTheme>
				) : (
					<div className='space-y-4'>
						{/* Captains Section */}
						<div>
							<h4 className='text-white font-medium text-xs md:text-sm mb-2'>
								Captains - Total Captaincies: <span className='font-bold text-dorkinians-yellow'>{totalCaptaincies}</span>
							</h4>
							{totalCaptaincies > 0 && captainHistory.length > 0 && (
								<div className='overflow-x-auto mt-2'>
									<table className='w-full text-white'>
										<thead>
											<tr className='border-b-2 border-dorkinians-yellow'>
												<th className='text-left py-2 px-2 text-xs md:text-sm'>Season</th>
												<th className='text-left py-2 px-2 text-xs md:text-sm'>Team</th>
											</tr>
										</thead>
										<tbody>
											{captainHistory.map((item, index) => (
												<tr key={index} className='border-b border-green-500'>
													<td className='py-2 px-2 text-xs md:text-sm'>{item.season}</td>
													<td className='py-2 px-2 text-xs md:text-sm'>{item.team}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>

						{/* Awards Section */}
						<div className='pt-2 border-t border-white/10'>
							<h4 className='text-white font-medium text-xs md:text-sm mb-2'>
								Awards - Total Awards: <span className='font-bold text-dorkinians-yellow'>{totalAwards}</span>
							</h4>
							{totalAwards > 0 && awardHistory.length > 0 && (
								<div className='overflow-x-auto mt-2'>
									<table className='w-full text-white'>
										<thead>
											<tr className='border-b-2 border-dorkinians-yellow'>
												<th className='text-left py-2 px-2 text-xs md:text-sm'>Season</th>
												<th className='text-left py-2 px-2 text-xs md:text-sm'>Award</th>
											</tr>
										</thead>
										<tbody>
											{awardHistory.map((item, index) => (
												<tr key={index} className='border-b border-green-500'>
													<td className='py-2 px-2 text-xs md:text-sm'>{item.season}</td>
													<td className='py-2 px-2 text-xs md:text-sm'>{item.awardName}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>

						{/* Achievements Section */}
						<div className='pt-2 border-t border-white/10'>
							<h4 className='text-white font-medium text-xs md:text-sm mb-2'>Achievements</h4>
							
							{/* TOTW Count */}
							<div>
								<p className='text-white text-xs md:text-sm'>
									<span className='text-white/70'>Number of times in TOTW: </span>
									<span className='font-bold text-dorkinians-yellow'>{awardsData?.totwCount || 0}</span>
								</p>
							</div>

							{/* Star Man Count */}
							<div>
								<p className='text-white text-xs md:text-sm'>
									<span className='text-white/70'>Number of times as Star Man: </span>
									<span className='font-bold text-dorkinians-yellow'>{awardsData?.starManCount || 0}</span>
								</p>
							</div>

							{/* Player of the Month Count (Top 5) */}
							<div>
								<p className='text-white text-xs md:text-sm'>
									<span className='text-white/70'>Number of times in Top 5 Players of the Month: </span>
									<span className='font-bold text-dorkinians-yellow'>{awardsData?.playerOfMonthCount || 0}</span>
								</p>
							</div>

							{/* Player of the Month #1 Count */}
							<div>
								<p className='text-white text-xs md:text-sm'>
									<span className='text-white/70'>Number of times as Player of the Month: </span>
									<span className='font-bold text-dorkinians-yellow'>{awardsData?.playerOfMonthFirstCount || 0}</span>
								</p>
							</div>

							{/* TOTS Count */}
							<div>
								<p className='text-white text-xs md:text-sm'>
									<span className='text-white/70'>Number of time in TOTS: </span>
									<span className='font-bold text-dorkinians-yellow'>{awardsData?.totsCount || 0}</span>
								</p>
							</div>

							{badgePayload && featureFlags.achievementBadges && (
								<div className='pt-2 border-t border-white/10'>
									<p className='text-white text-xs md:text-sm mb-1'>
										{profileHref ? (
											<Link
												href={profileHref}
												className='text-white/70 underline underline-offset-2 hover:text-white'
												data-testid='milestone-badges-profile-link'>
												Achievement Badges earned:
											</Link>
										) : (
											<span className='text-white/70'>Achievement Badges earned: </span>
										)}
										{" "}
										<span className='font-bold text-dorkinians-yellow'>{badgePayload.totalBadges}</span>
										{badgePayload.highestBadgeTier ? (
											<span className='text-white/70'>
												{" "}
												(highest tier: <span className='capitalize text-dorkinians-yellow'>{badgePayload.highestBadgeTier}</span>)
											</span>
										) : null}
									</p>
								</div>
							)}
						</div>

						{totalCaptaincies === 0 && totalAwards === 0 && (awardsData?.playerOfMonthCount || 0) === 0 && (awardsData?.playerOfMonthFirstCount || 0) === 0 && (awardsData?.starManCount || 0) === 0 && (awardsData?.totwCount || 0) === 0 && (awardsData?.totsCount || 0) === 0 && (!featureFlags.achievementBadges || (badgePayload?.earned?.length ?? 0) === 0) && (
							<p className='text-white/70 text-xs md:text-sm'>No captaincies, awards or achievements recorded.</p>
						)}
					</div>
				)}
			</div>
		</div>
	);

	const tableModeTabOptions: Array<{ id: PlayerStatsTableMode; label: string }> = [
		{ id: "totals", label: "Totals" },
		{ id: "perApp", label: "Per App" },
		...(featureFlags.playerStatsDataTablePer90 ? ([{ id: "per90", label: "Per 90" }] as const) : []),
	];

	const dataTableContent = (
		<div className='mb-4'>
			{tableStatMode === "per90" && featureFlags.playerStatsDataTablePer90 && (
				<p className='text-xs md:text-sm text-white/80 mb-2'>
					Per-90 stats (Minutes: {Math.round(toNumber(validPlayerData.minutes)).toLocaleString()}) - min. 360 minutes required.
				</p>
			)}
			<div data-testid='player-stats-table-controls' className='mb-3 flex w-full justify-end'>
				<div
					className='inline-flex shrink-0 rounded-md overflow-hidden border border-white/20'
					data-testid='player-stats-table-mode-tabs'>
					{tableModeTabOptions.map((mode) => (
						<button
							key={mode.id}
							type='button'
							onClick={() => setTableStatMode(mode.id)}
							className={`px-3 py-1 text-xs md:text-sm border-r border-white/20 last:border-r-0 ${
								tableStatMode === mode.id ? "bg-dorkinians-yellow text-black font-semibold" : "bg-transparent text-white"
							}`}
						>
							{mode.label}
						</button>
					))}
				</div>
			</div>
			<div className='overflow-x-auto'>
				<table className='w-full bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden'>
				<thead className='sticky top-0 z-10'>
					<tr className='bg-white/20'>
						<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Icon</th>
						<th className='px-2 md:px-4 py-2 md:py-3 text-left text-white font-semibold text-xs md:text-sm'>Stat</th>
						<th className='px-2 md:px-4 py-2 md:py-3 text-right text-white font-semibold text-xs md:text-sm'>Value</th>
					</tr>
				</thead>
				<tbody>
					{displayedStatEntries.map(([key, stat]) => {
						const value = validPlayerData[stat.statName as keyof PlayerData];
						return <StatRow key={key} stat={stat} value={value} playerData={validPlayerData} tableMode={tableStatMode} />;
					})}
				</tbody>
			</table>
			</div>
		</div>
	);

	return (
		<div className='h-full flex flex-col'>
			<div className='flex-shrink-0 p-2 md:p-4'>
				<div className='flex flex-col items-center mb-2 md:mb-4 gap-2'>
					<div className='flex items-center justify-center space-x-2 md:space-x-3'>
						<h2
							className='text-xl md:text-2xl font-semibold text-dorkinians-yellow text-center'
							data-testid='stats-page-heading'>
							Stats - {selectedPlayer}
						</h2>
						<button
							type='button'
							data-testid='home-edit-player-button'
							onClick={handleEditClick}
							className='p-1.5 md:p-2 text-yellow-300 hover:text-yellow-200 hover:bg-yellow-400/10 rounded-full transition-colors shrink-0'
							title='Edit player selection'>
							<PenOnPaperIcon className='h-4 w-4 md:h-5 md:w-5' />
						</button>
					</div>
				</div>
				<div className='flex justify-center mb-2 md:mb-4'>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							const next = !isDataTableMode;
							trackEvent(UmamiEvents.DataTableToggled, { enabled: next, statsSubPage: "player-stats" });
							setIsDataTableMode(next);
						}}
						className='underline'>
						{isDataTableMode ? "Switch to data visualisation" : "Switch to data table"}
					</Button>
				</div>
				<FilterPills playerFilters={playerFilters} filterData={filterData} currentStatsSubPage={currentStatsSubPage} />
			</div>

			<div 
				className='flex-1 px-2 md:px-4 pb-4 min-h-0 overflow-y-auto'
				style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
				{!isDataTableMode && chartContent}
				{isDataTableMode && (
					isLoadingPlayerData ? (
						<div data-testid="loading-skeleton">
							<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
								<DataTableSkeleton />
							</SkeletonTheme>
						</div>
					) : (
						dataTableContent
					)
				)}
				
				{/* COMMENTED OUT: Share Stats functionality - will be re-added in the future */}
				{/* Share Button */}
				{/* {!isDataTableMode && (
					<div className='flex justify-center mt-1 mb-4'>
						<button
							onClick={handleShare}
							disabled={isGeneratingShare}
							className='flex items-center gap-2 px-6 py-3 bg-dorkinians-yellow hover:bg-yellow-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed'>
							{isGeneratingShare ? (
								<>
									<svg className='animate-spin h-5 w-5' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'>
										<circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
										<path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
									</svg>
									<span>Generating...</span>
								</>
							) : (
								<>
									<ArrowUpTrayIcon className='h-5 w-5' />
									<span>Share Stats</span>
								</>
							)}
						</button>
					</div>
				)} */}
			</div>

			{/* COMMENTED OUT: Share Stats functionality - will be re-added in the future */}
			{/* Blackout overlay - covers full screen during entire share process */}
			{/* {(isShareModalOpen || isGeneratingShare || isIOSPreviewOpen || isNonIOSPreviewOpen) && typeof window !== 'undefined' && createPortal(
				<div className="fixed inset-0 bg-black z-[30]" style={{ pointerEvents: 'none', opacity: 1 }} />,
				document.body
			)} */}

			{/* Share Visualization Modal */}
			{/* <ShareVisualizationModal
				isOpen={isShareModalOpen}
				onClose={() => setIsShareModalOpen(false)}
				onSelect={handleVisualizationSelect}
				options={availableVisualizations}
				backgroundColor={shareBackgroundColor}
				onBackgroundColorChange={setShareBackgroundColor}
			/> */}

			{/* iOS Share Preview Modal */}
			{/* <IOSSharePreviewModal
				isOpen={isIOSPreviewOpen}
				imageDataUrl={generatedImageDataUrl}
				onContinue={handleIOSShareContinue}
				onClose={handleIOSShareClose}
				backgroundColor={shareBackgroundColor}
				onBackgroundColorChange={setShareBackgroundColor}
				onRegenerateImage={handleRegenerateImage}
			/> */}

			{/* Non-iOS Share Preview Modal */}
			{/* <SharePreviewModal
				isOpen={isNonIOSPreviewOpen}
				imageDataUrl={generatedImageDataUrl}
				onContinue={handleNonIOSShareContinue}
				onClose={handleNonIOSShareClose}
				backgroundColor={shareBackgroundColor}
				onBackgroundColorChange={setShareBackgroundColor}
				onRegenerateImage={handleRegenerateImage}
			/> */}

			{/* Hidden share card for image generation */}
			{/* {selectedPlayer && validPlayerData && (
				<div 
					ref={shareCardRef}
					style={{ 
						position: 'fixed', 
						left: '-20000px', 
						top: '-20000px', 
						width: '1080px',
						height: '1080px',
						visibility: 'hidden',
						opacity: 0,
						pointerEvents: 'none',
						zIndex: -1,
						overflow: 'hidden',
					}}>
					<ShareableStatsCard
						playerName={selectedPlayer}
						playerData={validPlayerData}
						playerFilters={playerFilters}
						filterData={filterData}
						selectedVisualization={selectedShareVisualization || undefined}
						backgroundColor={shareBackgroundColor}
					/>
				</div>
			)} */}

			{/* All Games full-screen modal */}
			{selectedPlayer && (
				<AllGamesModal
					isOpen={isAllGamesModalOpen}
					onClose={closeAllGamesModal}
					playerName={selectedPlayer}
					playerDisplayName={playerData?.playerName ?? selectedPlayer}
				/>
			)}
		</div>
	);
}
