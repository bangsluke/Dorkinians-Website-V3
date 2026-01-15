import { z } from "zod";
import { logError } from "@/lib/utils/logger";

// Environment variable validation schema
const envSchema = z.object({
	// Neo4j Database (required)
	PROD_NEO4J_URI: z.string().url("PROD_NEO4J_URI must be a valid URL"),
	PROD_NEO4J_USER: z.string().min(1, "PROD_NEO4J_USER is required"),
	PROD_NEO4J_PASSWORD: z.string().min(1, "PROD_NEO4J_PASSWORD is required"),

	// API Security (required)
	SEED_API_KEY: z.string().min(32, "SEED_API_KEY must be at least 32 characters for security"),

	// CORS Configuration (optional - defaults to production URL)
	ALLOWED_ORIGIN: z.string().url("ALLOWED_ORIGIN must be a valid URL").optional(),

	// Email Configuration (optional)
	SMTP_SERVER: z.string().optional(),
	SMTP_PORT: z.string().optional(),
	SMTP_USERNAME: z.string().optional(),
	SMTP_PASSWORD: z.string().optional(),
	SMTP_FROM_EMAIL: z.string().email().optional(),
	SMTP_TO_EMAIL: z.string().email().optional(),
	SMTP_EMAIL_SECURE: z.string().optional(),

	// Umami Analytics (optional)
	NEXT_PUBLIC_UMAMI_SCRIPT_URL: z.string().url().optional(),
	NEXT_PUBLIC_UMAMI_WEBSITE_ID: z.string().optional(),

	// App Version (optional)
	NEXT_PUBLIC_APP_VERSION: z.string().optional(),

	// Heroku Seeder URL (optional)
	HEROKU_SEEDER_URL: z.string().url().optional(),

	// Authentication (required for admin access)
	AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters for security"),
	AUTH_GOOGLE_ID: z.string().min(1, "AUTH_GOOGLE_ID is required"),
	AUTH_GOOGLE_SECRET: z.string().min(1, "AUTH_GOOGLE_SECRET is required"),
	AUTH_URL: z.string().url("AUTH_URL must be a valid URL"),
	// NEXTAUTH_URL is optional - NextAuth v5 prefers AUTH_URL but will fall back to NEXTAUTH_URL
	NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL").optional(),
});

type Env = z.infer<typeof envSchema>;

// Validate environment variables
export function validateEnv(): { success: true; env: Env } | { success: false; errors: string[] } {
	try {
		const env = envSchema.parse(process.env);
		return { success: true, env };
	} catch (error) {
		if (error instanceof z.ZodError) {
			const errors = error.issues.map((err) => {
				const path = err.path.join(".");
				return `${path}: ${err.message}`;
			});
			return { success: false, errors };
		}
		return { success: false, errors: ["Unknown validation error"] };
	}
}

// Validate and throw if invalid (for use at app startup)
export function validateEnvOrThrow(): Env {
	const result = validateEnv();
	if (result.success === false) {
		const errorMessage = `Environment variable validation failed:\n${result.errors.join("\n")}`;
		logError("Environment variable validation failed", new Error(errorMessage));
		throw new Error(errorMessage);
	}
	return result.env;
}

// Get validated environment variables (returns validated env or throws)
export function getValidatedEnv(): Env {
	return validateEnvOrThrow();
}
