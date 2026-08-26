/**
 * Neo4jService connect reuse + in-flight promise.
 * Mocks neo4j-driver so no live Aura is required.
 *
 * Note: jest.config sets resetMocks/clearMocks — re-apply driverFactory
 * implementation in beforeEach so neo4j.driver() never returns undefined.
 */

type Neo4jTestHooks = {
	driverFactory: jest.Mock;
	verifyConnectivity: jest.Mock;
	close: jest.Mock;
};

declare global {
	// eslint-disable-next-line no-var
	var __neo4jConnectTestHooks: Neo4jTestHooks | undefined;
}

jest.mock("neo4j-driver", () => {
	const verifyConnectivity = jest.fn();
	const close = jest.fn();
	const driverFactory = jest.fn();
	globalThis.__neo4jConnectTestHooks = { driverFactory, verifyConnectivity, close };

	const auth = {
		basic: jest.fn((user: string, password: string) => ({ user, password })),
	};
	const api = {
		driver: (...args: unknown[]) => driverFactory(...args),
		auth,
	};
	return {
		__esModule: true,
		default: api,
		...api,
	};
});

import { Neo4jService } from "@/lib/neo4j";

function hooks(): Neo4jTestHooks {
	const h = globalThis.__neo4jConnectTestHooks;
	if (!h) {
		throw new Error("neo4j-driver mock hooks not initialized");
	}
	return h;
}

describe("Neo4jService.connect reuse", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		const { driverFactory, verifyConnectivity, close } = hooks();
		driverFactory.mockImplementation(() => ({
			verifyConnectivity: (...args: unknown[]) => verifyConnectivity(...args),
			close: (...args: unknown[]) => close(...args),
			session: jest.fn(),
		}));
		close.mockResolvedValue(undefined);
		verifyConnectivity.mockReset();
		driverFactory.mockClear();
		close.mockClear();

		process.env.PROD_NEO4J_URI = "neo4j+s://example.databases.neo4j.io";
		process.env.PROD_NEO4J_USER = "neo4j";
		process.env.PROD_NEO4J_PASSWORD = "test-password";
		delete process.env.NEO4J_TRUST_ALL_CERTIFICATES;
	});

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	test("concurrent connect calls share one in-flight driver creation", async () => {
		const { driverFactory, verifyConnectivity } = hooks();
		let resolveVerify: () => void = () => undefined;
		verifyConnectivity.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveVerify = resolve;
				}),
		);

		const service = new Neo4jService();
		const p1 = service.connect();
		const p2 = service.connect();
		const p3 = service.connect();

		expect(driverFactory).toHaveBeenCalledTimes(1);

		resolveVerify();
		await expect(Promise.all([p1, p2, p3])).resolves.toEqual([true, true, true]);
		expect(driverFactory).toHaveBeenCalledTimes(1);
		expect(service.isConnectedStatus()).toBe(true);
	});

	test("subsequent connect after success returns immediately without new driver", async () => {
		const { driverFactory, verifyConnectivity } = hooks();
		verifyConnectivity.mockResolvedValue(undefined);

		const service = new Neo4jService();
		await expect(service.connect()).resolves.toBe(true);
		await expect(service.connect()).resolves.toBe(true);

		expect(driverFactory).toHaveBeenCalledTimes(1);
	});

	test("failed connect closes partial driver and allows a later retry", async () => {
		const { driverFactory, verifyConnectivity, close } = hooks();
		verifyConnectivity
			.mockRejectedValueOnce(new Error("Could not perform discovery"))
			.mockResolvedValueOnce(undefined);

		const service = new Neo4jService();
		await expect(service.connect()).resolves.toBe(false);
		expect(close).toHaveBeenCalled();
		expect(service.isConnectedStatus()).toBe(false);

		await expect(service.connect()).resolves.toBe(true);
		expect(driverFactory).toHaveBeenCalledTimes(2);
		expect(service.isConnectedStatus()).toBe(true);
	});
});
