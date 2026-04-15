/**
 * HTML + plain text for the CI `test:all` summary email (per-suite cards + fail/skip detail).
 */

const fs = require("fs");
const path = require("path");
const { XMLParser } = require("fast-xml-parser");
const { escapeHtml, wrapSectionCard } = require("./dorkiniansReportEmail");

const E2E_FOLDER_LABELS = {
	"01-navigation": "Navigation",
	"02-home": "Home",
	"03-stats": "Player Stats",
	"04-totw": "TOTW",
	"05-club-info": "Club Info",
	"06-settings": "Settings",
	"07-admin": "Admin",
	"08-api": "API",
	"09-cross-cutting": "Cross-Cutting",
	"10-wrapped": "Wrapped",
};

const E2E_FOLDER_ORDER = [
	"01-navigation",
	"02-home",
	"03-stats",
	"04-totw",
	"05-club-info",
	"06-settings",
	"07-admin",
	"08-api",
	"09-cross-cutting",
	"10-wrapped",
];

/** @returns {{ dir: string, jestUnit: string, jestIntegration: string, jestOther: string, junit: string }} */
function getTestAllArtifactPaths(repoRoot) {
	const dir = path.join(repoRoot, "__tests__", "e2e", "test-results");
	return {
		dir,
		jestUnit: path.join(dir, "jest-test-all-unit.json"),
		jestIntegration: path.join(dir, "jest-test-all-integration.json"),
		jestOther: path.join(dir, "jest-test-all-other.json"),
		junit: path.join(dir, "junit.xml"),
	};
}

