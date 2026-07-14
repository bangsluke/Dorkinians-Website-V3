/**
 * Build / refresh E2E_FIX_TRACKER.md from Playwright JSON baseline.
 * Usage:
 *   node __tests__/e2e/scripts/build-tracker.mjs __tests__/e2e/.baseline.json
 */
import fs from "fs";
import path from "path";

const input = process.argv[2] || "__tests__/e2e/.baseline.json";
const trackerPath = path.join(path.dirname(input), "E2E_FIX_TRACKER.md");
const raw = fs.readFileSync(input, "utf8");
const start = raw.indexOf("{");
const end = raw.lastIndexOf("}");
const report = JSON.parse(raw.slice(start, end + 1));

const rows = [];

function walk(suite, fileHint) {
	const file = suite.file || fileHint;
	for (const spec of suite.specs || []) {
		for (const t of spec.tests || []) {
			const results = t.results || [];
			const last = results[results.length - 1];
			const status = last?.status || t.status || "unknown";
			const error = last?.error?.message || last?.errors?.[0]?.message || "";
			const outcome =
				status === "skipped"
					? "skip"
					: status === "passed"
						? "pass"
						: status === "timedOut" || status === "failed" || status === "interrupted"
							? "fail"
							: status;
			rows.push({
				file: (file || "").replace(/\\/g, "/"),
				title: spec.title,
				project: t.projectName || "unknown",
				outcome,
				status,
				error: String(error).split("\n")[0].slice(0, 200),
			});
		}
	}
	for (const child of suite.suites || []) walk(child, file);
}

for (const suite of report.suites || []) walk(suite);

function categorize(row) {
	const e = (row.error || "").toLowerCase();
	const t = row.title.toLowerCase();
	if (row.outcome === "skip") return "D";
	if (e.includes("browser has been closed") || e.includes("target page, context") || e.includes("executable doesn't exist"))
		return "A";
	if (e.includes("expected") && e.includes("received")) return "B";
	if (e.includes("not found") || e.includes("tobevisible") || e.includes("testid")) return "C";
	if (e.includes("timeout") || e.includes("timed out")) return "E";
	if (t.includes("wrapped") || t.includes("formation") || t.includes("useful links")) return "B";
	return "E";
}

const failed = rows.filter((r) => r.outcome === "fail");
const skipped = rows.filter((r) => r.outcome === "skip");
const passed = rows.filter((r) => r.outcome === "pass");

const byFile = new Map();
for (const r of [...failed, ...skipped]) {
	const key = r.file.includes("e2e/") ? r.file.split("e2e/")[1] : r.file;
	if (!byFile.has(key)) byFile.set(key, []);
	byFile.get(key).push(r);
}

const now = new Date().toISOString();
let md = `# E2E Fix Tracker

Living inventory of failing and skipped Playwright E2E tests.

## Legend

| Status | Meaning |
|--------|---------|
| \`fail\` | Hard failure in baseline |
| \`skip\` | Guarded / intentional skip |
| \`fixed\` | Verified green in targeted re-run |
| \`justified-skip\` | Keep skip; documented reason |
| \`deferred\` | Known issue, deferred with reason |

| Category | Meaning |
|----------|---------|
| A | Infra / timeout cascade |
| B | Deterministic assertion drift |
| C | Missing / renamed testid or UI contract |
| D | Legitimate data / mobile / env guard |
| E | Flaky wait / navigation logic |

## Baseline summary

- **Date:** ${now}
- **Environment:** local prod (\`next start\` on :3000)
- **Totals:** ${passed.length} passed / ${failed.length} failed / ${skipped.length} skipped
- **Artifacts:** \`${input}\`

## Groups

`;

const sortedFiles = [...byFile.keys()].sort();
for (const file of sortedFiles) {
	md += `### \`${file}\`\n\n`;
	md += `| Test | Project | Status | Cat | Root cause | Planned fix | Verified |\n`;
	md += `|------|---------|--------|-----|------------|-------------|----------|\n`;
	for (const r of byFile.get(file)) {
		const cat = categorize(r);
		const cause = r.outcome === "skip" ? "Guard skip (see SKIPPED_TESTS_JUSTIFICATIONS.md)" : r.error.replace(/\|/g, "/");
		const plan =
			cat === "D"
				? "Keep justified skip unless fixture exists"
				: cat === "B"
					? "Update assertion / scope locator"
					: cat === "C"
						? "Align testid or soft-skip when UI absent"
						: cat === "A"
							? "Stabilize env / waits; re-run after server healthy"
							: "Harden waits / navigation helpers";
		md += `| ${r.title.replace(/\|/g, "/")} | ${r.project} | ${r.outcome} | ${cat} | ${cause || "—"} | ${plan} | pending |\n`;
	}
	md += `\n`;
}

md += `## Batch progress

1. [ ] wrapped
2. [ ] club-info
3. [ ] totw
4. [ ] stats
5. [ ] full-suite verify

## Notes

- Neo4j local runs behind SSL inspection may need \`NEO4J_TRUST_ALL_CERTIFICATES=true\` (\`neo4j+s\` → \`neo4j+ssc\`).
- Regen: \`node __tests__/e2e/scripts/build-tracker.mjs __tests__/e2e/.baseline.json\`
`;

fs.writeFileSync(trackerPath, md);
fs.writeFileSync(
	path.join(path.dirname(input), ".baseline-summary.json"),
	JSON.stringify({ totals: { pass: passed.length, fail: failed.length, skip: skipped.length }, failed, skipped }, null, 2),
);
console.log(JSON.stringify({ pass: passed.length, fail: failed.length, skip: skipped.length, files: sortedFiles.length }));
console.log("Wrote", trackerPath);
