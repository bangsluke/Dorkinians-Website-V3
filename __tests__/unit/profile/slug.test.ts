import {
	getPlayerProfileHref,
	playerNameToProfileSlug,
	profileSlugToPlayerName,
} from "@/lib/profile/slug";

describe("profile slug", () => {
	it("round-trips names with spaces", () => {
		const name = "Luke Bangs";
		const slug = playerNameToProfileSlug(name);
		expect(profileSlugToPlayerName(slug)).toBe(name);
	});

	it("round-trips punctuation", () => {
		const name = "O'Brien-Smith";
		const slug = playerNameToProfileSlug(name);
		expect(profileSlugToPlayerName(slug)).toBe(name);
	});

	it("builds profile href for player", () => {
		const href = getPlayerProfileHref("Luke Bangs");
		expect(href).toBe("/profile/Luke-Bangs");
		expect(profileSlugToPlayerName(href.replace("/profile/", ""))).toBe("Luke Bangs");
	});
});
