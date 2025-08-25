const path = require('path');
const fs = require('fs');

// Import CSV header configuration
const { getCSVHeaderConfig } = require('./lib/config/csvHeaders');

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
							<p>This process runs on Heroku infrastructure and will continue even if you close this email.</p>
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

This process runs on Heroku infrastructure and will continue even if you close this email.

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
							<p>For detailed error logs, check the Heroku logs.</p>
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
For detailed error logs, check the Heroku logs.
		`.trim();
	}
}

// Initialize services
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

		// Generate unique job ID
		const jobId = `seed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		console.log('🆔 TRIGGER: Generated job ID:', jobId);

		// Configure email service with environment variables (available during execution)
		console.log('📧 EMAIL: Configuring email service...');
		emailService.configure();

		// Send start notification
		console.log('📧 START: Attempting to send start notification...');
		try {
			await emailService.sendSeedingStartEmail(environment, jobId);
			console.log('✅ START: Start notification sent successfully');
		} catch (emailError) {
			console.warn('⚠️ START: Failed to send start notification:', emailError);
			// Don't fail the function if email fails
		}

		// Trigger Heroku seeding service
		console.log('🌱 HEROKU: Starting Heroku seeding service...');
		try {
			const herokuUrl = process.env.HEROKU_SEEDER_URL || 'https://your-heroku-app.herokuapp.com';
			const response = await fetch(`${herokuUrl}/seed`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					environment,
					jobId
				})
			});

			if (response.ok) {
				console.log('✅ HEROKU: Heroku seeding service started successfully');
			} else {
				console.warn('⚠️ HEROKU: Heroku seeding service may have failed to start');
			}
		} catch (herokuError) {
			console.warn('⚠️ HEROKU: Failed to start Heroku seeding service:', herokuError);
			// Continue with immediate response - Heroku process may still work
		}

		// Return immediate response
		console.log('✅ SUCCESS: Returning immediate response');
		return {
			statusCode: 200,
			headers: { ...headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				success: true,
				message: 'Database seeding started on Heroku',
				environment,
				jobId,
				timestamp: new Date().toISOString(),
				status: 'started',
				note: 'Seeding is running on Heroku. Check email for completion notification.',
				herokuUrl: process.env.HEROKU_SEEDER_URL || 'https://your-heroku-app.herokuapp.com'
			})
		};

	} catch (error) {
		console.error('❌ ERROR: Main execution error:', error);
		console.error('❌ ERROR: Stack trace:', error.stack);

		// Send failure notification
		console.log('📧 FAILURE: Attempting to send failure notification...');
		try {
			await emailService.sendSeedingSummaryEmail({
				success: false,
				environment: event.queryStringParameters?.environment || 'production',
				jobId: 'unknown',
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
				error: 'Failed to start database seeding',
				message: error.message,
				timestamp: new Date().toISOString()
			})
		};
	}
};
