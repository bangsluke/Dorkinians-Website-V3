"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChatbotResponse } from "@/lib/services/chatbotService";

interface CalendarProps {
	visualization: ChatbotResponse["visualization"];
}

interface DateRange {
	startDate: string;
	endDate: string;
}

interface GameDate {
	date: string;
	goals?: number;
	assists?: number;
	[key: string]: unknown;
}

interface WeekValue {
	weekNumber: number;
	year: number;
	value: number;
}

interface WeekBasedData {
	weeks: WeekValue[];
	highlightRange?: {
		startWeek: number;
		startYear: number;
		endWeek: number;
		endYear: number;
	};
}

interface WeekData {
	weekNumber: number;
	year: number;
	startDate: Date;
	endDate: Date;
	gameCount: number;
	value: number;
	isHighlighted: boolean;
}

interface MonthLabel {
	month: string;
	startWeekIndex: number;
	endWeekIndex: number;
}

// Google Sheets WEEKNUM(date, 2) equivalent
// Mode 2: Week starts Monday, Week 1 = week containing January 1st
function weekNum(date: Date): number {
	const year = date.getFullYear();
	const jan1 = new Date(year, 0, 1);
	
	// Get day of week for Jan 1 (0=Sunday, 1=Monday, ..., 6=Saturday)
	const jan1Day = jan1.getDay();
	
	// Convert to Monday-based (0=Monday, 1=Tuesday, ..., 6=Sunday)
	const jan1MondayBased = jan1Day === 0 ? 6 : jan1Day - 1;
	
	// Calculate days since Jan 1
	const daysSinceJan1 = Math.floor((date.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
	
	// Calculate week number
	// Week 1 starts on the Monday of the week containing Jan 1
	const weekNumber = Math.floor((daysSinceJan1 + jan1MondayBased) / 7) + 1;
	
	return weekNumber;
}

// Get the Monday of a given week number in a year
function getMondayOfWeek(year: number, weekNumber: number): Date {
	const jan1 = new Date(year, 0, 1);
	const jan1Day = jan1.getDay();
	const jan1MondayBased = jan1Day === 0 ? 6 : jan1Day - 1;
	
	// Calculate days to add to get to the Monday of weekNumber
	const daysToAdd = (weekNumber - 1) * 7 - jan1MondayBased;
	const monday = new Date(jan1);
	monday.setDate(jan1.getDate() + daysToAdd);
	
	return monday;
}

// Get number of weeks in a year (52 or 53)
function getWeeksInYear(year: number): number {
	const dec31 = new Date(year, 11, 31);
	const weekNumDec31 = weekNum(dec31);
	
	// If Dec 31 is in week 53, the year has 53 weeks
	return weekNumDec31 === 53 ? 53 : 52;
}

// Get full month name from a week's date (using Thursday as reference)
function getMonthName(weekStartDate: Date): string {
	const thursday = new Date(weekStartDate);
	thursday.setDate(weekStartDate.getDate() + 3);
	const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
	return monthNames[thursday.getMonth()];
}

// Custom Tooltip Component
interface TooltipProps {
	week: WeekData;
	show: boolean;
	position: { top: number; left: number };
}

function Tooltip({ week, show, position }: TooltipProps) {
	if (!show || typeof document === "undefined") return null;

	const monthName = getMonthName(week.startDate);

	return createPortal(
		<div
			className='fixed z-[9999] px-3 py-2 text-sm text-white rounded-lg shadow-lg pointer-events-none'
			style={{
				backgroundColor: "#0f0f0f",
				top: `${position.top}px`,
				left: `${position.left}px`,
			}}>
			<div className='text-center space-y-1'>
				<div className='font-semibold'>{week.year}</div>
				<div>{monthName}</div>
				<div>Week {week.weekNumber}</div>
				<div className='font-medium' style={{ color: '#F9ED32' }}>Value: {week.value}</div>
			</div>
		</div>,
		document.body
	);
}

// Week Square Component with Tooltip
interface WeekSquareProps {
	week: WeekData;
	maxValue: number;
	opacity: number;
}

function WeekSquare({ week, maxValue, opacity }: WeekSquareProps) {
	const [showTooltip, setShowTooltip] = useState(false);
	const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
	const squareRef = useRef<HTMLDivElement>(null);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	const updateTooltipPosition = () => {
		if (!squareRef.current) return;

		const rect = squareRef.current.getBoundingClientRect();
		const tooltipWidth = 120;
		const tooltipHeight = 80;
		const margin = 10;

		// Position above the square by default
		let top = rect.top + window.scrollY - tooltipHeight - margin;
		let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipWidth / 2);

		// Adjust if tooltip would go above viewport
		if (top < window.scrollY + margin) {
			top = rect.bottom + window.scrollY + margin;
		}

		// Keep tooltip within viewport horizontally
		if (left < window.scrollX + margin) {
			left = window.scrollX + margin;
		} else if (left + tooltipWidth > window.scrollX + window.innerWidth - margin) {
			left = window.scrollX + window.innerWidth - tooltipWidth - margin;
		}

		setTooltipPosition({ top, left });
	};

	const handleMouseEnter = () => {
		updateTooltipPosition();
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
	};

	const handleTouchStart = () => {
		updateTooltipPosition();
		setShowTooltip(true);
	};

	const handleTouchEnd = () => {
		setTimeout(() => {
			setShowTooltip(false);
		}, 2000);
	};

	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	// Determine background color
	let backgroundColor: string;
	if (week.isHighlighted) {
		// Dorkinians Green with opacity
		backgroundColor = `rgba(28, 136, 65, ${opacity})`;
	} else if (week.value > 0) {
		// Yellow with opacity
		backgroundColor = `rgba(249, 237, 50, ${opacity})`;
	} else {
		// White with transparency
		backgroundColor = `rgba(255, 255, 255, ${opacity})`;
	}

	return (
		<>
			<div
				ref={squareRef}
				className='w-6 h-6 rounded flex items-center justify-center relative cursor-pointer'
				style={{ backgroundColor }}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}>
				<span
					className='text-xs font-medium'
					style={{
						fontSize: '9px',
						color: week.value > 0 ? '#000000' : 'rgba(255, 255, 255, 0.6)',
					}}>
					{week.weekNumber}
				</span>
			</div>
			<Tooltip week={week} show={showTooltip} position={tooltipPosition} />
		</>
	);
}

