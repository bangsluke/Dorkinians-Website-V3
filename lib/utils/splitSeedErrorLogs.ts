/**
 * Split last-seed-run error log lines into data vs system boxes for the admin UI.
 * Full logs and downloads stay unsplit; only the visible error boxes use this.
 */

const SYSTEM_LOG_PATTERN =
	/HEROKU MEMORY|MEMORY MONITOR|MEMORY CRITICAL|MEMORY_GUARD|MEMORY:|\bRSS\b|\bHeap\b|\bR14\b|heroku\[|Connection test failed/i;

/**
 * Whether a single error-log line belongs in System Logs (memory / Heroku ops).
 */
export function isSystemSeedErrorLogLine(line: string): boolean {
	if (!line || !line.trim()) return false;
	return SYSTEM_LOG_PATTERN.test(line);
}

/**
 * Split errorLogText into Data Logs and System Logs.
 * Empty input yields empty strings for both (callers show empty-state copy).
 */
export function splitSeedErrorLogs(errorLogText: string | null | undefined): {
	dataLogText: string;
	systemLogText: string;
} {
	const raw = errorLogText == null ? "" : String(errorLogText);
	if (!raw.trim()) {
		return { dataLogText: "", systemLogText: "" };
	}
	const dataLines: string[] = [];
	const systemLines: string[] = [];
	for (const line of raw.split(/\r?\n/)) {
		if (!line.trim()) continue;
		if (isSystemSeedErrorLogLine(line)) {
			systemLines.push(line);
		} else {
			dataLines.push(line);
		}
	}
	return {
		dataLogText: dataLines.join("\n"),
		systemLogText: systemLines.join("\n"),
	};
}
