import fs from "fs";
import os from "os";
import path from "path";

const {
	buildSectionsFromArtifacts,
	buildTestAllEmailInnerHtml,
	buildTestAllEmailPlainText,
	getTestAllArtifactPaths,
} = require("../../../lib/email/testAllSummaryEmail");

describe("test-all summary email helpers", () => {
	it("maps 10-wrapped to Wrapped and keeps it last", () => {
		const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "test-all-email-"));
		try {
			const paths = getTestAllArtifactPaths(tmpRoot);
			fs.mkdirSync(path.dirname(paths.junit), { recursive: true });
			fs.writeFileSync(
				paths.junit,
				`<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="root">
    <testcase name="wrapped test" file="__tests__/e2e/10-wrapped/wrapped.spec.ts" time="0.5" />
    <testcase name="stats test" file="__tests__/e2e/03-stats/stats.spec.ts" time="0.5" />
    <testcase name="cross test" file="__tests__/e2e/09-cross-cutting/cross.spec.ts" time="0.5" />
  </testsuite>
</testsuites>`,
				"utf8",
			);

			const sections = buildSectionsFromArtifacts({
				artifactsEnabled: true,
				repoRoot: tmpRoot,
				suitePass: {
					unit: true,
					integration: true,
					otherJest: true,
					e2e: true,
					chatbotReport: true,
					questionsReport: true,
				},
				logs: {},
			});

			const e2eSection = sections.find((s: any) => s.displayName === "E2E (Playwright)");
			expect(e2eSection).toBeDefined();
			expect(e2eSection.subsections.map((s: any) => s.name)).toEqual(["Player Stats", "Cross-Cutting", "Wrapped"]);
		} finally {
			fs.rmSync(tmpRoot, { recursive: true, force: true });
		}
	});

	it("renders non-wrapping status badges in html output", () => {
		const html = buildTestAllEmailInnerHtml({
			summaryItems: [{ name: "Unit Tests", result: false }],
			passedCount: 0,
			totalCount: 1,
			e2eSkippedCount: 0,
			e2eSkipNote: "",
			sections: [
				{
					displayName: "Unit",
					command: "jest --testPathPatterns=unit",
					suitePassed: false,
					subsections: [{ name: "Summary", passed: false }],
					counts: { passed: 0, failed: 1, skipped: 0 },
					detailTests: [],
				},
			],
		});

		expect(html).toContain("white-space:nowrap");
		expect(html).toContain("line-height:1");
		expect(html).toContain("role=\"presentation\"");
		expect(html).toContain("mso-line-height-rule:exactly");
		expect(html).toContain("width:1%");
	});

	it("creates named failed detail from suite-level Jest failure without assertionResults", () => {
		const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "test-all-email-jest-fallback-"));
		try {
			const paths = getTestAllArtifactPaths(tmpRoot);
			fs.mkdirSync(path.dirname(paths.jestUnit), { recursive: true });
			fs.writeFileSync(
				paths.jestUnit,
				JSON.stringify(
					{
						testResults: [
							{
								name: "__tests__/unit/utils/tokenUtils.test.ts",
								status: "failed",
								message: "ReferenceError: window is not defined",
								assertionResults: [],
							},
						],
					},
					null,
					2,
				),
				"utf8",
			);

			const sections = buildSectionsFromArtifacts({
				artifactsEnabled: true,
				repoRoot: tmpRoot,
				suitePass: {
					unit: false,
					integration: true,
					otherJest: true,
					e2e: true,
					chatbotReport: true,
					questionsReport: true,
				},
				logs: {},
			});
			const unitSection = sections.find((s: any) => s.displayName === "Unit");
			expect(unitSection).toBeDefined();
			expect(unitSection.counts.failed).toBe(1);
			expect(unitSection.detailTests).toHaveLength(1);
			expect(unitSection.detailTests[0].title).toBe("tokenUtils.test.ts");
			expect(unitSection.detailTests[0].status).toBe("failed");
			expect(unitSection.detailTests[0].message).toContain("window is not defined");

			const html = buildTestAllEmailInnerHtml({
				summaryItems: [{ name: "Unit Tests", result: false }],
				passedCount: 0,
				totalCount: 1,
				e2eSkippedCount: 0,
				e2eSkipNote: "",
				sections: [unitSection],
			});
			const text = buildTestAllEmailPlainText({
				summaryItems: [{ name: "Unit Tests", result: false }],
				passedCount: 0,
				totalCount: 1,
				e2eSkippedCount: 0,
				e2eSkipNote: "",
				sections: [unitSection],
			});

			expect(html).toContain("tokenUtils.test.ts");
			expect(text).toContain("[failed] tokenUtils.test.ts");
		} finally {
			fs.rmSync(tmpRoot, { recursive: true, force: true });
		}
	});

	it("includes database pipeline note in plain text output", () => {
		const text = buildTestAllEmailPlainText({
			summaryItems: [{ name: "Unit Tests", result: true }],
			passedCount: 1,
			totalCount: 1,
			e2eSkippedCount: 0,
			e2eSkipNote: "",
			sections: [
				{
					displayName: "Unit",
					command: "jest --testPathPatterns=unit",
					suitePassed: true,
					subsections: [{ name: "Summary", passed: true }],
					counts: { passed: 1, failed: 0, skipped: 0 },
					detailTests: [],
				},
			],
		});

		expect(text).toContain("Database package tests: run in the database-dorkinians repository pipeline.");
	});

	it("includes failed unit test titles in plain text when artifact details exist", () => {
		const text = buildTestAllEmailPlainText({
			summaryItems: [{ name: "Unit Tests", result: false }],
			passedCount: 0,
			totalCount: 1,
			e2eSkippedCount: 0,
			e2eSkipNote: "",
			sections: [
				{
					displayName: "Unit",
					command: "jest --testPathPatterns=unit",
					suitePassed: false,
					subsections: [{ name: "Summary", status: "failed" }],
					counts: { passed: 8, failed: 1, skipped: 0 },
					detailTests: [
						{
							title: "User auth › rejects expired token",
							status: "failed",
							durationSec: 0.2,
							message: "Expected token to be valid",
						},
					],
				},
			],
		});

		expect(text).toContain("User auth › rejects expired token");
		expect(text).toContain("[failed]");
	});

	it("adds deterministic fallback detail when a failed suite has no parsed test names", () => {
		const html = buildTestAllEmailInnerHtml({
			summaryItems: [{ name: "Unit Tests", result: false }],
			passedCount: 0,
			totalCount: 1,
			e2eSkippedCount: 0,
			e2eSkipNote: "",
			sections: [
				{
					displayName: "Unit",
					command: "jest --testPathPatterns=unit",
					suitePassed: false,
					subsections: [{ name: "Summary", status: "failed" }],
					counts: { passed: 3, failed: 1, skipped: 0 },
					detailTests: [],
				},
			],
		});
		const text = buildTestAllEmailPlainText({
			summaryItems: [{ name: "Unit Tests", result: false }],
			passedCount: 0,
			totalCount: 1,
			e2eSkippedCount: 0,
			e2eSkipNote: "",
			sections: [
				{
					displayName: "Unit",
					command: "jest --testPathPatterns=unit",
					suitePassed: false,
					subsections: [{ name: "Summary", status: "failed" }],
					counts: { passed: 3, failed: 1, skipped: 0 },
					detailTests: [],
				},
			],
		});

		expect(html).toContain("Failing test details unavailable");
		expect(text).toContain("Failing test details unavailable in artifacts");
	});

	it("marks skipped-only E2E folders as SKIPPED, not FAILED", () => {
		const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "test-all-email-skips-"));
		try {
			const paths = getTestAllArtifactPaths(tmpRoot);
			fs.mkdirSync(path.dirname(paths.junit), { recursive: true });
			fs.writeFileSync(
				paths.junit,
				`<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="root">
    <testcase name="home skipped test" file="__tests__/e2e/02-home/home.spec.ts" time="0.2">
      <skipped />
    </testcase>
  </testsuite>
</testsuites>`,
				"utf8",
			);

			const sections = buildSectionsFromArtifacts({
				artifactsEnabled: true,
				repoRoot: tmpRoot,
				suitePass: {
					unit: true,
					integration: true,
					otherJest: true,
					e2e: true,
					chatbotReport: true,
					questionsReport: true,
				},
				logs: {},
			});
			const e2eSection = sections.find((s: any) => s.displayName === "E2E (Playwright)");
			expect(e2eSection).toBeDefined();
			expect(e2eSection.subsections).toEqual([{ name: "Home", status: "skipped", passed: false }]);

			const text = buildTestAllEmailPlainText({
				summaryItems: [{ name: "E2E Tests", result: true }],
				passedCount: 1,
				totalCount: 1,
				e2eSkippedCount: 1,
				e2eSkipNote: "Expected skips",
				sections: [e2eSection],
			});
			expect(text).toContain("  - Home: SKIPPED");
			expect(text).not.toContain("  - Home: FAILED");
		} finally {
			fs.rmSync(tmpRoot, { recursive: true, force: true });
		}
	});
});
