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
			const { unansweredQuestionLogger } = mocked();
			unansweredQuestionLogger.getUnansweredQuestions.mockResolvedValue([{ id: 1 }, { id: 2 }]);
			const { GET } = await import("../../app/api/admin/unanswered-questions/route");

			const res = await GET({} as any);
			const json = await res.json();

			expect(res.status).toBe(200);
			expect(json.success).toBe(true);
			expect(json.count).toBe(2);
		});

		test("GET returns 500 on logger error", async () => {
			const { unansweredQuestionLogger } = mocked();
			unansweredQuestionLogger.getUnansweredQuestions.mockRejectedValue(new Error("boom"));
			const { GET } = await import("../../app/api/admin/unanswered-questions/route");

			const res = await GET({} as any);
			expect(res.status).toBe(500);
		});

		test("DELETE clears single question when timestamp provided", async () => {
			const { unansweredQuestionLogger } = mocked();
			const { DELETE } = await import("../../app/api/admin/unanswered-questions/route");
			const req = { url: "http://localhost/api/admin/unanswered-questions?timestamp=123" } as any;

			const res = await DELETE(req);
			const json = await res.json();

			expect(unansweredQuestionLogger.clearQuestion).toHaveBeenCalledWith("123");
			expect(json.success).toBe(true);
		});

		test("DELETE clears all when timestamp missing", async () => {
			const { unansweredQuestionLogger } = mocked();
			const { DELETE } = await import("../../app/api/admin/unanswered-questions/route");
			const req = { url: "http://localhost/api/admin/unanswered-questions" } as any;

			const res = await DELETE(req);
			expect(unansweredQuestionLogger.clearAllQuestions).toHaveBeenCalled();
			expect(res.status).toBe(200);
		});
	});

	describe("player-data-filtered route", () => {
		test("returns rate limiter response when limited", async () => {
			const { dataApiRateLimiter } = mocked();
			dataApiRateLimiter.mockResolvedValue(NextResponse.json({ error: "limited" }, { status: 429 }));
			const { POST } = await import("../../app/api/player-data-filtered/route");

			const req = new Request("http://localhost/api/player-data-filtered", {
				method: "POST",
				body: JSON.stringify({ playerName: "Luke", filters: {} }),
			});
			const res = await POST(req as any);
			expect(res.status).toBe(429);
		});

		test("returns csrf response when token invalid", async () => {
			const { dataApiRateLimiter, csrfProtection } = mocked();
			dataApiRateLimiter.mockResolvedValue(null);
			csrfProtection.mockReturnValue(NextResponse.json({ error: "csrf" }, { status: 403 }));
			const { POST } = await import("../../app/api/player-data-filtered/route");

			const req = new Request("http://localhost/api/player-data-filtered", {
				method: "POST",
				body: JSON.stringify({ playerName: "Luke", filters: {} }),
			});
			const res = await POST(req as any);
			expect(res.status).toBe(403);
		});

		test("returns 400 for invalid player name", async () => {
			const { dataApiRateLimiter, csrfProtection } = mocked();
			dataApiRateLimiter.mockResolvedValue(null);
			csrfProtection.mockReturnValue(null);
			const { POST } = await import("../../app/api/player-data-filtered/route");

			const req = new Request("http://localhost/api/player-data-filtered", {
				method: "POST",
				body: JSON.stringify({ playerName: "", filters: {} }),
			});
			const res = await POST(req as any);
			expect(res.status).toBe(400);
		});

		test("returns 500 on db connect failure", async () => {
			const { dataApiRateLimiter, csrfProtection, neo4jService } = mocked();
			dataApiRateLimiter.mockResolvedValue(null);
			csrfProtection.mockReturnValue(null);
			neo4jService.connect.mockResolvedValue(false);
			const { POST } = await import("../../app/api/player-data-filtered/route");

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
			const { dataApiRateLimiter, csrfProtection } = mocked();
			dataApiRateLimiter.mockResolvedValue(null);
			csrfProtection.mockReturnValue(null);
			const { POST } = await import("../../app/api/team-data-filtered/route");

			const req = new Request("http://localhost/api/team-data-filtered", {
				method: "POST",
				body: JSON.stringify({ teamName: "", filters: {} }),
			});
			const res = await POST(req as any);
			expect(res.status).toBe(400);
		});

		test("returns server error when query preparation/execution fails", async () => {
			const { dataApiRateLimiter, csrfProtection, neo4jService } = mocked();
			dataApiRateLimiter.mockResolvedValue(null);
			csrfProtection.mockReturnValue(null);
			neo4jService.connect.mockResolvedValue(true);
			neo4jService.runQuery.mockResolvedValue({ records: [] });
			const { POST } = await import("../../app/api/team-data-filtered/route");

			const req = new Request("http://localhost/api/team-data-filtered", {
				method: "POST",
				body: JSON.stringify({ teamName: "Whole Club", filters: { timeRange: { type: "allTime" } } }),
			});
			const res = await POST(req as any);
			expect(res.status).toBe(500);
		});
	});
});
