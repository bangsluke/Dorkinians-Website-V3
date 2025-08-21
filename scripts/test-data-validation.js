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

// Helper function to extract numeric values from Neo4j results
function extractNeo4jValue(value) {
	if (value && typeof value === 'object' && value.low !== undefined) {
		return value.low; // Neo4j Integer object
	}
	return value || 0; // Direct value or fallback
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
					// Fix: Extract numeric values from Neo4j count results
					const count = extractNeo4jValue(row.count);
					console.log(`    ${row.type}: ${count} nodes`);
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
				// Fix: Extract numeric value from Neo4j count result
				const count = matchDetailResult.data?.[0]?.totalMatchDetails?.toNumber?.() || matchDetailResult.data?.[0]?.totalMatchDetails || 0;
				console.log(`  📊 Total MatchDetail nodes: ${count}`);
			}
			
			// Check relationships for a test player
			console.log("  🔗 Checking relationships for Luke Bangs...");
			const relationshipQuery = `
				MATCH (p:Player {name: 'Luke Bangs', graphLabel: 'dorkiniansWebsite'})
				OPTIONAL MATCH (p)-[r]->(n)
				RETURN p.name as playerName, type(r) as relationshipType, labels(n)[0] as targetType, count(r) as relationshipCount
			`;
			
			// Check MatchDetail properties for Luke Bangs
			console.log("  📊 Checking MatchDetail properties for Luke Bangs...");
			const matchDetailPropsQuery = `
				MATCH (p:Player {name: 'Luke Bangs', graphLabel: 'dorkiniansWebsite'})
				MATCH (p)-[:PERFORMED_IN]->(md:MatchDetail {graphLabel: 'dorkiniansWebsite'})
				RETURN md.min as min, md.mom as mom, md.goals as goals, keys(md) as allProperties
				LIMIT 5
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
					// Fix: Extract numeric value from Neo4j count result
					const count = extractNeo4jValue(row.relationshipCount);
					console.log(`    ${row.relationshipType} -> ${row.targetType}: ${count}`);
				});
			}
			
			// Execute MatchDetail properties query
			const matchDetailPropsResponse = await makeRequest("http://localhost:3000/api/seed-data/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "query",
					query: matchDetailPropsQuery
				})
			});
			
			if (matchDetailPropsResponse.ok) {
				const matchDetailPropsResult = await matchDetailPropsResponse.json();
				console.log("  📊 Sample MatchDetail properties:");
				matchDetailPropsResult.data?.forEach((row, index) => {
					console.log(`    Match ${index + 1}: min=${row.min}, mom=${row.mom}, goals=${row.goals}`);
					console.log(`    Properties: ${row.allProperties?.join(', ')}`);
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
				// Now including all metrics from the configuration
				const neo4jQuery = `
					MATCH (p:Player {name: $playerName, graphLabel: 'dorkiniansWebsite'})
					MATCH (p)-[:PERFORMED_IN]->(md:MatchDetail {graphLabel: 'dorkiniansWebsite'})
					RETURN 
						p.name as playerName,
						count(md) as APP,
						coalesce(sum(CASE WHEN md.minutes IS NULL OR md.minutes = '' THEN 0 ELSE md.minutes END), 0) as MIN,
						coalesce(sum(CASE WHEN md.manOfMatch IS NULL OR md.manOfMatch = '' THEN 0 ELSE md.manOfMatch END), 0) as MOM,
						coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = '' THEN 0 ELSE md.goals END), 0) as G,
						coalesce(sum(CASE WHEN md.assists IS NULL OR md.assists = '' THEN 0 ELSE md.assists END), 0) as A,
						coalesce(sum(CASE WHEN md.yellowCards IS NULL OR md.yellowCards = '' THEN 0 ELSE md.yellowCards END), 0) as Y,
						coalesce(sum(CASE WHEN md.redCards IS NULL OR md.redCards = '' THEN 0 ELSE md.redCards END), 0) as R,
						coalesce(sum(CASE WHEN md.saves IS NULL OR md.saves = '' THEN 0 ELSE md.saves END), 0) as SAVES,
						coalesce(sum(CASE WHEN md.ownGoals IS NULL OR md.ownGoals = '' THEN 0 ELSE md.ownGoals END), 0) as OG,
						coalesce(sum(CASE WHEN md.conceded IS NULL OR md.conceded = '' THEN 0 ELSE md.conceded END), 0) as C,
						coalesce(sum(CASE WHEN md.cleanSheet IS NULL OR md.cleanSheet = '' THEN 0 ELSE md.cleanSheet END), 0) as CLS,
						coalesce(sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = '' THEN 0 ELSE md.penaltiesScored END), 0) as PSC,
						coalesce(sum(CASE WHEN md.penaltiesMissed IS NULL OR md.penaltiesMissed = '' THEN 0 ELSE md.penaltiesMissed END), 0) as PM,
						coalesce(sum(CASE WHEN md.penaltiesConceded IS NULL OR md.penaltiesConceded = '' THEN 0 ELSE md.penaltiesConceded END), 0) as PCO,
						coalesce(sum(CASE WHEN md.penaltiesSaved IS NULL OR md.penaltiesSaved = '' THEN 0 ELSE md.penaltiesSaved END), 0) as PSV,
						coalesce(sum(CASE WHEN md.fantasyPoints IS NULL OR md.fantasyPoints = '' THEN 0 ELSE md.fantasyPoints END), 0) as FTP
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
					// Fix: Extract numeric values from Neo4j results
					const neo4jData = result.data?.[0];
					
					// Debug: Log raw Neo4j results
					console.log(`    🔍 Raw Neo4j data for ${playerName}:`, JSON.stringify(neo4jData, null, 2));
					
					neo4jResults.push({
						playerName,
						APP: extractNeo4jValue(neo4jData?.APP),
						MIN: extractNeo4jValue(neo4jData?.MIN),
						MOM: extractNeo4jValue(neo4jData?.MOM),
						G: extractNeo4jValue(neo4jData?.G),
						A: extractNeo4jValue(neo4jData?.A),
						Y: extractNeo4jValue(neo4jData?.Y),
						R: extractNeo4jValue(neo4jData?.R),
						SAVES: extractNeo4jValue(neo4jData?.SAVES),
						OG: extractNeo4jValue(neo4jData?.OG),
						C: extractNeo4jValue(neo4jData?.C),
						CLS: extractNeo4jValue(neo4jData?.CLS),
						PSC: extractNeo4jValue(neo4jData?.PSC),
						PM: extractNeo4jValue(neo4jData?.PM),
						PCO: extractNeo4jValue(neo4jData?.PCO),
						PSV: extractNeo4jValue(neo4jData?.PSV),
						FTP: extractNeo4jValue(neo4jData?.FTP)
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
				// Test chatbot for each stat - now including all metrics
				const stats = ['APP', 'MIN', 'MOM', 'G', 'A', 'Y', 'R', 'SAVES', 'OG', 'C', 'CLS', 'PSC', 'PM', 'PCO', 'PSV', 'FTP'];
				const chatbotStats = {};
				
				for (const stat of stats) {
					// Generate appropriate question text for each metric
					let questionText = '';
					switch (stat) {
						case 'APP': questionText = 'appearances'; break;
						case 'MIN': questionText = 'minutes played'; break;
						case 'MOM': questionText = 'man of the match awards'; break;
						case 'G': questionText = 'goals'; break;
						case 'A': questionText = 'assists'; break;
						case 'Y': questionText = 'yellow cards'; break;
						case 'R': questionText = 'red cards'; break;
						case 'SAVES': questionText = 'saves'; break;
						case 'OG': questionText = 'own goals'; break;
						case 'C': questionText = 'conceded goals'; break;
						case 'CLS': questionText = 'clean sheets'; break;
						case 'PSC': questionText = 'penalties scored'; break;
						case 'PM': questionText = 'penalties missed'; break;
						case 'PCO': questionText = 'penalties conceded'; break;
						case 'PSV': questionText = 'penalties saved'; break;
						case 'FTP': questionText = 'fantasy points'; break;
						default: questionText = stat.toLowerCase();
					}
					
					const question = `What is ${playerName}'s total ${questionText}?`;
					
					console.log(`    🤖 Asking: ${question}`);
					
					const chatbotResponse = await makeRequest("http://localhost:3000/api/chatbot/", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ question })
					});
					
					if (chatbotResponse.ok) {
						const result = await chatbotResponse.json();
						console.log(`    🤖 Answer: ${result.answer}`);
						chatbotStats[stat] = result.answer;
					} else {
						console.log(`    ❌ API Error: ${chatbotResponse.status}`);
						chatbotStats[stat] = "API Error";
					}
				}
				
				chatbotResults.push({
					playerName,
					APP: chatbotStats.APP || 'N/A',
					MIN: chatbotStats.MIN || 'N/A',
					MOM: chatbotStats.MOM || 'N/A',
					G: chatbotStats.G || 'N/A',
					A: chatbotStats.A || 'N/A',
					Y: chatbotStats.Y || 'N/A',
					R: chatbotStats.R || 'N/A',
					SAVES: chatbotStats.SAVES || 'N/A',
					OG: chatbotStats.OG || 'N/A',
					C: chatbotStats.C || 'N/A',
					CLS: chatbotStats.CLS || 'N/A',
					PSC: chatbotStats.PSC || 'N/A',
					PM: chatbotStats.PM || 'N/A',
					PCO: chatbotStats.PCO || 'N/A',
					PSV: chatbotStats.PSV || 'N/A',
					FTP: chatbotStats.FTP || 'N/A'
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
				
				// Test each stat individually - now including all metrics
				const stats = [
					{ key: 'APP', label: 'Appearances', csvValue: player['APP'], neo4jValue: neo4jResult.APP, chatbotValue: chatbotResult.APP },
					{ key: 'MIN', label: 'Minutes', csvValue: player['MIN'], neo4jValue: neo4jResult.MIN, chatbotValue: chatbotResult.MIN },
					{ key: 'MOM', label: 'Man of Match', csvValue: player['MOM'], neo4jValue: neo4jResult.MOM, chatbotValue: chatbotResult.MOM },
					{ key: 'G', label: 'Goals', csvValue: player['G'], neo4jValue: neo4jResult.G, chatbotValue: chatbotResult.G },
					{ key: 'A', label: 'Assists', csvValue: player['A'], neo4jValue: neo4jResult.A, chatbotValue: chatbotResult.A },
					{ key: 'Y', label: 'Yellow Cards', csvValue: player['Y'], neo4jValue: neo4jResult.Y, chatbotValue: chatbotResult.Y },
					{ key: 'R', label: 'Red Cards', csvValue: player['R'], neo4jValue: neo4jResult.R, chatbotValue: chatbotResult.R },
					{ key: 'SAVES', label: 'Saves', csvValue: player['SAVES'], neo4jValue: neo4jResult.SAVES, chatbotValue: chatbotResult.SAVES },
					{ key: 'OG', label: 'Own Goals', csvValue: player['OG'], neo4jValue: neo4jResult.OG, chatbotValue: chatbotResult.OG },
					{ key: 'C', label: 'Conceded', csvValue: player['C'], neo4jValue: neo4jResult.C, chatbotValue: chatbotResult.C },
					{ key: 'CLS', label: 'Clean Sheets', csvValue: player['CLS'], neo4jValue: neo4jResult.CLS, chatbotValue: chatbotResult.CLS },
					{ key: 'PSC', label: 'Penalties Scored', csvValue: player['PSC'], neo4jValue: neo4jResult.PSC, chatbotValue: chatbotResult.PSC },
					{ key: 'PM', label: 'Penalties Missed', csvValue: player['PM'], neo4jValue: neo4jResult.PM, chatbotValue: chatbotResult.PM },
					{ key: 'PCO', label: 'Penalties Conceded', csvValue: player['PCO'], neo4jValue: neo4jResult.PCO, chatbotValue: chatbotResult.PCO },
					{ key: 'PSV', label: 'Penalties Saved', csvValue: player['PSV'], neo4jValue: neo4jResult.PSV, chatbotValue: chatbotResult.PSV },
					{ key: 'FTP', label: 'Fantasy Points', csvValue: player['FTP'], neo4jValue: neo4jResult.FTP, chatbotValue: chatbotResult.FTP }
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
					console.log(`    Match: ${csvValue == neo4jValue ? '✅ PASS' : '❌ FAIL'}`);
					
					// Add chatbot answer analysis
					if (chatbotValue !== 'N/A' && chatbotValue !== 'API Error') {
						// Extract numeric value from chatbot answer if possible
						const chatbotNumericMatch = chatbotValue.match(/(\d+)/);
						if (chatbotNumericMatch) {
							const chatbotNumeric = parseInt(chatbotNumericMatch[1]);
							const chatbotMatch = (csvValue == chatbotNumeric);
							console.log(`    Chatbot Match: ${chatbotMatch ? '✅ PASS' : '❌ FAIL'} (${chatbotNumeric})`);
						}
					}
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
		
		// Calculate chatbot accuracy
		let chatbotPassedTests = 0;
		let chatbotTotalTests = 0;
		
		for (const player of testPlayers) {
			const playerName = player['PLAYER NAME'] || player['Player Name'];
			const chatbotResult = chatbotResults.find(r => r.playerName === playerName);
			
			if (chatbotResult) {
				const stats = ['APP', 'MIN', 'MOM', 'G', 'A', 'Y', 'R', 'SAVES', 'OG', 'C', 'CLS', 'PSC', 'PM', 'PCO', 'PSV', 'FTP'];
				stats.forEach(stat => {
					const csvValue = player[stat] || 'N/A';
					const chatbotValue = chatbotResult[stat] || 'N/A';
					
					if (csvValue !== 'N/A' && chatbotValue !== 'N/A' && chatbotValue !== 'API Error') {
						chatbotTotalTests++;
						const chatbotNumericMatch = chatbotValue.match(/(\d+)/);
						if (chatbotNumericMatch) {
							const chatbotNumeric = parseInt(chatbotNumericMatch[1]);
							if (csvValue == chatbotNumeric) {
								chatbotPassedTests++;
							}
						}
					}
				});
			}
		}
		
		// Display summary
		console.log("\n" + "=".repeat(60));
		console.log(`📈 VALIDATION SUMMARY: ${passedTests}/${totalTests} tests passed`);
		console.log(`📊 Success Rate: ${Math.round(passedTests/totalTests*100)}%`);
		console.log(`🤖 CHATBOT ACCURACY: ${chatbotPassedTests}/${chatbotTotalTests} tests passed`);
		console.log(`🤖 Chatbot Success Rate: ${Math.round(chatbotPassedTests/chatbotTotalTests*100)}%`);
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
