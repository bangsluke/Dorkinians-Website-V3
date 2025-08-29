import nodemailer from "nodemailer";

export interface CSVHeaderValidationFailure {
	sourceName: string;
	expectedHeaders: string[];
	actualHeaders: string[];
	missingHeaders: string[];
	extraHeaders: string[];
	url: string;
	error?: string; // For access errors (401, 403, 404, etc.)
}

export interface CSVValidationSummary {
	headerFailures: CSVHeaderValidationFailure[];
	accessFailures: CSVHeaderValidationFailure[];
	totalSources: number;
	validSources: number;
	failedSources: number;
}

export interface SeedingSummary {
	environment: string;
	nodesCreated: number;
	relationshipsCreated: number;
	duration: number;
	errorCount: number;
	timestamp: string;
	success: boolean;
	errors?: string[];
}

export interface EmailConfig {
	host: string;
	port: number;
	secure: boolean;
	auth: {
		user: string;
		pass: string;
	};
	from: string;
	to: string;
}

export class EmailService {
	private static instance: EmailService;
	private transporter: nodemailer.Transporter | null = null;
	private config: EmailConfig | null = null;

	static getInstance(): EmailService {
		if (!EmailService.instance) {
			EmailService.instance = new EmailService();
		}
		return EmailService.instance;
	}

	configure(config: EmailConfig): void {
		this.config = config;
		this.transporter = nodemailer.createTransport({
			host: config.host,
			port: config.port,
			secure: config.secure,
			auth: {
				user: config.auth.user,
				pass: config.auth.pass,
			},
			tls: {
				rejectUnauthorized: process.env.NODE_ENV === "production", // Only reject in production
				// For development, allow self-signed certificates
				...(process.env.NODE_ENV !== "production" && {
					rejectUnauthorized: false,
					checkServerIdentity: () => undefined,
				}),
			},
		});
	}

	async sendCSVHeaderValidationFailure(failures: CSVHeaderValidationFailure[]): Promise<boolean> {
		// Convert old interface to new summary format for backward compatibility
		const summary: CSVValidationSummary = {
			headerFailures: failures.filter((f) => !f.error),
			accessFailures: failures.filter((f) => f.error),
			totalSources: failures.length,
			validSources: 0,
			failedSources: failures.length,
		};

		return this.sendCSVValidationSummary(summary);
	}

	async sendCSVValidationSummary(summary: CSVValidationSummary): Promise<boolean> {
		if (!this.transporter || !this.config) {
			console.error("❌ Email service not configured");
			return false;
		}

		try {
			const totalFailures = summary.headerFailures.length + summary.accessFailures.length;
			const subject = `🚨 Dorkinians Website V3 - CSV Validation Issues - ${totalFailures} data source(s) affected`;

			const htmlBody = this.generateCSVValidationSummaryEmail(summary);
			const textBody = this.generateCSVValidationSummaryEmailText(summary);

			const mailOptions = {
				from: this.config.from,
				to: this.config.to,
				subject,
				html: htmlBody,
				text: textBody,
			};

			const info = await this.transporter.sendMail(mailOptions);
			console.log(`✅ CSV validation summary email sent: ${info.messageId}`);
			return true;
		} catch (error) {
			console.error("❌ Failed to send CSV validation summary email:", error);
			return false;
		}
	}

	async sendSeedingSummary(summary: SeedingSummary): Promise<boolean> {
		if (!this.transporter || !this.config) {
			console.error("❌ Email service not configured");
			return false;
		}

		try {
			const status = summary.success ? "✅ Completed Successfully" : "⚠️ Completed with Errors";
			const subject = `🌱 Dorkinians Website V3 - Database Seeding ${status} - ${summary.environment.toUpperCase()}`;

			const htmlBody = this.generateSeedingSummaryEmail(summary);
			const textBody = this.generateSeedingSummaryEmailText(summary);

			const mailOptions = {
				from: this.config.from,
				to: this.config.to,
				subject,
				html: htmlBody,
				text: textBody,
			};

			const info = await this.transporter.sendMail(mailOptions);
			console.log(`✅ Seeding summary email sent: ${info.messageId}`);
			return true;
		} catch (error) {
			console.error("❌ Failed to send seeding summary email:", error);
			return false;
		}
	}

