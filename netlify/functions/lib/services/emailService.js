const nodemailer = require("nodemailer");

class EmailService {
	constructor() {
		this.transporter = null;
		this.config = null;
	}

	static getInstance() {
		if (!EmailService.instance) {
			EmailService.instance = new EmailService();
		}
		return EmailService.instance;
	}

	configure() {
		// Load configuration from environment variables
		this.config = {
			host: process.env.SMTP_SERVER,
			port: parseInt(process.env.SMTP_PORT) || 587,
			secure: process.env.SMTP_EMAIL_SECURE === 'true',
			auth: {
				user: process.env.SMTP_USERNAME,
				pass: process.env.SMTP_PASSWORD,
			},
			from: process.env.SMTP_FROM_EMAIL,
			to: process.env.SMTP_TO_EMAIL,
		};

		if (!this.config.host || !this.config.auth.user || !this.config.auth.pass) {
			console.warn('⚠️ EMAIL: Missing required SMTP configuration');
			return;
		}

		this.transporter = nodemailer.createTransport({
			host: this.config.host,
			port: this.config.port,
			secure: this.config.secure,
			auth: {
				user: this.config.auth.user,
				pass: this.config.auth.pass,
			},
			tls: {
				rejectUnauthorized: process.env.NODE_ENV === "production",
				...((process.env.NODE_ENV !== "production") && {
					rejectUnauthorized: false,
					checkServerIdentity: () => undefined
				})
			},
		});

		console.log('📧 EMAIL: Email service configured successfully');
	}

	async sendCSVHeaderValidationFailure(failures) {
		// Convert old interface to new summary format for backward compatibility
		const summary = {
			headerFailures: failures.filter((f) => !f.error),
			accessFailures: failures.filter((f) => f.error),
			totalSources: failures.length,
			validSources: 0,
			failedSources: failures.length,
		};

		return this.sendCSVValidationSummary(summary);
	}

	async sendCSVValidationSummary(summary) {
		if (!this.transporter || !this.config) {
			console.error("❌ Email service not configured");
			return false;
		}

		try {
			const totalFailures = summary.headerFailures.length + summary.accessFailures.length;
			const subject = `🚨 Dorkinians Website V3 - CSV Validation Issues - ${totalFailures} data source(s) affected`;

			const htmlBody = this.generateCSVValidationSummaryEmail(summary);

			const mailOptions = {
				from: this.config.from,
				to: this.config.to,
				subject: subject,
				html: htmlBody,
			};

			const info = await this.transporter.sendMail(mailOptions);
			console.log("✅ CSV validation summary email sent successfully:", info.messageId);
			return true;
		} catch (error) {
			console.error("❌ Failed to send CSV validation summary email:", error);
			return false;
		}
	}

	async sendSeedingStartEmail(environment, jobId = 'unknown') {
		try {
			console.log('📧 EMAIL: Sending seeding start email...');
			
			if (!this.transporter || !this.config) {
				console.warn('⚠️ EMAIL: Email service not configured');
				return;
			}

			const mailOptions = {
				from: this.config.from,
				to: this.config.to,
				subject: `🌱 Database Seeding Started - ${environment.toUpperCase()} - Job: ${jobId}`,
				html: `
					<h2>🚀 Database Seeding Process Started</h2>
					<p><strong>Environment:</strong> ${environment.toUpperCase()}</p>
					<p><strong>Job ID:</strong> ${jobId}</p>
					<p><strong>Start Time:</strong> ${new Date().toLocaleString()}</p>
					<p><strong>Status:</strong> Seeding process is now running in the background</p>
					<hr>
					<p><em>This is an automated notification. The seeding process will continue running and you will receive a completion email when it finishes.</em></p>
				`
			};

			const info = await this.transporter.sendMail(mailOptions);
			console.log('✅ EMAIL: Start notification sent successfully:', info.messageId);
			return info.messageId;
		} catch (error) {
			console.error('❌ EMAIL: Failed to send start notification:', error);
			throw error;
		}
	}

