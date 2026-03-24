import { getBaseSecurityHeaders, getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";
import { sanitizeError, validateErrorResponse } from "@/lib/utils/errorSanitizer";
import { logError } from "@/lib/utils/logger";

jest.mock("@/lib/utils/logger", () => ({
	logError: jest.fn(),
}));

describe("Unit - securityHeaders and errorSanitizer", () => {
	test("getBaseSecurityHeaders returns expected core hardening headers", () => {
		const headers = getBaseSecurityHeaders();
		expect(headers["X-Frame-Options"]).toBe("DENY");
		expect(headers["X-Content-Type-Options"]).toBe("nosniff");
		expect(headers["Strict-Transport-Security"]).toContain("max-age=31536000");
	});

	test("getCorsHeadersWithSecurity injects nonce and origin override", () => {
		const headers = getCorsHeadersWithSecurity("https://example.com", "abc123");
		expect(headers["Access-Control-Allow-Origin"]).toBe("https://example.com");
		expect(headers["Content-Security-Policy"]).toContain("'nonce-abc123'");
	});

	test("sanitizeError in production returns generic message and logs real error", () => {
		const err = new Error("database password leaked");
		const sanitized = sanitizeError(err, true);
		expect(sanitized.message).toMatch(/an error occurred/i);
		expect(sanitized.details).toBeUndefined();
		expect(logError).toHaveBeenCalledWith("Error details (server-side only)", err);
	});

	test("sanitizeError in development exposes message/details", () => {
		const err = new Error("debug details");
		const sanitized = sanitizeError(err, false);
		expect(sanitized.message).toBe("debug details");
		expect(sanitized.details).toContain("Error: debug details");
	});

	test("validateErrorResponse blocks sensitive payload patterns", () => {
		expect(validateErrorResponse({ error: "neo4j connection failed" })).toBe(false);
		expect(validateErrorResponse({ error: "safe message only" })).toBe(true);
	});
});
