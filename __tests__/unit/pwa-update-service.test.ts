describe("Unit - pwaUpdateService", () => {
	beforeEach(() => {
		jest.resetModules();
		(global as any).fetch = jest.fn(() => Promise.resolve({ ok: true }));
	});

	test("checkForUpdates returns false when serviceWorker is unavailable", async () => {
		Object.defineProperty(global, "window", {
			value: { location: { origin: "http://localhost:3000", reload: jest.fn() } },
			configurable: true,
		});
		Object.defineProperty(global, "navigator", {
			value: {},
			configurable: true,
		});

		const { pwaUpdateService } = await import("@/lib/services/pwaUpdateService");
		const result = await pwaUpdateService.checkForUpdates();
		expect(result.isUpdateAvailable).toBe(false);
	});

	test("checkForUpdates detects waiting worker as available update", async () => {
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

		const { pwaUpdateService } = await import("@/lib/services/pwaUpdateService");
		const result = await pwaUpdateService.checkForUpdates();
		expect(result.isUpdateAvailable).toBe(true);
	});

	test("activateUpdate posts skip-waiting and triggers reload", async () => {
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

		const { pwaUpdateService } = await import("@/lib/services/pwaUpdateService");
		await pwaUpdateService.activateUpdate();
		expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
		expect(reload).toHaveBeenCalled();
	});
});
