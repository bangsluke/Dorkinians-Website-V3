export class DateUtils {
	/**
	 * Convert date format from DD/MM/YYYY or DD/MM/YY to YYYY-MM-DD
	 * Also handles DD-MM-YYYY and DD-MM-YY formats
	 */
	static convertDateFormat(dateStr: string): string {
		// Handle both "/" and "-" delimiters
		const parts = dateStr.split(/[\/\-]/);
		if (parts.length === 3) {
			let day = parts[0].padStart(2, "0");
			let month = parts[1].padStart(2, "0");
			let year = parts[2];

			// Handle 2-digit years (assume 20xx for years 00-99)
			if (year.length === 2) {
				const currentYear = new Date().getFullYear();
				const century = Math.floor(currentYear / 100) * 100;
				const yearNum = parseInt(year, 10);
				if (!isNaN(yearNum)) {
					year = (century + yearNum).toString();
				}
			}

			// Validate date components
			const dayNum = parseInt(day, 10);
			const monthNum = parseInt(month, 10);
			const yearNum = parseInt(year, 10);

			// Basic validation: day 1-31, month 1-12, year reasonable (1900-2100)
			if (!isNaN(dayNum) && !isNaN(monthNum) && !isNaN(yearNum) &&
				dayNum >= 1 && dayNum <= 31 &&
				monthNum >= 1 && monthNum <= 12 &&
				yearNum >= 1900 && yearNum <= 2100) {
				return `${year}-${month}-${day}`;
			}
		}
		return dateStr; // Return as-is if format not recognized or invalid
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
	 * Convert "since [YEAR]" to first date after that year
	 * e.g., "since 2020" → "2021-01-01"
	 */
	static convertSinceYearToDate(year: number): string {
		const nextYear = year + 1;
		return `${nextYear}-01-01`;
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

	/**
	 * Convert season string (e.g., "2020/21") to season start date (e.g., "2020-09-01")
	 * Seasons typically start on September 1st of the first year
	 */
	static convertSeasonToStartDate(season: string): string {
		// Handle formats like "2020/21" or "2020-21"
		const seasonMatch = season.match(/(\d{4})[\/\-](\d{2})/);
		if (seasonMatch) {
			const startYear = parseInt(seasonMatch[1], 10);
			// Season starts on September 1st of the first year
			return `${startYear}-09-01`;
		}
		
		// If format not recognized, try to extract year from the beginning
		const yearMatch = season.match(/^(\d{4})/);
		if (yearMatch) {
			const startYear = parseInt(yearMatch[1], 10);
			return `${startYear}-09-01`;
		}
		
		// Fallback: return as-is (shouldn't happen with valid season strings)
		return season;
	}
}
