import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const e2eRoot = path.resolve(scriptDir, "..");

/** Resolve a path and require it to stay under __tests__/e2e. */
function resolveUnderE2e(candidate) {
	const resolved = path.resolve(process.cwd(), candidate);
	const relative = path.relative(e2eRoot, resolved);
	if (relative.startsWith("..") || path.isAbsolute(relative)) {
		console.error(`Refusing path outside __tests__/e2e: ${candidate}`);
		process.exit(1);
	}
	return resolved;
}

const input = resolveUnderE2e(process.argv[2] || path.join(e2eRoot, ".full-stable-console.txt"));
const outJson = resolveUnderE2e(path.join(e2eRoot, ".full-stable.json"));
const buf = fs.readFileSync(input);
let text =
	buf[0] === 0xff && buf[1] === 0xfe
		? buf.toString("utf16le")
		: buf[0] === 0xfe && buf[1] === 0xff
			? buf.swap16().toString("utf16le")
			: buf.toString("utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

// List+JSON tee mixes logs with the report; find the Playwright root object.
const configKey = text.indexOf('"config"');
const start = configKey >= 0 ? text.lastIndexOf("{", configKey) : text.indexOf("{\n  \"config\"");
const end = text.lastIndexOf("}");
if (start < 0 || end < 0) {
	console.error("No JSON object found in", input);
	process.exit(1);
}
const report = JSON.parse(text.slice(start, end + 1));
fs.writeFileSync(outJson, JSON.stringify(report, null, 2));

const fails = [];
const skips = [];
function walk(suite, fileHint) {
	const file = suite.file || fileHint;
	for (const spec of suite.specs || []) {
		for (const t of spec.tests || []) {
			const last = (t.results || [])[(t.results || []).length - 1];
			const status = last?.status || t.status;
			const err = String(last?.error?.message || last?.errors?.[0]?.message || "")
				.split("\n")[0]
				.slice(0, 220);
			const ann = [...(t.annotations || []), ...(last?.annotations || [])]
				.map((a) => a.description || a.type)
				.filter(Boolean)
				.join("; ");
			const row = { file: (file || "").replace(/\\/g, "/"), title: spec.title, project: t.projectName, status, err, ann };
			if (status === "failed" || status === "timedOut" || t.status === "unexpected") fails.push(row);
			if (status === "skipped") skips.push(row);
		}
	}
	for (const child of suite.suites || []) walk(child, file);
}
for (const s of report.suites || []) walk(s);

const byTitle = {};
for (const s of skips) {
	byTitle[s.title] = byTitle[s.title] || new Set();
	byTitle[s.title].add(s.project);
}

console.log(
	JSON.stringify(
		{
			stats: report.stats,
			fails,
			skipCount: skips.length,
			uniqueSkips: Object.keys(byTitle).length,
			skipsByTitle: Object.fromEntries(Object.entries(byTitle).map(([k, v]) => [k, [...v]])),
		},
		null,
		2,
	),
);
