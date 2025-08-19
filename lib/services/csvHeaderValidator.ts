import { CSVHeaderConfig, getCSVHeaderConfig } from "@/lib/config/csvHeaders";
import { DataSource } from "./dataService";
import { CSVHeaderValidationFailure } from "./emailService";

export interface CSVHeaderValidationResult {
	isValid: boolean;
	failures: CSVHeaderValidationFailure[];
	totalSources: number;
	validSources: number;
	failedSources: number;
}

export class CSVHeaderValidator {
	private static instance: CSVHeaderValidator;

	static getInstance(): CSVHeaderValidator {
		if (!CSVHeaderValidator.instance) {
			CSVHeaderValidator.instance = new CSVHeaderValidator();
		}
		return CSVHeaderValidator.instance;
	}

	/**
	 * Fetches only the headers from a CSV URL without downloading the full content
	 */
	private async fetchCSVHeaders(url: string): Promise<string[]> {
		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const csvText = await response.text();
			const lines = csvText.split("\n");

			if (lines.length === 0) {
				throw new Error("Empty CSV file");
			}

			// Parse the first line as headers
			const headerLine = lines[0].trim();
			if (!headerLine) {
				throw new Error("Empty header line");
			}

			// Split by comma and clean up quotes
			const headers = headerLine.split(",").map((header) => header.trim().replace(/^["']|["']$/g, ""));

			return headers;
		} catch (error) {
			console.error(`❌ Failed to fetch CSV headers from ${url}:`, error);
			throw error;
		}
	}

	/**
	 * Validates CSV headers for a single data source
	 */
	private validateCSVHeaders(sourceName: string, expectedHeaders: string[], actualHeaders: string[]): CSVHeaderValidationFailure | null {
		const missingHeaders = expectedHeaders.filter((header) => !actualHeaders.includes(header));
		const extraHeaders = actualHeaders.filter((header) => !expectedHeaders.includes(header));

		if (missingHeaders.length === 0 && extraHeaders.length === 0) {
			return null; // Headers match exactly
		}

		return {
			sourceName,
			expectedHeaders,
			actualHeaders,
			missingHeaders,
			extraHeaders,
			url: "N/A", // Will be filled in by caller
		};
	}

	/**
	 * Validates CSV headers for all data sources
	 */
	async validateAllCSVHeaders(dataSources: DataSource[]): Promise<CSVHeaderValidationResult> {
		console.log("🔍 Starting CSV header validation...");

		const failures: CSVHeaderValidationFailure[] = [];
		const totalSources = dataSources.length;
		let validSources = 0;
		let failedSources = 0;

		for (const source of dataSources) {
			try {
				console.log(`  📊 Validating headers for ${source.name}...`);

				const headerConfig = getCSVHeaderConfig(source.name);
				if (!headerConfig) {
					console.warn(`  ⚠️ No header configuration found for ${source.name}, skipping validation`);
					continue;
				}

				const actualHeaders = await this.fetchCSVHeaders(source.url);
				const failure = this.validateCSVHeaders(source.name, headerConfig.expectedHeaders, actualHeaders);

				if (failure) {
					failure.url = source.url;
					failures.push(failure);
					failedSources++;
					console.error(`  ❌ Header validation failed for ${source.name}`);
					console.error(`     Expected: ${headerConfig.expectedHeaders.join(", ")}`);
					console.error(`     Actual: ${actualHeaders.join(", ")}`);
					console.error(`     Missing: ${failure.missingHeaders.join(", ")}`);
					console.error(`     Extra: ${failure.extraHeaders.join(", ")}`);
				} else {
					validSources++;
					console.log(`  ✅ Headers valid for ${source.name}`);
				}

				// Small delay to avoid overwhelming the server
				await new Promise((resolve) => setTimeout(resolve, 100));
			} catch (error) {
				console.error(`  ❌ Failed to validate headers for ${source.name}:`, error);
				failedSources++;

				// Create a failure record for this source
				const headerConfig = getCSVHeaderConfig(source.name);
				if (headerConfig) {
					failures.push({
						sourceName: source.name,
						expectedHeaders: headerConfig.expectedHeaders,
						actualHeaders: [],
						missingHeaders: headerConfig.expectedHeaders,
						extraHeaders: [],
						url: source.url,
					});
				}
			}
		}

		const result: CSVHeaderValidationResult = {
			isValid: failures.length === 0,
			failures,
			totalSources,
			validSources,
			failedSources,
		};

		console.log(`\n📊 CSV Header Validation Complete:`);
		console.log(`  Total Sources: ${totalSources}`);
		console.log(`  Valid Sources: ${validSources}`);
		console.log(`  Failed Sources: ${failedSources}`);
		console.log(`  Overall Result: ${result.isValid ? "✅ PASSED" : "❌ FAILED"}`);

		return result;
	}

	/**
	 * Validates CSV headers for a single data source
	 */
	async validateSingleCSVHeaders(source: DataSource): Promise<CSVHeaderValidationFailure | null> {
		try {
			const headerConfig = getCSVHeaderConfig(source.name);
			if (!headerConfig) {
				throw new Error(`No header configuration found for ${source.name}`);
			}

			const actualHeaders = await this.fetchCSVHeaders(source.url);
			const failure = this.validateCSVHeaders(source.name, headerConfig.expectedHeaders, actualHeaders);

			if (failure) {
				failure.url = source.url;
			}

			return failure;
		} catch (error) {
			console.error(`Failed to validate headers for ${source.name}:`, error);
			throw error;
		}
	}
}

export const csvHeaderValidator = CSVHeaderValidator.getInstance();
