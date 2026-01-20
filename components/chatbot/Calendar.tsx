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
	goalInvolvements?: number; // Goal involvement count for this week
	gameCount?: number; // Number of games in this week
	fixtureResult?: string; // Fixture result: 'W', 'D', or 'L'
	fixtureScoreline?: string; // Fixture scoreline: 'W 3-1', 'D 2-2', 'L 1-3', etc.
}

interface WeekBasedData {
	weeks: WeekValue[];
	highlightRange?: {
		startWeek: number;
		startYear: number;
		endWeek: number;
		endYear: number;
	};
	allFixtureDates?: string[];
	streakSequence?: string[]; // seasonWeek strings from streak calculation
	streakDates?: string[]; // Actual dates from streak sequence for precise matching
	streakType?: string; // Streak type for styling (e.g., "longest_no_goal_involvement" for red styling)
	showGoalInvolvements?: boolean; // Whether to show goal involvements vs apps
	contributionLabel?: string; // Label for the contribution metric (e.g., "Goal Involvements", "Goals", "Assists")
	fixtureResults?: Record<string, string>; // Map of date -> result ('W'|'D'|'L')
	fixtureScorelines?: Record<string, string>; // Map of date -> scoreline ('W 3-1', 'D 2-2', etc.)
	fixtureResultType?: string; // Type identifier for fixture result visualization (e.g., "team_unbeaten_run")
	fullDateRange?: { start: string; end: string }; // Full date range for full calendar view (e.g., 2016-2025)
}

interface WeekData {
	weekNumber: number;
	year: number;
	startDate: Date;
	endDate: Date;
	gameCount: number;
	value: number;
	isHighlighted: boolean;
	hasFixtures: boolean;
	isNegativeStreak?: boolean; // For negative streaks (e.g., no goal involvements)
	goalInvolvements?: number; // Goal involvement count for this week
	showGoalInvolvements?: boolean; // Whether to show goal involvements vs apps
	isPlayed?: boolean; // Whether player played in this week (for negative streak styling)
	contributionLabel?: string; // Label for the contribution metric (e.g., "Goal Involvements", "Goals", "Assists")
	fixtureResult?: string; // Fixture result: 'W', 'D', or 'L'
	fixtureScoreline?: string; // Fixture scoreline: 'W 3-1', 'D 2-2', 'L 1-3', etc.
	fixtureResultType?: string; // Type identifier for fixture result visualization
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

	// Show different tooltip text based on whether week has fixtures and what data type to show
	let tooltipText: string;
	let tooltipSecondaryText: string | null = null;
	if (!week.hasFixtures) {
		tooltipText = "No fixtures on this week";
	} else if (week.fixtureResultType === "team_unbeaten_run" && week.fixtureScoreline) {
		// For team unbeaten run questions, show scoreline (e.g., "W 3-1")
		tooltipText = week.fixtureScoreline;
	} else if (week.showGoalInvolvements) {
		// For goal involvement/goal scoring/assisting questions, show apps first, then contribution metric
		const goalInvolvements = week.goalInvolvements !== undefined ? week.goalInvolvements : 0;
		const contributionLabel = week.contributionLabel || "Goal Involvements"; // Default to "Goal Involvements" for backward compatibility
		tooltipText = `Apps: ${week.gameCount || 0}`;
		tooltipSecondaryText = `${contributionLabel}: ${goalInvolvements}`;
	} else {
		tooltipText = `Apps: ${week.value}`;
	}

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
				<div className='font-medium' style={{ color: '#F9ED32' }}>{tooltipText}</div>
				{tooltipSecondaryText && (
					<div className='font-medium' style={{ color: '#F9ED32' }}>{tooltipSecondaryText}</div>
				)}
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

	// Determine background color and border style
	let backgroundColor: string;
	let borderStyle: React.CSSProperties = {};
	// Grey styling for boxes with fixtures but no player games
	const hasFixturesNoGames = week.hasFixtures && !week.isPlayed && (week.gameCount === 0 || week.value === 0);
	
