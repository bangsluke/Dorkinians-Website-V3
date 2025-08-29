// CommonJS version of CSV header validator for compatibility

class CSVHeaderValidator {
	static getInstance() {
		if (!CSVHeaderValidator.instance) {
			CSVHeaderValidator.instance = new CSVHeaderValidator();
		}
		return CSVHeaderValidator.instance;
	}

	async validateAllCSVHeaders(dataSources) {
		console.log("🔍 Starting CSV header validation...");

		const results = [];
		let validSources = 0;
		let failedSources = 0;

		for (const dataSource of dataSources) {
			try {
				const isValid = await this.validateCSVHeaders(dataSource);
				if (isValid) {
					validSources++;
					console.log(`✅ ${dataSource.name}: Headers valid`);
				} else {
					failedSources++;
					console.log(`❌ ${dataSource.name}: Headers invalid`);
				}
			} catch (error) {
				failedSources++;
				console.error(`❌ ${dataSource.name}: Validation error:`, error);
				results.push({
					sourceName: dataSource.name,
					url: dataSource.url,
					expectedHeaders: [],
					actualHeaders: [],
					missingHeaders: [],
					extraHeaders: [],
				});
			}
		}

		const totalSources = dataSources.length;
		const isValid = failedSources === 0;

		console.log(`📊 Header validation complete: ${validSources}/${totalSources} sources valid`);

		return {
			isValid,
			totalSources,
			validSources,
			failedSources,
			failures: results,
		};
	}

	async validateCSVHeaders(dataSource) {
		try {
			const response = await fetch(dataSource.url);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const csvText = await response.text();
			const lines = csvText.split("\n");
			if (lines.length === 0) {
				throw new Error("Empty CSV file");
			}

			const headerLine = lines[0].trim();
			const actualHeaders = headerLine.split(",").map((h) => h.trim());

			// Define expected headers for each data source based on new structure
			const expectedHeaders = this.getExpectedHeaders(dataSource.name);
			if (!expectedHeaders) {
				console.warn(`⚠️ No header validation defined for ${dataSource.name}`);
				return true; // Skip validation for unknown sources
			}

			const missingHeaders = expectedHeaders.filter((h) => !actualHeaders.includes(h));
			const extraHeaders = actualHeaders.filter((h) => !expectedHeaders.includes(h));

			if (missingHeaders.length > 0 || extraHeaders.length > 0) {
				console.error(`❌ ${dataSource.name} header validation failed:`);
				if (missingHeaders.length > 0) {
					console.error(`  Missing: ${missingHeaders.join(", ")}`);
				}
				if (extraHeaders.length > 0) {
					console.error(`  Extra: ${extraHeaders.join(", ")}`);
				}
				console.error(`  Expected: ${expectedHeaders.join(", ")}`);
				console.error(`  Actual: ${actualHeaders.join(", ")}`);
				return false;
			}

			return true;
		} catch (error) {
			console.error(`❌ Error validating headers for ${dataSource.name}:`, error);
			return false;
		}
	}

	getExpectedHeaders(sourceName) {
		// Define expected headers for each data source based on new structure
		switch (sourceName) {
			case "TBL_Players":
				return ["ID", "PLAYER NAME", "ALLOW ON SITE", "MOST PLAYED FOR TEAM", "MOST COMMON POSITION"];

			case "TBL_FixturesAndResults":
				return [
					"ID",
					"SEASON",
					"DATE",
					"TEAM",
					"COMP TYPE",
					"COMPETITION",
					"OPPOSITION",
					"HOME/AWAY",
					"RESULT",
					"HOME SCORE",
					"AWAY SCORE",
					"STATUS",
					"OPPO OWN GOALS",
					"FULL RESULT",
					"DORKINIANS GOALS",
					"CONCEDED",
					"EXTRACTED PICKER",
				];

			case "TBL_MatchDetails":
				return [
					"ID",
					"SEASON",
					"DATE",
					"TEAM",
					"PLAYER NAME",
					"MIN",
					"CLASS",
					"MOM",
					"G",
					"A",
					"Y",
					"R",
					"SAVES",
					"OG",
					"PSC",
					"PM",
					"PCO",
					"PSV",
					"IMPORTED_FIXTURE_DETAIL",
				];

			case "TBL_WeeklyTOTW":
				return [
					"ID",
					"SEASON",
					"WEEK",
					"TOTW SCORE",
					"PLAYER COUNT",
					"STAR MAN",
					"STAR MAN SCORE",
					"GK1",
					"DEF1",
					"DEF2",
					"DEF3",
					"DEF4",
					"DEF5",
					"MID1",
					"MID2",
					"MID3",
					"MID4",
					"MID5",
					"FWD1",
					"FWD2",
					"FWD3",
				];

			case "TBL_SeasonTOTW":
				return [
					"ID",
					"SEASON",
					"TOTW SCORE",
					"STAR MAN",
					"STAR MAN SCORE",
					"GK1",
					"DEF1",
					"DEF2",
					"DEF3",
					"DEF4",
					"DEF5",
					"MID1",
					"MID2",
					"MID3",
					"MID4",
					"MID5",
					"FWD1",
					"FWD2",
					"FWD3",
				];

			case "TBL_PlayersOfTheMonth":
				return [
					"ID",
					"SEASON",
					"DATE",
					"#1 Name",
					"#1 Points",
					"#2 Name",
					"#2 Points",
					"#3 Name",
					"#3 Points",
					"#4 Name",
					"#4 Points",
					"#5 Name",
					"#5 Points",
				];

			case "TBL_OppositionDetails":
				return ["ID", "OPPOSITION", "SHORT TEAM NAME", "ADDRESS", "DISTANCE (MILES)"];

			default:
				return null; // Unknown source, skip validation
		}
	}
}

const csvHeaderValidator = CSVHeaderValidator.getInstance();

module.exports = {
	CSVHeaderValidator,
	csvHeaderValidator,
};
