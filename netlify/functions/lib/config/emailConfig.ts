import { EmailConfig } from "@/lib/services/emailService";

export const getEmailConfig = (): EmailConfig | null => {
	// Check if email configuration is available
	const host = process.env.SMTP_SERVER;
	const port = process.env.SMTP_PORT;
	const user = process.env.SMTP_USERNAME;
	const pass = process.env.SMTP_PASSWORD;
	const from = process.env.SMTP_FROM_EMAIL;
	const to = process.env.SMTP_TO_EMAIL;

	if (!host || !port || !user || !pass || !from || !to) {
		console.warn("⚠️ Email configuration incomplete. CSV header validation failures will not be emailed.");
		console.warn("   Required environment variables: SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL, SMTP_TO_EMAIL");
		return null;
	}

	return {
		host,
		port: parseInt(port, 10),
		secure: process.env.SMTP_EMAIL_SECURE === "true",
		auth: {
			user,
			pass,
		},
		from,
		to,
	};
};

export const isEmailConfigured = (): boolean => {
	return getEmailConfig() !== null;
};