	private generateCSVValidationSummaryEmail(summary: CSVValidationSummary): string {
		let html = `
      <h2>🚨 CSV Validation Issues Detected</h2>
      <p>The database seeding process has detected issues with CSV data sources:</p>
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      
      <h3>📊 Summary:</h3>
      <ul>
        <li><strong>Total Sources:</strong> ${summary.totalSources}</li>
        <li><strong>Valid Sources:</strong> ${summary.validSources}</li>
        <li><strong>Failed Sources:</strong> ${summary.failedSources}</li>
        <li><strong>Header Validation Failures:</strong> ${summary.headerFailures.length}</li>
        <li><strong>Access Failures:</strong> ${summary.accessFailures.length}</li>
      </ul>
    `;

		// Header validation failures
		if (summary.headerFailures.length > 0) {
			html += `
        <h3>🔍 Header Validation Failures (${summary.headerFailures.length}):</h3>
        <p>These data sources have changes in their CSV headers:</p>
      `;

			summary.headerFailures.forEach((failure, index) => {
				html += `
          <div style="margin: 20px 0; padding: 15px; border: 1px solid #ff6b6b; border-radius: 5px; background-color: #fff5f5;">
            <h4>${index + 1}. ${failure.sourceName}</h4>
            <p><strong>URL:</strong> <a href="${failure.url}">${failure.url}</a></p>

            <div style="margin: 10px 0;">
              <h5>Expected Headers:</h5>
              <code style="background-color: #f0f0f0; padding: 5px; border-radius: 3px;">${failure.expectedHeaders.join(", ")}</code>
            </div>

            <div style="margin: 10px 0;">
              <h5>Actual Headers:</h5>
              <code style="background-color: #f0f0f0; padding: 5px; border-radius: 3px;">${failure.actualHeaders.join(", ")}</code>
            </div>

            <div style="margin: 10px 0;">
              <h5>Missing Headers:</h5>
              <code style="background-color: #ffe6e6; padding: 5px; border-radius: 3px; color: #d63031;">${failure.missingHeaders.join(", ") || "None"}</code>
            </div>

            <div style="margin: 10px 0;">
              <h5>Extra Headers:</h5>
              <code style="background-color: #ffe6e6; padding: 5px; border-radius: 3px; color: #d63031;">${failure.extraHeaders.join(", ") || "None"}</code>
            </div>
          </div>
        `;
			});
		}

		// Access failures
		if (summary.accessFailures.length > 0) {
			html += `
        <h3>🔒 Access Failures (${summary.accessFailures.length}):</h3>
        <p>These data sources could not be accessed (likely permission or URL issues):</p>
      `;

			summary.accessFailures.forEach((failure, index) => {
				html += `
          <div style="margin: 20px 0; padding: 15px; border: 1px solid #e74c3c; border-radius: 5px; background-color: #fdf2f2;">
            <h4>${index + 1}. ${failure.sourceName}</h4>
            <p><strong>URL:</strong> <a href="${failure.url}">${failure.url}</a></p>
            <p><strong>Error:</strong> <span style="color: #e74c3c; font-weight: bold;">${failure.error}</span></p>
            
            <div style="margin: 10px 0;">
              <h5>Expected Headers:</h5>
              <code style="background-color: #f0f0f0; padding: 5px; border-radius: 3px;">${failure.expectedHeaders.join(", ")}</code>
            </div>
            
            <div style="margin: 10px 0; padding: 10px; background-color: #fff3cd; border-radius: 3px;">
              <strong>⚠️ Possible Causes:</strong>
              <ul style="margin: 5px 0; padding-left: 20px;">
                <li>Google Sheets tab is not published or has restricted access</li>
                <li>URL has changed or GID is incorrect</li>
                <li>Temporary Google Sheets service issue</li>
                <li>Network connectivity problems</li>
              </ul>
            </div>
          </div>
        `;
			});
		}

		html += `
      <h3>🔧 Required Actions:</h3>
      <ol>
    `;

		if (summary.headerFailures.length > 0) {
			html += `<li>For header validation failures: Update the header configuration in <code>lib/config/csvHeaders.ts</code></li>`;
		}

		if (summary.accessFailures.length > 0) {
			html += `
        <li>For access failures: 
          <ul>
            <li>Check Google Sheets permissions and publishing settings</li>
            <li>Verify URLs and GIDs in <code>netlify/functions/lib/config/dataSources.js</code></li>
            <li>Test URLs manually in a browser</li>
          </ul>
        </li>
      `;
		}

		html += `
        <li>Test the validation process again with <code>npm run test-headers</code></li>
        <li>Run seeding only after all issues are resolved</li>
      </ol>

      <p><strong>Note:</strong> Database seeding has been halted to prevent data corruption.</p>

      <hr>
      <p style="color: #666; font-size: 12px;">
        This email was automatically generated by the Dorkinians FC database seeding system.
      </p>
    `;

		return html;
	}