	async sendSeedingSummaryEmail({ success, environment, jobId = 'unknown', nodesCreated, relationshipsCreated, errorCount, errors, duration }) {
		try {
			console.log('📧 EMAIL: Sending seeding summary email...');
			
			if (!this.transporter || !this.config) {
				console.warn('⚠️ EMAIL: Email service not configured');
				return;
			}

			const statusIcon = success ? '✅' : '❌';
			const statusText = success ? 'Completed Successfully' : 'Failed';
			const durationText = duration ? `${Math.round(duration / 1000)} seconds` : 'Unknown';

			const mailOptions = {
				from: this.config.from,
				to: this.config.to,
				subject: `${statusIcon} Database Seeding ${statusText} - ${environment.toUpperCase()} - Job: ${jobId}`,
				html: `
					<h2>${statusIcon} Database Seeding ${statusText}</h2>
					<p><strong>Environment:</strong> ${environment.toUpperCase()}</p>
					<p><strong>Job ID:</strong> ${jobId}</p>
					<p><strong>Status:</strong> ${statusText}</p>
					<p><strong>Completion Time:</strong> ${new Date().toLocaleString()}</p>
					<p><strong>Duration:</strong> ${durationText}</p>
					
					<h3>📊 Results Summary</h3>
					<p><strong>Nodes Created:</strong> ${nodesCreated}</p>
					<p><strong>Relationships Created:</strong> ${relationshipsCreated}</p>
					<p><strong>Error Count:</strong> ${errorCount}</p>
					
					${errors && errors.length > 0 ? `
						<h3>❌ Errors Encountered</h3>
						<ul>
							${errors.map(error => `<li>${error}</li>`).join('')}
						</ul>
					` : ''}
					
					<hr>
					<p><em>This is an automated notification from the Dorkinians FC Statistics Website seeding system.</em></p>
				`
			};

			const info = await this.transporter.sendMail(mailOptions);
			console.log('✅ EMAIL: Summary email sent successfully:', info.messageId);
			return info.messageId;
		} catch (error) {
			console.error('❌ EMAIL: Failed to send summary email:', error);
			throw error;
		}
	}

	generateCSVValidationSummaryEmail(summary) {
		const totalFailures = summary.headerFailures.length + summary.accessFailures.length;
		const validSources = summary.totalSources - summary.failedSources;

		let htmlBody = `
			<h2>🚨 CSV Validation Issues Detected</h2>
			<p><strong>Total Data Sources:</strong> ${summary.totalSources}</p>
			<p><strong>Valid Sources:</strong> ${validSources}</p>
			<p><strong>Failed Sources:</strong> ${summary.failedSources}</p>
			<p><strong>Total Issues:</strong> ${totalFailures}</p>
			<p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
		`;

		if (summary.headerFailures.length > 0) {
			htmlBody += `
				<h3>📋 Header Mismatch Issues (${summary.headerFailures.length})</h3>
				<table border="1" style="border-collapse: collapse; width: 100%; margin: 10px 0;">
					<tr style="background-color: #f2f2f2;">
						<th style="padding: 8px; text-align: left;">Source</th>
						<th style="padding: 8px; text-align: left;">Expected Headers</th>
						<th style="padding: 8px; text-align: left;">Actual Headers</th>
						<th style="padding: 8px; text-align: left;">Missing</th>
						<th style="padding: 8px; text-align: left;">Extra</th>
					</tr>
			`;

			summary.headerFailures.forEach(failure => {
				htmlBody += `
					<tr>
						<td style="padding: 8px;">${failure.sourceName}</td>
						<td style="padding: 8px;">${failure.expectedHeaders.join(', ')}</td>
						td style="padding: 8px;">${failure.actualHeaders.join(', ')}</td>
						<td style="padding: 8px;">${failure.missingHeaders.join(', ')}</td>
						<td style="padding: 8px;">${failure.extraHeaders.join(', ')}</td>
					</tr>
				`;
			});

			htmlBody += '</table>';
		}

		if (summary.accessFailures.length > 0) {
			htmlBody += `
				<h3>🔒 Access Issues (${summary.accessFailures.length})</h3>
				<table border="1" style="border-collapse: collapse; width: 100%; margin: 10px 0;">
					<tr style="background-color: #f2f2f2;">
						<th style="padding: 8px; text-align: left;">Source</th>
						<th style="padding: 8px; text-align: left;">Error</th>
						<th style="padding: 8px; text-align: left;">URL</th>
					</tr>
			`;

			summary.accessFailures.forEach(failure => {
				htmlBody += `
					<tr>
						td style="padding: 8px;">${failure.sourceName}</td>
						<td style="padding: 8px;">${failure.error}</td>
						<td style="padding: 8px;">${failure.url}</td>
					</tr>
				`;
			});

			htmlBody += '</table>';
		}

		htmlBody += `
			<hr>
			<p><em>This is an automated notification from the Dorkinians FC Statistics Website CSV validation system.</em></p>
			<p><strong>Action Required:</strong> Please review and fix the issues above to ensure data integrity.</p>
		`;

		return htmlBody;
	}

	async sendTestEmail() {
		if (!this.transporter || !this.config) {
			console.error("❌ Email service not configured");
			return false;
		}

		try {
			const mailOptions = {
				from: this.config.from,
				to: this.config.to,
				subject: "🧪 Test Email - Dorkinians Website V3",
				html: `
					<h2>🧪 Test Email</h2>
					<p>This is a test email to verify the email service configuration.</p>
					<p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
					<p><strong>Environment:</strong> ${process.env.NODE_ENV || 'unknown'}</p>
					<hr>
					<p><em>If you receive this email, the email service is working correctly.</em></p>
				`,
			};

			const info = await this.transporter.sendMail(mailOptions);
			console.log("✅ Test email sent successfully:", info.messageId);
			return true;
		} catch (error) {
			console.error("❌ Failed to send test email:", error);
			return false;
		}
	}
}

// Create and export singleton instance
const emailService = new EmailService();

module.exports = {
	EmailService,
	emailService
};
