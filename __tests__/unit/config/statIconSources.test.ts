import fs from "fs";
import path from "path";
import { statObject } from "@/config/config";

const PUBLIC_DIR = path.join(process.cwd(), "public");

const DECORATIVE_STAT_IMAGES = [
	"/stat-images/brick-wall.svg",
	"/stat-images/stopwatch.svg",
	"/stat-images/horizontal-pitch.svg",
	"/stat-images/uk-map.svg",
	"/stat-images/europe-map.svg",
	"/stat-images/world-map.svg",
	"/totw-images/TOTWBackground.svg",
	"/totw-images/Kit.svg",
];

describe("stat image sources", () => {
	it("every statObject iconName has a file under public/stat-icons", () => {
		const missing: string[] = [];
		for (const [key, stat] of Object.entries(statObject)) {
			const iconName = (stat as { iconName?: string }).iconName;
			if (!iconName) {
				missing.push(`${key}: missing iconName`);
				continue;
			}
			const filePath = path.join(PUBLIC_DIR, "stat-icons", `${iconName}.svg`);
			if (!fs.existsSync(filePath)) {
				missing.push(`${key}: ${iconName}.svg`);
			}
		}
		expect(missing).toEqual([]);
	});

	it("decorative Player Stats image paths exist under public", () => {
		const missing = DECORATIVE_STAT_IMAGES.filter((publicPath) => {
			const filePath = path.join(PUBLIC_DIR, publicPath.replace(/^\//, ""));
			return !fs.existsSync(filePath);
		});
		expect(missing).toEqual([]);
	});
});
