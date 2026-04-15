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
});
