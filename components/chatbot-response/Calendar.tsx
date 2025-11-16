"use client";

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

export default function Calendar({ visualization }: CalendarProps) {
	if (!visualization) return null;

	// Handle both date range format and array of game dates
	let startDate: Date;
	let endDate: Date;
	const gameDates = new Set<string>(); // Set of dates that have games

	if (Array.isArray(visualization.data) && visualization.data.length > 0) {
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

	// Get all months in the range
	const months: Date[] = [];
	const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
	const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

	while (current <= end) {
		months.push(new Date(current));
		current.setMonth(current.getMonth() + 1);
	}

	// Check if a date has a game (for highlighting)
	const hasGame = (date: Date): boolean => {
		return gameDates.has(date.toDateString());
	};
	
	// Check if a date is within the overall range (for display purposes)
	const isInRange = (date: Date): boolean => {
		return date >= startDate && date <= endDate;
	};

	// Get days in month
	const getDaysInMonth = (date: Date): Date[] => {
		const year = date.getFullYear();
		const month = date.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const days: Date[] = [];

		// Add days from previous month to fill first week
		const startDayOfWeek = firstDay.getDay();
		for (let i = startDayOfWeek - 1; i >= 0; i--) {
			const prevDate = new Date(year, month, -i);
			days.push(prevDate);
		}

		// Add days of current month
		for (let day = 1; day <= lastDay.getDate(); day++) {
			days.push(new Date(year, month, day));
		}

		// Add days from next month to fill last week
		const remainingDays = 42 - days.length; // 6 weeks * 7 days
		for (let day = 1; day <= remainingDays; day++) {
			days.push(new Date(year, month + 1, day));
		}

		return days;
	};

	// Format month/year
	const formatMonthYear = (date: Date): string => {
		return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
	};

	// Check if date is in current month
	const isCurrentMonth = (date: Date, monthDate: Date): boolean => {
		return date.getMonth() === monthDate.getMonth() && date.getFullYear() === monthDate.getFullYear();
	};

	const daysOfWeek = ["S", "T", "W", "T", "F", "S", "S"];

	return (
		<div className='mt-4 space-y-4'>
			{months.map((monthDate, monthIndex) => {
				const days = getDaysInMonth(monthDate);
				const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
				const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

				return (
					<div
						key={monthIndex}
						className='bg-white rounded-lg p-4 shadow-lg'
						style={{
							background: "rgba(255, 255, 255, 0.95)",
						}}>
						{/* Month Header */}
						<div className='flex items-center justify-between mb-3'>
							<h4 className='text-lg font-semibold text-gray-800'>
								{formatMonthYear(monthDate)}
							</h4>
						</div>

						{/* Days of Week Header */}
						<div className='grid grid-cols-7 gap-1 mb-2'>
							{daysOfWeek.map((day, index) => (
								<div
									key={index}
									className='text-center text-xs font-medium text-gray-600 py-1'>
									{day}
								</div>
							))}
						</div>

						{/* Calendar Grid */}
						<div className='grid grid-cols-7 gap-1'>
							{days.map((date, index) => {
								const hasGameOnDate = hasGame(date);
								const isCurrentMonthDate = isCurrentMonth(date, monthDate);
								const isStartDate = date.toDateString() === startDate.toDateString();
								const isEndDate = date.toDateString() === endDate.toDateString();

								return (
									<div
										key={index}
										className={`
											aspect-square flex items-center justify-center text-sm
											${isCurrentMonthDate ? "text-gray-800" : "text-gray-400"}
											${hasGameOnDate ? "bg-teal-500 text-white rounded" : ""}
											${isStartDate || isEndDate ? "font-bold" : ""}
										`}
										style={{
											backgroundColor: hasGameOnDate ? "#14B8A6" : undefined,
										}}>
										<div className='flex flex-col items-center'>
											<span>{date.getDate()}</span>
											{hasGameOnDate && (
												<span
													className='w-1 h-1 rounded-full mt-0.5'
													style={{ backgroundColor: "#14B8A6" }}
												/>
											)}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				);
			})}
		</div>
	);
}

