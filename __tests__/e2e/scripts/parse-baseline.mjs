/**
 * Parse Playwright JSON report into a compact fail/skip inventory.
 * Usage: node __tests__/e2e/scripts/parse-baseline.mjs __tests__/e2e/.baseline.json
 */
import fs from "fs";
import path from "path";

const input = process.argv[2] || "__tests__/e2e/.baseline.json";
const raw = fs.readFileSync(input, "utf8");
// Playwright may emit non-JSON noise; extract the outermost JSON object.
const start = raw.indexOf("{");
const end = raw.lastIndexOf("}");
if (start < 0 || end < 0) {
	console.error("No JSON object found in", input);
	process.exit(1);
}
const report = JSON.parse(raw.slice(start, end + 1));

const rows = [];

function walk(suite, projectHint) {
	const project =
		suite.projectName ||
		projectHint ||
		(suite.title && !suite.file ? suite.title : projectHint);
	for (const spec of suite.specs || []) {
		for (const t of spec.tests || []) {
			const projectName = t.projectName || project || "unknown";
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
				file: path.relative(process.cwd(), suite.file || spec.file || "").replace(/\\/g, "/") || spec.title,
				title: spec.title,
				project: projectName,
				outcome,
				status,
				error: String(error).split("\n")[0].slice(0, 240),
			});
		}
	}
	for (const child of suite.suites || []) {
		walk(child, project);
	}
}

for (const suite of report.suites || []) {
	walk(suite, undefined);
}

const failed = rows.filter((r) => r.outcome === "fail");
const skipped = rows.filter((r) => r.outcome === "skip");
const passed = rows.filter((r) => r.outcome === "pass");

const summary = {
	totals: {
		pass: passed.length,
		fail: failed.length,
		skip: skipped.length,
		other: rows.length - passed.length - failed.length - skipped.length,
	},
	failed,
	skipped,
};

const outPath = path.join(path.dirname(input), ".baseline-summary.json");
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary.totals));
console.log("Wrote", outPath);
