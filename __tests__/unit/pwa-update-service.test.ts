// Unit tests for pwaUpdateService with jest.resetModules and synthetic window/navigator/serviceWorker globals.
// Mocks fetch and service worker registration shapes only-no real SW lifecycle or network. Each test re-imports the module after env setup.
// Isolated globals per test; ordering matters because module state is reloaded when imports run.

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
					addEventListener: jest.fn(),
					removeEventListener: jest.fn(),
				},
			},
			configurable: true,
		});

		const { pwaUpdateService } = await import("@/lib/services/pwaUpdateService");
		const result = await pwaUpdateService.checkForUpdates();
		expect(result.isUpdateAvailable).toBe(true);
	});

	test("activateUpdate waits for controllerchange before reload and returns success", async () => {
		jest.useFakeTimers();
		const postMessage = jest.fn();
		const reload = jest.fn();
		const setItem = jest.fn();
		let controllerChangeHandler: (() => void) | null = null;

		const registration: any = {
			waiting: { postMessage },
			installing: null,
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
			update: jest.fn(async () => undefined),
		};
		Object.defineProperty(global, "window", {
			value: {
				location: { origin: "http://localhost:3000", reload },
				setTimeout: (fn: () => void, ms?: number) => global.setTimeout(fn, ms) as unknown as number,
				clearTimeout: (id: ReturnType<typeof setTimeout>) => global.clearTimeout(id),
			},
			configurable: true,
		});
		Object.defineProperty(global, "navigator", {
			value: {
				serviceWorker: {
					getRegistration: jest.fn(async () => registration),
					controller: {},
					addEventListener: jest.fn((event: string, handler: () => void) => {
						if (event === "controllerchange") controllerChangeHandler = handler;
					}),
					removeEventListener: jest.fn(),
				},
			},
			configurable: true,
		});
		Object.defineProperty(global, "localStorage", {
			value: { getItem: jest.fn(), setItem: jest.fn() },
			configurable: true,
		});
		Object.defineProperty(global, "sessionStorage", {
			value: { getItem: jest.fn(), setItem, removeItem: jest.fn() },
			configurable: true,
		});

		const { pwaUpdateService, PWA_UPDATE_RESULT_KEY } = await import("@/lib/services/pwaUpdateService");
		const activatePromise = pwaUpdateService.activateUpdate();
		await Promise.resolve();
		await Promise.resolve();

		expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
		expect(reload).not.toHaveBeenCalled();
		expect(controllerChangeHandler).toBeTruthy();
		controllerChangeHandler!();

		await expect(activatePromise).resolves.toBe("success");
		expect(setItem).toHaveBeenCalledWith(PWA_UPDATE_RESULT_KEY, "success");
		expect(reload).toHaveBeenCalled();
		jest.useRealTimers();
	});

	test("activateUpdate returns no-waiting when no waiting worker", async () => {
		Object.defineProperty(global, "window", {
			value: { location: { origin: "http://localhost:3000", reload: jest.fn() } },
			configurable: true,
		});
		Object.defineProperty(global, "navigator", {
			value: {
				serviceWorker: {
					getRegistration: jest.fn(async () => ({ waiting: null })),
					addEventListener: jest.fn(),
					removeEventListener: jest.fn(),
				},
			},
			configurable: true,
		});

		const { pwaUpdateService } = await import("@/lib/services/pwaUpdateService");
		await expect(pwaUpdateService.activateUpdate()).resolves.toBe("no-waiting");
	});

	test("consumePwaUpdateResultToast reads and clears the flag", async () => {
		const store: Record<string, string> = { "dorkinians-pwa-update-result": "success" };
		Object.defineProperty(global, "window", {
			value: {},
			configurable: true,
		});
		Object.defineProperty(global, "sessionStorage", {
			value: {
				getItem: (k: string) => store[k] ?? null,
				removeItem: (k: string) => {
					delete store[k];
				},
				setItem: (k: string, v: string) => {
					store[k] = v;
				},
			},
			configurable: true,
		});
		Object.defineProperty(global, "navigator", {
			value: {},
			configurable: true,
		});

		const { consumePwaUpdateResultToast } = await import("@/lib/services/pwaUpdateService");
		expect(consumePwaUpdateResultToast()).toBe("success");
		expect(consumePwaUpdateResultToast()).toBe(null);
	});
});