	// For fixture result type (team unbeaten run), use fixture result colors
	if (week.fixtureResultType === "team_unbeaten_run") {
		if (!week.hasFixtures) {
			// No fixtures - dark grey
			backgroundColor = `rgba(100, 100, 100, 0.5)`;
		} else if (week.fixtureResult === 'W') {
			// Win - green
			backgroundColor = `rgba(28, 136, 65, ${opacity})`;
		} else if (week.fixtureResult === 'D') {
			// Draw - grey
			backgroundColor = `rgba(200, 200, 200, 0.5)`;
		} else if (week.fixtureResult === 'L') {
			// Loss - red
			backgroundColor = `rgba(220, 50, 50, 1.0)`;
		} else {
			// Has fixtures but no result data - default to grey
			backgroundColor = `rgba(200, 200, 200, 0.5)`;
		}
		
		// Add bold white border for highlighted weeks (winning streak)
		if (week.isHighlighted) {
			borderStyle = {
				border: '2px solid rgba(255, 255, 255, 0.9)',
			};
		}
	} else if (week.showGoalInvolvements) {
		// For goal involvement/goal/assist questions, use specific styling logic
		const goalInvolvements = week.goalInvolvements !== undefined ? week.goalInvolvements : 0;
		const gameCount = week.gameCount || 0;
		
		if (!week.hasFixtures) {
			// No fixtures - dark grey, no border
			backgroundColor = `rgba(100, 100, 100, 0.5)`;
		} else if (gameCount === 0) {
			// Apps 0 - grey (player didn't play), no border
			backgroundColor = `rgba(200, 200, 200, 0.5)`;
		} else if (week.isHighlighted && week.isNegativeStreak) {
			// Games in the streak without goal involvements/goals/assists - red fill with bold white border
			backgroundColor = `rgba(220, 50, 50, 1.0)`; // Red with full opacity
			borderStyle = {
				border: '2px solid rgba(255, 255, 255, 0.9)',
			};
		} else if (goalInvolvements === 0) {
			// Apps 1+ but Goal Involvements 0 - brighter Dorkinians yellow fill
			backgroundColor = `rgba(249, 237, 50, 1.0)`; // Brighter Dorkinians yellow with full opacity
		} else {
			// Apps 1+ and Goal Involvements > 0 - green fill
			backgroundColor = `rgba(28, 136, 65, ${opacity})`; // Green
		}
		
		// Add bold white border for positive goal involvement streaks (highlighted but not negative)
		if (week.isHighlighted && !week.isNegativeStreak) {
			borderStyle = {
				border: '2px solid rgba(255, 255, 255, 0.9)',
			};
		}
	} else {
		// For non-goal involvement questions (e.g., consecutive weekends), use original logic
		if (week.isHighlighted) {
			// Dorkinians Green - darker for value 2, regular for value 1, with bold white border for streak
			if (week.value === 2) {
				backgroundColor = `rgba(20, 100, 45, ${opacity})`; // Darker green
			} else {
				backgroundColor = `rgba(28, 136, 65, ${opacity})`; // Regular green
			}
			borderStyle = {
				border: '2px solid rgba(255, 255, 255, 0.9)',
			};
		} else if (week.value > 0) {
			// Yellow - darker for value 2, regular for value 1
			if (week.value === 2) {
				backgroundColor = `rgba(220, 210, 30, ${opacity})`; // Darker yellow
			} else {
				backgroundColor = `rgba(249, 237, 50, ${opacity})`; // Regular yellow
			}
		} else if (hasFixturesNoGames) {
			// Darker grey, no border for weekends with fixtures but no player games
			backgroundColor = `rgba(100, 100, 100, 0.5)`;
		} else {
			// White with transparency (for weekends with no fixtures)
			backgroundColor = `rgba(255, 255, 255, ${opacity})`;
		}
	}

