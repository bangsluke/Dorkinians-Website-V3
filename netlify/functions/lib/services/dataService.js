const Papa = require("papaparse");
const fs = require("fs");
const path = require("path");

class DataService {
	constructor() {
		this.cache = new Map();
		this.cacheStats = { hits: 0, misses: 0, size: 0 };
	}

	static getInstance() {
		if (!DataService.instance) {
			DataService.instance = new DataService();
		}
		return DataService.instance;
	}

	async fetchCSVData(dataSource, reducedMode = false, maxRows = 50) {
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

			let csvText;

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

			let rows = result.data;

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

	async fetchAllDataSources(dataSources) {
		const results = new Map();

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

	clearCache() {
		this.cache.clear();
		this.cacheStats = { hits: 0, misses: 0, size: 0 };
		console.log("🗑️ Data cache cleared");
	}

	getCacheStats() {
		return {
			size: this.cacheStats.size,
			sources: Array.from(this.cache.keys()),
		};
	}
}

const dataService = DataService.getInstance();

module.exports = {
	DataService,
	dataService,
};
