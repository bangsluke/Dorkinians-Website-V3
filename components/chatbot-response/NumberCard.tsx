"use client";

import { ChatbotResponse } from "@/lib/services/chatbotService";
import { statObject } from "@/config/config";
import { findMetricByAlias } from "@/lib/config/chatbotMetrics";
import Image from "next/image";

interface NumberCardProps {
	visualization: ChatbotResponse["visualization"];
	metricKey?: string; // Optional metric key from question analysis
}

export default function NumberCard({ visualization, metricKey: propMetricKey }: NumberCardProps) {
	if (!visualization) return null;

	// Extract metric key from visualization data
	const dataItem = Array.isArray(visualization.data) && visualization.data.length > 0
		? visualization.data[0]
		: visualization.data;

	const metricDisplayName = (dataItem as any)?.metric || (visualization.config as any)?.metric;
	const value = (dataItem as any)?.value ?? dataItem;

	// Helper function to extract base stat key from team-specific keys
	const getBaseStatKey = (key: string): string | null => {
		if (!key) return null;
		
		// Team-specific goals: 1sGoals, 2sGoals, etc. -> G
		if (/^\d+sGoals$/i.test(key)) {
			return "G";
		}
		
		// Team-specific appearances: 1sApps, 2sApps, etc. -> APP
		if (/^\d+sApps$/i.test(key)) {
			return "APP";
		}
		
		// Team-specific goals with ordinal: 1st XI Goals, 2nd XI Goals, etc. -> G
		if (/^\d+(?:st|nd|rd|th)\s+XI\s+Goals$/i.test(key)) {
			return "G";
		}
		
		// Team-specific appearances with ordinal: 1st XI Apps, 2nd XI Apps, etc. -> APP
		if (/^\d+(?:st|nd|rd|th)\s+XI\s+Apps$/i.test(key)) {
			return "APP";
		}
		
		return null;
	};

	// Find metric key: use prop if available, otherwise try to find by display name
	let metricKey = propMetricKey;
	
	// Map PENALTY_CONVERSION_RATE to PenConversionRate (statObject key)
	if (metricKey && metricKey.toUpperCase() === "PENALTY_CONVERSION_RATE") {
		metricKey = "PenConversionRate";
	}
	
	// If metricKey is team-specific, get the base stat key
	if (metricKey) {
		const baseKey = getBaseStatKey(metricKey);
		if (baseKey) {
			metricKey = baseKey;
		}
	}
	
	if (!metricKey && metricDisplayName) {
		// Try to find metric key by matching display name
		const metricConfig = findMetricByAlias(metricDisplayName);
		if (metricConfig) {
			metricKey = metricConfig.key;
			// Check if it's team-specific and get base key
			const baseKey = getBaseStatKey(metricKey);
			if (baseKey) {
				metricKey = baseKey;
			}
		} else {
			// Fallback: search statObject for matching wordedText or displayText
			for (const [key, stat] of Object.entries(statObject)) {
				if (
					stat.wordedText?.toLowerCase() === metricDisplayName.toLowerCase() ||
					stat.displayText?.toLowerCase() === metricDisplayName.toLowerCase() ||
					stat.statName?.toLowerCase() === metricDisplayName.toLowerCase()
				) {
					metricKey = key;
					break;
				}
			}
			// Special case: if display name is "Penalty Conversion Rate", map to PenConversionRate
			if (!metricKey && metricDisplayName && metricDisplayName.toLowerCase().includes("penalty conversion rate")) {
				metricKey = "PenConversionRate";
			}
		}
	}

	// Look up stat in statObject
	const stat = (metricKey && typeof metricKey === 'string' && metricKey.length > 0 && metricKey in statObject) 
		? statObject[metricKey as keyof typeof statObject] 
		: undefined;
	// Use iconName from dataItem if provided, otherwise fall back to statObject
	const iconName = (dataItem as any)?.iconName || stat?.iconName;
	// Use wordedText from data if provided (for custom labels like "Goals" vs "Open Play Goals")
	const wordedText = (dataItem as any)?.wordedText || stat?.wordedText || metricDisplayName || "statistic";

	// Format value based on stat format
	let formattedValue: string | number = value;
	if (stat && stat.statFormat === "Percentage") {
		// Format percentage with % sign and correct decimal places
		const decimalPlaces = stat.numberDecimalPlaces || 0;
		const numValue = typeof value === "number" ? value : Number(value);
		if (!isNaN(numValue)) {
			formattedValue = numValue.toFixed(decimalPlaces) + "%";
		}
	}

	// Build icon path
	const iconPath = iconName ? `/stat-icons/${iconName}.svg` : null;

	return (
		<div
			className='mt-4 p-4 rounded-lg flex items-center gap-4'
			style={{
				background: "linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))",
			}}>
			{/* Icon */}
			{iconPath && (
				<div className='flex-shrink-0'>
					<Image
						src={iconPath}
						alt={wordedText}
						width={40}
						height={40}
						className='object-contain'
					/>
				</div>
			)}

			{/* Value */}
			<div className='text-3xl font-bold text-yellow-300 flex-shrink-0'>
				{formattedValue}
			</div>

			{/* Summary text */}
			<div className='text-white text-sm md:text-base flex-grow'>
				{wordedText}
			</div>
		</div>
	);
}