	return (
		<>
			<div
				ref={squareRef}
				className='w-6 h-6 rounded flex items-center justify-center relative cursor-pointer'
				style={{ backgroundColor, ...borderStyle }}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}>
				<span
					className='text-xs font-medium'
					style={{
						fontSize: '9px',
						color: (() => {
							// For yellow boxes (Apps 1+ but Goal Involvements 0), use black text
							if (week.showGoalInvolvements) {
								const goalInvolvements = week.goalInvolvements !== undefined ? week.goalInvolvements : 0;
								const gameCount = week.gameCount || 0;
								if (gameCount > 0 && goalInvolvements === 0 && !(week.isHighlighted && week.isNegativeStreak)) {
									return '#000000'; // Black for yellow boxes
								}
							}
							// Default: black for boxes with value/goal involvements, white/grey for others
							return (week.value > 0 || (week.showGoalInvolvements && week.goalInvolvements !== undefined && week.goalInvolvements > 0)) 
								? '#000000' 
								: (hasFixturesNoGames ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.6)');
						})(),
					}}>
					{week.showGoalInvolvements && week.goalInvolvements !== undefined 
						? week.goalInvolvements 
						: week.weekNumber}
				</span>
			</div>
			<Tooltip week={week} show={showTooltip} position={tooltipPosition} />
		</>
	);
}