function ensureArtifactDir(repoRoot) {
	const { dir } = getTestAllArtifactPaths(repoRoot);
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

/** Jest --json --outputFile= path (forward slashes for Windows shells). */
function jestJsonOutputSuffix(outputPath) {
	const p = path.resolve(outputPath).replace(/\\/g, "/");
	return ` --json --outputFile=${p}`;
}

function toArray(x) {
	if (x == null) return [];
	return Array.isArray(x) ? x : [x];
}

function excerptText(s, maxLen = 1800) {
	if (s == null || typeof s !== "string") return "";
	const t = s.trim();
	if (t.length <= maxLen) return t;
	return `…${t.slice(-maxLen)}`;
}

function normalizeSlashes(p) {
	return String(p || "").replace(/\\/g, "/");
}

function readJsonFile(absPath) {
	try {
		if (!fs.existsSync(absPath)) return null;
		const raw = fs.readFileSync(absPath, "utf8");
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function unitPathToSubsection(filePath) {
	const n = normalizeSlashes(filePath);
	if (n.includes("/unit/basic/")) return "Basic";
	if (n.includes("/unit/services/")) return "Services";
	if (n.includes("/unit/utils/")) return "Utils";
	if (n.includes("/unit/stores/")) return "Stores";
	return "Other";
}

function integrationPathToSubsection(filePath) {
	const n = normalizeSlashes(filePath);
	const base = n.split("/").pop() || n;
	if (base.includes("api-routes.integration")) return "API Routes";
	if (base.includes("ui-integration")) return "UI Integration";
	if (base.includes("api-contracts.integration")) return "API Contracts";
	if (base.includes("chatbotIntegration")) return "Chatbot Integration";
	return base.replace(/\.(test|spec)\.[tj]s$/, "") || "File";
}

function otherJestPathToSubsection(filePath) {
	const n = normalizeSlashes(filePath);
	const m = n.match(/__tests__\/([^/]+)\//);
	if (m) return m[1];
	const base = n.split("/").pop() || "Other";
	return base.replace(/\.(test|spec)\.[tj]s$/, "") || "Other";
}

function isAssertionOk(status) {
	return status === "passed";
}

function isSkippedLike(status) {
	return status === "skipped" || status === "pending";
}

/**
 * @param {object|null} jestJson
 * @param {'unit'|'integration'|'other'} mode
 * @param {boolean} suitePassed
 */
function jestJsonToModel(jestJson, mode, suitePassed) {
	/** @type {Map<string, { passed: boolean, tests: object[] }>} */
	const buckets = new Map();

	function bucketFor(file) {
		if (mode === "unit") return unitPathToSubsection(file);
		if (mode === "integration") return integrationPathToSubsection(file);
		return otherJestPathToSubsection(file);
	}

	if (jestJson && Array.isArray(jestJson.testResults)) {
		for (const tr of jestJson.testResults) {
			const file = tr.name || "";
			const bname = bucketFor(file);
			if (!buckets.has(bname)) {
				buckets.set(bname, { passed: true, tests: [] });
			}
			const bucket = buckets.get(bname);
			const assertions = toArray(tr.assertionResults);
			for (const ar of assertions) {
				const st = ar.status || "failed";
				const titleParts = toArray(ar.ancestorTitles);
				const fullTitle = [...titleParts, ar.title].filter(Boolean).join(" › ") || ar.title || "(unnamed)";
				const durationMs = typeof ar.duration === "number" ? ar.duration : null;
				const failMsg =
					Array.isArray(ar.failureMessages) && ar.failureMessages.length
						? ar.failureMessages.join("\n")
						: "";
				bucket.tests.push({
					title: fullTitle,
					status: st,
					durationMs,
					message: failMsg,
				});
				if (!isAssertionOk(st)) bucket.passed = false;
			}
		}
	}

	const subsections = [];
	if (buckets.size === 0) {
		subsections.push({ name: "Summary", passed: suitePassed });
	} else {
		const names = [...buckets.keys()].sort((a, b) => a.localeCompare(b));
		for (const name of names) {
			subsections.push({ name, passed: buckets.get(name).passed });
		}
	}

	const allTests = [...buckets.values()].flatMap((b) => b.tests);
	const passedN = allTests.filter((t) => isAssertionOk(t.status)).length;
	const failedN = allTests.filter((t) => t.status === "failed").length;
	const skippedN = allTests.filter((t) => isSkippedLike(t.status)).length;

	const detailTests = allTests
		.filter((t) => t.status === "failed" || isSkippedLike(t.status))
		.map((t) => ({
			title: t.title,
			status: t.status === "failed" ? "failed" : "skipped",
			durationSec: t.durationMs != null ? Math.round((t.durationMs / 1000) * 10) / 10 : null,
			message: excerptText(t.message || "", 1200),
		}));

	return {
		subsections,
		counts: { passed: passedN, failed: failedN, skipped: skippedN },
		detailTests,
	};
}

function failureTextFromNode(failureNode) {
	if (failureNode == null) return "";
	if (typeof failureNode === "string") return failureNode;
	if (typeof failureNode === "object" && !Array.isArray(failureNode)) {
		const msg = failureNode["@_message"] || failureNode["@message"] || "";
		const body = failureNode["#text"] || failureNode["#cdata"] || "";
		const line = [String(msg).trim(), String(body).trim()].filter(Boolean).join("\n");
		if (line) return line;
	}
	const parts = toArray(failureNode).map((f) => failureTextFromNode(f));
	return parts.filter(Boolean).join("\n").trim();
}

function walkJUnitSuite(suiteNode, out) {
	if (!suiteNode || typeof suiteNode !== "object") return;
	const cases = toArray(suiteNode.testcase);
	for (const tc of cases) {
		out.push(tc);
	}
	const nested = toArray(suiteNode.testsuite);
	for (const child of nested) {
		walkJUnitSuite(child, out);
	}
}

function parseJUnitFile(absPath) {
	try {
		if (!fs.existsSync(absPath)) return null;
		const xml = fs.readFileSync(absPath, "utf8");
		const parser = new XMLParser({
			ignoreAttributes: false,
			attributeNamePrefix: "@_",
		});
		const doc = parser.parse(xml);
		const root = doc.testsuites || doc;
		const topSuites = toArray(root.testsuite);
		const flat = [];
		for (const s of topSuites) {
			walkJUnitSuite(s, flat);
		}
		return flat;
	} catch {
		return null;
	}
}

function e2ePathToArea(filePath, classname) {
	const n = normalizeSlashes(filePath || classname || "");
	const m = n.match(/(\d{2}-[^/\\]+)/);
	if (m && E2E_FOLDER_LABELS[m[1]]) return { key: m[1], label: E2E_FOLDER_LABELS[m[1]] };
	if (m) return { key: m[1], label: m[1] };
	return { key: "zz-other", label: "Other" };
}

function junitCasesToModel(testcases, suitePassed) {
	if (!testcases || testcases.length === 0) {
		return {
			subsections: [{ name: "Summary", passed: suitePassed }],
			counts: { passed: 0, failed: 0, skipped: 0 },
			detailTests: [],
		};
	}

	/** @type {Map<string, { label: string, passed: boolean, tests: object[] }>} */
	const buckets = new Map();

	for (const tc of testcases) {
		const name = tc["@_name"] || "(unnamed)";
		const classname = tc["@_classname"] || "";
		const file = tc["@_file"] || "";
		const time = parseFloat(tc["@_time"] || "0") || 0;
		const hasFailure = tc.failure != null;
		const hasSkipped = tc.skipped != null;
		let status = "passed";
		if (hasFailure) status = "failed";
		else if (hasSkipped) status = "skipped";

		const area = e2ePathToArea(file, classname);
		if (!buckets.has(area.key)) {
			buckets.set(area.key, { label: area.label, passed: true, tests: [] });
		}
		const bucket = buckets.get(area.key);
		const msg = hasFailure ? excerptText(failureTextFromNode(tc.failure), 1200) : "";
		bucket.tests.push({
			title: name,
			status,
			durationSec: Math.round(time * 10) / 10,
			message: msg,
		});
		if (status !== "passed") bucket.passed = false;
	}

	const orderedKeys = [...buckets.keys()].sort((a, b) => {
		const aIdx = E2E_FOLDER_ORDER.indexOf(a);
		const bIdx = E2E_FOLDER_ORDER.indexOf(b);
		if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
		if (aIdx !== -1) return -1;
		if (bIdx !== -1) return 1;
		return (buckets.get(a).label || a).localeCompare(buckets.get(b).label || b);
	});
	const subsections = orderedKeys.map((key) => ({ name: buckets.get(key).label, passed: buckets.get(key).passed }));

	const allTests = [...buckets.values()].flatMap((b) => b.tests);
	const passedN = allTests.filter((t) => t.status === "passed").length;
	const failedN = allTests.filter((t) => t.status === "failed").length;
	const skippedN = allTests.filter((t) => t.status === "skipped").length;

	const detailTests = allTests
		.filter((t) => t.status === "failed" || t.status === "skipped")
		.map((t) => ({
			title: t.title,
			status: t.status,
			durationSec: t.durationSec,
			message: t.message,
		}));

	return {
		subsections,
		counts: { passed: passedN, failed: failedN, skipped: skippedN },
		detailTests,
	};
}

function statusPill(passed) {
	const bg = passed ? "#ecfdf3" : "#fef3f2";
	const color = passed ? "#177245" : "#b42318";
	const label = passed ? "PASSED" : "FAILED";
	return `<span style="display:inline-block;white-space:nowrap;line-height:1;padding:5px 11px;border-radius:999px;font-size:12px;font-weight:700;background:${bg};color:${color};">${label}</span>`;
}

function buildSuiteCard(section) {
	const sectionPassed = section.suitePassed;
	const borderColor = sectionPassed ? "#b7ebcd" : "#f3c7c1";
	const subRows = section.subsections
		.map(
			(sub) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eaecf0;color:#101828;">${escapeHtml(sub.name)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eaecf0;white-space:nowrap;">
          <span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;background:${
				sub.passed ? "#ecfdf3" : "#fef3f2"
			};color:${sub.passed ? "#177245" : "#b42318"};white-space:nowrap;line-height:1;">
            ${sub.passed ? "PASSED" : "FAILED"}
          </span>
        </td>
      </tr>`,
		)
		.join("");

	return `
      <div style="margin:16px 0;border:1px solid ${borderColor};border-radius:12px;overflow:hidden;background:#ffffff;">
        <div style="padding:14px 16px;border-bottom:1px solid #eaecf0;background:#f9fafb;display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div>
            <div style="font-size:17px;font-weight:700;color:#101828;margin-bottom:4px;">${escapeHtml(section.displayName)}</div>
            <div style="font-family:Consolas,'Courier New',monospace;font-size:12px;color:#475467;">${escapeHtml(section.command)}</div>
          </div>
          ${statusPill(sectionPassed)}
        </div>
        <table style="border-collapse:collapse;width:100%;">
        <thead>
          <tr>
            <th style="padding:10px 12px;border-bottom:1px solid #eaecf0;text-align:left;font-size:12px;letter-spacing:.02em;text-transform:uppercase;color:#475467;">Subsection</th>
            <th style="padding:10px 12px;border-bottom:1px solid #eaecf0;text-align:left;font-size:12px;letter-spacing:.02em;text-transform:uppercase;color:#475467;white-space:nowrap;width:130px;">Status</th>
          </tr>
        </thead>
        <tbody>${subRows}</tbody>
        </table>
      </div>`;
}

function buildDetailListHtml(section) {
	const { counts, detailTests, failureLogExcerpt } = section;
	const c = counts || { passed: 0, failed: 0, skipped: 0 };
	const hasTests = detailTests && detailTests.length > 0;
	const hasLog = failureLogExcerpt && String(failureLogExcerpt).trim();
	const needsCountsRow = c.failed > 0 || c.skipped > 0;

	if (!needsCountsRow && !hasTests && !hasLog) return "";

	const headerBg = c.failed > 0 ? "#991b1b" : c.skipped > 0 ? "#b45309" : "#047857";
	const headerText = "#ffffff";
	const headerLine = `${escapeHtml(section.displayName)} - ${c.passed} passed, ${c.failed} failed, ${c.skipped} skipped`;

	let body = "";

	if (hasTests) {
		for (const t of detailTests) {
			const isFail = t.status === "failed";
			const isSkip = t.status === "skipped";
			const border = isFail ? "#dc2626" : isSkip ? "#d97706" : "#16a34a";
			const cardBg = isFail ? "#fef2f2" : isSkip ? "#fffbeb" : "#f0fdf4";
			const icon = isFail ? "✗" : isSkip ? "⊘" : "✓";
			const dur = t.durationSec != null ? `${t.durationSec}s` : "-";
			const msgBlock =
				t.message && t.message.trim()
					? `<div style="font-size:11px;color:#475467;margin-top:6px;font-family:Consolas,monospace;white-space:pre-wrap;word-break:break-word;">${escapeHtml(t.message)}</div>`
					: "";
			body += `
			<div style="margin:8px 0;padding:12px 14px;background:${cardBg};border-left:4px solid ${border};border-radius:0 8px 8px 0;">
				<div style="font-size:14px;font-weight:700;color:#101828;">${icon} ${escapeHtml(t.title)}</div>
				<div style="font-size:12px;color:#64748b;margin-top:4px;">${escapeHtml(dur)}</div>
				${msgBlock}
			</div>`;
		}
	}

	if (hasLog) {
		body += `
		<div style="margin:10px 0 0;padding:12px;background:#f9fafb;border:1px solid #eaecf0;border-radius:8px;">
			<div style="font-size:11px;font-weight:700;color:#475467;margin-bottom:6px;">Output excerpt</div>
			<pre style="margin:0;font-size:11px;color:#101828;white-space:pre-wrap;word-break:break-word;font-family:Consolas,monospace;">${escapeHtml(
				excerptText(failureLogExcerpt, 2500),
			)}</pre>
		</div>`;
	}

	return `
	<div style="margin:16px 0;border-radius:10px;overflow:hidden;border:1px solid #eaecf0;">
		<div style="padding:12px 16px;background:${headerBg};color:${headerText};font-size:14px;font-weight:700;">
			${headerLine}
		</div>
		<div style="padding:12px 14px;background:#ffffff;">
			${body}
		</div>
	</div>`;
}

function buildOverallStatusHtml(summaryItems, passedCount, totalCount, e2eSkippedCount, e2eSkipNote) {
	const summaryInner = `<div style="font-size:16px;font-weight:700;color:#101828;margin-bottom:6px;">Overall: ${passedCount}/${totalCount} suites passed</div>
		${
			e2eSkippedCount > 0 && e2eSkipNote
				? `<div style="font-size:13px;color:#344054;margin-top:6px;"><strong>Skip note:</strong> ${escapeHtml(e2eSkipNote)}</div>`
				: ""
		}
		<div style="font-size:13px;color:#344054;margin-top:6px;"><strong>Database package tests:</strong> run in the database-dorkinians repository pipeline.</div>`;

	const subRows = summaryItems
		.map(
			(item) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eaecf0;color:#101828;">${escapeHtml(item.name)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eaecf0;white-space:nowrap;">
          <span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;background:${
				item.result ? "#ecfdf3" : "#fef3f2"
			};color:${item.result ? "#177245" : "#b42318"};white-space:nowrap;line-height:1;">
            ${item.result ? "PASSED" : "FAILED"}
          </span>
        </td>
      </tr>`,
		)
		.join("");

	const table = `
	  <div style="margin:16px 0;border:1px solid #eaecf0;border-radius:12px;overflow:hidden;background:#ffffff;">
        <table style="border-collapse:collapse;width:100%;">
        <thead>
          <tr>
            <th style="padding:10px 12px;border-bottom:1px solid #eaecf0;text-align:left;font-size:12px;letter-spacing:.02em;text-transform:uppercase;color:#475467;">Suite</th>
            <th style="padding:10px 12px;border-bottom:1px solid #eaecf0;text-align:left;font-size:12px;letter-spacing:.02em;text-transform:uppercase;color:#475467;white-space:nowrap;width:130px;">Status</th>
          </tr>
        </thead>
        <tbody>${subRows}</tbody>
        </table>
      </div>`;

	return wrapSectionCard(summaryInner, { heading: "Overall status" }) + table;
}

/**
 * @param {object} params
 * @param {boolean} params.artifactsEnabled
 * @param {string} params.repoRoot
 * @param {{ unit: boolean, integration: boolean, otherJest: boolean, e2e: boolean, chatbotReport: boolean, questionsReport: boolean }} params.suitePass
 * @param {{ chatbot?: string, questions?: string }} params.logs
 */
function buildSectionsFromArtifacts(params) {
	const { artifactsEnabled, repoRoot, suitePass, logs } = params;
	const paths = getTestAllArtifactPaths(repoRoot);

	const sections = [];

	// Unit
	let unitModel = { subsections: [{ name: "Summary", passed: suitePass.unit }], counts: { passed: 0, failed: 0, skipped: 0 }, detailTests: [] };
	if (artifactsEnabled) {
		const j = readJsonFile(paths.jestUnit);
		unitModel = jestJsonToModel(j, "unit", suitePass.unit);
	}
	sections.push({
		displayName: "Unit",
		command: "jest --testPathPatterns=unit",
		suitePassed: suitePass.unit,
		...unitModel,
	});

	let intModel = { subsections: [{ name: "Summary", passed: suitePass.integration }], counts: { passed: 0, failed: 0, skipped: 0 }, detailTests: [] };
	if (artifactsEnabled) {
		const j = readJsonFile(paths.jestIntegration);
		intModel = jestJsonToModel(j, "integration", suitePass.integration);
	}
	sections.push({
		displayName: "Integration",
		command: "jest --testPathPatterns=integration",
		suitePassed: suitePass.integration,
		...intModel,
	});

	let otherModel = { subsections: [{ name: "Summary", passed: suitePass.otherJest }], counts: { passed: 0, failed: 0, skipped: 0 }, detailTests: [] };
	if (artifactsEnabled) {
		const j = readJsonFile(paths.jestOther);
		otherModel = jestJsonToModel(j, "other", suitePass.otherJest);
	}
	sections.push({
		displayName: "Other Jest",
		command: 'jest --testPathPatterns="(comprehensive|advanced|performance|validation|ux|security|monitoring)"',
		suitePassed: suitePass.otherJest,
		...otherModel,
	});

	let e2eModel = { subsections: [{ name: "Summary", passed: suitePass.e2e }], counts: { passed: 0, failed: 0, skipped: 0 }, detailTests: [] };
	if (artifactsEnabled) {
		const cases = parseJUnitFile(paths.junit);
		e2eModel = junitCasesToModel(cases || [], suitePass.e2e);
	}
	sections.push({
		displayName: "E2E (Playwright)",
		command: "playwright test",
		suitePassed: suitePass.e2e,
		...e2eModel,
	});

	sections.push({
		displayName: "Chatbot Report",
		command: "npm run test:chatbot-players-report",
		suitePassed: suitePass.chatbotReport,
		subsections: [{ name: "Run", passed: suitePass.chatbotReport }],
		counts: { passed: suitePass.chatbotReport ? 1 : 0, failed: suitePass.chatbotReport ? 0 : 1, skipped: 0 },
		detailTests: [],
		failureLogExcerpt: !suitePass.chatbotReport && logs?.chatbot ? logs.chatbot : "",
	});

	sections.push({
		displayName: "Questions Report",
		command: "npm run test:questions-report",
		suitePassed: suitePass.questionsReport,
		subsections: [{ name: "Run", passed: suitePass.questionsReport }],
		counts: { passed: suitePass.questionsReport ? 1 : 0, failed: suitePass.questionsReport ? 0 : 1, skipped: 0 },
		detailTests: [],
		failureLogExcerpt: !suitePass.questionsReport && logs?.questions ? logs.questions : "",
	});

	return sections;
}

/** Show detail list when there are failing/skipped tests, log excerpt, or only log (script failure). */
function sectionNeedsDetailList(section) {
	if (section.detailTests && section.detailTests.length > 0) return true;
	if (section.failureLogExcerpt && String(section.failureLogExcerpt).trim()) return true;
	const c = section.counts;
	return !!(c && (c.failed > 0 || c.skipped > 0));
}

function buildTestAllEmailInnerHtml(opts) {
	const { summaryItems, passedCount, totalCount, e2eSkippedCount, e2eSkipNote, sections } = opts;
	let html = buildOverallStatusHtml(summaryItems, passedCount, totalCount, e2eSkippedCount, e2eSkipNote);
	for (const section of sections) {
		html += buildSuiteCard(section);
		if (sectionNeedsDetailList(section)) {
			html += buildDetailListHtml(section);
		}
	}
	return html;
}

function buildTestAllEmailPlainText(opts) {
	const { summaryItems, passedCount, totalCount, e2eSkippedCount, e2eSkipNote, sections } = opts;
	const lines = [
		"Full Test Suite (test:all)",
		`Overall: ${passedCount}/${totalCount} suites passed`,
		...summaryItems.map((item) => `- ${item.name}: ${item.result ? "PASSED" : "FAILED"}`),
	];
	if (e2eSkippedCount > 0 && e2eSkipNote) {
		lines.push(`Skip note: ${e2eSkipNote}`);
	}
	lines.push("Database package tests: run in the database-dorkinians repository pipeline.");
	lines.push("", "Per-suite:");
	for (const section of sections) {
		lines.push(`\n${section.displayName} (${section.suitePassed ? "PASSED" : "FAILED"})`);
		for (const sub of section.subsections) {
			lines.push(`  - ${sub.name}: ${sub.passed ? "PASSED" : "FAILED"}`);
		}
		const c = section.counts;
		if (c && (c.failed > 0 || c.skipped > 0)) {
			lines.push(`  Tests: ${c.passed} passed, ${c.failed} failed, ${c.skipped} skipped`);
		}
		if (section.detailTests && section.detailTests.length > 0) {
			for (const t of section.detailTests) {
				lines.push(`    * [${t.status}] ${t.title} (${t.durationSec ?? "?"}s)`);
				if (t.message) lines.push(`      ${t.message.split("\n")[0].slice(0, 200)}`);
			}
		}
		if (section.failureLogExcerpt && String(section.failureLogExcerpt).trim()) {
			lines.push(`  Log excerpt: ${excerptText(section.failureLogExcerpt, 500)}`);
		}
	}
	return lines.join("\n");
}

module.exports = {
	getTestAllArtifactPaths,
	ensureArtifactDir,
	jestJsonOutputSuffix,
	buildSectionsFromArtifacts,
	buildTestAllEmailInnerHtml,
	buildTestAllEmailPlainText,
};
