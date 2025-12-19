"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { RecentGamesSkeleton } from "@/components/skeletons";

interface Fixture {
	result: string;
	date: string;
	opposition: string;
	homeOrAway: string;
	goalsScored: number;
	goalsConceded: number;
	compType: string;
}

interface RecentGamesFormProps {
	teamName: string;
	filters: any;
}

export default function RecentGamesForm({ teamName, filters }: RecentGamesFormProps) {
	const [fixtures, setFixtures] = useState<Fixture[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showTooltip, setShowTooltip] = useState<number | null>(null);
	const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number; placement: 'above' | 'below'; arrowLeft: number } | null>(null);
	const [showDetailBoxes, setShowDetailBoxes] = useState(false);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);
	const boxRefs = useRef<(HTMLDivElement | null)[]>([]);
	const tooltipRef = useRef<HTMLDivElement | null>(null);

	// Find all scroll containers up the DOM tree
	const findScrollContainers = (element: HTMLElement | null): HTMLElement[] => {
		const containers: HTMLElement[] = [];
		let current: HTMLElement | null = element;
		
		try {
			while (current && typeof document !== 'undefined' && current !== document.body) {
				try {
					const style = window.getComputedStyle(current);
					const overflowY = style.overflowY;
					const overflowX = style.overflowX;
					
					if (overflowY === 'auto' || overflowY === 'scroll' || overflowX === 'auto' || overflowX === 'scroll') {
						containers.push(current);
					}
				} catch (e) {
					// Element may not be in DOM or computed style unavailable
					break;
				}
				
				current = current.parentElement;
			}
		} catch (e) {
			// Silently fail if DOM traversal fails
		}
		
		return containers;
	};

	useEffect(() => {
		if (!teamName) {
			setFixtures([]);
			return;
		}

		const fetchRecentFixtures = async () => {
			setIsLoading(true);
			setError(null);
			try {
				const response = await fetch("/api/team-recent-fixtures", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						teamName,
						filters: {
							...(filters || {}),
							teams: [], // Don't pass teams in filters, use teamName instead
						},
					}),
				});

				if (response.ok) {
					const data = await response.json();
					setFixtures(data.fixtures || []);
				} else {
					const errorData = await response.json();
					setError(errorData.error || "Failed to fetch recent fixtures");
					setFixtures([]);
				}
			} catch (err) {
				console.error("Error fetching recent fixtures:", err);
				setError("Error loading recent fixtures");
				setFixtures([]);
			} finally {
				setIsLoading(false);
			}
		};

		fetchRecentFixtures();
	}, [teamName, filters]);

	const updateTooltipPosition = (index: number) => {
		const boxRef = boxRefs.current[index];
		if (!boxRef || typeof window === 'undefined') {
			// Hide tooltip if box is not available
			setShowTooltip(null);
			setTooltipPosition(null);
			return;
		}

		try {
			const rect = boxRef.getBoundingClientRect();
			const viewportHeight = window.innerHeight || 0;
			const viewportWidth = window.innerWidth || 0;
			const scrollY = window.scrollY || 0;
			const scrollX = window.scrollX || 0;

			// Check if box is still visible in viewport
			// Hide tooltip if box has scrolled above the visible threshold
			if (rect.bottom < 0 || rect.top > viewportHeight || rect.right < 0 || rect.left > viewportWidth) {
				setShowTooltip(null);
				setTooltipPosition(null);
				return;
			}

			// Calculate tooltip dimensions
			let tooltipHeight = 100; // Default estimate
			const tooltipWidth = 200;

			if (tooltipRef.current) {
				try {
					const tooltipRect = tooltipRef.current.getBoundingClientRect();
					tooltipHeight = tooltipRect.height || 100;
				} catch (e) {
					// Tooltip not yet rendered
				}
			}

			// Calculate available space
			const spaceBelow = viewportHeight - rect.bottom;
			const spaceAbove = rect.top;
			const margin = 10;
			const arrowHeight = 8;
			const spacing = 8;

			let placement: 'above' | 'below' = 'below';
			let top: number;

			const neededSpaceBelow = tooltipHeight + arrowHeight + spacing + margin;
			const neededSpaceAbove = tooltipHeight + arrowHeight + spacing + margin;

			if (spaceBelow < neededSpaceBelow && spaceAbove > neededSpaceAbove) {
				placement = 'above';
				top = rect.top + scrollY - tooltipHeight - arrowHeight - spacing;
			} else if (spaceBelow >= neededSpaceBelow) {
				placement = 'below';
				top = rect.bottom + scrollY + spacing;
			} else {
				placement = 'above';
				top = Math.max(margin, rect.top + scrollY - tooltipHeight - arrowHeight - spacing);
			}

			// Center horizontally on box
			let left = rect.left + scrollX + (rect.width / 2) - (tooltipWidth / 2);
			const boxCenter = rect.left + scrollX + (rect.width / 2);

			// Keep within viewport
			if (left < scrollX + margin) {
				left = scrollX + margin;
			} else if (left + tooltipWidth > scrollX + window.innerWidth - margin) {
				left = scrollX + window.innerWidth - tooltipWidth - margin;
			}

			// Calculate arrow position relative to tooltip left edge
			// Arrow should point to box center, constrained to stay within tooltip bounds
			const arrowLeft = Math.max(12, Math.min(tooltipWidth - 12, boxCenter - left));

			setTooltipPosition({ top, left, placement, arrowLeft });
		} catch (e) {
			console.error('Error updating tooltip position:', e);
		}
	};

	useEffect(() => {
		if (showTooltip !== null) {
			const timeoutId = setTimeout(() => {
				updateTooltipPosition(showTooltip);
			}, 0);
			return () => clearTimeout(timeoutId);
		}
	}, [showTooltip]);

	// Add scroll listeners to update tooltip position on scroll
	useEffect(() => {
		if (showTooltip === null) return;
		
		const boxRef = boxRefs.current[showTooltip];
		if (!boxRef) return;
		
		const scrollContainers = findScrollContainers(boxRef);
		const handleScroll = () => {
			updateTooltipPosition(showTooltip);
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

	const handleMouseEnter = (index: number) => {
		updateTooltipPosition(index);
		timeoutRef.current = setTimeout(() => {
			setShowTooltip(index);
		}, 300);
	};

	const handleMouseLeave = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		setShowTooltip(null);
		setTooltipPosition(null);
	};

	const handleTouchStart = (index: number) => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		updateTooltipPosition(index);
		timeoutRef.current = setTimeout(() => {
			setShowTooltip(index);
		}, 200);
	};

	const handleTouchEnd = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		setShowTooltip(null);
		setTooltipPosition(null);
	};

	const getBoxColor = (result: string): string => {
		switch (result) {
			case "W":
				return "bg-green-500";
			case "D":
				return "bg-gray-500";
			case "L":
				return "bg-red-500";
			default:
				return "bg-gray-700";
		}
	};

	const getHomeAwayColor = (homeOrAway: string): string => {
		switch (homeOrAway) {
			case "Home":
				return "bg-dorkinians-yellow/20 text-dorkinians-yellow";
			case "Away":
				return "bg-gray-700 text-gray-300";
			default:
				return "bg-gray-700 text-gray-300";
		}
	};

	const getCompTypeColor = (compType: string): string => {
		switch (compType) {
			case "League":
				return "bg-blue-600/30 text-blue-300";
			case "Cup":
				return "bg-purple-600/30 text-purple-300";
			case "Friendly":
				return "bg-green-600/30 text-green-300";
			default:
				return "bg-gray-700 text-gray-300";
		}
	};

	const getCompTypeLetter = (compType: string): string => {
		switch (compType) {
			case "League":
				return "L";
			case "Cup":
				return "C";
			case "Friendly":
				return "F";
			default:
				return "";
		}
	};

	const formatDate = (dateString: string): string => {
		if (!dateString) return "";
		try {
			const date = new Date(dateString);
			return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
		} catch {
			return dateString;
		}
	};

	// Calculate totals for summary
	const totalGoalsScored = fixtures.reduce((sum, f) => sum + (f.goalsScored || 0), 0);
	const totalGoalsConceded = fixtures.reduce((sum, f) => sum + (f.goalsConceded || 0), 0);

	// Always show 10 boxes, filling with empty if fewer than 10 results
	const boxesToShow = Array.from({ length: 10 }, (_, index) => {
		return fixtures[index] || null;
	});

	if (isLoading) {
		return (
			<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
				<RecentGamesSkeleton />
			</SkeletonTheme>
		);
	}

	if (error) {
		return (
			<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 mb-4'>
				<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Recent Form</h3>
				<p className='text-white/70 text-xs md:text-sm'>{error}</p>
			</div>
		);
	}

	const activeFixture = showTooltip !== null ? boxesToShow[showTooltip] : null;

	return (
		<div className='bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 mb-4'>
			<h3 className='text-white font-semibold text-sm md:text-base mb-2'>Recent Form</h3>
			<button
				onClick={() => setShowDetailBoxes(!showDetailBoxes)}
				className='text-white/70 hover:text-white text-xs md:text-sm mb-2 underline cursor-pointer w-full text-center'
			>
				{showDetailBoxes ? 'Hide detail boxes' : 'Show detail boxes'}
			</button>
			<div className='flex gap-1 w-full'>
				{boxesToShow.map((fixture, index) => (
					<div
						key={index}
						ref={(el) => { boxRefs.current[index] = el; }}
						className={`flex-1 aspect-square ${getBoxColor(fixture?.result || "")} rounded flex items-center justify-center cursor-help relative`}
						onMouseEnter={() => fixture && handleMouseEnter(index)}
						onMouseLeave={handleMouseLeave}
						onTouchStart={() => fixture && handleTouchStart(index)}
						onTouchEnd={handleTouchEnd}
					>
						{fixture?.result && (
							<span className='text-white font-bold text-sm md:text-base'>
								{fixture.result}
							</span>
						)}
					</div>
				))}
			</div>
			{/* Home/Away row */}
			{showDetailBoxes && (
				<div className='flex gap-1 w-full mt-1'>
					{boxesToShow.map((fixture, index) => (
						<div
							key={index}
							className={`flex-1 aspect-square ${getHomeAwayColor(fixture?.homeOrAway || "")} rounded flex items-center justify-center`}
						>
							{fixture?.homeOrAway && (
								<span className='font-bold text-sm md:text-base'>
									{fixture.homeOrAway === "Home" ? "H" : "A"}
								</span>
							)}
						</div>
					))}
				</div>
			)}
			{/* Competition type row */}
			{showDetailBoxes && (
				<div className='flex gap-1 w-full mt-1'>
					{boxesToShow.map((fixture, index) => (
						<div
							key={index}
							className={`flex-1 aspect-square ${getCompTypeColor(fixture?.compType || "")} rounded flex items-center justify-center`}
						>
							{fixture?.compType && (
								<span className='font-bold text-sm md:text-base'>
									{getCompTypeLetter(fixture.compType)}
								</span>
							)}
						</div>
					))}
				</div>
			)}
			{/* Legend */}
			{showDetailBoxes && (
				<div className='flex flex-wrap gap-2 justify-center mt-3'>
					<div className={`px-2 py-1 rounded text-xs font-medium ${getHomeAwayColor("Away")}`}>
						Away
					</div>
					<div className={`px-2 py-1 rounded text-xs font-medium ${getHomeAwayColor("Home")}`}>
						Home
					</div>
					<div className={`px-2 py-1 rounded text-xs font-medium ${getCompTypeColor("League")}`}>
						League
					</div>
					<div className={`px-2 py-1 rounded text-xs font-medium ${getCompTypeColor("Cup")}`}>
						Cup
					</div>
					<div className={`px-2 py-1 rounded text-xs font-medium ${getCompTypeColor("Friendly")}`}>
						Friendly
					</div>
				</div>
			)}
			{/* Summary text */}
			{fixtures.length > 0 && (
				<div className='mt-2 text-center'>
					<p className='text-white/70 text-xs md:text-sm'>
						{totalGoalsScored} {totalGoalsScored === 1 ? 'goal' : 'goals'} scored, {totalGoalsConceded} {totalGoalsConceded === 1 ? 'goal' : 'goals'} conceded
					</p>
				</div>
			)}
			{/* Tooltip */}
			{showTooltip !== null && activeFixture && tooltipPosition && typeof document !== 'undefined' && document.body && createPortal(
				<div 
					ref={tooltipRef}
					className='fixed z-[9999] px-3 py-2 text-sm text-white rounded-lg shadow-lg w-48 text-center pointer-events-none' 
					style={{ 
						backgroundColor: '#0f0f0f',
						top: `${tooltipPosition.top}px`,
						left: `${tooltipPosition.left}px`
					}}>
					{tooltipPosition.placement === 'above' ? (
						<div className='absolute top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent mt-1' style={{ borderTopColor: '#0f0f0f', left: `${tooltipPosition.arrowLeft}px`, transform: 'translateX(-50%)' }}></div>
					) : (
						<div className='absolute bottom-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent mb-1' style={{ borderBottomColor: '#0f0f0f', left: `${tooltipPosition.arrowLeft}px`, transform: 'translateX(-50%)' }}></div>
					)}
					<div className='font-semibold mb-1'>{activeFixture.opposition || 'Unknown'}</div>
					<div className='text-xs mb-1'>{formatDate(activeFixture.date)}</div>
					<div className='text-xs mb-1 flex items-center justify-center gap-2 flex-wrap'>
						<span className={`px-2 py-1 rounded text-xs font-medium ${getHomeAwayColor(activeFixture.homeOrAway)}`}>
							{activeFixture.homeOrAway || 'Unknown'}
						</span>
						<span className={`px-2 py-1 rounded text-xs font-medium ${getCompTypeColor(activeFixture.compType)}`}>
							{activeFixture.compType || 'Unknown'}
						</span>
						<span>
							{activeFixture.goalsScored} - {activeFixture.goalsConceded}
						</span>
					</div>
				</div>,
				document.body
			)}
		</div>
	);
}
