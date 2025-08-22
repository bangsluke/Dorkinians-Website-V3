#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import the scheduler service
const { schedulerService } = require('../lib/services/schedulerService.js');

// Default configuration
const defaultConfig = {
	interval: '0 */6 * * *', // Every 6 hours
	scriptPath: path.join(__dirname, 'seed-database.js'),
	environment: 'production',
	emailNotifications: true
};

// Parse command line arguments
function parseArguments() {
	const args = process.argv.slice(2);
	const config = { ...defaultConfig };

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case '--interval':
			case '-i':
				config.interval = args[++i];
				break;
			case '--environment':
			case '-e':
				config.environment = args[++i];
				break;
			case '--no-email':
				config.emailNotifications = false;
				break;
			case '--help':
			case '-h':
				showHelp();
				process.exit(0);
				break;
			case '--status':
				showStatus();
				process.exit(0);
				break;
			case '--stop':
				stopScheduler();
				process.exit(0);
				break;
		}
	}

	return config;
}

function showHelp() {
	console.log(`
🚀 Dorkinians Database Seeding Scheduler

Usage: node scripts/start-scheduler.js [options]

Options:
  -i, --interval <cron>     Cron expression (default: "0 */6 * * *" - every 6 hours)
  -e, --environment <env>    Environment: development or production (default: production)
  --no-email                 Disable email notifications
  --status                   Show current scheduler status
  --stop                     Stop the scheduler
  -h, --help                Show this help message

Examples:
  # Start with default settings (every 6 hours, production)
  node scripts/start-scheduler.js

  # Run every 2 hours
  node scripts/start-scheduler.js --interval "0 */2 * * *"

  # Run daily at 2 AM
  node scripts/start-scheduler.js --interval "0 2 * * *"

  # Development environment
  node scripts/start-scheduler.js --environment development

  # Check status
  node scripts/start-scheduler.js --status

  # Stop scheduler
  node scripts/start-scheduler.js --stop

Cron Expression Format:
  ┌───────────── minute (0-59)
  │ ┌───────────── hour (0-23)
  │ │ ┌───────────── day of month (1-31)
  │ │ │ ┌───────────── month (1-12)
  │ │ │ │ ┌───────────── day of week (0-7, 0 and 7 are Sunday)
  │ │ │ │ │
  * * * * *

Common Examples:
  "0 */6 * * *"    - Every 6 hours
  "0 2 * * *"      - Daily at 2 AM
  "0 9,18 * * *"   - Twice daily at 9 AM and 6 PM
  "0 0 * * 0"      - Weekly on Sunday at midnight
`);
}

function showStatus() {
	try {
		const status = schedulerService.getStatus();
		console.log(`
📊 Scheduler Status:
  Running: ${status.isRunning ? '✅ Yes' : '❌ No'}
  Scheduled: ${status.isScheduled ? '✅ Yes' : '❌ No'}
  Next Run: ${status.nextRun}
  
Configuration:
  ${status.config ? `
  Interval: ${status.config.interval}
  Environment: ${status.config.environment}
  Email Notifications: ${status.config.emailNotifications ? '✅ Enabled' : '❌ Disabled'}
  Script Path: ${status.config.scriptPath}
  ` : 'Not configured'}
`);
	} catch (error) {
		console.log(`
📊 Scheduler Status:
  Status: ❌ Error - ${error.message}
  Service: Not available
`);
	}
}

function stopScheduler() {
	try {
		schedulerService.stop();
		console.log('⏹️ Scheduler stopped successfully');
	} catch (error) {
		console.error('❌ Failed to stop scheduler:', error.message);
	}
}

// Main execution
async function main() {
	try {
		const config = parseArguments();
		
		console.log('🚀 Starting Dorkinians Database Seeding Scheduler...');
		console.log(`📅 Schedule: ${config.interval}`);
		console.log(`🌍 Environment: ${config.environment}`);
		console.log(`📧 Email Notifications: ${config.emailNotifications ? 'Enabled' : 'Disabled'}`);
		console.log(`📜 Script: ${config.scriptPath}`);
		console.log('');

		// Configure and start the scheduler
		schedulerService.configure(config);
		schedulerService.start();

		// Keep the process running
		console.log('🔄 Scheduler is running. Press Ctrl+C to stop.');
		
		// Handle graceful shutdown
		process.on('SIGINT', () => {
			console.log('\n🛑 Received SIGINT, shutting down gracefully...');
			schedulerService.stop();
			process.exit(0);
		});

		process.on('SIGTERM', () => {
			console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
			schedulerService.stop();
			process.exit(0);
		});

	} catch (error) {
		console.error('❌ Failed to start scheduler:', error.message);
		process.exit(1);
	}
}

// Run if this file is executed directly
if (require.main === module) {
	main();
}
