"use client";

import { useNavigationStore, type PlayerData } from "@/lib/stores/navigation";
import { statObject, statsPageConfig, appConfig } from "@/config/config";
import Image from "next/image";
import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import PenOnPaperIcon from "@/components/icons/PenOnPaperIcon";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import FilterPills from "@/components/filters/FilterPills";
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, XAxis, YAxis, CartesianGrid, Line, ComposedChart } from "recharts";
import OppositionMap from "@/components/maps/OppositionMap";
import OppositionPerformanceScatter from "@/components/stats/OppositionPerformanceScatter";
import ShareableStatsCard from "@/components/stats/ShareableStatsCard";
import ShareVisualizationModal from "@/components/stats/ShareVisualizationModal";
import IOSSharePreviewModal from "@/components/stats/IOSSharePreviewModal";
import SharePreviewModal from "@/components/stats/SharePreviewModal";
import { generateShareImage, shareImage, performIOSShare, performNonIOSShare, getAvailableVisualizations } from "@/lib/utils/shareUtils";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/utils/pwaDebug";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { ChartSkeleton, TableSkeleton, StatCardSkeleton, AwardsListSkeleton, DataTableSkeleton } from "@/components/skeletons";

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

function StatRow({ stat, value, playerData }: { stat: any; value: any; playerData: PlayerData }) {
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
		timeoutRef.current = setTimeout(() => {
			setShowTooltip(true);
		}, 1000);
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

	return (
		<>
			<tr
				ref={rowRef}
				className='border-b border-white/10 hover:bg-white/5 transition-colors relative group cursor-help'
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}>
				<td className='px-2 md:px-4 py-2 md:py-3'>
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
				<td className='px-2 md:px-4 py-2 md:py-3'>
					<span className='text-white font-medium text-xs md:text-sm'>{stat.displayText}</span>
				</td>
				<td className='px-2 md:px-4 py-2 md:py-3 text-right whitespace-nowrap'>
					<span className='text-white font-mono text-xs md:text-sm'>
						{(() => {
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
					{stat.description}
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
						priority
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
									<span className='inline-block w-3 h-3 rounded-full bg-green-500 mr-2'></span>
									Penalties Scored
								</td>
								<td className='text-right py-1 px-2 font-mono'>{scored}</td>
							</tr>
						)}
						{missed > 0 && (
							<tr className='border-b border-white/10'>
								<td className='py-1 px-2'>
									<span className='inline-block w-3 h-3 rounded-full bg-red-500 mr-2'></span>
									Penalties Missed
								</td>
								<td className='text-right py-1 px-2 font-mono'>{missed}</td>
							</tr>
						)}
						{saved > 0 && (
							<tr className='border-b border-white/10'>
								<td className='py-1 px-2'>
									<span className='inline-block w-3 h-3 rounded-full bg-blue-500 mr-2'></span>
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

	// Get match stats summary
	const getMatchStatsSummary = (match: any): string => {
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
		
		return parts.join(", ");
	};

	// Convert breakdown object to sorted array with values
	const breakdownEntries = Object.entries(fantasyBreakdown.breakdown || {})
		.map(([stat, points]) => ({ 
			stat, 
			points: points as number,
			value: fantasyBreakdown.breakdownValues?.[stat] || 0
		}))
		.filter((entry) => entry.points !== 0)
		.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));

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
							{fantasyBreakdown.highestScoringMonth.matches.slice(0, 5).map((match: any, index: number) => {
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
							{fantasyBreakdown.highestScoringMonth.matches.length > 5 && (
								<p className='text-white/70 text-xs mt-2'>
									+ {fantasyBreakdown.highestScoringMonth.matches.length - 5} more match
									{fantasyBreakdown.highestScoringMonth.matches.length - 5 !== 1 ? "es" : ""}
								</p>
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
						priority
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
	const sectionHeight = gk > 0 ? '340px' : '260px';

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
						priority
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
									<td className='py-2 px-2 text-xs md:text-sm'>Goals Conceded</td>
									<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>{conceded}</td>
								</tr>
								<tr className='border-b border-white/10'>
									<td className='py-2 px-2 text-xs md:text-sm'>Clean Sheets</td>
									<td className='text-right py-2 px-2 font-mono text-xs md:text-sm'>{cleanSheets}</td>
								</tr>
								<tr className='border-b border-white/10'>
									<td className='py-2 px-2 text-xs md:text-sm'>Avg Goals Conceded/Game</td>
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
						priority
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
						priority
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
								<span className='inline-block w-3 h-3 rounded-full bg-purple-500 mr-2'></span>
								GK
							</td>
							<td className='text-right py-2 px-2 font-mono'>{gk}</td>
							<td className='text-right py-2 px-2 font-mono'>{gkPercentOfTotal.toFixed(1)}%</td>
							<td className='text-right py-2 px-2 font-mono'>{gkMinutes.toLocaleString()}</td>
						</tr>
						<tr className='border-b border-white/10'>
							<td className='py-2 px-2'>
								<span className='inline-block w-3 h-3 rounded-full bg-amber-700 mr-2'></span>
								DEF
							</td>
							<td className='text-right py-2 px-2 font-mono'>{def}</td>
							<td className='text-right py-2 px-2 font-mono'>{defPercentOfTotal.toFixed(1)}%</td>
							<td className='text-right py-2 px-2 font-mono'>{defMinutes.toLocaleString()}</td>
						</tr>
						<tr className='border-b border-white/10'>
							<td className='py-2 px-2'>
								<span className='inline-block w-3 h-3 rounded-full bg-green-400 mr-2'></span>
								MID
							</td>
							<td className='text-right py-2 px-2 font-mono'>{mid}</td>
							<td className='text-right py-2 px-2 font-mono'>{midPercentOfTotal.toFixed(1)}%</td>
							<td className='text-right py-2 px-2 font-mono'>{midMinutes.toLocaleString()}</td>
						</tr>
						<tr>
							<td className='py-2 px-2'>
								<span className='inline-block w-3 h-3 rounded-full bg-teal-400 mr-2'></span>
								FWD
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
	const { selectedPlayer, cachedPlayerData, isLoadingPlayerData, enterEditMode, setMainPage, currentStatsSubPage, playerFilters, filterData } = useNavigationStore();
	
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

	// State for view mode toggle - initialize from localStorage
	const [isDataTableMode, setIsDataTableMode] = useState<boolean>(() => {
		if (typeof window !== "undefined") {
			const saved = safeLocalStorageGet("player-stats-view-mode");
			if (saved === "true") return true;
			if (saved === "false") return false;
		}
		return false;
	});

	// Persist view mode to localStorage when it changes
	useEffect(() => {
		if (typeof window !== "undefined") {
			safeLocalStorageSet("player-stats-view-mode", isDataTableMode ? "true" : "false");
		}
	}, [isDataTableMode]);

	// State for share functionality
	const [isGeneratingShare, setIsGeneratingShare] = useState(false);
	const [isShareModalOpen, setIsShareModalOpen] = useState(false);
	const [selectedShareVisualization, setSelectedShareVisualization] = useState<{ type: string; data?: any } | null>(null);
	const [shareBackgroundColor, setShareBackgroundColor] = useState<"yellow" | "green">("yellow");
	const [isIOSPreviewOpen, setIsIOSPreviewOpen] = useState(false);
	const [isNonIOSPreviewOpen, setIsNonIOSPreviewOpen] = useState(false);
	const [generatedImageDataUrl, setGeneratedImageDataUrl] = useState<string>("");
	const shareCardRef = useRef<HTMLDivElement>(null);


	// Get stats to display for current page
	const statsToDisplay = useMemo(() => {
		return [...(statsPageConfig[currentStatsSubPage]?.statsToDisplay || [])];
	}, [currentStatsSubPage]);

	// Filter statObject entries to only include stats in statsToDisplay
	const filteredStatEntries = useMemo(() => {
		return Object.entries(statObject).filter(([key]) => statsToDisplay.includes(key as keyof typeof statObject));
	}, [statsToDisplay]);

	const playerData: PlayerData | null = cachedPlayerData?.playerData || null;

	// Debug log for position counts (must be before early returns)
	useEffect(() => {
		if (playerData && selectedPlayer) {
			const gk = toNumber(playerData.gk || 0);
			const def = toNumber(playerData.def || 0);
			const mid = toNumber(playerData.mid || 0);
			const fwd = toNumber(playerData.fwd || 0);
			console.log(`[Position Counts] ${selectedPlayer}:`, {
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
		return [
			{ name: "Apps", value: toNumber(playerData.appearances) },
			{ name: "Mins", value: toNumber(playerData.minutes) },
			{ name: "Seasons", value: seasonsDisplay, isString: true },
			{ name: "MoM", value: toNumber(playerData.mom) },
			{ name: "Goals", value: toNumber(playerData.allGoalsScored) },
			{ name: "Assists", value: toNumber(playerData.assists) },
		];
	}, [playerData, filterData]);

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
		return playerFilters.teams.length === 0;
	}, [playerFilters.teams]);

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

	// Fetch seasonal stats when all seasons are selected (must be before early returns)
	useEffect(() => {
		if (!selectedPlayer || !allSeasonsSelected) {
			setSeasonalStats([]);
			return;
		}
		if (appConfig.forceSkeletonView) {
			return;
		}

		const fetchSeasonalStats = async () => {
			setIsLoadingSeasonalStats(true);
			try {
				const response = await fetch("/api/player-seasonal-stats", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						playerName: selectedPlayer,
						filters: playerFilters,
					}),
				});
				if (response.ok) {
					const data = await response.json();
					setSeasonalStats(data.seasonalStats || []);
				}
			} catch (error) {
				console.error("Error fetching seasonal stats:", error);
			} finally {
				setIsLoadingSeasonalStats(false);
			}
		};

		fetchSeasonalStats();
	}, [selectedPlayer, allSeasonsSelected, playerFilters]);

	// Fetch team stats when all teams are selected (must be before early returns)
	useEffect(() => {
		if (!selectedPlayer || !allTeamsSelected) {
			setTeamStats([]);
			return;
		}
		if (appConfig.forceSkeletonView) {
			return;
		}

		const fetchTeamStats = async () => {
			setIsLoadingTeamStats(true);
			try {
				const response = await fetch("/api/player-team-stats", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						playerName: selectedPlayer,
						filters: playerFilters,
					}),
				});
				if (response.ok) {
					const data = await response.json();
					setTeamStats(data.teamStats || []);
				}
			} catch (error) {
				console.error("Error fetching team stats:", error);
			} finally {
				setIsLoadingTeamStats(false);
			}
		};

		fetchTeamStats();
	}, [selectedPlayer, allTeamsSelected, playerFilters]);

	// Fetch monthly stats when player is selected
	useEffect(() => {
		if (!selectedPlayer) {
			setMonthlyStats([]);
			return;
		}
		if (appConfig.forceSkeletonView) {
			return;
		}

		const fetchMonthlyStats = async () => {
			setIsLoadingMonthlyStats(true);
			try {
				const response = await fetch("/api/player-monthly-stats", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						playerName: selectedPlayer,
						filters: playerFilters,
					}),
				});
				if (response.ok) {
					const data = await response.json();
					setMonthlyStats(data.monthlyStats || []);
				}
			} catch (error) {
				console.error("Error fetching monthly stats:", error);
			} finally {
				setIsLoadingMonthlyStats(false);
			}
		};

		fetchMonthlyStats();
	}, [selectedPlayer, playerFilters]);

	// Fetch fantasy breakdown when player or filters change
	useEffect(() => {
		if (!selectedPlayer) {
			setFantasyBreakdown(null);
			return;
		}
		if (appConfig.forceSkeletonView) {
			return;
		}

		const fetchFantasyBreakdown = async () => {
			setIsLoadingFantasyBreakdown(true);
			try {
				const response = await fetch("/api/player-fantasy-breakdown", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						playerName: selectedPlayer,
						filters: playerFilters,
					}),
				});
				if (response.ok) {
					const data = await response.json();
					setFantasyBreakdown(data);
				}
			} catch (error) {
				console.error("Error fetching fantasy breakdown:", error);
			} finally {
				setIsLoadingFantasyBreakdown(false);
			}
		};

		fetchFantasyBreakdown();
	}, [selectedPlayer, playerFilters]);

	// Fetch opposition map data when player is selected
	useEffect(() => {
		if (!selectedPlayer) {
			setOppositionMapData([]);
			return;
		}
		if (appConfig.forceSkeletonView) {
			return;
		}

		const fetchOppositionMapData = async () => {
			setIsLoadingOppositionMap(true);
			try {
				const response = await fetch(`/api/player-oppositions-map?playerName=${encodeURIComponent(selectedPlayer)}`);
				if (response.ok) {
					const data = await response.json();
					setOppositionMapData(data.oppositions || []);
				}
			} catch (error) {
				console.error("Error fetching opposition map data:", error);
				setOppositionMapData([]);
			} finally {
				setIsLoadingOppositionMap(false);
			}
		};

		fetchOppositionMapData();
	}, [selectedPlayer]);

	// Fetch opposition performance data when player is selected
	useEffect(() => {
		if (!selectedPlayer) {
			setOppositionPerformanceData([]);
			return;
		}
		if (appConfig.forceSkeletonView) {
			return;
		}

		const fetchOppositionPerformanceData = async () => {
			setIsLoadingOppositionPerformance(true);
			try {
				const response = await fetch(`/api/player-opposition-performance?playerName=${encodeURIComponent(selectedPlayer)}`);
				if (response.ok) {
					const data = await response.json();
					setOppositionPerformanceData(data.performanceData || []);
				}
			} catch (error) {
				console.error("Error fetching opposition performance data:", error);
				setOppositionPerformanceData([]);
			} finally {
				setIsLoadingOppositionPerformance(false);
			}
		};

		fetchOppositionPerformanceData();
	}, [selectedPlayer]);

	// Fetch game details when player or filters change
	useEffect(() => {
		if (!selectedPlayer) {
			setGameDetails(null);
			return;
		}
		if (appConfig.forceSkeletonView) {
			return;
		}

		const fetchGameDetails = async () => {
			setIsLoadingGameDetails(true);
			try {
				const response = await fetch("/api/player-game-details", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						playerName: selectedPlayer,
						filters: playerFilters,
					}),
				});
				if (response.ok) {
					const data = await response.json();
					setGameDetails(data);
				}
			} catch (error) {
				console.error("Error fetching game details:", error);
				setGameDetails(null);
			} finally {
				setIsLoadingGameDetails(false);
			}
		};

		fetchGameDetails();
	}, [selectedPlayer, playerFilters]);

	// Fetch awards data when player is selected
	useEffect(() => {
		if (!selectedPlayer) {
			setAwardsData(null);
			return;
		}
		if (appConfig.forceSkeletonView) {
			return;
		}

		const fetchAwards = async () => {
			setIsLoadingAwards(true);
			try {
				const response = await fetch(`/api/player-awards?playerName=${encodeURIComponent(selectedPlayer)}`);
				if (response.ok) {
					const data = await response.json();
					setAwardsData(data);
				}
			} catch (error) {
				console.error("Error fetching awards:", error);
			} finally {
				setIsLoadingAwards(false);
			}
		};

		fetchAwards();
	}, [selectedPlayer]);

	// Fetch captain history when player is selected
	useEffect(() => {
		if (!selectedPlayer) {
			setCaptainHistory([]);
			setTotalCaptaincies(0);
			return;
		}
		if (appConfig.forceSkeletonView) {
			return;
		}

		const fetchCaptainHistory = async () => {
			setIsLoadingCaptainHistory(true);
			try {
				const response = await fetch(`/api/captains/player-history?playerName=${encodeURIComponent(selectedPlayer)}`);
				if (response.ok) {
					const data = await response.json();
					setCaptainHistory(data.captaincies || []);
					setTotalCaptaincies(data.totalCaptaincies || 0);
				}
			} catch (error) {
				console.error("Error fetching captain history:", error);
				setCaptainHistory([]);
				setTotalCaptaincies(0);
			} finally {
				setIsLoadingCaptainHistory(false);
			}
		};

		fetchCaptainHistory();
	}, [selectedPlayer]);

	// Fetch award history when player is selected
	useEffect(() => {
		if (!selectedPlayer) {
			setAwardHistory([]);
			setTotalAwards(0);
			return;
		}
		if (appConfig.forceSkeletonView) {
			return;
		}

		const fetchAwardHistory = async () => {
			setIsLoadingAwardHistory(true);
			try {
				const response = await fetch(`/api/awards/player-history?playerName=${encodeURIComponent(selectedPlayer)}`);
				if (response.ok) {
					const data = await response.json();
					setAwardHistory(data.awards || []);
					setTotalAwards(data.totalAwards || 0);
				}
			} catch (error) {
				console.error("Error fetching award history:", error);
				setAwardHistory([]);
				setTotalAwards(0);
			} finally {
				setIsLoadingAwardHistory(false);
			}
		};

		fetchAwardHistory();
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
				trendline: trendlinePoints[index]?.value || 0,
			}));
		}

		return baseData;
	}, [seasonalStats, seasonalSelectedStat, statOptions, showTrend]);

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

	// Get available visualizations (must be before early returns)
	const availableVisualizations = useMemo(() => {
		if (!playerData) return [];
		return getAvailableVisualizations(
			playerData,
			playerFilters,
			allSeasonsSelected,
			allTeamsSelected,
			seasonalChartData,
			teamChartData,
			isLoadingSeasonalStats,
			isLoadingTeamStats,
			oppositionMapData,
			fantasyBreakdown,
			isLoadingFantasyBreakdown,
			gameDetails,
			isLoadingGameDetails,
			monthlyChartData,
			isLoadingMonthlyStats,
			awardsData,
			isLoadingAwards
		);
	}, [
		playerData,
		playerFilters,
		allSeasonsSelected,
		allTeamsSelected,
		seasonalChartData,
		teamChartData,
		isLoadingSeasonalStats,
		isLoadingTeamStats,
		oppositionMapData,
		fantasyBreakdown,
		isLoadingFantasyBreakdown,
		gameDetails,
		isLoadingGameDetails,
	]);

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
						<div className='flex items-center justify-center mb-2 md:mb-4 relative'>
							<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow text-center' data-testid="stats-page-heading">Stats - {selectedPlayer}</h2>
							<button
								onClick={handleEditClick}
								className='absolute right-0 flex items-center justify-center w-8 h-8 text-yellow-300 hover:text-yellow-200 hover:bg-yellow-400/10 rounded-full transition-colors'
								title='Edit player selection'>
								<PenOnPaperIcon className='h-4 w-4 md:h-5 md:w-5' />
							</button>
						</div>
						<div className='flex justify-center mb-2 md:mb-4'>
							<button
								onClick={() => setIsDataTableMode(!isDataTableMode)}
								className='text-white underline hover:text-white/80 text-sm md:text-base cursor-pointer'>
								{isDataTableMode ? "Switch to data visualisation" : "Switch to data table"}
							</button>
						</div>
						<FilterPills playerFilters={playerFilters} filterData={filterData} currentStatsSubPage={currentStatsSubPage} />
					</div>
					<div className='flex-1 px-2 md:px-4 pb-4 min-h-0 overflow-y-auto space-y-4'>
						<StatCardSkeleton />
						<ChartSkeleton />
						<ChartSkeleton />
						<ChartSkeleton />
					</div>
				</div>
				</SkeletonTheme>
			</div>
		);
	}

	if (!cachedPlayerData || !playerData) {
		return (
			<div className='h-full flex items-center justify-center p-4'>
				<div className='text-center'>
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-2 md:mb-4'>Stats</h2>
					<p className='text-white text-sm md:text-base'>No player data available. Please try selecting the player again.</p>
				</div>
			</div>
		);
	}

	// At this point, playerData is guaranteed to be non-null
	const validPlayerData: PlayerData = playerData;

	// Extract visualization data based on selection
	const getVisualizationData = (vizType: string): { type: string; data?: any } => {
		switch (vizType) {
			case "seasonal-performance":
				const selectedSeasonalOption = statOptions.find(opt => opt.value === seasonalSelectedStat);
				return {
					type: vizType,
					data: { 
						chartData: seasonalChartData,
						selectedStat: selectedSeasonalOption?.label || seasonalSelectedStat,
					},
				};
			case "team-performance":
				const selectedTeamOption = statOptions.find(opt => opt.value === teamSelectedStat);
				return {
					type: vizType,
					data: { 
						chartData: teamChartData,
						selectedStat: selectedTeamOption?.label || teamSelectedStat,
					},
				};
			case "match-results":
				const wins = toNumber(validPlayerData.wins || 0);
				const draws = toNumber(validPlayerData.draws || 0);
				const losses = toNumber(validPlayerData.losses || 0);
				const pieData = [
					{ name: "Wins", value: wins, color: "#22c55e" },
					{ name: "Draws", value: draws, color: "#60a5fa" },
					{ name: "Losses", value: losses, color: "#ef4444" },
				].filter(item => item.value > 0);
				return {
					type: vizType,
					data: { pieData },
				};
			case "positional-stats":
				return {
					type: vizType,
					data: {
						gk: toNumber(validPlayerData.gk),
						def: toNumber(validPlayerData.def),
						mid: toNumber(validPlayerData.mid),
						fwd: toNumber(validPlayerData.fwd),
						appearances: toNumber(validPlayerData.appearances),
						gkMinutes: toNumber(validPlayerData.gkMinutes || 0),
						defMinutes: toNumber(validPlayerData.defMinutes || 0),
						midMinutes: toNumber(validPlayerData.midMinutes || 0),
						fwdMinutes: toNumber(validPlayerData.fwdMinutes || 0),
					},
				};
			case "defensive-record":
				return {
					type: vizType,
					data: {
						conceded: toNumber(validPlayerData.conceded),
						cleanSheets: toNumber(validPlayerData.cleanSheets),
						ownGoals: toNumber(validPlayerData.ownGoals),
						appearances: toNumber(validPlayerData.appearances),
						gk: toNumber(validPlayerData.gk),
						saves: toNumber(validPlayerData.saves),
						concededPerApp: toNumber(validPlayerData.concededPerApp || 0),
					},
				};
			case "card-stats":
				return {
					type: vizType,
					data: {
						yellowCards: toNumber(validPlayerData.yellowCards),
						redCards: toNumber(validPlayerData.redCards),
					},
				};
			case "penalty-stats":
				return {
					type: vizType,
					data: {
						scored: toNumber(validPlayerData.penaltiesScored),
						missed: toNumber(validPlayerData.penaltiesMissed),
						saved: toNumber(validPlayerData.penaltiesSaved),
						conceded: toNumber(validPlayerData.penaltiesConceded),
						penaltyShootoutScored: toNumber(validPlayerData.penaltyShootoutPenaltiesScored || 0),
						penaltyShootoutMissed: toNumber(validPlayerData.penaltyShootoutPenaltiesMissed || 0),
						penaltyShootoutSaved: toNumber(validPlayerData.penaltyShootoutPenaltiesSaved || 0),
					},
				};
			case "fantasy-points":
				return {
					type: vizType,
					data: {
						totalPoints: toNumber(validPlayerData.fantasyPoints),
						breakdown: fantasyBreakdown?.breakdown || {},
						breakdownValues: fantasyBreakdown?.breakdownValues || {},
						playerName: selectedPlayer || "",
					},
				};
			case "distance-travelled":
				return {
					type: vizType,
					data: {
						distance: toNumber(validPlayerData.distance),
						awayGames: toNumber(validPlayerData.awayGames || 0),
					},
				};
			case "minutes-per-stats":
				const minutes = toNumber(validPlayerData.minutes);
				const allGoalsScored = toNumber(validPlayerData.allGoalsScored);
				const assists = toNumber(validPlayerData.assists);
				const mom = toNumber(validPlayerData.mom);
				const cleanSheets = toNumber(validPlayerData.cleanSheets);
				return {
					type: vizType,
					data: {
						minutesPerGoal: allGoalsScored > 0 ? minutes / allGoalsScored : 0,
						minutesPerAssist: assists > 0 ? minutes / assists : 0,
						minutesPerMoM: mom > 0 ? minutes / mom : 0,
						minutesPerCleanSheet: cleanSheets > 0 ? minutes / cleanSheets : 0,
					},
				};
			case "game-details":
				return {
					type: vizType,
					data: {
						leagueGames: gameDetails?.leagueGames || 0,
						cupGames: gameDetails?.cupGames || 0,
						friendlyGames: gameDetails?.friendlyGames || 0,
						leagueWins: gameDetails?.leagueWins || 0,
						cupWins: gameDetails?.cupWins || 0,
						friendlyWins: gameDetails?.friendlyWins || 0,
						homeGames: gameDetails?.homeGames || 0,
						awayGames: gameDetails?.awayGames || 0,
						homeWins: gameDetails?.homeWins || 0,
						awayWins: gameDetails?.awayWins || 0,
						uniqueOpponents: gameDetails?.uniqueOpponents || 0,
						uniqueCompetitions: gameDetails?.uniqueCompetitions || 0,
						uniqueTeammates: gameDetails?.uniqueTeammates || 0,
					},
				};
			case "monthly-performance":
				const selectedMonthlyOption = statOptions.find(opt => opt.value === monthlySelectedStat);
				return {
					type: vizType,
					data: {
						chartData: monthlyChartData,
						selectedStat: selectedMonthlyOption?.label || monthlySelectedStat,
					},
				};
			case "awards-and-achievements":
				return {
					type: vizType,
					data: awardsData,
				};
			default:
				return { type: vizType };
		}
	};

	// Handle visualization selection
	const handleVisualizationSelect = async (vizId: string, backgroundColor: "yellow" | "green") => {
		// Set generating state immediately to show blackout overlay
		setIsGeneratingShare(true);
		
		const vizData = getVisualizationData(vizId);
		setSelectedShareVisualization(vizData);
		setShareBackgroundColor(backgroundColor);
		
		// Close modal immediately - blackout overlay is already in place
		setIsShareModalOpen(false);
		
		// Wait for state update, then generate image
		setTimeout(async () => {
			if (!shareCardRef.current) {
				setIsGeneratingShare(false);
				return;
			}
			
			try {
				const imageDataUrl = await generateShareImage(shareCardRef.current, 2);
				const shareResult = await shareImage(imageDataUrl, selectedPlayer || "");
				
				if (shareResult.needsIOSPreview) {
					// Show iOS preview modal - keep blackout visible
					setGeneratedImageDataUrl(imageDataUrl);
					setIsIOSPreviewOpen(true);
					// Don't clear selectedShareVisualization yet - wait for user action
					// Keep isGeneratingShare true to maintain blackout
				} else if (shareResult.needsPreview) {
					// Show non-iOS preview modal - keep blackout visible
					setGeneratedImageDataUrl(imageDataUrl);
					setIsNonIOSPreviewOpen(true);
					// Don't clear selectedShareVisualization yet - wait for user action
					// Keep isGeneratingShare true to maintain blackout
				} else {
					// Download fallback (no Web Share API) - clear immediately and remove blackout
					setIsGeneratingShare(false);
					setSelectedShareVisualization(null);
				}
			} catch (error) {
				console.error("[Share] Error generating share image:", error);
				alert("Failed to generate share image. Please try again.");
				setIsGeneratingShare(false);
				setSelectedShareVisualization(null);
			}
		}, 100);
	};

	// Regenerate image when background color changes in preview
	const handleRegenerateImage = async (color: "yellow" | "green") => {
		setShareBackgroundColor(color);
		
		if (!shareCardRef.current) {
			return;
		}
		
		try {
			const imageDataUrl = await generateShareImage(shareCardRef.current, 2);
			setGeneratedImageDataUrl(imageDataUrl);
		} catch (error) {
			console.error("[Share] Error regenerating image:", error);
		}
	};

	// Handle iOS share continuation
	const handleIOSShareContinue = async () => {
		setIsIOSPreviewOpen(false);
		
		try {
			await performIOSShare(generatedImageDataUrl, selectedPlayer || "");
		} catch (error) {
			console.error("[Share] Error sharing image:", error);
			alert("Failed to share image. Please try again.");
		} finally {
			setIsGeneratingShare(false);
			setSelectedShareVisualization(null);
			setGeneratedImageDataUrl("");
		}
	};

	// Handle iOS share close
	const handleIOSShareClose = () => {
		setIsIOSPreviewOpen(false);
		setIsGeneratingShare(false);
		setSelectedShareVisualization(null);
		setGeneratedImageDataUrl("");
	};

	// Handle non-iOS share continuation
	const handleNonIOSShareContinue = async () => {
		setIsNonIOSPreviewOpen(false);
		
		try {
			await performNonIOSShare(generatedImageDataUrl, selectedPlayer || "");
		} catch (error) {
			console.error("[Share] Error sharing image:", error);
			alert("Failed to share image. Please try again.");
		} finally {
			setIsGeneratingShare(false);
			setSelectedShareVisualization(null);
			setGeneratedImageDataUrl("");
		}
	};

	// Handle non-iOS share close
	const handleNonIOSShareClose = () => {
		setIsNonIOSPreviewOpen(false);
		setIsGeneratingShare(false);
		setSelectedShareVisualization(null);
		setGeneratedImageDataUrl("");
	};

	// Share handler - opens modal
	const handleShare = () => {
		if (!selectedPlayer || !validPlayerData) {
			return;
		}
		setIsShareModalOpen(true);
	};

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

	const chartContent = (
		<div className='space-y-4 pb-4 md:space-y-0 player-stats-masonry'>
			{/* Key Performance Stats Grid */}
			{keyPerformanceData.some(item => typeof item.value === 'number' && item.value > 0) ? (
				<div id='key-performance-stats' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
					<h3 className='text-white font-semibold text-sm md:text-base mb-3'>Key Performance Stats</h3>
					<div className='grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4'>
						{keyPerformanceData.map((item) => {
							let statKey = "APP";
							if (item.name === "Apps") statKey = "APP";
							else if (item.name === "Mins") statKey = "MIN";
							else if (item.name === "Seasons") statKey = "NumberSeasonsPlayedFor";
							else if (item.name === "MoM") statKey = "MOM";
							else if (item.name === "Goals") statKey = "AllGSC";
							else if (item.name === "Assists") statKey = "A";
							const stat = statObject[statKey as keyof typeof statObject];
							// Use Goals-Icon specifically for Goals stat
							const iconName = item.name === "Goals" ? "Goals-Icon" : (stat?.iconName || "Appearance-Icon");
							return (
								<div key={item.name} className='bg-white/5 rounded-lg p-2 md:p-3 flex items-center gap-3 md:gap-4'>
									<div className='flex-shrink-0'>
										<Image
											src={`/stat-icons/${iconName}.svg`}
											alt={stat?.displayText || item.name}
											width={40}
											height={40}
											className='w-8 h-8 md:w-10 md:h-10 object-contain'
										/>
									</div>
									<div className='flex-1 min-w-0'>
										<div className='text-white/70 text-sm md:text-base mb-1'>
											{item.name}
										</div>
										<div className='text-white font-bold text-xl md:text-2xl'>
											{(item as any).isString ? item.value : (() => {
												if (item.name === "Mins") {
													// Format minutes with commas and without " mins" suffix
													return Math.round(toNumber(item.value)).toLocaleString();
												}
												return formatStatValue(item.value, stat?.statFormat || "Integer", stat?.numberDecimalPlaces || 0, (stat as any)?.statUnit);
											})()}
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			) : null}

			{/* Seasonal Performance Section */}
			<div id='seasonal-performance' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
				{allSeasonsSelected && (
					<div className='flex items-center justify-between mb-2 gap-2'>
						<h3 className='text-white font-semibold text-sm md:text-base flex-shrink-0'>Seasonal Performance</h3>
						<div className='flex-1 max-w-[45%]'>
							<Listbox value={seasonalSelectedStat} onChange={setSeasonalSelectedStat}>
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
							<div className='chart-container' style={{ touchAction: 'pan-y' }}>
								<ResponsiveContainer width='100%' height={240}>
									<ComposedChart 
										data={seasonalChartData} 
										margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
									>
										<CartesianGrid strokeDasharray='3 3' stroke='rgba(255, 255, 255, 0.1)' />
										<XAxis dataKey='name' stroke='#fff' fontSize={12} />
										<YAxis stroke='#fff' fontSize={12} />
										<Tooltip content={seasonalTooltip} />
										<Bar 
											dataKey='value' 
											fill='#f9ed32' 
											radius={[4, 4, 0, 0]} 
											opacity={0.9} 
											activeBar={{ fill: '#f9ed32', opacity: 1, stroke: 'none' }}
										/>
										{showTrend && (
											<Line 
												type='linear' 
												dataKey='trendline' 
												stroke='#ffffff' 
												strokeWidth={2}
												strokeDasharray='5 5'
												dot={false}
												activeDot={false}
												isAnimationActive={false}
												connectNulls={false}
											/>
										)}
									</ComposedChart>
								</ResponsiveContainer>
							</div>
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
							<Listbox value={teamSelectedStat} onChange={setTeamSelectedStat}>
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
							<div className='chart-container' style={{ touchAction: 'pan-y' }}>
								<ResponsiveContainer width='100%' height={240}>
									<BarChart 
										data={teamChartData} 
										margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
									>
										<CartesianGrid strokeDasharray='3 3' stroke='rgba(255, 255, 255, 0.1)' />
										<XAxis dataKey='name' stroke='#fff' fontSize={12} />
										<YAxis stroke='#fff' fontSize={12} />
										<Tooltip content={teamTooltip} />
										<Bar
											dataKey='value' 
											fill='#22c55e' 
											radius={[4, 4, 0, 0]} 
											opacity={0.9} 
											activeBar={{ fill: '#22c55e', opacity: 1, stroke: 'none' }}
										/>
									</BarChart>
								</ResponsiveContainer>
							</div>
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
						<div className='chart-container -my-2' style={{ touchAction: 'pan-y' }}>
							<ResponsiveContainer width='100%' height={220}>
								<PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
									<Pie
										data={pieChartData}
										cx='50%'
										cy='50%'
										labelLine={false}
										label={({ cx, cy, midAngle, innerRadius, outerRadius, name, value }) => {
											const RADIAN = Math.PI / 180;
											const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
											const x = cx + radius * Math.cos(-midAngle * RADIAN);
											const y = cy + radius * Math.sin(-midAngle * RADIAN);
											
											return (
												<text
													x={x}
													y={y}
													fill="#ffffff"
													textAnchor={x > cx ? 'start' : 'end'}
													dominantBaseline="central"
													fontSize={14}
													fontWeight='bold'
												>
													{`${name}: ${value}`}
												</text>
											);
										}}
										outerRadius={90}
										fill='#8884d8'
										dataKey='value'
									>
										{pieChartData.map((entry, index) => (
											<Cell key={`cell-${index}`} fill={entry.color} />
										))}
									</Pie>
									<Tooltip content={customTooltip} />
								</PieChart>
							</ResponsiveContainer>
						</div>
					</div>
				);
			})()}

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
						<Listbox value={monthlySelectedStat} onChange={setMonthlySelectedStat}>
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
					<div className='chart-container' style={{ touchAction: 'pan-y' }}>
						<ResponsiveContainer width='100%' height={240}>
							<BarChart 
								data={monthlyChartData} 
								margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
							>
								<CartesianGrid strokeDasharray='3 3' stroke='rgba(255, 255, 255, 0.1)' />
								<XAxis dataKey='name' stroke='#fff' fontSize={12} />
								<YAxis stroke='#fff' fontSize={12} />
								<Tooltip content={seasonalTooltip} />
								<Bar 
									dataKey='value' 
									fill='#f9ed32' 
									radius={[4, 4, 0, 0]} 
									opacity={0.9} 
									activeBar={{ fill: '#f9ed32', opacity: 1, stroke: 'none' }}
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>
				) : (
					<div className='flex items-center justify-center h-64'>
						<p className='text-white text-sm'>No monthly data available</p>
					</div>
				)}
			</div>

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
					<OppositionMap oppositions={oppositionMapData} isLoading={isLoadingOppositionMap} />
				</div>
			)}

			{/* Opposition Performance Section */}
			<div id='opposition-performance' className='md:break-inside-avoid md:mb-4'>
			{(() => {
				const hasGoalsOrAssists = toNumber(validPlayerData.goals) > 0 || toNumber(validPlayerData.assists) > 0;
				const isSingleOppositionSelected = !playerFilters.opposition.allOpposition && playerFilters.opposition.searchTerm !== "";
				
				if (!hasGoalsOrAssists || isSingleOppositionSelected) {
					return null;
				}

				return (
					<OppositionPerformanceScatter
						data={oppositionPerformanceData}
						isLoading={isLoadingOppositionPerformance}
					/>
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

			{/* Captaincies, Awards and Achievements Section */}
			<div id='awards-and-achievements' className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 md:break-inside-avoid md:mb-4'>
				<h3 className='text-white font-semibold text-sm md:text-base mb-4'>Captaincies, Awards and Achievements</h3>
				{isLoadingAwards || isLoadingCaptainHistory || isLoadingAwardHistory ? (
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
						</div>

						{totalCaptaincies === 0 && totalAwards === 0 && (awardsData?.playerOfMonthCount || 0) === 0 && (awardsData?.playerOfMonthFirstCount || 0) === 0 && (awardsData?.starManCount || 0) === 0 && (awardsData?.totwCount || 0) === 0 && (awardsData?.totsCount || 0) === 0 && (
							<p className='text-white/70 text-xs md:text-sm'>No captaincies, awards or achievements recorded.</p>
						)}
					</div>
				)}
			</div>
		</div>
	);

	const dataTableContent = (
		<div className='mb-4'>
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
					{filteredStatEntries.map(([key, stat]) => {
						const value = validPlayerData[stat.statName as keyof PlayerData];
						return <StatRow key={key} stat={stat} value={value} playerData={validPlayerData} />;
					})}
				</tbody>
			</table>
			</div>
		</div>
	);

	return (
		<div className='h-full flex flex-col'>
			<div className='flex-shrink-0 p-2 md:p-4'>
				<div className='flex items-center justify-center mb-2 md:mb-4 relative'>
					<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow text-center' data-testid="stats-page-heading">Stats - {selectedPlayer}</h2>
					<button
						onClick={handleEditClick}
						className='absolute right-0 flex items-center justify-center w-8 h-8 text-yellow-300 hover:text-yellow-200 hover:bg-yellow-400/10 rounded-full transition-colors'
						title='Edit player selection'>
						<PenOnPaperIcon className='h-4 w-4 md:h-5 md:w-5' />
					</button>
				</div>
				<div className='flex justify-center mb-2 md:mb-4'>
					<button
						onClick={() => setIsDataTableMode(!isDataTableMode)}
						className='text-white underline hover:text-white/80 text-sm md:text-base cursor-pointer'>
						{isDataTableMode ? "Switch to data visualisation" : "Switch to data table"}
					</button>
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
				
				{/* Share Button */}
				{!isDataTableMode && (
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
				)}
			</div>

			{/* Blackout overlay - covers full screen during entire share process */}
			{(isShareModalOpen || isGeneratingShare || isIOSPreviewOpen || isNonIOSPreviewOpen) && typeof window !== 'undefined' && createPortal(
				<div className="fixed inset-0 bg-black z-[30]" style={{ pointerEvents: 'none', opacity: 1 }} />,
				document.body
			)}

			{/* Share Visualization Modal */}
			<ShareVisualizationModal
				isOpen={isShareModalOpen}
				onClose={() => setIsShareModalOpen(false)}
				onSelect={handleVisualizationSelect}
				options={availableVisualizations}
				backgroundColor={shareBackgroundColor}
				onBackgroundColorChange={setShareBackgroundColor}
			/>

			{/* iOS Share Preview Modal */}
			<IOSSharePreviewModal
				isOpen={isIOSPreviewOpen}
				imageDataUrl={generatedImageDataUrl}
				onContinue={handleIOSShareContinue}
				onClose={handleIOSShareClose}
				backgroundColor={shareBackgroundColor}
				onBackgroundColorChange={setShareBackgroundColor}
				onRegenerateImage={handleRegenerateImage}
			/>

			{/* Non-iOS Share Preview Modal */}
			<SharePreviewModal
				isOpen={isNonIOSPreviewOpen}
				imageDataUrl={generatedImageDataUrl}
				onContinue={handleNonIOSShareContinue}
				onClose={handleNonIOSShareClose}
				backgroundColor={shareBackgroundColor}
				onBackgroundColorChange={setShareBackgroundColor}
				onRegenerateImage={handleRegenerateImage}
			/>

			{/* Hidden share card for image generation */}
			{selectedPlayer && validPlayerData && (
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
			)}
		</div>
	);
}