export default function Calendar({ visualization }: CalendarProps) {
	const [showFullCalendar, setShowFullCalendar] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const [weeksPerRow, setWeeksPerRow] = useState(10);
	
	if (!visualization) return null;

	// Handle week-based format, date range format, and array of game dates
	let startDate: Date;
	let endDate: Date;
	const gameDates = new Set<string>(); // Set of dates that have games
		let weekBasedData: WeekBasedData | null = null;
		let highlightRange: WeekBasedData["highlightRange"] = undefined;
		let allFixtureDates: string[] = []; // Extract allFixtureDates from weekBasedData if available
		let streakSequence: string[] = []; // Extract streakSequence from weekBasedData if available
		let streakDates: string[] = []; // Extract streakDates from weekBasedData if available
		let streakType: string | undefined = undefined; // Extract streakType for styling
		let showGoalInvolvements: boolean = false; // Whether to show goal involvements vs apps
		let contributionLabel: string | undefined = undefined; // Label for contribution metric
		let fixtureResults: Record<string, string> | undefined = undefined; // Extract fixtureResults if available
		let fixtureScorelines: Record<string, string> | undefined = undefined; // Extract fixtureScorelines if available
		let fixtureResultType: string | undefined = undefined; // Extract fixtureResultType if available

		// Check for new week-based format
		if (
			visualization.data &&
			typeof visualization.data === "object" &&
			"weeks" in visualization.data &&
			Array.isArray((visualization.data as WeekBasedData).weeks)
		) {
			weekBasedData = visualization.data as WeekBasedData;
			highlightRange = weekBasedData.highlightRange;
			allFixtureDates = weekBasedData?.allFixtureDates || [];
			streakSequence = weekBasedData?.streakSequence || [];
			streakDates = weekBasedData?.streakDates || [];
			streakType = weekBasedData?.streakType;
			showGoalInvolvements = weekBasedData?.showGoalInvolvements || false;
			contributionLabel = weekBasedData?.contributionLabel;
			fixtureResults = weekBasedData?.fixtureResults;
			fixtureScorelines = weekBasedData?.fixtureScorelines;
			fixtureResultType = weekBasedData?.fixtureResultType;
			const fullDateRange = weekBasedData?.fullDateRange;

		// Determine date range from weeks or fullDateRange
		const weeks = weekBasedData.weeks;
		if (weeks.length === 0) {
			return (
				<div className='mt-4 p-4 dark-dropdown rounded-lg'>
					<p className='text-yellow-300'>No valid week data available</p>
				</div>
			);
		}

		// If showFullCalendar is true and fullDateRange exists, use that for the date range
		// Otherwise, determine from weeks data
		if (showFullCalendar && fullDateRange) {
			startDate = new Date(fullDateRange.start);
			endDate = new Date(fullDateRange.end);
		} else {
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
		}
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
	const allYears: number[] = []; // All years in the full date range
	const startYear = startDate.getFullYear();
	const endYear = endDate.getFullYear();
	
	// Calculate all years in the full date range
	for (let year = startYear; year <= endYear; year++) {
		allYears.push(year);
	}
	
	// If showFullCalendar is true and fullDateRange exists, use that for years calculation
	if (showFullCalendar && weekBasedData?.fullDateRange) {
		const fullStartYear = new Date(weekBasedData.fullDateRange.start).getFullYear();
		const fullEndYear = new Date(weekBasedData.fullDateRange.end).getFullYear();
		// Include all years in the full date range
		for (let year = fullStartYear; year <= fullEndYear; year++) {
			years.push(year);
		}
	} else if (!showFullCalendar && highlightRange) {
		// Initially show only years within the highlight range (streak years)
		// This ensures we only show the year(s) that contain the actual streak
		for (let year = highlightRange.startYear; year <= highlightRange.endYear; year++) {
			years.push(year);
		}
	} else {
		// In full calendar mode (without fullDateRange) or when no highlightRange, include all years in the date range
		years.push(...allYears);
	}
	
	// Determine if we should show the toggle button
	// Show toggle if:
	// 1. There are more years in the full range than in the highlight range, OR
	// 2. The streak is less than a year (so users can expand to see full year), OR
	// 3. There's a highlightRange (so users can toggle between compact and full view)
	const highlightRangeYearCount = highlightRange ? (highlightRange.endYear - highlightRange.startYear + 1) : 0;
	const hasMoreYears = highlightRange ? allYears.length > highlightRangeYearCount : false;
	const shouldShowToggle = hasMoreYears || isStreakLessThanYear || (highlightRange !== undefined);

	// Process weeks for each year
	const yearWeeks: Map<number, WeekData[]> = new Map();
	const yearGameCounts: Map<number, Map<number, number>> = new Map(); // year -> week -> count
	const yearWeekValues: Map<number, Map<number, number>> = new Map(); // year -> week -> value (for week-based format)

	// Handle week-based data format
	// Track goal involvements per week and game counts
	const yearGoalInvolvements: Map<number, Map<number, number>> = new Map(); // year -> week -> goal involvements
	const yearFixtureResults: Map<number, Map<number, string>> = new Map(); // year -> week -> fixture result
	const yearFixtureScorelines: Map<number, Map<number, string>> = new Map(); // year -> week -> fixture scoreline
	if (weekBasedData) {
		for (const week of weekBasedData.weeks) {
			if (!yearWeekValues.has(week.year)) {
				yearWeekValues.set(week.year, new Map());
			}
			const weekValues = yearWeekValues.get(week.year)!;
			weekValues.set(week.weekNumber, week.value);
			
			// Track goal involvements if available
			if (week.goalInvolvements !== undefined) {
				if (!yearGoalInvolvements.has(week.year)) {
					yearGoalInvolvements.set(week.year, new Map());
				}
				yearGoalInvolvements.get(week.year)!.set(week.weekNumber, week.goalInvolvements);
			}
			
			// Track fixture results if available
			if (week.fixtureResult) {
				if (!yearFixtureResults.has(week.year)) {
					yearFixtureResults.set(week.year, new Map());
				}
				yearFixtureResults.get(week.year)!.set(week.weekNumber, week.fixtureResult);
			}
			
			// Track fixture scorelines if available
			if (week.fixtureScoreline) {
				if (!yearFixtureScorelines.has(week.year)) {
					yearFixtureScorelines.set(week.year, new Map());
				}
				yearFixtureScorelines.get(week.year)!.set(week.weekNumber, week.fixtureScoreline);
			}
			
			// Also set gameCount for backward compatibility with existing rendering logic
			if (!yearGameCounts.has(week.year)) {
				yearGameCounts.set(week.year, new Map());
			}
			const weekCounts = yearGameCounts.get(week.year)!;
			// Use gameCount if available
			// For goal involvement questions, gameCount represents actual games played (from chatbotService)
			// Don't infer from value because value is goal involvements, not game count
			if (week.gameCount !== undefined) {
				weekCounts.set(week.weekNumber, week.gameCount);
			} else if (!showGoalInvolvements) {
				// Only infer from value for non-goal involvement questions
				weekCounts.set(week.weekNumber, week.value > 0 ? 1 : 0);
			} else {
				// For goal involvement questions, if gameCount is not provided, default to 0
				weekCounts.set(week.weekNumber, 0);
			}
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
		// Show shortened view if streak is less than a year, even with highlightRange
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

			// When showing full calendar, check if week is within date range
			// When in compact mode (even with highlightRange), filter by months with data if streak is less than a year
			if (showFullCalendar) {
				// In full calendar mode, check if this week is within our date range
				const weekEnd = new Date(sunday);
				weekEnd.setHours(23, 59, 59, 999);
				
				if (weekEnd < startDate || monday > endDate) {
					continue; // Skip weeks outside the date range
				}
			} else if (isStreakLessThanYear) {
				// In compact mode, only include weeks in months with data (even with highlightRange)
				const thursday = new Date(monday);
				thursday.setDate(monday.getDate() + 3);
				if (!monthsWithData.has(thursday.getMonth())) {
					continue; // Skip weeks in months without data
				}
			}

			// Determine if this week is highlighted
			// Only highlight if the week is actually in the streak sequence, not just in the date range
			let isHighlighted = false;
			if (streakDates.length > 0) {
				// Use actual dates from streak for precise matching
				// Check if any date in the streak falls within this week (Monday-Sunday)
				const weekStartNormalized = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
				const weekEndNormalized = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());
				
				isHighlighted = streakDates.some(dateStr => {
					const streakDate = new Date(dateStr);
					const streakDateNormalized = new Date(streakDate.getFullYear(), streakDate.getMonth(), streakDate.getDate());
					// Check if streak date falls within this week
					return streakDateNormalized >= weekStartNormalized && streakDateNormalized <= weekEndNormalized;
				});
			} else if (highlightRange) {
				// Fallback to highlightRange if no streakSequence (for backward compatibility)
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

			// Check if this week has any fixtures (for any Dorkinians team)
			// Only check for fixtures if the week is within the displayed date range
			// If allFixtureDates is provided (array exists, even if empty), use it to determine hasFixtures
			// If allFixtureDates is undefined, default to true (assume fixtures might exist, don't show grey)
			let hasFixtures = true; // Default to true
			if (weekBasedData?.allFixtureDates !== undefined) {
				// Ensure this week is within the date range before checking fixtures
				const weekEnd = new Date(sunday);
				weekEnd.setHours(23, 59, 59, 999);
				const isWithinDateRange = weekEnd >= startDate && monday <= endDate;
				
				if (isWithinDateRange) {
					// allFixtureDates array exists (may be empty), check if any fixture falls in this week
					// Normalize dates to midnight local time for accurate date comparison
					const mondayNormalized = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
					const sundayNormalized = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());
					
					hasFixtures = allFixtureDates.some(fixtureDateStr => {
						const fixtureDate = new Date(fixtureDateStr);
						// Normalize to midnight local time for accurate date comparison
						const fixtureDateNormalized = new Date(fixtureDate.getFullYear(), fixtureDate.getMonth(), fixtureDate.getDate());
						// Check if fixture date falls within this week (Monday to Sunday)
						const isInWeek = fixtureDateNormalized >= mondayNormalized && fixtureDateNormalized <= sundayNormalized;
						return isInWeek;
					});
				} else {
					// Week is outside the date range - don't check fixtures, default to true
					hasFixtures = true;
				}
			}

			// Check if this is a negative streak (e.g., no goal involvements)
			const isNegativeStreak = streakType === "longest_no_goal_involvement";
			
			// Get goal involvements for this week if available (default to 0 if not found)
			const goalInvolvements = yearGoalInvolvements.get(year)?.get(weekNum) ?? (showGoalInvolvements ? 0 : undefined);
			
			// Get fixture result for this week if available
			const weekFixtureResult = yearFixtureResults.get(year)?.get(weekNum);
			
			// Get fixture scoreline for this week if available
			const weekFixtureScoreline = yearFixtureScorelines.get(year)?.get(weekNum);
			
			// Determine if player played in this week (for negative streak styling)
			const isPlayed = (weekCounts.get(weekNum) || 0) > 0;

			weeks.push({
				weekNumber: weekNum,
				year: year,
				startDate: monday,
				endDate: sunday,
				gameCount: weekCounts.get(weekNum) || 0,
				value: value,
				isHighlighted: isHighlighted,
				hasFixtures: hasFixtures,
				isNegativeStreak: isNegativeStreak,
				goalInvolvements: goalInvolvements,
				showGoalInvolvements: showGoalInvolvements,
				isPlayed: isPlayed,
				contributionLabel: contributionLabel,
				fixtureResult: weekFixtureResult,
				fixtureScoreline: weekFixtureScoreline,
				fixtureResultType: fixtureResultType,
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

	// Calculate weeksPerRow based on container width
	useEffect(() => {
		const calculateWeeksPerRow = () => {
			if (!containerRef.current) return;
			
			// Get container width, accounting for padding (p-4 = 16px on each side = 32px total)
			const containerWidth = containerRef.current.offsetWidth;
			const padding = 32; // 16px padding on each side
			const availableWidth = containerWidth - padding;
			
			// Each week box is 24px (w-6) + 2px gap (gap-0.5) = 26px total
			const boxWidth = 24;
			const gap = 2;
			const boxWithGap = boxWidth + gap;
			
			// Calculate how many boxes fit
			const calculatedWeeksPerRow = Math.floor(availableWidth / boxWithGap);
			
			// Ensure minimum of 5 and maximum of 15 weeks per row
			const clampedWeeksPerRow = Math.max(5, Math.min(15, calculatedWeeksPerRow));
			
			setWeeksPerRow(clampedWeeksPerRow);
		};

		calculateWeeksPerRow();

		// Recalculate on window resize
		const handleResize = () => {
			calculateWeeksPerRow();
		};

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	return (
		<div ref={containerRef} className='mt-4 space-y-6'>
			{years.map((year) => {
				const weeks = yearWeeks.get(year);
				const monthLabels = yearMonthLabels.get(year) || [];

				if (!weeks || weeks.length === 0) return null;

				// Calculate max value for opacity scaling
				const maxValue = Math.max(...weeks.map((w) => w.value), 1);

				// Group weeks into rows based on calculated weeksPerRow
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

								const boxWidth = 24;
								const gap = 2;
								const boxWithGap = boxWidth + gap;
								const rowWidth = rowWeeks.length * boxWithGap - gap; // Total width of the row

								return (
									<div key={rowIndex} className='space-y-1 flex flex-col items-center'>
										{/* Month Labels Row for this week row */}
										{rowMonthLabels.length > 0 && (
											<div className='relative h-4' style={{ width: `${rowWidth}px` }}>
												{rowMonthLabels.map((label, labelIdx) => {
													// Calculate position relative to this row
													const labelStartInRow = Math.max(0, label.startWeekIndex - startWeekIndex);
													const labelEndInRow = Math.min(rowWeeks.length - 1, label.endWeekIndex - startWeekIndex);
													
													if (labelEndInRow < 0 || labelStartInRow >= rowWeeks.length) return null;

													const left = labelStartInRow * boxWithGap;
													const width = (labelEndInRow - labelStartInRow + 1) * boxWithGap - gap;

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
										<div className='flex gap-0.5' style={{ width: `${rowWidth}px` }}>
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
			{shouldShowToggle && (
				<div className='mt-4 text-center'>
					<button
						onClick={() => setShowFullCalendar(!showFullCalendar)}
						className='text-sm text-yellow-300 hover:text-yellow-200 cursor-pointer underline transition-colors'>
						{showFullCalendar ? 'Hide full calendar' : 'Show full calendar'}
					</button>
				</div>
			)}
		</div>
	);
}
