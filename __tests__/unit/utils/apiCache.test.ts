import { apiCache } from "@/lib/utils/apiCache";
import { resetRedisClientForTests } from "@/lib/utils/redisClient";

describe("apiCache distributed helpers", () => {
	beforeEach(() => {
		apiCache.clear();
		resetRedisClientForTests();
		delete process.env.UPSTASH_REDIS_REST_URL;
		delete process.env.UPSTASH_REDIS_REST_TOKEN;
	});

	test("getAsync/setAsync round-trip via in-memory when Redis unset", async () => {
		const key = apiCache.generateKey("/api/teams");
		await apiCache.setAsync(key, { teams: [{ name: "1st XI" }] }, 60_000);
		const hit = await apiCache.getAsync<{ teams: { name: string }[] }>(key);
		expect(hit).toEqual({ teams: [{ name: "1st XI" }] });
	});

	test("getAsync returns null on miss and fails open without Redis", async () => {
		const miss = await apiCache.getAsync("/api/missing");
		expect(miss).toBeNull();
	});

	test("sync get still works after setAsync", async () => {
		const key = apiCache.generateKey("/api/players");
		await apiCache.setAsync(key, { players: [] }, 60_000);
		expect(apiCache.get(key)).toEqual({ players: [] });
	});
});
