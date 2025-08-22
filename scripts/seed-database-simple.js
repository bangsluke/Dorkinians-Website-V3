const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const fs = require("fs");

function countErrorsFromLog() {
	try {
		const logPath = path.join(__dirname, "..", "logs", "seeding-errors.log");
		if (!fs.existsSync(logPath)) {
			return 0;
		}

		const logContent = fs.readFileSync(logPath, "utf8");
		const lines = logContent.split("\n");
		
		// Count lines that contain actual error details (not timestamps or separators)
		let errorCount = 0;
		for (const line of lines) {
			if (line.trim() && 
				!line.startsWith("===") && 
				!line.startsWith("[") && 
				!line.startsWith("Details:") &&
				!line.startsWith("}")) {
				errorCount++;
			}
		}
		
		return errorCount;
	} catch (error) {
		console.warn(`⚠️ Could not read error log: ${error.message}`);
		return 0;
	}
}

// Simple data seeder implementation
class SimpleDataSeeder {
	constructor() {
		this.neo4jDriver = null;
		this.session = null;
	}

	async initialize() {
		try {
			// Import neo4j driver dynamically
			const neo4j = require('neo4j-driver');
			
			const uri = process.env.PROD_NEO4J_URI;
			const user = process.env.PROD_NEO4J_USER;
			const password = process.env.PROD_NEO4J_PASSWORD;

			if (!uri || !user || !password) {
				throw new Error('Missing Neo4j environment variables');
			}

			this.neo4jDriver = neo4j.driver(uri, neo4j.auth.basic(user, password));
			this.session = this.neo4jDriver.session();
			
			// Test connection
			await this.session.run('RETURN 1 as test');
			console.log('✅ Neo4j connection established');
			
		} catch (error) {
			console.error('❌ Failed to initialize Neo4j connection:', error);
			throw error;
		}
	}

	async cleanup() {
		try {
			if (this.session) {
				await this.session.close();
			}
			if (this.neo4jDriver) {
				await this.neo4jDriver.close();
			}
			console.log('✅ Neo4j connection closed');
		} catch (error) {
			console.warn('⚠️ Error during cleanup:', error);
		}
	}

	async seedAllData() {
		try {
			console.log('🌱 Starting actual data seeding process...');
			
			// Import required modules
			const Papa = require('papaparse');
			const https = require('https');
			const http = require('http');
			
			// Data sources configuration
			const dataSources = [
				{
					name: "TBL_SiteDetails",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=77050817&single=true&output=csv",
				},
				{
					name: "TBL_Players",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1796371215&single=true&output=csv",
				},
				{
					name: "TBL_FixturesAndResults",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=103750289&single=true&output=csv",
				},
				{
					name: "TBL_MatchDetails",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=564691931&single=true&output=csv",
				},
				{
					name: "TBL_WeeklyTOTW",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1985336995&single=true&output=csv",
				},
				{
					name: "TBL_SeasonTOTW",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=91372781&single=true&output=csv",
				},
				{
					name: "TBL_PlayersOfTheMonth",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=2007852556&single=true&output=csv",
				},
				{
					name: "TBL_CaptainsAndAwards",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1753413613&single=true&output=csv",
				},
				{
					name: "TBL_OppositionDetails",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1977394709&single=true&output=csv",
				},
				{
					name: "TBL_TestData",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=14183891&single=true&output=csv",
				}
			];
			
			let totalNodesCreated = 0;
			let totalRelationshipsCreated = 0;
			const errors = [];
			
			// Clear existing data and apply schema
			console.log('🗑️ Clearing existing graph data...');
			await this.clearGraphData();
			
			console.log('🏗️ Applying database schema...');
			await this.applySchema();
			
			// Process each data source
			for (const dataSource of dataSources) {
				try {
					console.log(`📊 Processing: ${dataSource.name}`);
					
					// Fetch CSV data
					const csvData = await this.fetchCSVData(dataSource.url);
					if (csvData.length === 0) {
						console.log(`ℹ️ No data found for ${dataSource.name}`);
						continue;
					}
					
					console.log(`📥 Fetched ${csvData.length} rows from ${dataSource.name}`);
					
					// Process the data based on source type
					const result = await this.processDataSource(dataSource.name, csvData);
					totalNodesCreated += result.nodesCreated;
					totalRelationshipsCreated += result.relationshipsCreated;
					
					if (result.errors.length > 0) {
						errors.push(...result.errors);
					}
					
					console.log(`✅ ${dataSource.name}: ${result.nodesCreated} nodes, ${result.relationshipsCreated} relationships`);
				} catch (error) {
					const errorMsg = `Failed to process ${dataSource.name}: ${error.message}`;
					console.error(`❌ ${errorMsg}`);
					errors.push(errorMsg);
				}
			}
			
			// Create relationships between nodes
			console.log('🔗 Creating relationships between nodes...');
			const relationshipResult = await this.createAllRelationships();
			totalRelationshipsCreated += relationshipResult;
			
			console.log(`🎉 Seeding completed! Created ${totalNodesCreated} nodes and ${totalRelationshipsCreated} relationships`);
			
			return {
				success: errors.length === 0,
				nodesCreated: totalNodesCreated,
				relationshipsCreated: totalRelationshipsCreated,
				errors: errors
			};
		} catch (error) {
			console.error('❌ Seeding failed:', error);
			return {
				success: false,
				nodesCreated: 0,
				relationshipsCreated: 0,
				errors: [error.message]
			};
		}
	}
	
