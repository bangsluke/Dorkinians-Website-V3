import { parseVeoLinks } from "@/lib/utils/veoLinks";

describe("parseVeoLinks", () => {
	test("returns empty for null, undefined, or blank", () => {
		expect(parseVeoLinks(null)).toEqual([]);
		expect(parseVeoLinks(undefined)).toEqual([]);
		expect(parseVeoLinks("")).toEqual([]);
		expect(parseVeoLinks("   ")).toEqual([]);
	});

	test("splits on semicolon and trims", () => {
		expect(parseVeoLinks("https://a.example.com; https://b.example.com")).toEqual([
			"https://a.example.com",
			"https://b.example.com",
		]);
	});

	test("drops empty segments", () => {
		expect(parseVeoLinks("https://a.example.com;; ")).toEqual(["https://a.example.com"]);
	});
});
