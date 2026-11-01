import { isSystemSeedErrorLogLine, splitSeedErrorLogs } from "@/lib/utils/splitSeedErrorLogs";

describe("splitSeedErrorLogs", () => {
	it("routes memory and Heroku lines to system logs", () => {
		const errorLogText = [
			"[ERROR] ❌ Connection test failed",
			"[ERROR] 🚨 HEROKU MEMORY CRITICAL: Job seed_1 - Memory usage is 489MB",
			"[ERROR] 🚨 MEMORY MONITOR: Critical memory usage (475MB RSS)",
			"[ERROR] ❌ Fixture validation failed",
			"heroku[web.1]: Process running",
			"MEMORY: Error occurred at memory - RSS: 400MB, Heap: 200MB",
		].join("\n");

		const { dataLogText, systemLogText } = splitSeedErrorLogs(errorLogText);

		expect(dataLogText).toContain("Connection test failed");
		expect(dataLogText).toContain("Fixture validation failed");
		expect(dataLogText).not.toContain("HEROKU MEMORY");
		expect(systemLogText).toContain("HEROKU MEMORY CRITICAL");
		expect(systemLogText).toContain("MEMORY MONITOR");
		expect(systemLogText).toContain("heroku[web.1]");
		expect(systemLogText).toContain("MEMORY:");
		expect(systemLogText).not.toContain("Connection test failed");
	});

	it("returns empty strings for empty input", () => {
		expect(splitSeedErrorLogs("")).toEqual({ dataLogText: "", systemLogText: "" });
		expect(splitSeedErrorLogs(null)).toEqual({ dataLogText: "", systemLogText: "" });
		expect(splitSeedErrorLogs(undefined)).toEqual({ dataLogText: "", systemLogText: "" });
	});

	it("identifies R14 and Heap markers as system lines", () => {
		expect(isSystemSeedErrorLogLine("Error R14 Memory quota exceeded")).toBe(true);
		expect(isSystemSeedErrorLogLine("Heap used 480MB")).toBe(true);
		expect(isSystemSeedErrorLogLine("❌ Missing MatchDetail for fixture")).toBe(false);
	});
});