export default function Calendar({ visualization }: CalendarProps) {
	const [showFullCalendar, setShowFullCalendar] = useState(false);
	
	if (!visualization) return null;

	// Handle week-based format, date range format, and array of game dates
	let startDate: Date;
	let endDate: Date;
	const gameDates = new Set<string>(); // Set of dates that have games
	let weekBasedData: WeekBasedData | null = null;
	let highlightRange: WeekBasedData["highlightRange"] = undefined;

	// Check for new week-based format
	if (
		visualization.data &&
		typeof visualization.data === "object" &&
		"weeks" in visualization.data &&
		Array.isArray((visualization.data as WeekBasedData).weeks)
	) {
		weekBasedData = visualization.data as WeekBasedData;
		highlightRange = weekBasedData.highlightRange;

		// Determine date range from weeks
		const weeks = weekBasedData.weeks;
		if (weeks.length === 0) {
			return (
				<div className='mt-4 p-4 dark-dropdown rounded-lg'>
					<p className='text-yellow-300'>No valid week data available</p>
				</div>
			);
		}

		// Find earliest and latest weeks
		let earliestWeek = weeks[0];
		let latestWeek = weeks[0];

		for (const week of weeks) {
			const weekStart = getMondayOfWeek(week.year, week.weekNumber);
			const earliestStart = getMondayOfWeek(earliestWeek.year, earliestWeek.weekNumber);
			const latestStart = getMondayOfWeek(latestWeek.year, latestWeek.weekNumber);

			if (weekStart < earliestStart) {
				earliestWeek = week;
			}
			if (weekStart > latestStart) {
				latestWeek = week;
			}
		}

		startDate = getMondayOfWeek(earliestWeek.year, earliestWeek.weekNumber);
		const latestWeekStart = getMondayOfWeek(latestWeek.year, latestWeek.weekNumber);
		endDate = new Date(latestWeekStart);
		endDate.setDate(latestWeekStart.getDate() + 6);
	} else if (Array.isArray(visualization.data) && visualization.data.length > 0) {
		// Handle array of game dates (streak data format)
		const gameData = visualization.data as GameDate[];
		
		// Extract all dates and find min/max
		const dates = gameData
			.map((game) => {
				const dateStr = game.date;
				if (dateStr) {
					gameDates.add(new Date(dateStr).toDateString());
					return new Date(dateStr);
				}
				return null;
			})
			.filter((date): date is Date => date !== null)
			.sort((a, b) => a.getTime() - b.getTime());

		if (dates.length === 0) {
			return (
				<div className='mt-4 p-4 dark-dropdown rounded-lg'>
					<p className='text-yellow-300'>No valid date data available</p>
				</div>
			);
		}

		startDate = dates[0];
		endDate = dates[dates.length - 1];
	} else if (visualization.data && typeof visualization.data === "object" && "startDate" in visualization.data && "endDate" in visualization.data) {
		// Handle date range format
		const dateRange = visualization.data as DateRange;
		startDate = new Date(dateRange.startDate);
		endDate = new Date(dateRange.endDate);
		
		// If it's a date range, highlight all dates in the range
		const current = new Date(startDate);
		while (current <= endDate) {
			gameDates.add(current.toDateString());
			current.setDate(current.getDate() + 1);
		}
	} else {
		return (
			<div className='mt-4 p-4 dark-dropdown rounded-lg'>
				<p className='text-yellow-300'>Invalid date data format</p>
			</div>
		);
	}

	// Calculate if streak is less than a year
	const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
	// If we have week-based data with a small number of weeks, it's definitely less than a year
	const isStreakLessThanYear = weekBasedData 
		? (weekBasedData.weeks.length <= 52 || daysDiff < 365)
		: daysDiff < 365;

	// Get years in the range
	// In compact mode, only include years within the streak range
	const years: number[] = [];
	const startYear = startDate.getFullYear();
	const endYear = endDate.getFullYear();
	
	if (isStreakLessThanYear && !showFullCalendar && highlightRange) {
		// In compact mode with highlightRange, only include years within the highlight range
		// This ensures we only show the year(s) that contain the actual streak
		for (let year = highlightRange.startYear; year <= highlightRange.endYear; year++) {
			years.push(year);
		}
	} else {
		// In full calendar mode or when no highlightRange, include all years in the date range
		for (let year = startYear; year <= endYear; year++) {
			years.push(year);
		}
	}

	// Process weeks for each year
	const yearWeeks: Map<number, WeekData[]> = new Map();
	const yearGameCounts: Map<number, Map<number, number>> = new Map(); // year -> week -> count
	const yearWeekValues: Map<number, Map<number, number>> = new Map(); // year -> week -> value (for week-based format)

	// Handle week-based data format
	if (weekBasedData) {
		for (const week of weekBasedData.weeks) {
			if (!yearWeekValues.has(week.year)) {
				yearWeekValues.set(week.year, new Map());
			}
			const weekValues = yearWeekValues.get(week.year)!;
			weekValues.set(week.weekNumber, week.value);
			// Also set gameCount for backward compatibility with existing rendering logic
			if (!yearGameCounts.has(week.year)) {
				yearGameCounts.set(week.year, new Map());
			}
			const weekCounts = yearGameCounts.get(week.year)!;
			weekCounts.set(week.weekNumber, week.value > 0 ? 1 : 0);
		}
	} else {
		// Count games per week from dates
		for (const dateStr of gameDates) {
			const date = new Date(dateStr);
			const year = date.getFullYear();
			const week = weekNum(date);
			
			if (!yearGameCounts.has(year)) {
				yearGameCounts.set(year, new Map());
			}
			const weekCounts = yearGameCounts.get(year)!;
			weekCounts.set(week, (weekCounts.get(week) || 0) + 1);
		}
	}

	// Generate all weeks for each year
	for (const year of years) {
		const weeksInYear = getWeeksInYear(year);
		const weeks: WeekData[] = [];
		const weekCounts = yearGameCounts.get(year) || new Map();
		const weekValues = yearWeekValues.get(year) || new Map();

		// Create a set of months that contain data for compact view filtering
		const monthsWithData = new Set<number>();
		if (isStreakLessThanYear && !showFullCalendar) {
			if (weekBasedData) {
				// For week-based data, determine which months contain data weeks
				for (const week of weekBasedData.weeks) {
					if (week.year === year) {
						const monday = getMondayOfWeek(week.year, week.weekNumber);
						const thursday = new Date(monday);
						thursday.setDate(monday.getDate() + 3);
						monthsWithData.add(thursday.getMonth());
					}
				}
			} else {
				// For other formats, determine months from game dates
				for (const dateStr of gameDates) {
					const date = new Date(dateStr);
					if (date.getFullYear() === year) {
						monthsWithData.add(date.getMonth());
					}
				}
			}
		}

		for (let weekNum = 1; weekNum <= weeksInYear; weekNum++) {
			const monday = getMondayOfWeek(year, weekNum);
			const sunday = new Date(monday);
			sunday.setDate(monday.getDate() + 6);

			// In compact mode (streak < 1 year and not showing full calendar), only include weeks in months with data
			if (isStreakLessThanYear && !showFullCalendar) {
				// Use Thursday (middle of week) to determine which month the week belongs to
				const thursday = new Date(monday);
				thursday.setDate(monday.getDate() + 3);
				if (!monthsWithData.has(thursday.getMonth())) {
					continue; // Skip weeks in months without data
				}
			} else {
				// In full calendar mode, check if this week is within our date range
				const weekEnd = new Date(sunday);
				weekEnd.setHours(23, 59, 59, 999);
				
				if (weekEnd < startDate || monday > endDate) {
					continue; // Skip weeks outside the date range
				}
			}

			// Determine if this week is highlighted
			let isHighlighted = false;
			if (highlightRange) {
				// Check if this week falls within the highlight range
				if (year === highlightRange.startYear && year === highlightRange.endYear) {
					// Same year range
					isHighlighted = weekNum >= highlightRange.startWeek && weekNum <= highlightRange.endWeek;
				} else if (year === highlightRange.startYear) {
					// Start year - check if week is >= startWeek
					isHighlighted = weekNum >= highlightRange.startWeek;
				} else if (year === highlightRange.endYear) {
					// End year - check if week is <= endWeek
					isHighlighted = weekNum <= highlightRange.endWeek;
				} else if (year > highlightRange.startYear && year < highlightRange.endYear) {
					// Year is between start and end years
					isHighlighted = true;
				}
			}

			// Get value from week-based data or use gameCount
			const value = weekValues.has(weekNum) ? weekValues.get(weekNum)! : (weekCounts.get(weekNum) || 0);

			weeks.push({
				weekNumber: weekNum,
				year: year,
				startDate: monday,
				endDate: sunday,
				gameCount: weekCounts.get(weekNum) || 0,
				value: value,
				isHighlighted: isHighlighted,
			});
		}

		if (weeks.length > 0) {
			yearWeeks.set(year, weeks);
		}
	}

	// Calculate month labels for each year - span weeks that belong to each month
	const yearMonthLabels: Map<number, MonthLabel[]> = new Map();
	const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

	for (const year of years) {
		const weeks = yearWeeks.get(year);
		if (!weeks || weeks.length === 0) continue;

		const monthLabels: MonthLabel[] = [];
		const monthWeekMap = new Map<number, number[]>(); // month -> array of week indices

		// For each week, determine which month it primarily belongs to (using Thursday as the reference)
		for (let idx = 0; idx < weeks.length; idx++) {
			const week = weeks[idx];
			// Use the middle of the week (Thursday) to determine the month
			const thursday = new Date(week.startDate);
			thursday.setDate(week.startDate.getDate() + 3);
			const month = thursday.getMonth();

			if (!monthWeekMap.has(month)) {
				monthWeekMap.set(month, []);
			}
			monthWeekMap.get(month)!.push(idx);
		}

		// Create month labels with start and end week indices
		for (const [month, weekIndices] of monthWeekMap.entries()) {
			if (weekIndices.length > 0) {
				const sortedIndices = weekIndices.sort((a, b) => a - b);
				monthLabels.push({
					month: monthNames[month],
					startWeekIndex: sortedIndices[0],
					endWeekIndex: sortedIndices[sortedIndices.length - 1],
				});
			}
		}

		// Sort month labels by start week index
		monthLabels.sort((a, b) => a.startWeekIndex - b.startWeekIndex);
		yearMonthLabels.set(year, monthLabels);
	}

	return (
		<div className='mt-4 space-y-6'>
			{years.map((year) => {
				const weeks = yearWeeks.get(year);
				const monthLabels = yearMonthLabels.get(year) || [];

				if (!weeks || weeks.length === 0) return null;

				// Calculate max value for opacity scaling
				const maxValue = Math.max(...weeks.map((w) => w.value), 1);

				// Group weeks into rows (approximately 10 weeks per row for better visibility)
				// This can be adjusted based on container width, but 10 is a good default
				const weeksPerRow = 10;
				const weekRows: WeekData[][] = [];
				for (let i = 0; i < weeks.length; i += weeksPerRow) {
					weekRows.push(weeks.slice(i, i + weeksPerRow));
				}

				return (
					<div key={year} className='dark-dropdown rounded-2xl p-4'>
						{/* Year Header */}
						<div className='mb-4'>
							<h4 className='text-lg font-semibold text-white'>{year}</h4>
						</div>

						{/* Render week rows with month label rows between them */}
						<div className='space-y-2'>
							{weekRows.map((rowWeeks, rowIndex) => {
								const startWeekIndex = rowIndex * weeksPerRow;
								const endWeekIndex = Math.min(startWeekIndex + rowWeeks.length - 1, weeks.length - 1);
								
								// Find month labels that start in this row (only show label in the row where it begins)
								const rowMonthLabels = monthLabels.filter((label) => {
									return label.startWeekIndex >= startWeekIndex && label.startWeekIndex <= endWeekIndex;
								});

								return (
									<div key={rowIndex} className='space-y-1'>
										{/* Month Labels Row for this week row */}
										{rowMonthLabels.length > 0 && (
											<div className='relative h-4' style={{ width: `${rowWeeks.length * 26}px` }}>
												{rowMonthLabels.map((label, labelIdx) => {
													// Calculate position relative to this row
													const labelStartInRow = Math.max(0, label.startWeekIndex - startWeekIndex);
													const labelEndInRow = Math.min(rowWeeks.length - 1, label.endWeekIndex - startWeekIndex);
													
													if (labelEndInRow < 0 || labelStartInRow >= rowWeeks.length) return null;

													const left = labelStartInRow * 26;
													const width = (labelEndInRow - labelStartInRow + 1) * 26 - 2;

													return (
														<div
															key={labelIdx}
															className='absolute text-xs font-medium text-gray-400 text-center'
															style={{
																left: `${left}px`,
																width: `${width}px`,
																fontSize: '10px',
															}}>
															{label.month}
														</div>
													);
												})}
											</div>
										)}

										{/* Week Tiles Row */}
										<div className='flex gap-0.5'>
											{rowWeeks.map((week, idx) => {
												const globalIdx = startWeekIndex + idx;
												// Calculate opacity: more value = more opaque (lower transparency)
												// For weeks with values: opacity ranges from 0.4 (1 value) to 1.0 (max value)
												// For weeks without values: white with high transparency (0.1)
												const opacity = week.value > 0
													? 0.4 + (week.value / maxValue) * 0.6
													: 0.1;

												return (
													<WeekSquare
														key={globalIdx}
														week={week}
														maxValue={maxValue}
														opacity={opacity}
													/>
												);
											})}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				);
			})}
			{/* Toggle button for full calendar view */}
			{isStreakLessThanYear && (
				<div className='mt-4 text-center'>
					<button
						onClick={() => setShowFullCalendar(!showFullCalendar)}
						className='text-sm text-yellow-300 hover:text-yellow-200 cursor-pointer underline transition-colors'>
						{showFullCalendar ? 'Hide full calendar' : 'Click for full calendar'}
					</button>
				</div>
			)}
		</div>
	);
}
