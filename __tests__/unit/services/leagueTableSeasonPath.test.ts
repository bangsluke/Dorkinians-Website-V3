import path from "path";
import {
	getSeasonDataFromJSON,
	resolveLeagueTableSeasonFilePath,
} from "@/lib/services/leagueTableService";

describe("resolveLeagueTableSeasonFilePath", () => {
	const dataDir = path.resolve(process.cwd(), "data", "league-tables");

	it("resolves hyphen and slash season formats inside data/league-tables", () => {
		const hyphen = resolveLeagueTableSeasonFilePath("2024-25");
		const slash = resolveLeagueTableSeasonFilePath("2024/25");

		expect(hyphen).toBe(path.join(dataDir, "2024-25.json"));
		expect(slash).toBe(path.join(dataDir, "2024-25.json"));
		expect(path.relative(dataDir, hyphen!).startsWith("..")).toBe(false);
	});

	it("rejects path traversal and non-season shapes", () => {
		expect(resolveLeagueTableSeasonFilePath("../package")).toBeNull();
		expect(resolveLeagueTableSeasonFilePath("../../etc/passwd")).toBeNull();
		expect(resolveLeagueTableSeasonFilePath("2024-25/../../etc/passwd")).toBeNull();
		expect(resolveLeagueTableSeasonFilePath("/etc/passwd")).toBeNull();
		expect(resolveLeagueTableSeasonFilePath("not-a-season")).toBeNull();
		expect(resolveLeagueTableSeasonFilePath("")).toBeNull();
	});
});

describe("getSeasonDataFromJSON", () => {
	it("loads a real season file", async () => {
		const data = await getSeasonDataFromJSON("2024-25");
		expect(data).not.toBeNull();
		expect(data?.season).toBe("2024/25");
	});

	it("returns null for traversal attempts", async () => {
		expect(await getSeasonDataFromJSON("../package")).toBeNull();
		expect(await getSeasonDataFromJSON("2024-25/../../package")).toBeNull();
	});
});