	private generateCSVHeaderValidationEmail(failures: CSVHeaderValidationFailure[]): string {
		let html = `
      <h2>🚨 CSV Header Validation Failed</h2>
      <p>The database seeding process has detected changes in CSV headers for the following data sources:</p>
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      <p><strong>Total Sources Affected:</strong> ${failures.length}</p>
      
      <h3>📊 Validation Failures:</h3>
    `;

		failures.forEach((failure, index) => {
			html += `
        <div style="margin: 20px 0; padding: 15px; border: 1px solid #ff6b6b; border-radius: 5px; background-color: #fff5f5;">
          <h4>${index + 1}. ${failure.sourceName}</h4>
          <p><strong>URL:</strong> <a href="${failure.url}">${failure.url}</a></p>
          
          <div style="margin: 10px 0;">
            <h5>Expected Headers:</h5>
            <code style="background-color: #f0f0f0; padding: 5px; border-radius: 3px;">${failure.expectedHeaders.join(", ")}</code>
          </div>
          
          <div style="margin: 10px 0;">
            <h5>Actual Headers:</h5>
            <code style="background-color: #f0f0f0; padding: 5px; border-radius: 3px;">${failure.actualHeaders.join(", ")}</code>
          </div>
          
          <div style="margin: 10px 0;">
            <h5>Missing Headers:</h5>
            <code style="background-color: #ffe6e6; padding: 5px; border-radius: 3px; color: #d63031;">${failure.missingHeaders.join(", ") || "None"}</code>
          </div>
          
          <div style="margin: 10px 0;">
            <h5>Extra Headers:</h5>
            <code style="background-color: #ffe6e6; padding: 5px; border-radius: 3px; color: #d63031;">${failure.extraHeaders.join(", ") || "None"}</code>
          </div>
        </div>
      `;
		});

		html += `
      <h3>🔧 Required Actions:</h3>
      <ol>
        <li>Review the CSV files in Google Sheets</li>
        <li>Update the header configuration in <code>lib/config/csvHeaders.ts</code></li>
        <li>Test the seeding process again</li>
      </ol>
      
      <p><strong>Note:</strong> Database seeding has been halted to prevent data corruption.</p>
      
      <hr>
      <p style="color: #666; font-size: 12px;">
        This email was automatically generated by the Dorkinians FC database seeding system.
      </p>
    `;

		return html;
	}

