import Papa from "papaparse";
import fs from "fs";
import path from "path";

export interface CSVData {
	[key: string]: string | number;
}

// For header-based CSV parsing, data is an object with column names
export type CSVRow = CSVData;

export interface DataSource {
	name: string;
	url: string;
	type: string;
	maxRows?: number; // Optional property for reduced seeding mode
}

export class DataService {
	private static instance: DataService;
	private cache: Map<string, any> = new Map();
	private cacheStats = { hits: 0, misses: 0, size: 0 };

	static getInstance(): DataService {
		if (!DataService.instance) {
			DataService.instance = new DataService();
		}
		return DataService.instance;
	}

	async fetchCSVData(dataSource: DataSource, reducedMode: boolean = false, maxRows: number = 50): Promise<CSVRow[]> {
		const cacheKey = `${dataSource.name}-${reducedMode}-${maxRows}`;

		// Check cache first
		if (this.cache.has(cacheKey)) {
			this.cacheStats.hits++;
			return this.cache.get(cacheKey);
		}

		this.cacheStats.misses++;

		try {
			console.log(`📥 Fetching CSV data from: ${dataSource.url}`);
			if (reducedMode) {
				console.log(`📊 Reduced mode: Processing max ${maxRows} rows`);
			}

			let csvText: string;

			// Handle local file URLs
			if (dataSource.url.startsWith("file://")) {
				const filePath = dataSource.url.replace("file://", "");
				const fullPath = path.resolve(process.cwd(), filePath);
				console.log(`📁 Reading local file: ${fullPath}`);

				if (!fs.existsSync(fullPath)) {
					throw new Error(`Local file not found: ${fullPath}`);
				}

				csvText = fs.readFileSync(fullPath, "utf-8");
			} else {
				// Handle remote URLs
				const response = await fetch(dataSource.url);
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				csvText = await response.text();
			}

			const result = Papa.parse(csvText, {
				header: true,
				skipEmptyLines: true,
				transformHeader: (header) => header.trim(),
			});

			let rows = result.data as CSVRow[];

			// Apply row limit if in reduced mode
			if (reducedMode && maxRows > 0) {
				const originalCount = rows.length;
				rows = rows.slice(0, maxRows);
				console.log(`📊 Reduced from ${originalCount} to ${rows.length} rows for ${dataSource.name}`);
			}

			// Cache the result
			this.cache.set(cacheKey, rows);
			this.cacheStats.size = this.cache.size;

			console.log(`✅ Successfully fetched ${rows.length} rows from ${dataSource.name}`);
			return rows;
		} catch (error) {
			console.error(`❌ Error fetching CSV data from ${dataSource.url}:`, error);
			throw error;
		}
	}

	async fetchAllDataSources(dataSources: DataSource[]): Promise<Map<string, CSVRow[]>> {
		const results = new Map<string, CSVRow[]>();

		const promises = dataSources.map(async (source) => {
			try {
				const data = await this.fetchCSVData(source, false, 0); // No reduced mode for all data
				results.set(source.name, data);
			} catch (error) {
				console.error(`Failed to fetch ${source.name}:`, error);
				results.set(source.name, []);
			}
		});

		await Promise.all(promises);
		return results;
	}

	clearCache(): void {
		this.cache.clear();
		this.cacheStats = { hits: 0, misses: 0, size: 0 };
		console.log("🗑️ Data cache cleared");
	}

	getCacheStats(): { size: number; sources: string[] } {
		return {
			size: this.cacheStats.size,
			sources: Array.from(this.cache.keys()),
		};
	}
}

export const dataService = DataService.getInstance();
