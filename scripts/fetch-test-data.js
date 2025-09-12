const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

async function fetchTestData() {
	try {
		// Compile TypeScript and run a simple script to fetch data
		const script = `
      const { fetchTestData } = require('./__tests__/utils/testUtils.js');
      fetchTestData().then(data => {
        console.log('PLAYERS_DATA_START');
        console.log(JSON.stringify(data, null, 2));
        console.log('PLAYERS_DATA_END');
      }).catch(err => {
        console.error('ERROR:', err.message);
      });
    `;

		// Write temporary script
		const tempScript = path.join(__dirname, "temp-fetch-data.js");
		fs.writeFileSync(tempScript, script);

		// Run the script
		const output = execSync(`node ${tempScript}`, {
			encoding: "utf8",
			cwd: process.cwd(),
		});

		// Clean up
		fs.unlinkSync(tempScript);

		// Extract JSON data
		const startMarker = "PLAYERS_DATA_START";
		const endMarker = "PLAYERS_DATA_END";
		const startIndex = output.indexOf(startMarker);
		const endIndex = output.indexOf(endMarker);

		if (startIndex !== -1 && endIndex !== -1) {
			const jsonData = output.substring(startIndex + startMarker.length, endIndex).trim();
			return JSON.parse(jsonData);
		} else {
			throw new Error("Could not extract player data from output");
		}
	} catch (error) {
		console.error("Error fetching test data:", error);
		return [];
	}
}

module.exports = { fetchTestData };
