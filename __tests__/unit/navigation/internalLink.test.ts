import { hrefToRouteKey, isInternalAppHref } from "@/lib/navigation/internalLink";

describe("isInternalAppHref", () => {
	it("accepts in-app absolute paths", () => {
		expect(isInternalAppHref("/stats")).toBe(true);
		expect(isInternalAppHref("/player/john-smith")).toBe(true);
	});

	it("rejects dangerous and external schemes", () => {
		expect(isInternalAppHref("javascript:alert(1)")).toBe(false);
		expect(isInternalAppHref("JavaScript:alert(1)")).toBe(false);
		expect(isInternalAppHref("data:text/html,<script>alert(1)</script>")).toBe(false);
		expect(isInternalAppHref("vbscript:msgbox(1)")).toBe(false);
		expect(isInternalAppHref("mailto:a@b.com")).toBe(false);
		expect(isInternalAppHref("tel:+441234")).toBe(false);
		expect(isInternalAppHref("//evil.example")).toBe(false);
		expect(isInternalAppHref("/\\evil.example")).toBe(false);
		expect(isInternalAppHref("#hash-only")).toBe(false);
	});
});

describe("hrefToRouteKey", () => {
	it("returns null for non-internal hrefs", () => {
		expect(hrefToRouteKey("javascript:alert(1)")).toBeNull();
		expect(hrefToRouteKey("//evil.example")).toBeNull();
	});

	it("keeps path for internal hrefs outside the browser", () => {
		expect(hrefToRouteKey("/stats?tab=1")).toBe("/stats?tab=1");
	});
});
