import { NextResponse } from "next/server";

jest.mock("../../lib/services/unansweredQuestionLogger", () => ({
	unansweredQuestionLogger: {
		getUnansweredQuestions: jest.fn(),
		clearQuestion: jest.fn(),
		clearAllQuestions: jest.fn(),
	},
}));

jest.mock("../../lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn(),
		runQuery: jest.fn(),
		getGraphLabel: jest.fn(() => "test-graph"),
	},
}));

jest.mock("../../lib/middleware/rateLimiter", () => ({
	dataApiRateLimiter: jest.fn(),
}));

jest.mock("../../lib/middleware/csrf", () => ({
	csrfProtection: jest.fn(),
	getCsrfHeaders: jest.fn(() => ({})),
}));

jest.mock("../../app/api/player-data/route", () => ({
	buildPlayerStatsQuery: jest.fn(() => ({ query: "MATCH (n) RETURN n", params: { graphLabel: "test-graph", playerName: "Luke" } })),
	buildFilterConditions: jest.fn(() => []),
}));

// Next.js route handler integration with Neo4j, rate limiting, CSRF, and admin logger collaborators mocked—no real HTTP server or DB.
// Tests dynamic-import routes per case to pick up fresh mock implementations. Request/Response objects are minimal stubs.
// Failures usually indicate handler guard order or mock wiring drift rather than external network issues.

const mocked = () => {
	const { unansweredQuestionLogger } = require("../../lib/services/unansweredQuestionLogger");
	const { neo4jService } = require("../../lib/neo4j");
	const { dataApiRateLimiter } = require("../../lib/middleware/rateLimiter");
	const { csrfProtection } = require("../../lib/middleware/csrf");
	return { unansweredQuestionLogger, neo4jService, dataApiRateLimiter, csrfProtection };
};

