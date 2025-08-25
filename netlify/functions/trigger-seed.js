const path = require('path');
const fs = require('fs');

// Simple email service implementation for Netlify Functions
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

	async sendSeedingStartEmail(environment) {
		if (!this.transporter || !this.config) {
			console.log('Email service not configured, skipping start notification');
			return true;
		}

		try {
			const subject = `🔄 Database Seeding Started - ${environment}`;
			
			const htmlBody = this.generateSeedingStartEmail(environment);
			const textBody = this.generateSeedingStartEmailText(environment);

			const mailOptions = {
				from: this.config.from,
				to: this.config.to,
				subject: subject,
				html: htmlBody,
				text: textBody
			};

			const info = await this.transporter.sendMail(mailOptions);
			console.log('📧 Start notification sent successfully:', info.messageId);
			return true;
		} catch (error) {
			console.error('Failed to send start notification:', error.message);
			return false;
		}
	}

	async sendSeedingSummaryEmail(summary) {
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

	generateSeedingStartEmail(environment) {
		return `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
					.content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
					.info-box { background: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #007bff; }
					.footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #666; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>🔄 Database Seeding Started</h1>
						<p>Environment: ${environment.toUpperCase()}</p>
						<p>Timestamp: ${new Date().toLocaleString()}</p>
					</div>
					
					<div class="content">
						<h2>Seeding Process Initiated</h2>
						
						<div class="info-box">
							<h3>What's Happening:</h3>
							<ul>
								<li>✅ Database connection established</li>
								<li>🔄 Processing 10 data sources from Google Sheets</li>
								<li>🗑️ Clearing existing data and applying schema</li>
								<li>📊 Creating nodes and relationships</li>
								<li>📧 You'll receive another email when complete</li>
							</ul>
						</div>
						
						<div class="info-box">
							<h3>Expected Duration:</h3>
							<p>Based on current performance: <strong>~30 minutes</strong></p>
							<p>This process runs on Netlify's infrastructure and will continue even if you close this email.</p>
						</div>
						
						<div class="footer">
							<p>This is an automated notification from the Dorkinians Website V3 seeding system.</p>
							<p>Monitor progress via the admin panel or wait for completion email.</p>
						</div>
					</div>
				</div>
			</body>
			</html>
		`;
	}

	generateSeedingStartEmailText(environment) {
		return `
Database Seeding Started
Environment: ${environment.toUpperCase()}
Timestamp: ${new Date().toLocaleString()}

SEEDING PROCESS INITIATED:
✅ Database connection established
🔄 Processing 10 data sources from Google Sheets
🗑️ Clearing existing data and applying schema
📊 Creating nodes and relationships
📧 You'll receive another email when complete

EXPECTED DURATION: ~30 minutes

This process runs on Netlify's infrastructure and will continue even if you close this email.

Monitor progress via the admin panel or wait for completion email.

This is an automated notification from the Dorkinians Website V3 seeding system.
		`.trim();
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

${summary.errors && summary.errors.length > 0 ? `
ERRORS ENCOUNTERED:
${summary.errors.map(error => `- ${error}`).join('\n')}
` : ''}

This is an automated notification from the Dorkinians Website V3 seeding system.
For detailed error logs, check the seeding-errors.log file.
		`.trim();
	}
}

// Simple data seeder implementation for Netlify Functions
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

	async executeBatchQuery(query, paramsArray) {
		try {
			const batchSize = 100; // Process in batches of 100
			let totalProcessed = 0;
			
			for (let i = 0; i < paramsArray.length; i += batchSize) {
				const batch = paramsArray.slice(i, i + batchSize);
				await this.session.run(query, { params: batch });
				totalProcessed += batch.length;
				
				if (i % 1000 === 0) {
					console.log(`📊 Batch processed: ${totalProcessed}/${paramsArray.length} items`);
				}
			}
			
			return totalProcessed;
		} catch (error) {
			console.error('❌ Batch query failed:', error);
			throw error;
		}
	}

	async seedAllData() {
		try {
			console.log('🌱 Starting actual data seeding process...');
			
			// Import required modules
			const Papa = require('papaparse');
			const https = require('https');
			const http = require('http');
			
			// Data sources configuration - read from config file
			const dataSources = [
				{
					name: "TBL_SiteDetails",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=77050817&single=true&output=csv",
				},
				{
					name: "TBL_Players",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1796371215&single=true&output=csv",
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
			
			// Fetch all CSV data in parallel for better performance
			console.log('📥 Fetching all CSV data in parallel...');
			const csvDataPromises = dataSources.map(async (dataSource) => {
				try {
					const csvData = await this.fetchCSVData(dataSource.url);
					return { name: dataSource.name, data: csvData, success: true };
				} catch (error) {
					console.error(`❌ Failed to fetch ${dataSource.name}: ${error.message}`);
					return { name: dataSource.name, data: [], success: false, error: error.message };
				}
			});

			const csvResults = await Promise.all(csvDataPromises);
			console.log(`📊 CSV fetching completed: ${csvResults.filter(r => r.success).length}/${csvResults.length} successful`);

			// Process each data source
			for (const csvResult of csvResults) {
				if (!csvResult.success) {
					errors.push(`Failed to fetch ${csvResult.name}: ${csvResult.error}`);
					continue;
				}

				try {
					console.log(`📊 Processing: ${csvResult.name}`);
					
					if (csvResult.data.length === 0) {
						console.log(`ℹ️ No data found for ${csvResult.name}`);
						continue;
					}
					
					console.log(`📥 Processing ${csvResult.data.length} rows from ${csvResult.name}`);
					
					// Log sample data for debugging
					if (csvResult.data.length > 0) {
						console.log(`🔍 Sample data from ${csvResult.name}:`, JSON.stringify(csvResult.data[0], null, 2));
					}
					
					// Process the data based on source type
					const result = await this.processDataSource(csvResult.name, csvResult.data);
					totalNodesCreated += result.nodesCreated;
					totalRelationshipsCreated += result.relationshipsCreated;
					
					if (result.errors.length > 0) {
						errors.push(...result.errors);
					}
					
					console.log(`✅ ${csvResult.name}: ${result.nodesCreated} nodes, ${result.relationshipsCreated} relationships`);
				} catch (error) {
					const errorMsg = `Failed to process ${csvResult.name}: ${error.message}`;
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
				
				// Skip rows with missing essential data
				if (!row['Name'] || row['Name'].trim() === '') {
					console.log(`⚠️ Skipping player row with missing name: Name="${row['Name']}"`);
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
					id: `player_${row['Name'].replace(/\s+/g, '_')}`,
					name: row['Name'],
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
				
				// Skip rows with missing essential data
				if (!row['Date'] || !row['OPPOSITION'] || row['Date'].trim() === '' || row['OPPOSITION'].trim() === '') {
					console.log(`⚠️ Skipping fixture row with missing data: Date="${row['Date']}", Opposition="${row['OPPOSITION']}"`);
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
					id: `fixture_${row['Date'].replace(/\s+/g, '_')}_${row['OPPOSITION'].replace(/\s+/g, '_')}`,
					date: row['Date'],
					opposition: row['OPPOSITION'],
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
				// Skip rows with missing essential data
				if (!row['Player Name'] || row['Player Name'].trim() === '') {
					console.log(`⚠️ Skipping match detail row with missing player name: Player Name="${row['Player Name']}"`);
					continue;
				}
				
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
					id: `matchdetail_${row['Player Name'].replace(/\s+/g, '_')}_${row['Goals'] || '0'}_${row['Assists'] || '0'}`,
					playerName: row['Player Name'],
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
				// Skip rows with missing essential data
				if (!row['Title'] || row['Title'].trim() === '') {
					console.log(`⚠️ Skipping site detail row with missing title: Title="${row['Title']}"`);
					continue;
				}
				
				const query = `
					CREATE (sd:SiteDetail {
						id: $id,
						title: $title,
						value: $value,
						graphLabel: 'dorkiniansWebsite'
					})
				`;
				
				const params = {
					id: `sitedetail_${row['Title'].replace(/\s+/g, '_')}`,
					title: row['Title'],
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
				// Skip rows with missing essential data
				if (!row['Week'] || !row['Player Name'] || row['Week'].trim() === '' || row['Player Name'].trim() === '') {
					console.log(`⚠️ Skipping weekly TOTW row with missing data: Week="${row['Week']}", Player="${row['Player Name']}"`);
					continue;
				}
				
				const query = `
					CREATE (wt:WeeklyTOTW {
						id: $id,
						week: $week,
						playerName: $playerName,
						graphLabel: 'dorkiniansWebsite'
					})
				`;
				
				const params = {
					id: `weeklytotw_${row['Week']}_${row['Player Name'].replace(/\s+/g, '_')}`,
					week: row['Week'],
					playerName: row['Player Name']
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
				// Skip rows with missing essential data
				if (!row['Season'] || !row['Player Name'] || row['Season'].trim() === '' || row['Player Name'].trim() === '') {
					console.log(`⚠️ Skipping season TOTW row with missing data: Season="${row['Season']}", Player="${row['Player Name']}"`);
					continue;
				}
				
				const query = `
					CREATE (st:SeasonTOTW {
						id: $id,
						season: $season,
						playerName: $playerName,
						graphLabel: 'dorkiniansWebsite'
					})
				`;
				
				const params = {
					id: `seasontotw_${row['Season']}_${row['Player Name'].replace(/\s+/g, '_')}`,
					season: row['Season'],
					playerName: row['Player Name']
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
				// Skip rows with missing essential data
				if (!row['Month'] || !row['Player Name'] || row['Month'].trim() === '' || row['Player Name'].trim() === '') {
					console.log(`⚠️ Skipping player of the month row with missing data: Month="${row['Month']}", Player="${row['Player Name']}"`);
					continue;
				}
				
				const query = `
					CREATE (pm:PlayerOfTheMonth {
						id: $id,
						month: $month,
						playerName: $playerName,
						graphLabel: 'dorkiniansWebsite'
					})
				`;
				
				const params = {
					id: `playerofthemonth_${row['Month']}_${row['Player Name'].replace(/\s+/g, '_')}`,
					month: row['Month'],
					playerName: row['Player Name']
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
				// Skip rows with missing essential data
				if (!row['Season'] || !row['Type'] || !row['Player Name'] || 
					row['Season'].trim() === '' || row['Type'].trim() === '' || row['Player Name'].trim() === '') {
					console.log(`⚠️ Skipping captain/award row with missing data: Season="${row['Season']}", Type="${row['Type']}", Player="${row['Player Name']}"`);
					continue;
				}
				
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
					id: `captainaward_${row['Season']}_${row['Type']}_${row['Player Name'].replace(/\s+/g, '_')}`,
					season: row['Season'],
					type: row['Type'],
					playerName: row['Player Name']
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
				// Skip rows with missing essential data
				if (!row['Name'] || row['Name'].trim() === '') {
					console.log(`⚠️ Skipping opposition detail row with missing name: Name="${row['Name']}"`);
					continue;
				}
				
				const query = `
					CREATE (od:OppositionDetail {
						id: $id,
						name: $name,
						graphLabel: 'dorkiniansWebsite'
					})
				`;
				
				const params = {
					id: `opposition_${row['Name'].replace(/\s+/g, '_')}`,
					name: row['Name']
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
				// Skip rows with missing essential data
				if (!row['Description'] || row['Description'].trim() === '') {
					console.log(`⚠️ Skipping test data row with missing description: Description="${row['Description']}"`);
					continue;
				}
				
				const query = `
					CREATE (td:TestData {
						id: $id,
						description: $description,
						graphLabel: 'dorkiniansWebsite'
					})
				`;
				
				const params = {
					id: `testdata_${row['Description'].replace(/\s+/g, '_')}`,
					description: row['Description']
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

// Initialize services
const dataSeeder = new SimpleDataSeeder();
const emailService = new SimpleEmailService();

// Configure email service with environment variables
emailService.configure();

exports.handler = async (event, context) => {
	// Set CORS headers
	const headers = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
	};

	// Set up timeout handler for 30-minute limit
	const timeoutHandler = setTimeout(async () => {
		try {
			console.log('⏰ Function timeout reached (30 minutes)');
			await emailService.sendSeedingSummaryEmail({
				success: false,
				environment: event.queryStringParameters?.environment || 'production',
				nodesCreated: 0,
				relationshipsCreated: 0,
				errorCount: 1,
				errors: ['Function timeout: Seeding process exceeded 30 minutes'],
				duration: 0
			});
		} catch (emailError) {
			console.warn('Failed to send timeout email:', emailError);
		}
	}, 29 * 60 * 1000); // 29 minutes to ensure email is sent before function timeout

	// Handle preflight request
	if (event.httpMethod === 'OPTIONS') {
		return {
			statusCode: 200,
			headers,
			body: ''
		};
	}

	try {
		// Parse request
		const { environment = 'production', force = false } = event.queryStringParameters || {};
		
		// Validate environment
		if (!['development', 'production'].includes(environment)) {
			return {
				statusCode: 400,
				headers: { ...headers, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					error: 'Invalid environment. Use "development" or "production"'
				})
			};
		}

		console.log(`🚀 Triggering database seeding for environment: ${environment}`);

		// Send start notification
		try {
			await emailService.sendSeedingStartEmail(environment);
		} catch (emailError) {
			console.warn('Failed to send start notification:', emailError);
			// Don't fail the function if email fails
		}

		// Execute seeding directly
		const startTime = Date.now();
		const result = await executeSeedingDirectly(environment);
		const duration = Date.now() - startTime;

		// Send email notification
		try {
			await sendSeedingNotification(result, environment, duration);
		} catch (emailError) {
			console.warn('Failed to send email notification:', emailError);
			// Don't fail the function if email fails
		}

		// Clear timeout handler
		clearTimeout(timeoutHandler);

		// Return success response
		return {
			statusCode: 200,
			headers: { ...headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				success: true,
				message: 'Database seeding completed successfully',
				environment,
				timestamp: new Date().toISOString(),
				result: {
					...result,
					duration
				}
			})
		};

	} catch (error) {
		console.error('❌ Error during seeding:', error);

		// Clear timeout handler
		clearTimeout(timeoutHandler);

		// Send failure notification
		try {
			await emailService.sendSeedingSummaryEmail({
				success: false,
				environment: event.queryStringParameters?.environment || 'production',
				nodesCreated: 0,
				relationshipsCreated: 0,
				errorCount: 1,
				errors: [error.message],
				duration: 0
			});
		} catch (emailError) {
			console.warn('Failed to send failure email:', emailError);
		}

		return {
			statusCode: 500,
			headers: { ...headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				error: 'Failed to complete database seeding',
				message: error.message,
				timestamp: new Date().toISOString()
			})
		};
	}
};

async function executeSeedingDirectly(environment) {
	console.log(`📜 Starting direct seeding for environment: ${environment}`);
	
	// Set environment variables
	process.env.NODE_ENV = environment;
	
	try {
		// Initialize the data seeder service
		await dataSeeder.initialize();
		
		// Execute the seeding process
		const seedingResult = await dataSeeder.seedAllData();
		
		// Count errors from log file
		const errorCount = countErrorsFromLog();
		
		return {
			success: true,
			exitCode: 0,
			nodesCreated: seedingResult.nodesCreated || 0,
			relationshipsCreated: seedingResult.relationshipsCreated || 0,
			errorCount,
			errors: []
		};
		
	} catch (error) {
		console.error('Seeding failed:', error);
		return {
			success: false,
			exitCode: 1,
			nodesCreated: 0,
			relationshipsCreated: 0,
			errorCount: 1,
			errors: [error.message]
		};
	} finally {
		// Clean up connections
		try {
			await dataSeeder.cleanup();
		} catch (cleanupError) {
			console.warn('Cleanup failed:', cleanupError);
		}
	}
}

async function sendSeedingNotification(result, environment, duration) {
	const summary = {
		success: result.success,
		environment,
		nodesCreated: result.nodesCreated,
		relationshipsCreated: result.relationshipsCreated,
		errorCount: result.errorCount,
		errors: result.errors,
		duration
	};

	await emailService.sendSeedingSummaryEmail(summary);
}

function countErrorsFromLog() {
	try {
		const logPath = path.join(process.cwd(), 'logs', 'seeding-errors.log');
		
		if (!fs.existsSync(logPath)) {
			return 0;
		}

		const logContent = fs.readFileSync(logPath, 'utf8');
		const lines = logContent.split('\n');
		
		// Count lines that contain actual error details
		let errorCount = 0;
		for (const line of lines) {
			if (line.trim() && 
				!line.startsWith('===') && 
				!line.startsWith('[') && 
				!line.startsWith('Details:') &&
				!line.startsWith('}')) {
				errorCount++;
			}
		}
		
		return errorCount;
	} catch (error) {
		console.warn(`⚠️ Could not read error log: ${error}`);
		return 0;
	}
}
