import * as cron from 'node-cron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { emailService } from './emailService';
import { SeedingSummary } from './emailService';

export interface SchedulerConfig {
	interval: string; // Cron expression (e.g., "0 */6 * * *" for every 6 hours)
	scriptPath: string; // Path to the seeding script
	environment: string; // Environment to run (development/production)
	emailNotifications: boolean; // Whether to send email notifications
}

export class SchedulerService {
	private static instance: SchedulerService;
	private cronJob: cron.ScheduledTask | null = null;
	private config: SchedulerConfig | null = null;
	private isRunning: boolean = false;

	static getInstance(): SchedulerService {
		if (!SchedulerService.instance) {
			SchedulerService.instance = new SchedulerService();
		}
		return SchedulerService.instance;
	}

	configure(config: SchedulerConfig): void {
		this.config = config;
	}

	start(): void {
		if (!this.config) {
			throw new Error('Scheduler not configured. Call configure() first.');
		}

		if (this.cronJob) {
			console.log('🔄 Scheduler already running, stopping previous instance...');
			this.stop();
		}

		console.log(`🚀 Starting scheduler with interval: ${this.config.interval}`);
		console.log(`📅 Next run: ${this.getNextRunTime()}`);

		this.cronJob = cron.schedule(this.config.interval, () => {
			this.runSeedingScript();
		}, {
			timezone: 'Europe/London' // UK timezone
		});

		console.log('✅ Scheduler started successfully');
	}

	stop(): void {
		if (this.cronJob) {
			this.cronJob.stop();
			this.cronJob.destroy();
			this.cronJob = null;
			console.log('⏹️ Scheduler stopped');
		}
	}

	private async runSeedingScript(): Promise<void> {
		if (this.isRunning) {
			console.log('⚠️ Seeding script already running, skipping this execution');
			return;
		}

		if (!this.config) {
			console.error('❌ Scheduler not configured');
			return;
		}

		this.isRunning = true;
		const startTime = Date.now();
		console.log(`🚀 Starting scheduled seeding at ${new Date().toISOString()}`);

		try {
			// Run the seeding script as a child process
			const result = await this.executeSeedingScript();
			
			const duration = Date.now() - startTime;
			const success = result.exitCode === 0;

			// Create seeding summary
			const summary: SeedingSummary = {
				environment: this.config.environment,
				nodesCreated: result.nodesCreated || 0,
				relationshipsCreated: result.relationshipsCreated || 0,
				duration: Math.round(duration / 1000), // Convert to seconds
				errorCount: result.errorCount || 0,
				timestamp: new Date().toISOString(),
				success,
				errors: result.errors || []
			};

			// Send email notification if enabled
			if (this.config.emailNotifications) {
				await this.sendSeedingNotification(summary);
			}

			console.log(`✅ Scheduled seeding completed in ${duration}ms`);
			console.log(`📊 Summary: ${summary.nodesCreated} nodes, ${summary.relationshipsCreated} relationships, ${summary.errorCount} errors`);

		} catch (error) {
			console.error('❌ Scheduled seeding failed:', error);
			
			// Send failure notification
			if (this.config.emailNotifications) {
				const failureSummary: SeedingSummary = {
					environment: this.config.environment,
					nodesCreated: 0,
					relationshipsCreated: 0,
					duration: Math.round((Date.now() - startTime) / 1000),
					errorCount: 1,
					timestamp: new Date().toISOString(),
					success: false,
					errors: [error instanceof Error ? error.message : String(error)]
				};
				
				await this.sendSeedingNotification(failureSummary);
			}
		} finally {
			this.isRunning = false;
		}
	}

	private executeSeedingScript(): Promise<{
		exitCode: number;
		nodesCreated?: number;
		relationshipsCreated?: number;
		errorCount?: number;
		errors?: string[];
	}> {
		return new Promise((resolve, reject) => {
			if (!this.config) {
				reject(new Error('Scheduler not configured'));
				return;
			}

			const scriptPath = path.resolve(this.config.scriptPath);
			console.log(`📜 Executing script: ${scriptPath}`);

			// Use npm run to execute the script
			const npmScript = this.config.environment === 'production' ? 'seed-prod' : 'seed-dev';
			const child: ChildProcess = spawn('npm', ['run', npmScript], {
				cwd: process.cwd(),
				stdio: ['pipe', 'pipe', 'pipe'],
				env: { ...process.env, NODE_ENV: this.config.environment as 'development' | 'production' }
			});

			let stdout = '';
			let stderr = '';
			let nodesCreated = 0;
			let relationshipsCreated = 0;

			child.stdout?.on('data', (data: Buffer) => {
				const output = data.toString();
				stdout += output;
				console.log(`[SEEDING] ${output.trim()}`);

				// Parse output for statistics
				if (output.includes('✅ Created')) {
					const match = output.match(/(\d+) nodes/);
					if (match) nodesCreated = parseInt(match[1]);
				}
				if (output.includes('✅ Created')) {
					const match = output.match(/(\d+) relationships/);
					if (match) relationshipsCreated = parseInt(match[1]);
				}
			});

			child.stderr?.on('data', (data: Buffer) => {
				const output = data.toString();
				stderr += output;
				console.error(`[SEEDING ERROR] ${output.trim()}`);
			});

			child.on('close', (code: number | null) => {
				const exitCode = code || 0;
				const success = exitCode === 0;

				// Count errors from the log file
				const errorCount = this.countErrorsFromLog();

				if (success) {
					resolve({
						exitCode,
						nodesCreated,
						relationshipsCreated,
						errorCount,
						errors: []
					});
				} else {
					resolve({
						exitCode,
						nodesCreated: 0,
						relationshipsCreated: 0,
						errorCount,
						errors: [stderr || 'Script execution failed']
					});
				}
			});

			child.on('error', (error: Error) => {
				reject(error);
			});
		});
	}

	private countErrorsFromLog(): number {
		try {
			const fs = require('fs');
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

	private async sendSeedingNotification(summary: SeedingSummary): Promise<void> {
		try {
			await emailService.sendSeedingSummary(summary);
			console.log('📧 Seeding notification email sent successfully');
		} catch (error) {
			console.error('❌ Failed to send seeding notification email:', error);
		}
	}

	getNextRunTime(): string {
		if (!this.cronJob || !this.config) {
			return 'Not scheduled';
		}

		// For now, return a placeholder since cron.getNextDate might not be available
		// You can implement this using a cron parser library if needed
		return 'Next run time calculation not implemented';
	}

	getStatus(): {
		isRunning: boolean;
		isScheduled: boolean;
		nextRun: string;
		config: SchedulerConfig | null;
	} {
		return {
			isRunning: this.isRunning,
			isScheduled: !!this.cronJob,
			nextRun: this.getNextRunTime(),
			config: this.config
		};
	}
}

export const schedulerService = SchedulerService.getInstance();