	private generateCSVValidationSummaryEmailText(summary: CSVValidationSummary): string {
		let text = `
CSV Validation Issues Detected

The database seeding process has detected issues with CSV data sources:

Time: ${new Date().toISOString()}

SUMMARY:
- Total Sources: ${summary.totalSources}
- Valid Sources: ${summary.validSources}
- Failed Sources: ${summary.failedSources}
- Header Validation Failures: ${summary.headerFailures.length}
- Access Failures: ${summary.accessFailures.length}
`;

		// Header validation failures
		if (summary.headerFailures.length > 0) {
			text += `

HEADER VALIDATION FAILURES (${summary.headerFailures.length}):
These data sources have changes in their CSV headers:
`;

			summary.headerFailures.forEach((failure, index) => {
				text += `
${index + 1}. ${failure.sourceName}
URL: ${failure.url}

Expected Headers: ${failure.expectedHeaders.join(", ")}
Actual Headers: ${failure.actualHeaders.join(", ")}
Missing Headers: ${failure.missingHeaders.join(", ") || "None"}
Extra Headers: ${failure.extraHeaders.join(", ") || "None"}

`;
			});
		}

		// Access failures
		if (summary.accessFailures.length > 0) {
			text += `

ACCESS FAILURES (${summary.accessFailures.length}):
These data sources could not be accessed (likely permission or URL issues):
`;

			summary.accessFailures.forEach((failure, index) => {
				text += `
${index + 1}. ${failure.sourceName}
URL: ${failure.url}
Error: ${failure.error}

Expected Headers: ${failure.expectedHeaders.join(", ")}

Possible Causes:
- Google Sheets tab is not published or has restricted access
- URL has changed or GID is incorrect
- Temporary Google Sheets service issue
- Network connectivity problems

`;
			});
		}

		text += `

REQUIRED ACTIONS:
`;

		if (summary.headerFailures.length > 0) {
			text += `1. For header validation failures: Update the header configuration in lib/config/csvHeaders.ts
`;
		}

		if (summary.accessFailures.length > 0) {
			text += `${summary.headerFailures.length > 0 ? "2" : "1"}. For access failures:
   - Check Google Sheets permissions and publishing settings
   - Verify URLs and GIDs in netlify/functions/lib/config/dataSources.js
   - Test URLs manually in a browser
`;
		}

		const nextActionNumber = (summary.headerFailures.length > 0 ? 1 : 0) + (summary.accessFailures.length > 0 ? 1 : 0) + 1;

		text += `${nextActionNumber}. Test the validation process again with: npm run test-headers
${nextActionNumber + 1}. Run seeding only after all issues are resolved

Note: Database seeding has been halted to prevent data corruption.

---
This email was automatically generated by the Dorkinians FC database seeding system.
`;

		return text;
	}

	private generateCSVHeaderValidationEmailText(failures: CSVHeaderValidationFailure[]): string {
		let text = `
CSV Header Validation Failed

The database seeding process has detected changes in CSV headers for the following data sources:

Time: ${new Date().toISOString()}
Total Sources Affected: ${failures.length}

VALIDATION FAILURES:
`;

		failures.forEach((failure, index) => {
			text += `
${index + 1}. ${failure.sourceName}
URL: ${failure.url}

Expected Headers: ${failure.expectedHeaders.join(", ")}
Actual Headers: ${failure.actualHeaders.join(", ")}
Missing Headers: ${failure.missingHeaders.join(", ") || "None"}
Extra Headers: ${failure.extraHeaders.join(", ") || "None"}

`;
		});

		text += `
REQUIRED ACTIONS:
1. Review the CSV files in Google Sheets
2. Update the header configuration in lib/config/csvHeaders.ts
3. Test the seeding process again

Note: Database seeding has been halted to prevent data corruption.

---
This email was automatically generated by the Dorkinians FC database seeding system.
`;

		return text;
	}

