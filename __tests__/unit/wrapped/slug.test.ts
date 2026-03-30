import { playerNameToWrappedSlug, wrappedSlugToPlayerName } from "@/lib/wrapped/slug";

describe("wrapped slug", () => {
	it("round-trips names with spaces", () => {
		const name = "Luke Bangs";
		const slug = playerNameToWrappedSlug(name);
		expect(wrappedSlugToPlayerName(slug)).toBe(name);
	});

	it("round-trips punctuation", () => {
		const name = "O'Brien-Smith";
		const slug = playerNameToWrappedSlug(name);
		expect(wrappedSlugToPlayerName(slug)).toBe(name);
	});

	it("returns null for invalid slug", () => {
		expect(wrappedSlugToPlayerName("@@@")).toBeNull();
	});

	it("still resolves legacy base64url bookmarks", () => {
		expect(wrappedSlugToPlayerName("THVrZSBCYW5ncw")).toBe("Luke Bangs");
	});
});