describe("API integration coverage", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("admin unanswered questions route", () => {
		test("GET returns questions and count", async () => {
			// Arrange: logger returns a small backlog
			const { unansweredQuestionLogger } = mocked();
			unansweredQuestionLogger.getUnansweredQuestions.mockResolvedValue([{ id: 1 }, { id: 2 }]);
			const { GET } = await import("../../app/api/admin/unanswered-questions/route");

			// Act: invoke GET handler
			const res = await GET({} as any);
			const json = await res.json();

			// Assert: success envelope with count
			expect(res.status).toBe(200);
			expect(json.success).toBe(true);
			expect(json.count).toBe(2);
		});

		test("GET returns 500 on logger error", async () => {
			// Arrange: logger throws to simulate persistence failure
			const { unansweredQuestionLogger } = mocked();
			unansweredQuestionLogger.getUnansweredQuestions.mockRejectedValue(new Error("boom"));
			const { GET } = await import("../../app/api/admin/unanswered-questions/route");

			// Act & assert: error surfaces as 500
			const res = await GET({} as any);
			expect(res.status).toBe(500);
		});

		test("DELETE clears single question when timestamp provided", async () => {
			// Arrange: DELETE with query param targeting one entry
			const { unansweredQuestionLogger } = mocked();
			const { DELETE } = await import("../../app/api/admin/unanswered-questions/route");
			const req = { url: "http://localhost/api/admin/unanswered-questions?timestamp=123" } as any;

			// Act: clear specific timestamp
			const res = await DELETE(req);
			const json = await res.json();

			// Assert: targeted clear + success body
			expect(unansweredQuestionLogger.clearQuestion).toHaveBeenCalledWith("123");
			expect(json.success).toBe(true);
		});

		test("DELETE clears all when timestamp missing", async () => {
			// Arrange: DELETE without timestamp → bulk clear path
			const { unansweredQuestionLogger } = mocked();
			const { DELETE } = await import("../../app/api/admin/unanswered-questions/route");
			const req = { url: "http://localhost/api/admin/unanswered-questions" } as any;

			// Act & assert: clearAll invoked with 200
			const res = await DELETE(req);
			expect(unansweredQuestionLogger.clearAllQuestions).toHaveBeenCalled();
			expect(res.status).toBe(200);
		});
	});

	describe("player-data-filtered route", () => {
		test("returns rate limiter response when limited", async () => {
			// Arrange: rate limiter short-circuits before business logic
			const { dataApiRateLimiter } = mocked();
			dataApiRateLimiter.mockResolvedValue(NextResponse.json({ error: "limited" }, { status: 429 }));
			const { POST } = await import("../../app/api/player-data-filtered/route");

			// Act: POST with valid-shaped body still hits limiter
			const req = new Request("http://localhost/api/player-data-filtered", {
				method: "POST",
				body: JSON.stringify({ playerName: "Luke", filters: {} }),
			});
			const res = await POST(req as any);
			// Assert: 429 forwarded from limiter
			expect(res.status).toBe(429);
		});

		test("returns csrf response when token invalid", async () => {
			// Arrange: pass rate limit then fail CSRF gate
			const { dataApiRateLimiter, csrfProtection } = mocked();
			dataApiRateLimiter.mockResolvedValue(null);
			csrfProtection.mockReturnValue(NextResponse.json({ error: "csrf" }, { status: 403 }));
			const { POST } = await import("../../app/api/player-data-filtered/route");

			// Act & assert: forbidden before DB
			const req = new Request("http://localhost/api/player-data-filtered", {
				method: "POST",
				body: JSON.stringify({ playerName: "Luke", filters: {} }),
			});
			const res = await POST(req as any);
			expect(res.status).toBe(403);
		});

		test("returns 400 for invalid player name", async () => {
			// Arrange: guards pass but payload fails validation
			const { dataApiRateLimiter, csrfProtection } = mocked();
			dataApiRateLimiter.mockResolvedValue(null);
			csrfProtection.mockReturnValue(null);
			const { POST } = await import("../../app/api/player-data-filtered/route");

			// Act & assert: empty player name rejected
			const req = new Request("http://localhost/api/player-data-filtered", {
				method: "POST",
				body: JSON.stringify({ playerName: "", filters: {} }),
			});
			const res = await POST(req as any);
			expect(res.status).toBe(400);
		});

		test("returns 500 on db connect failure", async () => {
			// Arrange: validation passes but graph connect fails
			const { dataApiRateLimiter, csrfProtection, neo4jService } = mocked();
			dataApiRateLimiter.mockResolvedValue(null);
			csrfProtection.mockReturnValue(null);
			neo4jService.connect.mockResolvedValue(false);
			const { POST } = await import("../../app/api/player-data-filtered/route");

			// Act & assert: connection error becomes 500
			const req = new Request("http://localhost/api/player-data-filtered", {
				method: "POST",
				body: JSON.stringify({ playerName: "Luke", filters: { timeRange: { type: "allTime" } } }),
			});
			const res = await POST(req as any);
			expect(res.status).toBe(500);
		});
	});

	describe("team-data-filtered route", () => {
		test("returns 400 for invalid team name", async () => {
			// Arrange: team route with empty teamName after middleware passes
			const { dataApiRateLimiter, csrfProtection } = mocked();
			dataApiRateLimiter.mockResolvedValue(null);
			csrfProtection.mockReturnValue(null);
			const { POST } = await import("../../app/api/team-data-filtered/route");

			// Act & assert: validation error
			const req = new Request("http://localhost/api/team-data-filtered", {
				method: "POST",
				body: JSON.stringify({ teamName: "", filters: {} }),
			});
			const res = await POST(req as any);
			expect(res.status).toBe(400);
		});

		test("returns server error when query preparation/execution fails", async () => {
			// Arrange: DB connects but downstream processing still errors (mocked empty records path)
			const { dataApiRateLimiter, csrfProtection, neo4jService } = mocked();
			dataApiRateLimiter.mockResolvedValue(null);
			csrfProtection.mockReturnValue(null);
			neo4jService.connect.mockResolvedValue(true);
			neo4jService.runQuery.mockResolvedValue({ records: [] });
			const { POST } = await import("../../app/api/team-data-filtered/route");

			// Act & assert: handler surfaces 500 for this failure mode
			const req = new Request("http://localhost/api/team-data-filtered", {
				method: "POST",
				body: JSON.stringify({ teamName: "Whole Club", filters: { timeRange: { type: "allTime" } } }),
			});
			const res = await POST(req as any);
			expect(res.status).toBe(500);
		});
	});
});