	private generateSeedingSummaryEmail(summary: SeedingSummary): string {
		const statusIcon = summary.success ? "✅" : "❌";
		const statusText = summary.success ? "SUCCESS" : "FAILED";
		const statusColor = summary.success ? "#10B981" : "#EF4444";

		// Create a link to the log file (assuming it's hosted somewhere accessible)
		const logFileUrl = this.getLogFileUrl();
		const logFileLink = logFileUrl
			? `<a href="${logFileUrl}" style="color: #3B82F6; text-decoration: underline;">View Error Log</a>`
			: "Error log not accessible";

		return `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<title>Database Seeding Report - ${statusText}</title>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background: ${statusColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
					.content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
					.status { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
					.summary { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
					.metric { display: flex; justify-content: space-between; margin: 8px 0; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
					.metric:last-child { border-bottom: none; }
					.label { font-weight: 600; color: #6b7280; }
					.value { font-weight: 600; color: #111827; }
					.error-section { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; margin: 15px 0; }
					.error-item { background: white; padding: 10px; border-radius: 4px; margin: 8px 0; border-left: 4px solid #ef4444; }
					.log-link { text-align: center; margin: 20px 0; }
					.log-link a { display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; }
					.footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<div class="status">${statusIcon} Database Seeding ${statusText}</div>
						<div>Dorkinians FC Website V3</div>
					</div>
					
					<div class="content">
						<div class="summary">
							<div class="metric">
								<span class="label">Environment:</span>
								<span class="value">${summary.environment}</span>
							</div>
							<div class="metric">
								<span class="label">Timestamp:</span>
								<span class="value">${new Date(summary.timestamp).toLocaleString("en-GB", { timeZone: "Europe/London" })}</span>
							</div>
							<div class="metric">
								<span class="label">Duration:</span>
								<span class="value">${summary.duration} seconds</span>
							</div>
							<div class="metric">
								<span class="label">Nodes Created:</span>
								<span class="value">${summary.nodesCreated}</span>
							</div>
							<div class="metric">
								<span class="label">Relationships Created:</span>
								<span class="value">${summary.relationshipsCreated}</span>
							</div>
							<div class="metric">
								<span class="label">Errors Found:</span>
								<span class="value" style="color: ${summary.errorCount > 0 ? "#ef4444" : "#10b981"}">${summary.errorCount}</span>
							</div>
						</div>
						
						${
							summary.errors && summary.errors.length > 0
								? `
							<div class="error-section">
								<h3 style="color: #dc2626; margin-top: 0;">❌ Errors Encountered</h3>
								${summary.errors
									.map(
										(error) => `
									<div class="error-item">
										<strong>Error:</strong> ${error}
									</div>
								`,
									)
									.join("")}
							</div>
						`
								: ""
						}
						
						<div class="log-link">
							<h3 style="margin-bottom: 15px;">📋 Detailed Error Log</h3>
							${logFileLink}
						</div>
      
						<div class="footer">
							<p>This is an automated report from the Dorkinians FC Website database seeding system.</p>
							<p>Generated on ${new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })}</p>
						</div>
					</div>
				</div>
			</body>
			</html>
		`;
	}

	private generateSeedingSummaryEmailText(summary: SeedingSummary): string {
		const statusIcon = summary.success ? "✅" : "❌";
		const statusText = summary.success ? "SUCCESS" : "FAILED";

		// Create a link to the log file
		const logFileUrl = this.getLogFileUrl();
		const logFileLink = logFileUrl ? `View Error Log: ${logFileUrl}` : "Error log not accessible";

		let text = `
${statusIcon} DATABASE SEEDING ${statusText}
Dorkinians FC Website V3

Environment: ${summary.environment}
Timestamp: ${new Date(summary.timestamp).toLocaleString("en-GB", { timeZone: "Europe/London" })}
Duration: ${summary.duration} seconds
Nodes Created: ${summary.nodesCreated}
Relationships Created: ${summary.relationshipsCreated}
Errors Found: ${summary.errorCount}

`;

		if (summary.errors && summary.errors.length > 0) {
			text += `ERRORS ENCOUNTERED:\n`;
			summary.errors.forEach((error, index) => {
				text += `${index + 1}. ${error}\n`;
			});
			text += `\n`;
		}

		text += `DETAILED ERROR LOG:\n${logFileLink}\n\n`;
		text += `Generated on ${new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })}\n`;
		text += `This is an automated report from the Dorkinians FC Website database seeding system.`;

		return text;
	}

	private getLogFileUrl(): string | null {
		// This method should return a URL to the seeding-errors.log file
		// You can customize this based on your hosting setup

		// Option 1: If you have a public URL for the log file
		// return 'https://your-domain.com/logs/seeding-errors.log';

		// Option 2: If you want to create a simple web endpoint to serve the log
		// return 'https://your-domain.com/api/logs/seeding-errors';

		// Option 3: For now, return null (no link)
		return null;
	}

	async testConnection(): Promise<boolean> {
		if (!this.transporter) {
			console.error("❌ Email service not configured");
			return false;
		}

		try {
			await this.transporter.verify();
			console.log("✅ Email service connection verified");
			return true;
		} catch (error) {
			console.error("❌ Email service connection failed:", error);
			return false;
		}
	}
}

export const emailService = EmailService.getInstance();