	async fetchCSVData(url) {
		return new Promise((resolve, reject) => {
			const protocol = url.startsWith('https:') ? require('https') : require('http');
			
			protocol.get(url, (res) => {
				let data = '';
				
				res.on('data', (chunk) => {
					data += chunk;
				});
				
				res.on('end', () => {
					try {
						const Papa = require('papaparse');
						const result = Papa.parse(data, { header: true });
						resolve(result.data.filter(row => Object.values(row).some(val => val && val.trim() !== '')));
					} catch (error) {
						reject(new Error(`Failed to parse CSV: ${error.message}`));
					}
				});
			}).on('error', (error) => {
				reject(new Error(`Failed to fetch CSV: ${error.message}`));
			});
		});
	}
	
	async processDataSource(sourceName, csvData) {
		let nodesCreated = 0;
		let relationshipsCreated = 0;
		const errors = [];
		
		try {
			switch (sourceName) {
				case 'TBL_Players':
					nodesCreated = await this.createPlayerNodes(csvData);
					break;
				case 'TBL_FixturesAndResults':
					nodesCreated = await this.createFixtureNodes(csvData);
					break;
				case 'TBL_MatchDetails':
					nodesCreated = await this.createMatchDetailNodes(csvData);
					break;
				case 'TBL_SiteDetails':
					nodesCreated = await this.createSiteDetailNodes(csvData);
					break;
				case 'TBL_WeeklyTOTW':
					nodesCreated = await this.createWeeklyTOTWNodes(csvData);
					break;
				case 'TBL_SeasonTOTW':
					nodesCreated = await this.createSeasonTOTWNodes(csvData);
					break;
				case 'TBL_PlayersOfTheMonth':
					nodesCreated = await this.createPlayerOfTheMonthNodes(csvData);
					break;
				case 'TBL_CaptainsAndAwards':
					nodesCreated = await this.createCaptainAndAwardNodes(csvData);
					break;
				case 'TBL_OppositionDetails':
					nodesCreated = await this.createOppositionDetailNodes(csvData);
					break;
				case 'TBL_TestData':
					nodesCreated = await this.createTestDataNodes(csvData);
					break;
				default:
					console.log(`⚠️ Unknown data source: ${sourceName}`);
			}
		} catch (error) {
			errors.push(`Failed to process ${sourceName}: ${error.message}`);
		}
		
		return { nodesCreated, relationshipsCreated, errors };
	}
	
