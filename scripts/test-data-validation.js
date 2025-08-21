const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// Use built-in http module for making requests
const http = require("http");
const https = require("https");

function makeRequest(url, options = {}) {
	return new Promise((resolve, reject) => {
		const urlObj = new URL(url);
		const isHttps = urlObj.protocol === "https:";
		const client = isHttps ? https : http;

		const requestOptions = {
			hostname: urlObj.hostname,
			port: urlObj.port,
			path: urlObj.pathname + urlObj.search,
			method: options.method || "GET",
			headers: options.headers || {},
		};

		if (options.body) {
			requestOptions.headers["Content-Type"] = "application/json";
			requestOptions.headers["Content-Length"] = Buffer.byteLength(options.body);
		}

		const req = client.request(requestOptions, (res) => {
			let data = "";
			res.on("data", (chunk) => {
				data += chunk;
			});
			res.on("end", () => {
				resolve({
					ok: res.statusCode >= 200 && res.statusCode < 300,
					status: res.statusCode,
					json: () => JSON.parse(data),
					text: () => data,
				});
			});
		});

		req.on("error", (error) => {
			reject(error);
		});

		if (options.body) {
			req.write(options.body);
		}

		req.end();
	});
}

// Test data validation function
async function testDataValidation() {
	console.log("🧪 Starting Data Validation Test...");
	console.log("📊 Testing TBL_TestData against Neo4j database and chatbot");
	
	const startTime = Date.now();
	
	try {
		// Step 1: Read TBL_TestData CSV
		console.log("\n📖 Step 1: Reading TBL_TestData CSV...");
		
		// Use local CSV file instead of Google Sheets URL
		const fs = require('fs');
		const csvPath = path.join(__dirname, '..', 'example-data', 'CSV-examples', 'TBL_TestData.csv');
		
		if (!fs.existsSync(csvPath)) {
			throw new Error(`CSV file not found: ${csvPath}`);
		}
		
		const csvData = fs.readFileSync(csvPath, 'utf8');
		const lines = csvData.trim().split('\n');
		const headers = lines[0].split(',');
		const testPlayers = lines.slice(1).map(line => {
			const values = line.split(',');
			const player = {};
			headers.forEach((header, index) => {
				player[header.trim()] = values[index]?.trim() || '';
			});
			return player;
		});
		
		console.log(`✅ Loaded ${testPlayers.length} test players from CSV`);
		
		// Step 2: Query Neo4j for each player's stats
		console.log("\n🔍 Step 2: Querying Neo4j database for player stats...");
		
		// First, check what's in the database
		console.log("  📊 Checking database contents...");
		try {
			const dbCheckQuery = `
				MATCH (n {graphLabel: 'dorkiniansWebsite'})
				RETURN labels(n)[0] as type, count(n) as count
				ORDER BY count DESC
			`;
			
			const dbCheckResponse = await makeRequest("http://localhost:3000/api/seed-data/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "query",
					query: dbCheckQuery
				})
			});
			
			if (dbCheckResponse.ok) {
				const result = await dbCheckResponse.json();
				console.log("  📊 Database contents:");
				result.data?.forEach(row => {
					console.log(`    ${row.type}: ${row.count} nodes`);
				});
			} else {
				console.log("  ⚠️ Could not check database contents");
			}
			
			// Check specific Player nodes
			console.log("  👥 Checking Player nodes...");
			const playerQuery = `
				MATCH (p:Player {graphLabel: 'dorkiniansWebsite'})
				RETURN p.name as name, p.id as id
				LIMIT 10
			`;
			
			const playerResponse = await makeRequest("http://localhost:3000/api/seed-data/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "query",
					query: playerQuery
				})
			});
			
			if (playerResponse.ok) {
				const playerResult = await playerResponse.json();
				console.log("  👥 Sample Player nodes:");
				playerResult.data?.forEach(row => {
					console.log(`    ${row.name} (ID: ${row.id})`);
				});
			} else {
				console.log("  ⚠️ Could not check Player nodes");
			}
			
			// Check if test players exist
			console.log("  🔍 Checking if test players exist...");
			const testPlayerNames = ['Luke Bangs', 'Oli Goddard', 'Jonny Sourris'];
			const testPlayerQuery = `
				MATCH (p:Player {graphLabel: 'dorkiniansWebsite'})
				WHERE p.name IN $playerNames
				RETURN p.name as name, p.id as id
			`;
			
			const testPlayerResponse = await makeRequest("http://localhost:3000/api/seed-data/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "query",
					query: testPlayerQuery,
					params: { playerNames: testPlayerNames }
				})
			});
			
			if (testPlayerResponse.ok) {
				const testPlayerResult = await testPlayerResponse.json();
				console.log("  🔍 Test players found:");
				testPlayerResult.data?.forEach(row => {
					console.log(`    ${row.name} (ID: ${row.id})`);
				});
				if (testPlayerResult.data?.length === 0) {
					console.log("    ⚠️ No test players found in database");
				}
			} else {
				console.log("  ⚠️ Could not check test players");
			}
			
			// Check MatchDetail nodes and relationships
			console.log("  📊 Checking MatchDetail nodes...");
			const matchDetailQuery = `
				MATCH (md:MatchDetail {graphLabel: 'dorkiniansWebsite'})
				RETURN count(md) as totalMatchDetails
			`;
			
			const matchDetailResponse = await makeRequest("http://localhost:3000/api/seed-data/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "query",
					query: matchDetailQuery
				})
			});
			
			if (matchDetailResponse.ok) {
				const matchDetailResult = await matchDetailResponse.json();
				console.log(`  📊 Total MatchDetail nodes: ${matchDetailResult.data?.[0]?.totalMatchDetails || 0}`);
			}
			
			// Check relationships for a test player
			console.log("  🔗 Checking relationships for Luke Bangs...");
			const relationshipQuery = `
				MATCH (p:Player {name: 'Luke Bangs', graphLabel: 'dorkiniansWebsite'})
				OPTIONAL MATCH (p)-[r]->(n)
				RETURN p.name as playerName, type(r) as relationshipType, labels(n)[0] as targetType, count(r) as relationshipCount
			`;
			
			const relationshipResponse = await makeRequest("http://localhost:3000/api/seed-data/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "query",
					query: relationshipQuery
				})
			});
			
			if (relationshipResponse.ok) {
				const relationshipResult = await relationshipResponse.json();
				console.log("  🔗 Relationships for Luke Bangs:");
				relationshipResult.data?.forEach(row => {
					console.log(`    ${row.relationshipType} -> ${row.targetType}: ${row.relationshipCount}`);
				});
			}
		} catch (error) {
			console.log("  ⚠️ Error checking database contents:", error.message);
		}
		
		const neo4jResults = [];
		
		for (const player of testPlayers) {
			const playerName = player['PLAYER NAME'] || player['Player Name'];
			if (!playerName) continue;
			
			try {
				// Query Neo4j for player stats - aggregate from MatchDetail nodes
				const neo4jQuery = `
					MATCH (p:Player {name: $playerName, graphLabel: 'dorkiniansWebsite'})
					MATCH (p)-[:PERFORMED_IN]->(md:MatchDetail {graphLabel: 'dorkiniansWebsite'})
					RETURN 
						p.name as playerName,
						count(md) as APP,
						coalesce(sum(md.min), 0) as MIN,
						coalesce(sum(md.mom), 0) as MOM,
						coalesce(sum(md.goals), 0) as G
				`;
				
				// Use the seeding API to execute the query (since we need Neo4j access)
				const queryResponse = await makeRequest("http://localhost:3000/api/seed-data/", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						action: "query",
						query: neo4jQuery,
						params: { playerName }
					})
				});
				
				if (queryResponse.ok) {
					const result = await queryResponse.json();
					neo4jResults.push({
						playerName,
						APP: result.data?.[0]?.APP || 0,
						MIN: result.data?.[0]?.MIN || 0,
						MOM: result.data?.[0]?.MOM || 0,
						G: result.data?.[0]?.G || 0
					});
				} else {
					console.warn(`⚠️ Failed to query Neo4j for ${playerName}`);
					neo4jResults.push({
						playerName,
						APP: 0, MIN: 0, MOM: 0, G: 0,
						error: "Query failed"
					});
				}
			} catch (error) {
				console.warn(`⚠️ Error querying ${playerName}:`, error.message);
				neo4jResults.push({
					playerName,
					APP: 0, MIN: 0, MOM: 0, G: 0,
					error: error.message
				});
			}
		}
		
		// Step 3: Test chatbot responses
		console.log("\n🤖 Step 3: Testing chatbot responses...");
		const chatbotResults = [];
		
		for (const player of testPlayers) {
			const playerName = player['PLAYER NAME'] || player['Player Name'];
			if (!playerName) continue;
			
			try {
				// Test chatbot for each stat
				const stats = ['APP', 'MIN', 'MOM', 'G'];
				const chatbotStats = {};
				
				for (const stat of stats) {
					const question = `What is ${playerName}'s total ${stat === 'APP' ? 'appearances' : stat === 'MIN' ? 'minutes played' : stat === 'MOM' ? 'man of the match awards' : 'goals'}?`;
					
					const chatbotResponse = await makeRequest("http://localhost:3000/api/chatbot/", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ question })
					});
					
					if (chatbotResponse.ok) {
						const result = await chatbotResponse.json();
						chatbotStats[stat] = result.answer;
					} else {
						chatbotStats[stat] = "API Error";
					}
				}
				
				chatbotResults.push({
					playerName,
					...chatbotStats
				});
			} catch (error) {
				console.warn(`⚠️ Error testing chatbot for ${playerName}:`, error.message);
				chatbotResults.push({
					playerName,
					APP: "Error", MIN: "Error", MOM: "Error", G: "Error"
				});
			}
		}
		
		// Step 4: Generate comparison report
		console.log("\n📊 Step 4: Generating validation report...");
		
		const report = [];
		let totalTests = 0;
		let passedTests = 0;
		
		for (let i = 0; i < testPlayers.length; i++) {
			const player = testPlayers[i];
			const playerName = player['PLAYER NAME'] || player['Player Name'];
			const neo4jResult = neo4jResults.find(r => r.playerName === playerName);
			const chatbotResult = chatbotResults.find(r => r.playerName === playerName);
			
			if (playerName && neo4jResult && chatbotResult) {
				console.log(`\n👤 PLAYER: ${playerName}`);
				console.log("─".repeat(50));
				
				// Test each stat individually
				const stats = [
					{ key: 'APP', label: 'Appearances', csvValue: player['APP'], neo4jValue: neo4jResult.APP, chatbotValue: chatbotResult.APP },
					{ key: 'MIN', label: 'Minutes', csvValue: player['MIN'], neo4jValue: neo4jResult.MIN, chatbotValue: chatbotResult.MIN },
					{ key: 'MOM', label: 'Man of Match', csvValue: player['MOM'], neo4jValue: neo4jResult.MOM, chatbotValue: chatbotResult.MOM },
					{ key: 'G', label: 'Goals', csvValue: player['G'], neo4jValue: neo4jResult.G, chatbotValue: chatbotResult.G }
				];
				
				stats.forEach(stat => {
					totalTests++;
					const csvValue = stat.csvValue || 'N/A';
					const neo4jValue = stat.neo4jValue || 0;
					const chatbotValue = stat.chatbotValue || 'N/A';
					const isMatch = (csvValue == neo4jValue);
					
					if (isMatch) passedTests++;
					
					console.log(`  ${stat.label}:`);
					console.log(`    CSV: ${csvValue}`);
					console.log(`    Neo4j: ${neo4jValue}`);
					console.log(`    Chatbot: ${chatbotValue}`);
					console.log(`    Match: ${isMatch ? '✅ PASS' : '❌ FAIL'}`);
				});
				
				report.push({
					playerName,
					stats: stats.map(stat => ({
						...stat,
						isMatch: (stat.csvValue == stat.neo4jValue)
					}))
				});
			}
		}
		
		// Display summary
		console.log("\n" + "=".repeat(60));
		console.log(`📈 VALIDATION SUMMARY: ${passedTests}/${totalTests} tests passed`);
		console.log(`📊 Success Rate: ${Math.round(passedTests/totalTests*100)}%`);
		console.log("=".repeat(60));
		
		// Calculate and display timing
		const endTime = Date.now();
		const duration = endTime - startTime;
		const minutes = Math.floor(duration / 60000);
		const seconds = Math.floor((duration % 60000) / 1000);
		const milliseconds = duration % 1000;
		
		console.log(`\n⏱️  Validation Duration: ${minutes > 0 ? minutes + 'm ' : ''}${seconds}s ${milliseconds}ms`);
		console.log("✅ Data validation test completed!");
		
		return {
			success: true,
			totalTests,
			passedTests,
			report,
			duration
		};
		
	} catch (error) {
		console.error("❌ Data validation test failed:", error.message);
		
		// Calculate timing even on error
		const endTime = Date.now();
		const duration = endTime - startTime;
		const minutes = Math.floor(duration / 60000);
		const seconds = Math.floor((duration % 60000) / 1000);
		const milliseconds = duration % 1000;
		
		console.log(`\n⏱️  Validation Duration: ${minutes > 0 ? minutes + 'm ' : ''}${seconds}s ${milliseconds}ms`);
		
		return {
			success: false,
			error: error.message,
			duration
		};
	}
}

// Run the validation test
if (require.main === module) {
	testDataValidation()
		.then(result => {
			if (result.success) {
				process.exit(0);
			} else {
				process.exit(1);
			}
		})
		.catch(error => {
			console.error("❌ Unhandled error:", error);
			process.exit(1);
		});
}

module.exports = { testDataValidation };
