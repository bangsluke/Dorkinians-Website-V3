export class DateUtils {
	/**
	 * Convert date format from DD/MM/YYYY or DD/MM/YY to YYYY-MM-DD
	 */
	static convertDateFormat(dateStr: string): string {
		const parts = dateStr.split("/");
		if (parts.length === 3) {
			let day = parts[0].padStart(2, "0");
			let month = parts[1].padStart(2, "0");
			let year = parts[2];

			// Handle 2-digit years
			if (year.length === 2) {
				const currentYear = new Date().getFullYear();
				const century = Math.floor(currentYear / 100) * 100;
				const yearNum = parseInt(year);
				year = (century + yearNum).toString();
			}

			return `${year}-${month}-${day}`;
		}
		return dateStr; // Return as-is if format not recognized
	}

	/**
	 * Convert YYYY-MM-DD to DD/MM/YYYY
	 */
	static formatDate(dateStr: string): string {
		if (dateStr.includes("-") && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
			const parts = dateStr.split("-");
			const year = parts[0];
			const month = parts[1];
			const day = parts[2];
			return `${day}/${month}/${year}`;
		}
		return dateStr;
	}

	/**
	 * Format a time range like "2022-03-20 to 2024-10-21" to "20/03/2022 to 21/10/2024"
	 */
	static formatTimeRange(timeRange: string): string {
		if (timeRange.includes(" to ")) {
			const [startDate, endDate] = timeRange.split(" to ");
			const formattedStart = DateUtils.formatDate(startDate.trim());
			const formattedEnd = DateUtils.formatDate(endDate.trim());
			return `${formattedStart} to ${formattedEnd}`;
		}
		return timeRange;
	}

	/**
	 * Calculate weekend dates for a given year and ordinal
	 */
	static calculateWeekendDates(year: number, ordinal: number = 1): { startDate: string; endDate: string } {
		// Find first Saturday of the year
		const jan1 = new Date(year, 0, 1);
		const dayOfWeek = jan1.getDay(); // 0=Sunday, 6=Saturday
		const daysToFirstSaturday = dayOfWeek === 6 ? 0 : (6 - dayOfWeek);
		const firstSaturday = new Date(year, 0, 1 + daysToFirstSaturday);
		
		// For ordinal weekends, add 7 * (ordinal - 1) days
		const weekendStart = new Date(firstSaturday);
		weekendStart.setDate(weekendStart.getDate() + 7 * (ordinal - 1));
		const weekendEnd = new Date(weekendStart);
		weekendEnd.setDate(weekendEnd.getDate() + 1); // Sunday
		
		// Format as YYYY-MM-DD
		const formatDate = (date: Date): string => {
			const yyyy = date.getFullYear();
			const mm = String(date.getMonth() + 1).padStart(2, "0");
			const dd = String(date.getDate()).padStart(2, "0");
			return `${yyyy}-${mm}-${dd}`;
		};
		
		return {
			startDate: formatDate(weekendStart),
			endDate: formatDate(weekendEnd),
		};
	}
}