	async createPlayerNodes(csvData) {
		let nodesCreated = 0;
		
		for (const row of csvData) {
			try {
				// Skip players where "ALLOW ON SITE" is FALSE
				if (row['ALLOW ON SITE'] && row['ALLOW ON SITE'].toLowerCase() === 'false') {
					continue;
				}
				
				const query = `
					CREATE (p:Player {
						id: $id,
						name: $name,
						position: $position,
						graphLabel: 'dorkiniansWebsite'
					})
				`;
				
				const params = {
					id: `player_${row['ID'] || row['Name']}`,
					name: row['Name'] || 'Unknown',
					position: row['Position'] || 'Unknown'
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create player node for ${row['Name']}: ${error.message}`);
			}
		}
		
		return nodesCreated;
	}
	
	async createFixtureNodes(csvData) {
		let nodesCreated = 0;
		
		for (const row of csvData) {
			try {
				// Skip fixtures where "COMP TYPE" is "-" or "OPPOSITION" is "No Game"
				if (row['COMP TYPE'] === '-' || row['OPPOSITION'] === 'No Game') {
					continue;
				}
				
				const query = `
					CREATE (f:Fixture {
						id: $id,
						date: $date,
						opposition: $opposition,
						competition: $competition,
						graphLabel: 'dorkiniansWebsite'
					})
				`;
				
				const params = {
					id: `fixture_${row['ID'] || row['Date']}`,
					date: row['Date'] || 'Unknown',
					opposition: row['OPPOSITION'] || 'Unknown',
					competition: row['COMP TYPE'] || 'Unknown'
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create fixture node for ${row['Date']}: ${error.message}`);
			}
		}
		
		return nodesCreated;
	}
	
	async createMatchDetailNodes(csvData) {
		let nodesCreated = 0;
		
		for (const row of csvData) {
			try {
				const query = `
					CREATE (md:MatchDetail {
						id: $id,
						playerName: $playerName,
						goals: $goals,
						assists: $assists,
						graphLabel: 'dorkiniansWebsite'
					})
				`;
				
				const params = {
					id: `matchdetail_${row['ID'] || row['Player Name']}`,
					playerName: row['Player Name'] || 'Unknown',
					goals: row['Goals'] || '0',
					assists: row['Assists'] || '0'
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create match detail node for ${row['Player Name']}: ${error.message}`);
			}
		}
		
		return nodesCreated;
	}
	
	async createSiteDetailNodes(csvData) {
		let nodesCreated = 0;
		
		for (const row of csvData) {
			try {
				const query = `
					CREATE (sd:SiteDetail {
						id: $id,
						title: $title,
						value: $value,
						graphLabel: 'dorkiniansWebsite'
					})
				`;
				
				const params = {
					id: `sitedetail_${row['ID'] || row['Title']}`,
					title: row['Title'] || 'Unknown',
					value: row['Value'] || 'Unknown'
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create site detail node for ${row['Title']}: ${error.message}`);
			}
		}
		
		return nodesCreated;
	}
	
	async createWeeklyTOTWNodes(csvData) {
		let nodesCreated = 0;
		
		for (const row of csvData) {
			try {
				const query = `
					CREATE (wt:WeeklyTOTW {
						id: $id,
						week: $week,
						playerName: $playerName,
						graphLabel: 'dorkiniansWebsite'
					})
				`;
				
				const params = {
					id: `weeklytotw_${row['ID'] || row['Week']}`,
					week: row['Week'] || 'Unknown',
					playerName: row['Player Name'] || 'Unknown'
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create weekly TOTW node for ${row['Week']}: ${error.message}`);
			}
		}
		
		return nodesCreated;
	}
	
	async createSeasonTOTWNodes(csvData) {
		let nodesCreated = 0;
		
		for (const row of csvData) {
			try {
				const query = `
					CREATE (st:SeasonTOTW {
						id: $id,
						season: $season,
						playerName: $playerName,
						graphLabel: 'dorkiniansWebsite'
					})
				`;
				
				const params = {
					id: `seasontotw_${row['ID'] || row['Season']}`,
					season: row['Season'] || 'Unknown',
					playerName: row['Player Name'] || 'Unknown'
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create season TOTW node for ${row['Season']}: ${error.message}`);
			}
		}
		
		return nodesCreated;
	}
	
	async createPlayerOfTheMonthNodes(csvData) {
		let nodesCreated = 0;
		
		for (const row of csvData) {
			try {
				const query = `
					CREATE (pm:PlayerOfTheMonth {
						id: $id,
						month: $month,
						playerName: $playerName,
						graphLabel: 'dorkiniansWebsite'
					})
				`;
				
				const params = {
					id: `playerofthemonth_${row['ID'] || row['Month']}`,
					month: row['Month'] || 'Unknown',
					playerName: row['Player Name'] || 'Unknown'
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create player of the month node for ${row['Month']}: ${error.message}`);
			}
		}
		
		return nodesCreated;
	}
	
	async createCaptainAndAwardNodes(csvData) {
		let nodesCreated = 0;
		
		for (const row of csvData) {
			try {
				const query = `
					CREATE (ca:CaptainAndAward {
						id: $id,
						season: $season,
						type: $type,
						playerName: $playerName,
						graphLabel: 'dorkiniansWebsite'
					})
				`;
				
				const params = {
					id: `captainaward_${row['ID'] || row['Season']}`,
					season: row['Season'] || 'Unknown',
					type: row['Type'] || 'Unknown',
					playerName: row['Player Name'] || 'Unknown'
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create captain/award node for ${row['Season']}: ${error.message}`);
			}
		}
		
		return nodesCreated;
	}
	
