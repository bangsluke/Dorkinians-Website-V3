// Unit tests for pwaUpdateService with jest.resetModules and synthetic window/navigator/serviceWorker globals.
// Mocks fetch and service worker registration shapes only—no real SW lifecycle or network. Each test re-imports the module after env setup.
// Isolated globals per test; ordering matters because module state is reloaded when imports run.

describe("Unit - pwaUpdateService", () => {
	beforeEach(() => {
		jest.resetModules();
		(global as any).fetch = jest.fn(() => Promise.resolve({ ok: true }));
	});

	test("checkForUpdates returns false when serviceWorker is unavailable", async () => {
		// Arrange: minimal window without service worker APIs
		Object.defineProperty(global, "window", {
			value: { location: { origin: "http://localhost:3000", reload: jest.fn() } },
			configurable: true,
		});
		Object.defineProperty(global, "navigator", {
			value: {},
			configurable: true,
		});

		// Act: load service and probe for updates
		const { pwaUpdateService } = await import("@/lib/services/pwaUpdateService");
		const result = await pwaUpdateService.checkForUpdates();
		// Assert: no worker means no pending update signal
		expect(result.isUpdateAvailable).toBe(false);
	});

	test("checkForUpdates detects waiting worker as available update", async () => {
		// Arrange: registration with waiting worker plus controller present
		const registration: any = {
			waiting: { postMessage: jest.fn() },
			installing: null,
			update: jest.fn(async () => undefined),
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
		};

		Object.defineProperty(global, "window", {
			value: { location: { origin: "http://localhost:3000", reload: jest.fn() } },
			configurable: true,
		});
		Object.defineProperty(global, "navigator", {
			value: {
				serviceWorker: {
					getRegistration: jest.fn(async () => registration),
					controller: {},
				},
			},
			configurable: true,
		});

		// Act & assert: waiting worker flags update availability
		const { pwaUpdateService } = await import("@/lib/services/pwaUpdateService");
		const result = await pwaUpdateService.checkForUpdates();
		expect(result.isUpdateAvailable).toBe(true);
	});

	test("activateUpdate posts skip-waiting and triggers reload", async () => {
		// Arrange: waiting worker, reload spy, and stubbed localStorage
		const postMessage = jest.fn();
		const reload = jest.fn();
		const registration: any = {
			waiting: { postMessage },
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
			update: jest.fn(async () => undefined),
		};
		Object.defineProperty(global, "window", {
			value: { location: { origin: "http://localhost:3000", reload } },
			configurable: true,
		});
		Object.defineProperty(global, "navigator", {
			value: {
				serviceWorker: { getRegistration: jest.fn(async () => registration) },
			},
			configurable: true,
		});
		Object.defineProperty(global, "localStorage", {
			value: { getItem: jest.fn(), setItem: jest.fn() },
			configurable: true,
		});

		// Act: instruct service to activate pending worker
		const { pwaUpdateService } = await import("@/lib/services/pwaUpdateService");
		await pwaUpdateService.activateUpdate();
		// Assert: skip-waiting handshake and reload invocation
		expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
		expect(reload).toHaveBeenCalled();
	});
});
