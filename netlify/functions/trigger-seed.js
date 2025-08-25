const path = require('path');
const fs = require('fs');

// Import CSV header configuration
const { getCSVHeaderConfig } = require('../../lib/config/csvHeaders');

// Helper functions for dynamic column mapping
function getColumnValue(row, columnName, fallback = '') {
    return row[columnName] || fallback;
}

function validateRequiredColumns(row, requiredColumns, sourceName) {
    for (const column of requiredColumns) {
        if (!row[column] || row[column].trim() === '') {
            console.log(`⚠️ Skipping ${sourceName} row with missing ${column}: ${column}="${row[column]}"`);
            return false;
        }
    }
    return true;
}

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
			console.log('🌱 SEEDER: Starting actual data seeding process...');
			console.log('⏰ SEEDER: Process start time:', new Date().toISOString());
			
			// Import required modules
			console.log('📦 SEEDER: Importing required modules...');
			const Papa = require('papaparse');
			const https = require('https');
			const http = require('http');
			console.log('✅ SEEDER: Modules imported successfully');
			
			// Data sources configuration - read from config file
			console.log('📋 SEEDER: Setting up data sources...');
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
			console.log('✅ SEEDER: Data sources configured:', dataSources.length, 'sources');
			
			let totalNodesCreated = 0;
			let totalRelationshipsCreated = 0;
			const errors = [];
			
			// Clear existing data and apply schema
			console.log('🗑️ SEEDER: Clearing existing graph data...');
			await this.clearGraphData();
			console.log('✅ SEEDER: Graph data cleared');
			
			console.log('🏗️ SEEDER: Applying database schema...');
			await this.applySchema();
			console.log('✅ SEEDER: Schema applied');
			
			// Fetch all CSV data in parallel for better performance
			console.log('📥 SEEDER: Fetching all CSV data in parallel...');
			const csvDataPromises = dataSources.map(async (dataSource) => {
				console.log(`📥 SEEDER: Starting fetch for ${dataSource.name}...`);
				try {
					const csvData = await this.fetchCSVData(dataSource.url);
					console.log(`✅ SEEDER: ${dataSource.name} fetched successfully, ${csvData.length} rows`);
					return { name: dataSource.name, data: csvData, success: true };
				} catch (error) {
					console.error(`❌ SEEDER: Failed to fetch ${dataSource.name}: ${error.message}`);
					return { name: dataSource.name, data: [], success: false, error: error.message };
				}
			});

			console.log('⏳ SEEDER: Waiting for all CSV fetches to complete...');
			const csvResults = await Promise.all(csvDataPromises);
			const successfulSources = csvResults.filter(r => r.success);
			const failedSources = csvResults.filter(r => !r.success);
			
			console.log(`📊 SEEDER: CSV fetching completed: ${successfulSources.length}/${csvResults.length} successful`);
			
			if (failedSources.length > 0) {
				console.error(`❌ SEEDER: Failed data sources:`);
				failedSources.forEach(source => {
					console.error(`   - ${source.name}: ${source.error}`);
				});
			}
			
			if (successfulSources.length === 0) {
				throw new Error('All data sources failed to fetch. Check Google Sheets permissions and URLs.');
			}

			// Process each data source
			console.log('🔄 SEEDER: Starting data source processing...');
			for (const csvResult of csvResults) {
				if (!csvResult.success) {
					const errorMsg = `Failed to fetch ${csvResult.name}: ${csvResult.error}`;
					console.error(`❌ SEEDER: ${errorMsg}`);
					errors.push(errorMsg);
					continue;
				}

				try {
					console.log(`📊 SEEDER: Processing: ${csvResult.name}`);
					
					if (csvResult.data.length === 0) {
						console.log(`ℹ️ SEEDER: No data found for ${csvResult.name}`);
						continue;
					}
					
					console.log(`📥 SEEDER: Processing ${csvResult.data.length} rows from ${csvResult.name}`);
					
					// Log sample data for debugging
					if (csvResult.data.length > 0) {
						console.log(`🔍 SEEDER: Sample data from ${csvResult.name}:`, JSON.stringify(csvResult.data[0], null, 2));
						console.log(`🔍 SEEDER: Total rows in ${csvResult.name}: ${csvResult.data.length}`);
						console.log(`🔍 SEEDER: Column headers in ${csvResult.name}:`, Object.keys(csvResult.data[0] || {}));
					} else {
						console.log(`⚠️ SEEDER: No data rows found in ${csvResult.name}`);
					}
					
					// Process the data based on source type
					console.log(`⚙️ SEEDER: Calling processDataSource for ${csvResult.name}...`);
					const result = await this.processDataSource(csvResult.name, csvResult.data);
					totalNodesCreated += result.nodesCreated;
					totalRelationshipsCreated += result.relationshipsCreated;
					
					if (result.errors.length > 0) {
						errors.push(...result.errors);
					}
					
					console.log(`✅ SEEDER: ${csvResult.name}: ${result.nodesCreated} nodes, ${result.relationshipsCreated} relationships`);
				} catch (error) {
					const errorMsg = `Failed to process ${csvResult.name}: ${error.message}`;
					console.error(`❌ SEEDER: ${errorMsg}`);
					errors.push(errorMsg);
				}
			}
			
			// Create relationships between nodes
			console.log('🔗 SEEDER: Creating relationships between nodes...');
			const relationshipResult = await this.createAllRelationships();
			totalRelationshipsCreated += relationshipResult;
			
			console.log(`🎉 SEEDER: Seeding completed! Created ${totalNodesCreated} nodes and ${totalRelationshipsCreated} relationships`);
			console.log('⏰ SEEDER: Process end time:', new Date().toISOString());
			
			return {
				success: errors.length === 0,
				nodesCreated: totalNodesCreated,
				relationshipsCreated: totalRelationshipsCreated,
				errors: errors
			};
		} catch (error) {
			console.error('❌ SEEDER: Seeding failed:', error);
			console.error('❌ SEEDER: Stack trace:', error.stack);
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
			
			const fetchWithRedirect = (fetchUrl, isRedirect = false) => {
				const options = {
					headers: {
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
						'Accept': 'text/csv,text/plain,*/*',
						'Accept-Language': 'en-US,en;q=0.9',
						'Cache-Control': 'no-cache'
					}
				};
				
				protocol.get(fetchUrl, options, (res) => {
					console.log(`📊 ${isRedirect ? 'Redirect' : 'Initial'} response from ${fetchUrl}: ${res.statusCode}`);
					
					// Handle redirects (Google Sheets now uses 307 redirects)
					if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
						const location = res.headers.location;
						if (location) {
							console.log(`🔄 Following redirect to: ${location}`);
							// Follow the redirect
							fetchWithRedirect(location, true);
							return;
						} else {
							reject(new Error(`Redirect response (${res.statusCode}) but no location header`));
							return;
						}
					}
					
					// Check if response is actually CSV
					const contentType = res.headers['content-type'] || '';
					if (!contentType.includes('text/csv') && !contentType.includes('text/plain')) {
						console.warn(`⚠️ Warning: ${fetchUrl} returned content-type: ${contentType}`);
					}
					
					let data = '';
					
					res.on('data', (chunk) => {
						data += chunk;
					});
					
					res.on('end', () => {
						console.log(`🔍 Raw data received from ${fetchUrl}:`);
						console.log(`   - Data length: ${data.length} characters`);
						console.log(`   - First 500 chars: ${data.substring(0, 500)}`);
						console.log(`   - Last 200 chars: ${data.substring(Math.max(0, data.length - 200))}`);
						
						// Check if data looks like HTML (common error case)
						if (data.includes('<html') || data.includes('<HTML') || data.includes('<!DOCTYPE')) {
							console.error(`❌ ${fetchUrl} returned HTML instead of CSV. This usually means:`);
							console.error(`   - The Google Sheet is no longer publicly accessible`);
							console.error(`   - The URL has expired or changed`);
							console.error(`   - Authentication is now required`);
							console.error(`   - Sample HTML content: ${data.substring(0, 200)}...`);
							reject(new Error(`URL returned HTML instead of CSV. Check sheet permissions and URL validity.`));
							return;
						}
						
						// Check if data looks like CSV
						if (!data.includes(',') || data.split('\n').length < 2) {
							console.error(`❌ ${fetchUrl} returned invalid CSV data. Content preview: ${data.substring(0, 200)}...`);
							reject(new Error(`Invalid CSV data received. Expected comma-separated values.`));
							return;
						}
						
						// Log raw CSV structure
						const lines = data.split('\n');
						console.log(`🔍 CSV structure analysis:`);
						console.log(`   - Total lines: ${lines.length}`);
						console.log(`   - Line 1 (headers): ${lines[0]}`);
						console.log(`   - Line 2 (first data): ${lines[1]}`);
						console.log(`   - Line 3 (second data): ${lines[2]}`);
						
						try {
							const Papa = require('papaparse');
							console.log(`🔍 Parsing CSV with Papa.parse...`);
							const result = Papa.parse(data, { header: true });
							
							console.log(`🔍 Papa.parse result:`);
							console.log(`   - Success: ${result.success}`);
							console.log(`   - Errors: ${result.errors.length}`);
							if (result.errors.length > 0) {
								console.log(`   - Error details:`, JSON.stringify(result.errors, null, 2));
							}
							console.log(`   - Meta:`, JSON.stringify(result.meta, null, 2));
							
							// Validate that we got actual CSV data with proper headers
							if (result.data.length === 0 || Object.keys(result.data[0] || {}).length === 0) {
								console.error(`❌ ${fetchUrl} parsed but has no valid data rows or headers`);
								console.error(`   - Result data length: ${result.data.length}`);
								console.error(`   - First row keys:`, Object.keys(result.data[0] || {}));
								reject(new Error(`CSV parsed but contains no valid data rows.`));
								return;
							}
							
							// Log the actual headers we received
							const headers = Object.keys(result.data[0] || {});
							console.log(`📊 CSV headers from ${fetchUrl}: ${headers.join(', ')}`);
							
							// Log sample parsed data
							if (result.data.length > 0) {
								console.log(`🔍 Sample parsed row:`, JSON.stringify(result.data[0], null, 2));
							}
							
							// Filter out completely empty rows
							const filteredData = result.data.filter(row => {
								const hasData = Object.values(row).some(val => val && val.trim() !== '');
								if (!hasData) {
									console.log(`🔍 Filtered out empty row:`, JSON.stringify(row));
								}
								return hasData;
							});
							
							console.log(`📊 CSV parsed: ${result.data.length} total rows, ${filteredData.length} non-empty rows`);
							
							if (filteredData.length === 0) {
								console.warn(`⚠️ Warning: All rows were filtered out from ${fetchUrl}`);
							}
							
							resolve(filteredData);
						} catch (error) {
							console.error(`❌ Failed to parse CSV from ${fetchUrl}: ${error.message}`);
							console.error(`Data preview: ${data.substring(0, 200)}...`);
							reject(new Error(`Failed to parse CSV: ${error.message}`));
						}
					});
				}).on('error', (error) => {
					console.error(`❌ Network error fetching ${fetchUrl}: ${error.message}`);
					reject(new Error(`Failed to fetch CSV: ${error.message}`));
				});
			};
			
			// Start the fetch process
			fetchWithRedirect(url);
		});
	}
	
	async processDataSource(sourceName, csvData) {
		console.log(`🔄 PROCESS: Starting processDataSource for ${sourceName}`);
		console.log(`📊 PROCESS: ${sourceName} has ${csvData.length} rows to process`);
		
		let nodesCreated = 0;
		let relationshipsCreated = 0;
		const errors = [];
		
		try {
			console.log(`⚙️ PROCESS: Calling processDataSourceByType for ${sourceName}...`);
			switch (sourceName) {
				case 'TBL_Players':
					console.log(`👥 PROCESS: Processing TBL_Players with ${csvData.length} rows...`);
					nodesCreated = await this.createPlayerNodes(csvData);
					break;
				case 'TBL_FixturesAndResults':
					console.log(`🏟️ PROCESS: Processing TBL_FixturesAndResults with ${csvData.length} rows...`);
					nodesCreated = await this.createFixtureNodes(csvData);
					break;
				case 'TBL_MatchDetails':
					console.log(`⚽ PROCESS: Processing TBL_MatchDetails with ${csvData.length} rows...`);
					nodesCreated = await this.createMatchDetailNodes(csvData);
					break;
				case 'TBL_SiteDetails':
					console.log(`🌐 PROCESS: Processing TBL_SiteDetails with ${csvData.length} rows...`);
					nodesCreated = await this.createSiteDetailNodes(csvData);
					break;
				case 'TBL_WeeklyTOTW':
					console.log(`📅 PROCESS: Processing TBL_WeeklyTOTW with ${csvData.length} rows...`);
					nodesCreated = await this.createWeeklyTOTWNodes(csvData);
					break;
				case 'TBL_SeasonTOTW':
					console.log(`🏆 PROCESS: Processing TBL_SeasonTOTW with ${csvData.length} rows...`);
					nodesCreated = await this.createSeasonTOTWNodes(csvData);
					break;
				case 'TBL_PlayersOfTheMonth':
					console.log(`👑 PROCESS: Processing TBL_PlayersOfTheMonth with ${csvData.length} rows...`);
					nodesCreated = await this.createPlayerOfTheMonthNodes(csvData);
					break;
				case 'TBL_CaptainsAndAwards':
					console.log(`🎖️ PROCESS: Processing TBL_CaptainsAndAwards with ${csvData.length} rows...`);
					nodesCreated = await this.createCaptainAndAwardNodes(csvData);
					break;
				case 'TBL_OppositionDetails':
					console.log(`🤝 PROCESS: Processing TBL_OppositionDetails with ${csvData.length} rows...`);
					nodesCreated = await this.createOppositionDetailNodes(csvData);
					break;
				case 'TBL_TestData':
					console.log(`🧪 PROCESS: Processing TBL_TestData with ${csvData.length} rows...`);
					nodesCreated = await this.createTestDataNodes(csvData);
					break;
				default:
					console.log(`⚠️ PROCESS: Unknown data source: ${sourceName}`);
			}
			console.log(`✅ PROCESS: ${sourceName} processing completed: ${nodesCreated} nodes created`);
		} catch (error) {
			const errorMsg = `Failed to process ${sourceName}: ${error.message}`;
			console.error(`❌ PROCESS: ${errorMsg}`);
			console.error(`❌ PROCESS: Stack trace for ${sourceName}:`, error.stack);
			errors.push(errorMsg);
		}
		
		console.log(`📤 PROCESS: Returning result for ${sourceName}: ${nodesCreated} nodes, ${relationshipsCreated} relationships, ${errors.length} errors`);
		return { nodesCreated, relationshipsCreated, errors };
	}
	
	async createPlayerNodes(csvData) {
		let nodesCreated = 0;
		const config = getCSVHeaderConfig('TBL_Players');
		
		for (const row of csvData) {
			try {
				// Skip players where "ALLOW ON SITE" is FALSE
				if (getColumnValue(row, 'ALLOW ON SITE') && getColumnValue(row, 'ALLOW ON SITE').toLowerCase() === 'false') {
					continue;
				}
				
				// Skip rows with missing essential data using dynamic column mapping
				if (!validateRequiredColumns(row, ['PLAYER NAME'], 'TBL_Players')) {
					continue;
				}
				
				const query = `
					MERGE (p:Player {id: $id})
					ON CREATE SET 
						p.name = $name,
						p.position = $position,
						p.graphLabel = 'dorkiniansWebsite'
					ON MATCH SET
						p.name = $name,
						p.position = $position,
						p.graphLabel = 'dorkiniansWebsite'
				`;
				
				const params = {
					id: `player_${getColumnValue(row, 'PLAYER NAME').replace(/\s+/g, '_')}`,
					name: getColumnValue(row, 'PLAYER NAME'),
					position: getColumnValue(row, 'MOST COMMON POSITION', 'Unknown')
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create player node for ${getColumnValue(row, 'PLAYER NAME')}: ${error.message}`);
			}
		}
		
		return nodesCreated;
	}
	
	async createFixtureNodes(csvData) {
		let nodesCreated = 0;
		const config = getCSVHeaderConfig('TBL_FixturesAndResults');
		
		for (const row of csvData) {
			try {
				// Skip fixtures where "COMP TYPE" is "-" or "OPPOSITION" is "No Game"
				if (getColumnValue(row, 'COMP TYPE') === '-' || getColumnValue(row, 'OPPOSITION') === 'No Game') {
					continue;
				}
				
				// Skip rows with missing essential data using dynamic column mapping
				if (!validateRequiredColumns(row, ['DATE', 'OPPOSITION'], 'TBL_FixturesAndResults')) {
					continue;
				}
				
				const query = `
					MERGE (f:Fixture {id: $id})
					ON CREATE SET 
						f.date = $date,
						f.opposition = $opposition,
						f.competition = $competition,
						f.graphLabel = 'dorkiniansWebsite'
					ON MATCH SET
						f.date = $date,
						f.opposition = $opposition,
						f.competition = $competition,
						f.graphLabel = 'dorkiniansWebsite'
				`;
				
				const params = {
					id: `fixture_${getColumnValue(row, 'DATE').replace(/\s+/g, '_')}_${getColumnValue(row, 'OPPOSITION').replace(/\s+/g, '_')}`,
					date: getColumnValue(row, 'DATE'),
					opposition: getColumnValue(row, 'OPPOSITION'),
					competition: getColumnValue(row, 'COMP TYPE', 'Unknown')
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create fixture node for ${getColumnValue(row, 'DATE')}: ${error.message}`);
			}
		}
		
		return nodesCreated;
	}
	
	async createMatchDetailNodes(csvData) {
		let nodesCreated = 0;
		const config = getCSVHeaderConfig('TBL_MatchDetails');
		
		for (const row of csvData) {
			try {
				// Skip rows with missing essential data using dynamic column mapping
				if (!validateRequiredColumns(row, ['PLAYER NAME'], 'TBL_MatchDetails')) {
					continue;
				}
				
				const query = `
					MERGE (md:MatchDetail {id: $id})
					ON CREATE SET 
						md.playerName = $playerName,
						md.goals = $goals,
						md.assists = $assists,
						md.graphLabel = 'dorkiniansWebsite'
					ON MATCH SET
						md.playerName = $playerName,
						md.goals = $goals,
						md.assists = $assists,
						md.graphLabel = 'dorkiniansWebsite'
				`;
				
				const params = {
					id: `matchdetail_${getColumnValue(row, 'PLAYER NAME').replace(/\s+/g, '_')}_${getColumnValue(row, 'G', '0')}_0`,
					playerName: getColumnValue(row, 'PLAYER NAME'),
					goals: getColumnValue(row, 'G', '0'),
					assists: getColumnValue(row, 'A', '0')
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create match detail node for ${getColumnValue(row, 'PLAYER NAME')}: ${error.message}`);
			}
		}
		
		return nodesCreated;
	}
	
	async createSiteDetailNodes(csvData) {
		let nodesCreated = 0;
		const config = getCSVHeaderConfig('TBL_SiteDetails');
		
		for (const row of csvData) {
			try {
				// Skip rows with missing essential data using dynamic column mapping
				if (!validateRequiredColumns(row, [config.expectedHeaders[0]], 'TBL_SiteDetails')) {
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
					id: `sitedetail_${getColumnValue(row, config.expectedHeaders[0]).replace(/\s+/g, '_')}`,
					title: getColumnValue(row, config.expectedHeaders[0]),
					value: getColumnValue(row, config.expectedHeaders[1], 'Unknown')
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create site detail node for ${getColumnValue(row, config.expectedHeaders[0])}: ${error.message}`);
				}
		}
		
		return nodesCreated;
	}
	
	async createWeeklyTOTWNodes(csvData) {
		let nodesCreated = 0;
		const config = getCSVHeaderConfig('TBL_WeeklyTOTW');
		
		for (const row of csvData) {
			try {
				// Skip rows with missing essential data using dynamic column mapping
				if (!validateRequiredColumns(row, ['WEEK', 'STAR MAN'], 'TBL_WeeklyTOTW')) {
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
					id: `weeklytotw_${getColumnValue(row, 'WEEK')}_${getColumnValue(row, 'STAR MAN').replace(/\s+/g, '_')}`,
					week: getColumnValue(row, 'WEEK'),
					playerName: getColumnValue(row, 'STAR MAN')
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create weekly TOTW node for ${getColumnValue(row, 'WEEK')}: ${error.message}`);
			}
		}
		
		return nodesCreated;
	}
	
	async createSeasonTOTWNodes(csvData) {
		let nodesCreated = 0;
		const config = getCSVHeaderConfig('TBL_SeasonTOTW');
		
		for (const row of csvData) {
			try {
				// Skip rows with missing essential data using dynamic column mapping
				if (!validateRequiredColumns(row, ['SEASON', 'STAR MAN'], 'TBL_SeasonTOTW')) {
					continue;
				}
				
				const query = `
					MERGE (st:SeasonTOTW {id: $id})
					ON CREATE SET 
						st.season = $season,
						st.playerName = $playerName,
						st.graphLabel = 'dorkiniansWebsite'
					ON MATCH SET
						st.season = $season,
						st.playerName = $playerName,
						st.graphLabel = 'dorkiniansWebsite'
				`;
				
				const params = {
					id: `seasontotw_${getColumnValue(row, 'SEASON')}_${getColumnValue(row, 'STAR MAN').replace(/\s+/g, '_')}`,
					season: getColumnValue(row, 'SEASON'),
					playerName: getColumnValue(row, 'STAR MAN')
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create season TOTW node for ${getColumnValue(row, 'SEASON')}: ${error.message}`);
			}
		}
		
		return nodesCreated;
	}
	
	async createPlayerOfTheMonthNodes(csvData) {
		let nodesCreated = 0;
		const config = getCSVHeaderConfig('TBL_PlayersOfTheMonth');
		
		for (const row of csvData) {
			try {
				// Skip rows with missing essential data using dynamic column mapping
				if (!validateRequiredColumns(row, ['DATE', '#1 Name'], 'TBL_PlayersOfTheMonth')) {
					continue;
				}
				
				const query = `
					MERGE (pm:PlayerOfTheMonth {id: $id})
					ON CREATE SET 
						pm.month = $month,
						pm.playerName = $playerName,
						pm.graphLabel = 'dorkiniansWebsite'
					ON MATCH SET
						pm.month = $month,
						pm.playerName = $playerName,
						pm.graphLabel = 'dorkiniansWebsite'
				`;
				
				const params = {
					id: `playerofthemonth_${getColumnValue(row, 'DATE').replace(/\s+/g, '_')}_${getColumnValue(row, '#1 Name').replace(/\s+/g, '_')}`,
					month: getColumnValue(row, 'DATE'),
					playerName: getColumnValue(row, '#1 Name')
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create player of the month node for ${getColumnValue(row, 'DATE')}: ${error.message}`);
			}
		}
		
		return nodesCreated;
	}
	
	async createCaptainAndAwardNodes(csvData) {
		let nodesCreated = 0;
		const config = getCSVHeaderConfig('TBL_CaptainsAndAwards');
		
		for (const row of csvData) {
			try {
				// Skip rows with missing essential data using dynamic column mapping
				if (!validateRequiredColumns(row, ['Item'], 'TBL_CaptainsAndAwards')) {
					continue;
				}
				
				const query = `
					CREATE (ca:CaptainAndAward {
						id: $id,
						item: $item,
						graphLabel: 'dorkiniansWebsite'
					})
				`;
				
				const params = {
					id: `captainaward_${getColumnValue(row, 'Item').replace(/\s+/g, '_')}`,
					item: getColumnValue(row, 'Item')
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create captain/award node for ${getColumnValue(row, 'Item')}: ${error.message}`);
			}
		}
		
		return nodesCreated;
	}
	
	async createOppositionDetailNodes(csvData) {
		let nodesCreated = 0;
		const config = getCSVHeaderConfig('TBL_OppositionDetails');
		
		for (const row of csvData) {
			try {
				// Skip rows with missing essential data using dynamic column mapping
				if (!validateRequiredColumns(row, ['OPPOSITION'], 'TBL_OppositionDetails')) {
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
					id: `opposition_${getColumnValue(row, 'OPPOSITION').replace(/\s+/g, '_')}`,
					name: getColumnValue(row, 'OPPOSITION')
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create opposition detail node for ${getColumnValue(row, 'OPPOSITION')}: ${error.message}`);
			}
		}
		
		return nodesCreated;
	}
	
	async createTestDataNodes(csvData) {
		let nodesCreated = 0;
		
		for (const row of csvData) {
			try {
				// Skip rows with missing essential data using dynamic column mapping
				if (!validateRequiredColumns(row, ['PLAYER NAME'], 'TBL_TestData')) {
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
					id: `testdata_${getColumnValue(row, 'PLAYER NAME').replace(/\s+/g, '_')}`,
					description: getColumnValue(row, 'PLAYER NAME')
				};
				
				await this.session.run(query, params);
				nodesCreated++;
			} catch (error) {
				console.error(`❌ Failed to create test data node for ${getColumnValue(row, 'PLAYER NAME')}: ${error.message}`);
			}
		}
		
		return nodesCreated;
	}
	
	async clearGraphData() {
		try {
			// Use DETACH DELETE to remove all nodes and relationships in one operation
			const clearQuery = 'MATCH (n {graphLabel: "dorkiniansWebsite"}) DETACH DELETE n';
			await this.session.run(clearQuery);
			console.log('✅ Existing graph data cleared');
			
		} catch (error) {
			console.error('❌ Failed to clear graph data:', error.message);
			// Continue anyway - MERGE will handle existing nodes
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

exports.handler = async (event, context) => {
	console.log('🚀 FUNCTION START: trigger-seed handler initiated');
	console.log('📊 Event details:', JSON.stringify(event, null, 2));
	console.log('⏰ Context remaining time:', context.getRemainingTimeInMillis(), 'ms');
	
	// Set CORS headers
	const headers = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
	};

	// Set up timeout handler for 30-minute limit
	const timeoutHandler = setTimeout(async () => {
		console.log('⏰ TIMEOUT HANDLER: Function timeout reached (30 minutes)');
		try {
			await emailService.sendSeedingSummaryEmail({
				success: false,
				environment: event.queryStringParameters?.environment || 'production',
				nodesCreated: 0,
				relationshipsCreated: 0,
				errorCount: 1,
				errors: ['Function timeout: Seeding process exceeded 30 minutes'],
				duration: 0
			});
			console.log('📧 TIMEOUT: Email notification sent');
		} catch (emailError) {
			console.warn('⚠️ TIMEOUT: Failed to send timeout email:', emailError);
		}
	}, 29 * 60 * 1000); // 29 minutes to ensure email is sent before function timeout

	// Handle preflight request
	if (event.httpMethod === 'OPTIONS') {
		console.log('🔄 PREFLIGHT: Handling OPTIONS request');
		return {
			statusCode: 200,
			headers,
			body: ''
		};
	}

	try {
		console.log('🔧 MAIN: Starting main execution logic');
		
		// Parse request
		const { environment = 'production', force = false } = event.queryStringParameters || {};
		console.log('🌍 ENVIRONMENT: Target environment:', environment);
		
		// Validate environment
		if (!['development', 'production'].includes(environment)) {
			console.log('❌ VALIDATION: Invalid environment detected');
			return {
				statusCode: 400,
				headers: { ...headers, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					error: 'Invalid environment. Use "development" or "production"'
				})
			};
		}

		console.log(`🚀 TRIGGER: Triggering database seeding for environment: ${environment}`);

		// Configure email service with environment variables (available during execution)
		console.log('📧 EMAIL: Configuring email service...');
		emailService.configure();

		// Send start notification
		console.log('📧 START: Attempting to send start notification...');
		try {
			await emailService.sendSeedingStartEmail(environment);
			console.log('✅ START: Start notification sent successfully');
		} catch (emailError) {
			console.warn('⚠️ START: Failed to send start notification:', emailError);
			// Don't fail the function if email fails
		}

		// Execute seeding directly
		console.log('🌱 SEEDING: Starting direct seeding execution...');
		const startTime = Date.now();
		const result = await executeSeedingDirectly(environment);
		const duration = Date.now() - startTime;
		console.log('⏱️ TIMING: Seeding execution completed in', duration, 'ms');

		// Send email notification
		console.log('📧 COMPLETION: Attempting to send completion notification...');
		try {
			await sendSeedingNotification(result, environment, duration);
			console.log('✅ COMPLETION: Completion notification sent successfully');
		} catch (emailError) {
			console.warn('⚠️ COMPLETION: Failed to send email notification:', emailError);
			// Don't fail the function if email fails
		}

		// Clear timeout handler
		console.log('🧹 CLEANUP: Clearing timeout handler...');
		clearTimeout(timeoutHandler);

		// Return success response
		console.log('✅ SUCCESS: Returning success response');
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
		console.error('❌ ERROR: Main execution error:', error);
		console.error('❌ ERROR: Stack trace:', error.stack);

		// Clear timeout handler
		console.log('🧹 CLEANUP: Clearing timeout handler due to error...');
		clearTimeout(timeoutHandler);

		// Send failure notification
		console.log('📧 FAILURE: Attempting to send failure notification...');
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
			console.log('✅ FAILURE: Failure notification sent successfully');
		} catch (emailError) {
			console.warn('⚠️ FAILURE: Failed to send failure email:', emailError);
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
	console.log(`📜 DIRECT: Starting direct seeding for environment: ${environment}`);
	console.log(`⏰ DIRECT: Remaining time: ${context?.getRemainingTimeInMillis() || 'unknown'} ms`);
	
	// Set environment variables
	process.env.NODE_ENV = environment;
	console.log('🔧 DIRECT: Environment variables set');
	
	try {
		console.log('🔌 DIRECT: Initializing data seeder service...');
		// Initialize the data seeder service
		await dataSeeder.initialize();
		console.log('✅ DIRECT: Data seeder initialized successfully');
		
		console.log('🌱 DIRECT: Executing seeding process...');
		// Execute the seeding process
		const seedingResult = await dataSeeder.seedAllData();
		console.log('✅ DIRECT: Seeding process completed');
		
		console.log('📊 DIRECT: Counting errors from log...');
		// Count errors from log file
		const errorCount = countErrorsFromLog();
		console.log('📊 DIRECT: Error count:', errorCount);
		
		console.log('📤 DIRECT: Preparing return result...');
		return {
			success: true,
			exitCode: 0,
			nodesCreated: seedingResult.nodesCreated || 0,
			relationshipsCreated: seedingResult.relationshipsCreated || 0,
			errorCount,
			errors: []
		};
		
	} catch (error) {
		console.error('❌ DIRECT: Seeding failed:', error);
		console.error('❌ DIRECT: Stack trace:', error.stack);
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
		console.log('🧹 DIRECT: Starting cleanup...');
		try {
			await dataSeeder.cleanup();
			console.log('✅ DIRECT: Cleanup completed successfully');
		} catch (cleanupError) {
			console.warn('⚠️ DIRECT: Cleanup failed:', cleanupError);
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