	async createOppositionDetailNodes(csvData) {
		let nodesCreated = 0;
		
		for (const row of csvData) {
			try {
				const query = `
					CREATE (od:OppositionDetail {
						id: $id,
						name: $name,
						graphLabel: 'dorkiniansWebsite'
					})
				`;
				
				const params = {
					id: `opposition_${row['ID'] || row['Name']}`,
					name: row['Name'] || 'Unknown'
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create opposition detail node for ${row['Name']}: ${error.message}`);
			}
		}
		
		return nodesCreated;
	}
	
	async createTestDataNodes(csvData) {
		let nodesCreated = 0;
		
		for (const row of csvData) {
			try {
				const query = `
					CREATE (td:TestData {
						id: $id,
						description: $description,
						graphLabel: 'dorkiniansWebsite'
					})
				`;
				
				const params = {
					id: `testdata_${row['ID'] || row['Description']}`,
					description: row['Description'] || 'Unknown'
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create test data node for ${row['Description']}: ${error.message}`);
			}
		}
		
		return nodesCreated;
	}
	
	async clearGraphData() {
		try {
			const query = 'MATCH (n {graphLabel: "dorkiniansWebsite"}) DETACH DELETE n';
			await this.session.run(query);
			console.log('✅ Existing graph data cleared');
		} catch (error) {
			console.error('❌ Failed to clear graph data:', error.message);
		}
	}
	
	async applySchema() {
		try {
			// Create constraints and indexes
			const constraints = [
				'CREATE CONSTRAINT player_id IF NOT EXISTS FOR (p:Player) REQUIRE p.id IS UNIQUE',
				'CREATE CONSTRAINT fixture_id IF NOT EXISTS FOR (f:Fixture) REQUIRE f.id IS UNIQUE',
				'CREATE CONSTRAINT matchdetail_id IF NOT EXISTS FOR (md:MatchDetail) REQUIRE md.id IS UNIQUE'
			];
			
			for (const constraint of constraints) {
				try {
					await this.session.run(constraint);
				} catch (error) {
					// Constraint might already exist, continue
					console.log(`ℹ️ Constraint setup: ${error.message}`);
				}
			}
			
			console.log('✅ Database schema applied');
		} catch (error) {
			console.error('❌ Failed to apply schema:', error.message);
		}
	}
	
	async createAllRelationships() {
		let totalRelationships = 0;
		
		try {
			// Create relationships between players and match details
			const playerMatchQuery = `
				MATCH (p:Player {graphLabel: 'dorkiniansWebsite'})
				MATCH (md:MatchDetail {graphLabel: 'dorkiniansWebsite'})
				WHERE p.name = md.playerName OR 
					  p.name = LOWER(md.playerName) OR 
					  p.name = REPLACE(md.playerName, ' ', '-')
				CREATE (p)-[:PERFORMED_IN]->(md)
				RETURN count(*) as count
			`;
			
			const result = await this.session.run(playerMatchQuery);
			const count = result.records[0].get('count').toNumber();
			totalRelationships += count;
			console.log(`🔗 Created ${count} player-match relationships`);
			
			// Create relationships between fixtures and match details
			const fixtureMatchQuery = `
				MATCH (f:Fixture {graphLabel: 'dorkiniansWebsite'})
				MATCH (md:MatchDetail {graphLabel: 'dorkiniansWebsite'})
				WHERE f.id = md.fixtureId OR f.date = md.fixtureDate
				CREATE (f)-[:CONTAINS]->(md)
				RETURN count(*) as count
			`;
			
			const fixtureResult = await this.session.run(fixtureMatchQuery);
			const fixtureCount = fixtureResult.records[0].get('count').toNumber();
			totalRelationships += fixtureCount;
			console.log(`🔗 Created ${fixtureCount} fixture-match relationships`);
			
		} catch (error) {
			console.error('❌ Failed to create relationships:', error.message);
		}
		
		return totalRelationships;
	}
}

