/** Split fixture VEO LINK field; multiple URLs may be separated by ";". */
export function parseVeoLinks(veoLink: string | null | undefined): string[] {
	if (veoLink == null || String(veoLink).trim() === "") return [];
	return String(veoLink)
		.split(";")
		.map((s) => s.trim())
		.filter(Boolean);
}
