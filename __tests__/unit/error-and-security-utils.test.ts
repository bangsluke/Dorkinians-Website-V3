import { getBaseSecurityHeaders, getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";
import { sanitizeError, validateErrorResponse } from "@/lib/utils/errorSanitizer";
import { logError } from "@/lib/utils/logger";

jest.mock("@/lib/utils/logger", () => ({
	logError: jest.fn(),
}));

// Pure unit checks for security header builders and error sanitization/validation helpers.
// Logger is mocked; no DB or HTTP. Assertions pin header names/CSP nonce wiring and prod vs dev error redaction behavior.

describe("Unit - securityHeaders and errorSanitizer", () => {
	test("getBaseSecurityHeaders returns expected core hardening headers", () => {
		// Act: build default security header map
		const headers = getBaseSecurityHeaders();
		// Assert: key hardening directives are present
		expect(headers["X-Frame-Options"]).toBe("DENY");
		expect(headers["X-Content-Type-Options"]).toBe("nosniff");
		expect(headers["Strict-Transport-Security"]).toContain("max-age=31536000");
	});

	test("getCorsHeadersWithSecurity injects nonce and origin override", () => {
		// Arrange & act: merge CORS + CSP with explicit origin and nonce
		const headers = getCorsHeadersWithSecurity("https://example.com", "abc123");
		// Assert: allow-origin and CSP nonce reflect inputs
		expect(headers["Access-Control-Allow-Origin"]).toBe("https://example.com");
		expect(headers["Content-Security-Policy"]).toContain("'nonce-abc123'");
	});

	test("sanitizeError in production returns generic message and logs real error", () => {
		// Arrange: sensitive error in production mode
		const err = new Error("database password leaked");
		// Act: sanitize for client-facing payload
		const sanitized = sanitizeError(err, true);
		// Assert: generic message, no details leak, logger invoked server-side
		expect(sanitized.message).toMatch(/an error occurred/i);
		expect(sanitized.details).toBeUndefined();
		expect(logError).toHaveBeenCalledWith("Error details (server-side only)", err);
	});

	test("sanitizeError in development exposes message/details", () => {
		// Arrange: development-mode flag
		const err = new Error("debug details");
		// Act & assert: richer error surface for engineers
		const sanitized = sanitizeError(err, false);
		expect(sanitized.message).toBe("debug details");
		expect(sanitized.details).toContain("Error: debug details");
	});

	test("validateErrorResponse blocks sensitive payload patterns", () => {
		// Assert: sensitive internals rejected
		expect(validateErrorResponse({ error: "neo4j connection failed" })).toBe(false);
		// Assert: safe user-facing text allowed
		expect(validateErrorResponse({ error: "safe message only" })).toBe(true);
	});
});