// Simple email service implementation
class SimpleEmailService {
	constructor() {
		this.config = null;
		this.transporter = null;
	}

	configure() {
		// Try to get email configuration from environment variables
		const emailConfig = {
			host: process.env.SMTP_SERVER,
			port: parseInt(process.env.SMTP_PORT) || 587,
			secure: process.env.SMTP_EMAIL_SECURE === 'true',
			auth: {
				user: process.env.SMTP_USERNAME,
				pass: process.env.SMTP_PASSWORD
			},
			from: process.env.SMTP_FROM_EMAIL,
			to: process.env.SMTP_TO_EMAIL
		};

		// Check if all required email config is present
		if (emailConfig.host && emailConfig.auth.user && emailConfig.auth.pass && emailConfig.from && emailConfig.to) {
			try {
				const nodemailer = require('nodemailer');
				this.transporter = nodemailer.createTransport({
					host: emailConfig.host,
					port: emailConfig.port,
					secure: emailConfig.secure,
					auth: emailConfig.auth,
					tls: {
						rejectUnauthorized: false,
						checkServerIdentity: () => undefined
					}
				});
				this.config = emailConfig;
				console.log('📧 Email service configured successfully');
			} catch (error) {
				console.warn('⚠️ Failed to configure email service:', error.message);
			}
		} else {
			console.log('ℹ️ Email service not configured - missing environment variables');
		}
	}

	async sendSeedingSummary(summary) {
		if (!this.transporter || !this.config) {
			console.log('Email service not configured, skipping email notification');
			return true;
		}

		try {
			const subject = `Database Seeding ${summary.success ? 'Success' : 'Failed'} - ${summary.environment}`;
			
			const htmlBody = this.generateSeedingSummaryEmail(summary);
			const textBody = this.generateSeedingSummaryEmailText(summary);

			const mailOptions = {
				from: this.config.from,
				to: this.config.to,
				subject: subject,
				html: htmlBody,
				text: textBody
			};

			const info = await this.transporter.sendMail(mailOptions);
			console.log('📧 Email sent successfully:', info.messageId);
			return true;
		} catch (error) {
			console.error('Failed to send email:', error.message);
			return false;
		}
	}

	generateSeedingSummaryEmail(summary) {
		const statusIcon = summary.success ? '✅' : '❌';
		const statusText = summary.success ? 'Success' : 'Failed';
		const statusColor = summary.success ? '#28a745' : '#dc3545';
		
		return `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background-color: ${statusColor}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
					.content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
					.summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
					.summary-item { background: white; padding: 15px; border-radius: 5px; text-align: center; }
					.summary-number { font-size: 24px; font-weight: bold; color: ${statusColor}; }
					.summary-label { font-size: 14px; color: #666; margin-top: 5px; }
					.error-list { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0; }
					.error-item { margin: 5px 0; padding: 5px; background: white; border-radius: 3px; }
					.footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #666; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>${statusIcon} Database Seeding ${statusText}</h1>
						<p>Environment: ${summary.environment.toUpperCase()}</p>
						<p>Timestamp: ${new Date(summary.timestamp).toLocaleString()}</p>
					</div>
					
					<div class="content">
						<h2>Seeding Summary</h2>
						
						<div class="summary-grid">
							<div class="summary-item">
								<div class="summary-number">${summary.nodesCreated}</div>
								<div class="summary-label">Nodes Created</div>
							</div>
							<div class="summary-item">
								<div class="summary-number">${summary.relationshipsCreated}</div>
								<div class="summary-label">Relationships Created</div>
							</div>
							<div class="summary-item">
								<div class="summary-number">${summary.errorCount}</div>
								<div class="summary-label">Errors in Log</div>
							</div>
							<div class="summary-item">
								<div class="summary-number">${Math.floor(summary.duration / 1000)}s</div>
								<div class="summary-label">Duration</div>
							</div>
						</div>
						
						${summary.errors && summary.errors.length > 0 ? `
							<div class="error-list">
								<h3>Errors Encountered:</h3>
								${summary.errors.map(error => `<div class="error-item">❌ ${error}</div>`).join('')}
							</div>
						` : ''}
						
						<div class="footer">
							<p>This is an automated notification from the Dorkinians Website V3 seeding system.</p>
							<p>For detailed error logs, check the seeding-errors.log file.</p>
						</div>
					</div>
				</div>
			</body>
			</html>
		`;
	}

