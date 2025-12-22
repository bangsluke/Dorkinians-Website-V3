import { findMetricByAlias } from "../../config/chatbotMetrics";
import { statObject } from "../../../config/config";
import { loggingService } from "../loggingService";

export class FormattingUtils {
	/**
	 * Format values according to metric configuration
	 */
	static formatValueByMetric(metric: string, value: number | bigint | string | Record<string, unknown>): string {
		// Debug logging for percentage metrics
		if (
			metric.includes("%") ||
			metric.includes("HomeGames%Won") ||
			(value && typeof value === "object" && value.originalPercentage === 51.8)
		) {
			loggingService.log(
				`🔧 formatValueByMetric called with metric: "${metric}", value: ${JSON.stringify(value)}, type: ${typeof value}`,
				null,
				"log",
			);
		}

		// Handle BigInt values from Neo4j first
		if (typeof value === "bigint") {
			return value.toString();
		}

		// Handle Neo4j Integer objects (e.g., {low: 445, high: 0})
		if (value && typeof value === "object" && "low" in value && "high" in value) {
			const neo4jInt = value as { low: number; high: number };
			value = neo4jInt.low + neo4jInt.high * 4294967296; // Convert Neo4j Integer to number
		}

		// Handle string values (like position names) - but check if it's a number string first
		if (typeof value === "string") {
			// Check if it's already a percentage string (ends with %)
			if (value.endsWith("%")) {
				// For percentage strings, we need to preserve the original percentage value
				// and mark it as already processed to avoid double conversion
				const numericPart = parseFloat(value.replace("%", ""));
				if (!isNaN(numericPart)) {
					// Store the original percentage value and mark it as already processed
					value = {
						originalPercentage: numericPart,
						isAlreadyPercentage: true,
					};
					if (metric.includes("HomeGames%Won") || value.originalPercentage === 51.8) {
						loggingService.log(`🔧 Converting percentage string: "${value.originalPercentage}%" -> preserving as percentage value`, null, "log");
					}
				} else {
					// If we can't parse it, return as-is
					return value;
				}
			} else {
				// Check if it's a numeric string that needs formatting
				const numValue = parseFloat(value);
				if (!isNaN(numValue)) {
					// It's a numeric string, continue with formatting logic
					value = numValue;
				} else {
					// It's a non-numeric string, return as-is
					return value;
				}
			}
		}

		// Resolve metric alias to canonical key before looking up config
		const resolvedMetric = (findMetricByAlias(metric)?.key || metric) as keyof typeof statObject;
		// Find the metric config
		const metricConfig = statObject[resolvedMetric];

		// Debug logging for metric config lookup
		if (metric.includes("%")) {
			loggingService.log(`🔧 Looking up metric config for "${metric}":`, metricConfig, "log");
			loggingService.log(`🔧 Resolved metric: "${resolvedMetric}"`, null, "log");
			loggingService.log(
				`🔧 Available statObject keys:`,
				Object.keys(statObject).filter((key) => key.includes("%")),
				"log",
			);
			if (metricConfig) {
				loggingService.log(`🔧 Metric config numberDecimalPlaces:`, metricConfig.numberDecimalPlaces, "log");
			}
		}

		if (metricConfig && typeof metricConfig === "object") {
			// Handle percentage formatting
			if (metricConfig.statFormat === "Percentage") {
				const decimalPlaces = metricConfig.numberDecimalPlaces || 0;

				// Check if this is already a processed percentage value
				if (value && typeof value === "object" && "isAlreadyPercentage" in value && "originalPercentage" in value) {
					const percentageValue = value as { originalPercentage: number; isAlreadyPercentage: boolean };
					// Use the original percentage value and apply decimal places
					const result = percentageValue.originalPercentage.toFixed(decimalPlaces) + "%";
					if (metric.includes("%")) {
						loggingService.log(`🔧 Percentage formatting (already processed): ${percentageValue.originalPercentage}% -> ${result}`, null, "log");
						loggingService.log(`🔧 Final result: "${result}"`, null, "log");
					}
					return result;
				}

				// Check if value is already a percentage (>= 1) or a decimal (< 1)
				const percentageValue = Number(value) >= 1 ? Number(value) : Number(value) * 100;
				const result = percentageValue.toFixed(decimalPlaces) + "%";
				if (metric.includes("%")) {
					loggingService.log(`🔧 Percentage formatting: ${value} -> ${percentageValue} -> ${result}`, null, "log");
					loggingService.log(`🔧 Final result: "${result}"`, null, "log");
				}
				return result;
			}

			// Handle other numeric formatting
			if ("numberDecimalPlaces" in metricConfig) {
				const decimalPlaces = metricConfig.numberDecimalPlaces || 0;

				// Check if this is already a processed percentage value
				if (value && typeof value === "object" && "isAlreadyPercentage" in value && "originalPercentage" in value) {
					const percentageValue = value as { originalPercentage: number; isAlreadyPercentage: boolean };
					// Use the original percentage value and apply decimal places
					const result = percentageValue.originalPercentage.toFixed(decimalPlaces);
					if (metric.includes("%")) {
						loggingService.log(`🔧 Decimal formatting (already processed): ${percentageValue.originalPercentage} -> ${result}`, null, "log");
					}
					return result;
				}

				const result = Number(value).toFixed(decimalPlaces);
				if (metric.includes("%")) {
					loggingService.log(`🔧 Decimal formatting: ${value} -> ${result}`, null, "log");
				}
				return result;
			}
		}

		// Default to integer if no config found
		// Check if this is already a processed percentage value
		if (value && typeof value === "object" && "isAlreadyPercentage" in value && "originalPercentage" in value) {
			const percentageValue = value as { originalPercentage: number; isAlreadyPercentage: boolean };
			// Use the original percentage value
			const result = percentageValue.originalPercentage.toString();
			if (metric.includes("%")) {
				loggingService.log(`🔧 Default formatting (already processed): ${percentageValue.originalPercentage} -> ${result}`, null, "log");
			}
			return result;
		}

		const result = Math.round(Number(value)).toString();
		if (metric.includes("%")) {
			loggingService.log(`🔧 Default formatting (no config found): ${value} -> ${result}`, null, "log");
		}
		return result;
	}
}
