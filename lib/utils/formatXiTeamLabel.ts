/** Normalise team labels for display (e.g. "5s" → "5th XI"). Unknown strings returned trimmed; extend XI_LABEL_MAP as data appears. */
const XI_LABEL_MAP: Record<string, string> = {
	"1s": "1st XI",
	"2s": "2nd XI",
	"3s": "3rd XI",
	"4s": "4th XI",
	"5s": "5th XI",
	"6s": "6th XI",
	"7s": "7th XI",
	"8s": "8th XI",
};

export function formatXiTeamLabel(raw: string | null | undefined): string {
	if (raw == null) return "";
	const t = String(raw).trim();
	if (!t) return "";
	const simple = XI_LABEL_MAP[t] ?? XI_LABEL_MAP[t.toLowerCase()];
	if (simple) return simple;
	if (/\d+(st|nd|rd|th)\s*xi/i.test(t)) return t;
	const m = /^(\d+)s$/i.exec(t);
	if (m) {
		const n = parseInt(m[1], 10);
		if (n < 1 || n > 20) return t;
		const suf = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
		return `${n}${suf} XI`;
	}
	return t.charAt(0).toUpperCase() + t.slice(1);
}