	generateSeedingSummaryEmailText(summary) {
		const statusText = summary.success ? 'SUCCESS' : 'FAILED';
		
		return `
Database Seeding ${statusText}
Environment: ${summary.environment.toUpperCase()}
Timestamp: ${new Date(summary.timestamp).toLocaleString()}

SUMMARY:
- Nodes Created: ${summary.nodesCreated}
- Relationships Created: ${summary.relationshipsCreated}
- Errors in Log: ${summary.errorCount}
- Duration: ${Math.floor(summary.duration / 1000)} seconds

${summary.errors && summary.errors.length > 0 ? `
ERRORS ENCOUNTERED:
${summary.errors.map(error => `- ${error}`).join('\n')}
` : ''}

This is an automated notification from the Dorkinians Website V3 seeding system.
For detailed error logs, check the seeding-errors.log file.
		`.trim();
	}
}

// Main seeding function
async function seedDatabase() {
	// Get environment from command line argument or default to development
	const environment = process.argv[2] || "development";
	
	// Start timing
	const startTime = Date.now();

	console.log(`🚀 Starting Database Seeding...`);
	console.log(`📍 Environment: ${environment.toUpperCase()}`);
	console.log(`📊 Processing all data sources`);

	try {
		// Set NODE_ENV based on the environment parameter
		process.env.NODE_ENV = environment;

		// Check environment variables based on the target environment
		if (environment === "production") {
			console.log("📋 Production Environment Check:");
			console.log("  NODE_ENV:", process.env.NODE_ENV);
			console.log("  PROD_NEO4J_URI:", process.env.PROD_NEO4J_URI ? "✅ Set" : "❌ Missing");
			console.log("  PROD_NEO4J_USER:", process.env.PROD_NEO4J_USER ? "✅ Set" : "❌ Missing");
			console.log("  PROD_NEO4J_PASSWORD:", process.env.PROD_NEO4J_USER ? "✅ Set" : "❌ Missing");

			if (!process.env.PROD_NEO4J_URI || !process.env.PROD_NEO4J_USER || !process.env.PROD_NEO4J_PASSWORD) {
				throw new Error("Production Neo4j environment variables are not configured");
			}

			console.log("📍 Target: Neo4j Aura (Production)");
		} else {
			console.log("📋 Development Environment Check:");
			console.log("  NODE_ENV:", process.env.NODE_ENV);
			console.log("  DEV_NEO4J_URI:", process.env.DEV_NEO4J_URI ? "✅ Set" : "❌ Missing");
			console.log("  DEV_NEO4J_USER:", process.env.DEV_NEO4J_USER ? "✅ Set" : "❌ Missing");
			console.log("  DEV_NEO4J_PASSWORD:", process.env.DEV_NEO4J_PASSWORD ? "✅ Set" : "❌ Missing");

			if (!process.env.DEV_NEO4J_URI || !process.env.DEV_NEO4J_USER || !process.env.DEV_NEO4J_PASSWORD) {
				throw new Error("Development Neo4j environment variables are not configured");
			}

			console.log("📍 Target: Local Neo4j Desktop (Development)");
		}

		console.log("✅ Environment variables validated");

		console.log(`📊 Seeding 10 data sources...`);
		console.log(`  1. TBL_SiteDetails`);
		console.log(`  2. TBL_Players`);
		console.log(`  3. TBL_FixturesAndResults`);
		console.log(`  4. TBL_MatchDetails`);
		console.log(`  5. TBL_WeeklyTOTW`);
		console.log(`  6. TBL_SeasonTOTW`);
		console.log(`  7. TBL_PlayersOfTheMonth`);
		console.log(`  8. TBL_CaptainsAndAwards`);
		console.log(`  9. TBL_OppositionDetails`);
		console.log(`  10. TBL_TestData`);

		// Initialize the data seeder service
		console.log("\n🔧 Initializing DataSeederService...");
		const dataSeeder = new SimpleDataSeeder();

		try {
			// Initialize the service
			await dataSeeder.initialize();
			
			// Execute seeding
			console.log("🌱 Starting database seeding...");
			const result = await dataSeeder.seedAllData();
			
			if (result.success) {
				console.log("✅ Seeding completed successfully!");
				console.log(`🎉 Created ${result.nodesCreated} nodes and ${result.relationshipsCreated} relationships`);
				console.log(`📍 Database: ${environment === "production" ? "Neo4j Aura (Production)" : "Local Neo4j Desktop"}`);
				
				// Send email notification
				console.log("\n📧 Sending seeding summary email...");
				try {
					const emailService = new SimpleEmailService();
					emailService.configure(); // Configure nodemailer
					
					const errorCount = countErrorsFromLog();
					const duration = Math.floor((Date.now() - startTime) / 1000);
					
					const summary = {
						environment: environment,
						nodesCreated: result.nodesCreated,
						relationshipsCreated: result.relationshipsCreated,
						duration: duration,
						errorCount: errorCount,
						timestamp: new Date().toISOString(),
						success: true
					};
					
					await emailService.sendSeedingSummary(summary);
					console.log("✅ Seeding summary email sent successfully");
				} catch (emailError) {
					console.warn(`⚠️ Failed to send seeding summary email: ${emailError.message}`);
				}
			} else {
				console.log("⚠️ Seeding completed with errors:", result.errors);
				
				// Send email notification for seeding with errors
				console.log("\n📧 Sending seeding summary email...");
				try {
					const emailService = new SimpleEmailService();
					emailService.configure(); // Configure nodemailer
					
					const errorCount = countErrorsFromLog();
					const duration = Math.floor((Date.now() - startTime) / 1000);
					
					const summary = {
						environment: environment,
						nodesCreated: result.nodesCreated || 0,
						relationshipsCreated: result.relationshipsCreated || 0,
						duration: duration,
						errorCount: errorCount,
						timestamp: new Date().toISOString(),
						success: false,
						errors: result.errors
					};
					
					await emailService.sendSeedingSummary(summary);
					console.log("✅ Seeding summary email sent successfully");
				} catch (emailError) {
					console.warn(`⚠️ Failed to send seeding summary email: ${emailError.message}`);
				}
			}
		} catch (seedingError) {
			console.error("❌ Seeding failed:", seedingError.message);
			console.log("\n💡 Make sure:");
			console.log("1. Neo4j database is accessible");
			console.log("2. All environment variables are set correctly");
			console.log("3. Data source files are available");
			
			// Send email notification for complete seeding failure
			console.log("\n📧 Sending seeding summary email...");
			try {
				const emailService = new SimpleEmailService();
				emailService.configure(); // Configure nodemailer
				
				const errorCount = countErrorsFromLog();
				const duration = Math.floor((Date.now() - startTime) / 1000);
				
				const summary = {
					environment: environment,
					nodesCreated: 0,
					relationshipsCreated: 0,
					duration: duration,
					errorCount: errorCount,
					timestamp: new Date().toISOString(),
					success: false,
					errors: [seedingError.message]
				};
				
				await emailService.sendSeedingSummary(summary);
				console.log("✅ Seeding summary email sent successfully");
			} catch (emailError) {
				console.warn(`⚠️ Failed to send seeding summary email: ${emailError.message}`);
			}
		} finally {
			// Clean up connections
			try {
				await dataSeeder.cleanup();
			} catch (cleanupError) {
				console.warn("⚠️ Cleanup failed:", cleanupError.message);
			}
		}

		// Calculate and display timing
		const endTime = Date.now();
		const duration = endTime - startTime;
		const minutes = Math.floor(duration / 60000);
		const seconds = Math.floor((duration % 60000) / 1000);
		const milliseconds = duration % 1000;
		
		console.log(`\n⏱️  Seeding Duration: ${minutes > 0 ? minutes + 'm ' : ''}${seconds}s ${milliseconds}ms`);
		console.log(`✅ ${environment} seeding completed!`);
	} catch (error) {
		// Calculate timing even on error
		const endTime = Date.now();
		const duration = endTime - startTime;
		const minutes = Math.floor(duration / 60000);
		const seconds = Math.floor((duration % 60000) / 1000);
		const milliseconds = duration % 1000;
		
		console.log(`\n⏱️  Seeding Duration: ${minutes > 0 ? minutes + 'm ' : ''}${seconds}s ${milliseconds}ms`);
		console.error(`❌ ${environment} seeding failed:`, error.message);
		console.log("\n💡 Make sure:");
		console.log("1. Neo4j database is accessible");
		console.log("2. All environment variables are set correctly");
		console.log("3. Data source files are available");
		
		process.exit(1);
	}
}

// Run the seeding
seedDatabase();
