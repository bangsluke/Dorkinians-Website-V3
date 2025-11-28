/**
 * Division Mapping Configuration
 * 
 * This file maps real division names from the league data to standardized division values
 * for the Season Progress chart. Update this mapping to align teams to realistic divisions.
 * 
 * Structure:
 * - Key: Actual division name (case-insensitive, partial matches supported)
 * - Value: Standardized division value (1 = top division, incrementing for lower divisions)
 * 
 * Division Hierarchy:
 * - 1: Premier / Top Division (displayed at top of Y-axis)
 * - 2, 3, 4...: Lower divisions (incrementing numbers, displayed lower on Y-axis)
 * 
 * Note: The Y-axis is inverted so value 1 appears at the top of the chart.
 */

export interface DivisionMapping {
	[key: string]: number;
}

/**
 * Division name mappings
 * These are the actual division names found in the league table data.
 * Update values to adjust the hierarchy (1 = top, higher numbers = lower divisions).
 */
export const divisionMapping: DivisionMapping = {
	// AFC League Structure (pre 2025/26)
	"premier": 1,
	"senior 1 south": 2,
	"senior 2 south": 3,
	"intermediate south": 4,
	"division 1 south": 5,
	"division 2 south": 6,
	"division 3 south": 7,
	"division 4 south": 8,
	"division 5 south": 9,
	"division 6 south": 10,
	"division 7 south": 11,
	"division 8 south": 12,

    // SAL League Structure (2025/26 onwards)
    "senior division 1": 1,
    "senior division 2": 2,
    "senior division 3": 3,
    "senior division 4": 4,
    "intermediate south 1": 5,
    "south division 2": 6,
    "south division 3": 7,
    "south division 4": 8,
    "south division 5": 9,
    "south division 6": 10,
    "south division 7": 11,
    "south division 8": 12,
    "south division 9": 13,
    "south division 10": 14,
    "south division 11": 15,
    "south division 12": 16,
    "south division 13": 17,
    "south division 14": 18,
    "south division 15": 19,
};

/**
 * Get division value from actual division name
 * Uses the mapping above with case-insensitive partial matching
 */
export function getDivisionValueFromMapping(division: string): number | null {
	if (!division || division.trim() === "") return null;
	
	const divisionLower = division.toLowerCase().trim();
	
	// Check for exact matches first
	if (divisionMapping[divisionLower]) {
		return divisionMapping[divisionLower];
	}
	
	// Check for partial matches (division name contains the key or vice versa)
	for (const [key, value] of Object.entries(divisionMapping)) {
		if (divisionLower.includes(key) || key.includes(divisionLower)) {
			return value;
		}
	}
	
	return null;
}

/**
 * Get standardized division name from value
 * Used for Y-axis labels when actual division names aren't available
 */
export function getStandardizedDivisionName(value: number): string {
	// Find the division name from the mapping
	for (const [name, val] of Object.entries(divisionMapping)) {
		if (val === value) {
			// Capitalize first letter of each word
			return name.split(' ').map(word => 
				word.charAt(0).toUpperCase() + word.slice(1)
			).join(' ');
		}
	}
	return `Division ${value}`;
}
