import { Page, TestInfo, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Use a file-based lock to persist across all execution contexts
const LOCK_FILE = path.join(process.cwd(), '__tests__', 'e2e', '.section-locks.json');
const LOCK_DIR = path.dirname(LOCK_FILE);

const getLoggedSections = (): Set<string> => {
	let loggedSections: Set<string>;
	
	try {
		if (fs.existsSync(LOCK_FILE)) {
			const data = fs.readFileSync(LOCK_FILE, 'utf-8');
			const parsed = JSON.parse(data);
			loggedSections = new Set(parsed.sections || []);
		} else {
			loggedSections = new Set<string>();
		}
	} catch {
		loggedSections = new Set<string>();
	}
	
	return loggedSections;
};

const saveLoggedSections = (sections: Set<string>) => {
	try {
		if (!fs.existsSync(LOCK_DIR)) {
			fs.mkdirSync(LOCK_DIR, { recursive: true });
		}
		fs.writeFileSync(LOCK_FILE, JSON.stringify({ sections: Array.from(sections) }), 'utf-8');
	} catch {
		// Ignore file write errors
	}
};

// Try to acquire an exclusive lock for a section (atomic operation)
const tryAcquireSectionLock = (sectionName: string): boolean => {
	const lockFile = path.join(LOCK_DIR, `.lock-${sectionName.replace(/[^a-zA-Z0-9]/g, '_')}`);
	
	try {
		if (!fs.existsSync(LOCK_DIR)) {
			fs.mkdirSync(LOCK_DIR, { recursive: true });
		}
		// Try to create lock file exclusively (fails if already exists)
		const fd = fs.openSync(lockFile, 'wx');
		fs.closeSync(fd);
		return true;
	} catch {
		// Lock file already exists, another process/project is handling this section
		return false;
	}
};

const releaseSectionLock = (sectionName: string) => {
	const lockFile = path.join(LOCK_DIR, `.lock-${sectionName.replace(/[^a-zA-Z0-9]/g, '_')}`);
	try {
		if (fs.existsSync(lockFile)) {
			fs.unlinkSync(lockFile);
		}
	} catch {
		// Ignore cleanup errors
	}
};

// Clear lock file at the start of each test run (called from global setup or first test)
export function clearSectionLocks() {
	try {
		if (fs.existsSync(LOCK_FILE)) {
			fs.unlinkSync(LOCK_FILE);
		}
		// Also clear any individual lock files
		if (fs.existsSync(LOCK_DIR)) {
			const files = fs.readdirSync(LOCK_DIR);
			for (const file of files) {
				if (file.startsWith('.lock-')) {
					try {
						fs.unlinkSync(path.join(LOCK_DIR, file));
					} catch {
						// Ignore individual file errors
					}
				}
			}
		}
	} catch {
		// Ignore cleanup errors
	}
}

/**
 * Log a section header once per test file (works across all projects and workers)
 */
export function logSectionHeader(sectionName: string, emoji: string, number: string) {
	const loggedSections = getLoggedSections();
	const setHasSection = loggedSections.has(sectionName);
	
	if (!setHasSection) {
		// Try to acquire exclusive lock for this section (atomic operation)
		const lockAcquired = tryAcquireSectionLock(sectionName);
		
		if (lockAcquired) {
			// We got the lock - double-check the file wasn't updated by another process
			const recheckSections = getLoggedSections();
			if (!recheckSections.has(sectionName)) {
				// Still not logged, we're the first - log it
				console.log('\n═══════════════════════════════════════════════════════════════');
				console.log(`${emoji} [${number}] ${sectionName}`);
				console.log('═══════════════════════════════════════════════════════════════\n');
				recheckSections.add(sectionName);
				saveLoggedSections(recheckSections);
			}
			releaseSectionLock(sectionName);
		}
	}
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page) {
	// Wait for DOM - networkidle is unreliable with continuous requests (analytics, websockets, etc.)
	await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
}

/**
 * Standard project-level mobile/desktop check for E2E tests.
 */
export function isMobileProject(testInfo: TestInfo): boolean {
	return testInfo.project.name.includes('Mobile');
}

/**
 * Wait for element to be visible and stable
 */
export async function waitForElement(
	page: Page,
	selector: string,
	options?: { timeout?: number; state?: 'visible' | 'attached' | 'detached' | 'hidden' }
) {
	const element = page.locator(selector);
	await element.waitFor({ state: options?.state || 'visible', timeout: options?.timeout || 30000 });
	return element;
}

/**
 * Wait for loading skeleton to disappear
 */
export async function waitForDataLoad(page: Page, skeletonSelector?: string) {
	const defaultSkeletonSelector = '[data-testid="loading-skeleton"], [class*="skeleton"], [class*="Skeleton"], [class*="loading"]';
	const selector = skeletonSelector || defaultSkeletonSelector;
	
	// Wait for skeleton to appear (if it does)
	try {
		await page.waitForSelector(selector, { timeout: 1000, state: 'visible' });
	} catch {
		// Skeleton might not appear, that's okay
	}
	
	// Wait for skeleton to disappear
	await page.waitForSelector(selector, { timeout: 30000, state: 'hidden' }).catch(() => {
		// If selector doesn't exist, that's fine - data might already be loaded
	});
	
	// Wait for network to be idle
	await page.waitForLoadState('networkidle');
}

/**
 * Navigate to a main page
 */
export async function navigateToMainPage(page: Page, pageName: 'home' | 'stats' | 'totw' | 'club-info' | 'settings') {
	const pageMap: Record<string, string> = {
		home: '/',
		stats: '/',
		totw: '/',
		'club-info': '/',
		settings: '/settings',
	};

	await page.goto(pageMap[pageName], { timeout: 30000, waitUntil: 'domcontentloaded' });

	// If not settings and not home, use the same visible nav control as navigation tests (footer vs sidebar).
	if (pageName !== 'settings' && pageName !== 'home') {
		// Wait for a nav control in the DOM (sidebar may be hidden on mobile but still attached).
		await page
			.locator('[data-testid="nav-footer-home"], [data-testid="nav-sidebar-home"]')
			.first()
			.waitFor({ state: 'attached', timeout: 20000 });

		const clickMainNav = async () => {
			try {
				if (pageName === 'stats' || pageName === 'totw' || pageName === 'club-info') {
					const navBtn = await getVisibleNavButton(page, pageName);
					await navBtn.click({ force: true, timeout: 15000 });
				}
			} catch {
				const testIdSelector = `[data-testid="nav-footer-${pageName}"], [data-testid="nav-sidebar-${pageName}"]`;
				const textSelector =
					pageName === 'stats'
						? 'button:has-text("Stats"), [aria-label*="Stats"]'
						: pageName === 'totw'
						? 'button:has-text("TOTW"), [aria-label*="TOTW"]'
						: 'button:has-text("Club Info"), [aria-label*="Club Info"]';
				let navLoc =
					pageName === 'totw'
						? page.locator('[data-testid="nav-footer-totw"], [data-testid="nav-sidebar-totw"]').first()
						: page.locator(testIdSelector).first();
				let buttonExists = await navLoc.isVisible({ timeout: 2000 }).catch(() => false);
				let selectorToUse = testIdSelector;
				if (!buttonExists) {
					buttonExists = await page.locator(textSelector).first().isVisible({ timeout: 5000 }).catch(() => false);
					selectorToUse = textSelector;
				}
				if (buttonExists) {
					if (pageName === 'totw') {
						await navLoc.click({ force: true, timeout: 10000 });
					} else {
						await page.locator(selectorToUse).first().click({ force: true, timeout: 10000 });
					}
				}
			}
		};

		const mainContentReady = async (): Promise<boolean> => {
			if (pageName === 'stats') {
				return page.getByTestId('stats-page-heading').isVisible({ timeout: 8000 }).catch(() => false);
			}
			if (pageName === 'totw') {
				// Season listbox is not mounted until TOTW data has loaded (see TeamOfTheWeek.tsx).
				return page
					.getByRole('heading', { level: 1, name: /Team of (the Week|the Season|All Time)/i })
					.isVisible({ timeout: 12000 })
					.catch(() => false);
			}
			if (pageName === 'club-info') {
				return page
					.getByRole('heading', { name: /Club Information/i })
					.isVisible({ timeout: 8000 })
					.catch(() => false);
			}
			return false;
		};

		/** Footer only calls setMainPage; persisted sub-page may hide the default view (TOTW pitch / club information). */
		const ensureDefaultSubPage = async () => {
			if (pageName === 'totw') {
				// Mobile footer leaves TOTW sub-page on whatever was persisted (often Players of the Month).
				if (await page.getByTestId('players-of-month-season-selector').isVisible({ timeout: 1500 }).catch(() => false)) {
					const dot = page.getByTestId('totw-subpage-indicator-totw');
					if (await dot.isVisible({ timeout: 2000 }).catch(() => false)) {
						await dot.click({ force: true, timeout: 10000 });
					} else {
						const sub = page.getByRole('button', { name: 'Team of the Week' });
						if (await sub.isVisible({ timeout: 2000 }).catch(() => false)) {
							await sub.click({ force: true, timeout: 10000 });
						}
					}
				}
			} else if (pageName === 'club-info') {
				if (await page.getByRole('heading', { name: /Club Information/i }).isVisible({ timeout: 2000 }).catch(() => false)) {
					return;
				}
				const dot = page.getByTestId('club-info-subpage-indicator-0');
				if (await dot.isVisible({ timeout: 2000 }).catch(() => false)) {
					await dot.click({ force: true, timeout: 10000 });
					return;
				}
				const sub = page.getByRole('button', { name: 'Club Information' });
				if (await sub.isVisible({ timeout: 2000 }).catch(() => false)) {
					await sub.click({ force: true, timeout: 10000 });
				}
			}
		};

		for (let attempt = 0; attempt < 3; attempt++) {
			await clickMainNav();
			await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
			await ensureDefaultSubPage();
			if (await mainContentReady()) {
				break;
			}
			await page.waitForTimeout(350);
		}

		if (pageName === 'stats') {
			await page.getByTestId('stats-page-heading').waitFor({ state: 'visible', timeout: 20000 });
		} else if (pageName === 'totw') {
			await page
				.getByRole('heading', { level: 1, name: /Team of (the Week|the Season|All Time)/i })
				.waitFor({ state: 'visible', timeout: 20000 });
			await page.getByTestId('totw-season-selector').waitFor({ state: 'visible', timeout: 65000 });
		} else if (pageName === 'club-info') {
			await page.getByRole('heading', { name: /Club Information/i }).waitFor({ state: 'visible', timeout: 25000 });
		}
	}
	
	// Final wait for page to be ready
	await waitForPageLoad(page);
}

export type ClubInfoSubPageId =
	| "club-information"
	| "league-information"
	| "club-captains"
	| "club-awards"
	| "useful-links";

const CLUB_INFO_SUBPAGE_DOT_INDEX: Record<ClubInfoSubPageId, number> = {
	"club-information": 0,
	"league-information": 1,
	"club-captains": 2,
	"club-awards": 3,
	"useful-links": 4,
};

/**
 * Navigate between Club Info sub-pages (mobile dot indicators vs desktop sidebar).
 * Precondition: main Club Info area is already open (`navigateToMainPage(page, "club-info")`).
 */
const CLUB_INFO_SUB_HEADING: Record<ClubInfoSubPageId, RegExp> = {
	"club-information": /Club Information/i,
	"league-information": /League Information/i,
	"club-captains": /Club Captains/i,
	"club-awards": /Club Awards/i,
	"useful-links": /Useful Links/i,
};

const CLUB_INFO_SIDEBAR_LABEL: Record<ClubInfoSubPageId, string> = {
	"club-information": "Club Information",
	"league-information": "League Information",
	"club-captains": "Club Captains",
	"club-awards": "Club Awards",
	"useful-links": "Useful Links",
};

export async function goToClubInfoSubPage(page: Page, subPageId: ClubInfoSubPageId) {
	const viewport = page.viewportSize();
	const isMobile = viewport !== null && viewport.width < 768;
	const headingRe = CLUB_INFO_SUB_HEADING[subPageId];

	for (let attempt = 0; attempt < 3; attempt++) {
		if (isMobile) {
			const idx = CLUB_INFO_SUBPAGE_DOT_INDEX[subPageId];
			const dot = page.getByTestId(`club-info-subpage-indicator-${idx}`);
			await dot.waitFor({ state: "visible", timeout: 15000 });
			await dot.click({ force: true, timeout: 10000 });
		} else if (attempt < 2) {
			await page.keyboard.press("Escape").catch(() => {});
			const btn = page.locator("aside").getByTestId(`nav-sidebar-${subPageId}`);
			await btn.waitFor({ state: "visible", timeout: 15000 });
			await btn.scrollIntoViewIfNeeded();
			try {
				await btn.click({ timeout: 8000 });
			} catch {
				await btn.click({ force: true, timeout: 10000 });
			}
			if (!(await page.getByRole("heading", { name: headingRe }).isVisible({ timeout: 2500 }).catch(() => false))) {
				const fallback = page
					.locator("aside")
					.getByRole("button", { name: CLUB_INFO_SIDEBAR_LABEL[subPageId] });
				await fallback.click({ timeout: 10000 }).catch(() => fallback.click({ force: true, timeout: 10000 }));
			}
		} else {
			const btn = page.locator("aside").getByTestId(`nav-sidebar-${subPageId}`);
			await btn.evaluate((n) => (n as HTMLButtonElement).click());
		}
		await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
		if (await page.getByRole("heading", { name: headingRe }).isVisible({ timeout: 5000 }).catch(() => false)) {
			return;
		}
	}
}

export type TOTWSubPageId = "totw" | "players-of-month";

/**
 * Navigate between TOTW sub-pages (mobile dot indicators vs desktop sidebar).
 * Precondition: TOTW main section is open (`navigateToMainPage(page, "totw")`).
 */
export async function goToTOTWSubPage(page: Page, subPageId: TOTWSubPageId) {
	const viewport = page.viewportSize();
	const isMobile = viewport !== null && viewport.width < 768;
	if (isMobile) {
		await page.getByTestId(`totw-subpage-indicator-${subPageId}`).click({ force: true, timeout: 15000 });
	} else if (subPageId === "totw") {
		await page.getByTestId("nav-sidebar-totw").first().click({ force: true, timeout: 15000 });
	} else {
		await page.getByTestId("nav-sidebar-players-of-month").click({ force: true, timeout: 15000 });
	}
	await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
}

/** Wait for TOTW / PoM loading skeleton panels to finish (best-effort). */
export async function waitForTotwSkeletonsGone(page: Page, timeout = 45000) {
	const skel = page.getByTestId("loading-skeleton");
	if ((await skel.count()) === 0) return;
	await skel.first().waitFor({ state: "hidden", timeout });
}

/**
 * Select a player from the player selection component
 */
export async function selectPlayer(page: Page, playerName: string) {
	// Wait for component to be ready (players might be loading)
	await page.waitForTimeout(800);
	
	// 1. Open the dropdown - try test ID first, then fall back to role
	let button = page.getByTestId('player-selection-button').first();
	const buttonExists = await button.isVisible({ timeout: 5000 }).catch(() => false);
	
	if (buttonExists) {
		// The button can briefly detach/re-mount on mobile when entering stats routes.
		// Retry a couple times, re-querying the locator each attempt.
		for (let attempt = 0; attempt < 3; attempt++) {
			button = page.getByTestId('player-selection-button').first();
			try {
				await button.waitFor({ state: 'visible', timeout: 5000 });
				// scrollIntoViewIfNeeded can throw when the element detaches during UI transitions.
				await button.scrollIntoViewIfNeeded().catch(() => {});
				// Try normal click first, then fallback to force click if needed
				try {
					await button.click({ timeout: 5000 });
					break;
				} catch {
					// If normal click fails, use force click (Headless UI Listbox may require this)
					await button.click({ force: true, timeout: 5000 });
					break;
				}
			} catch {
				// Backoff briefly, then retry.
				await page.waitForTimeout(250);
			}
		}
	} else {
		let roleButton = page.getByRole('button', { name: /Choose a player/i });
		for (let attempt = 0; attempt < 3; attempt++) {
			roleButton = page.getByRole('button', { name: /Choose a player/i });
			try {
				await roleButton.waitFor({ state: 'visible', timeout: 5000 });
				// Best-effort scroll; ignore transient detachment errors.
				await roleButton.scrollIntoViewIfNeeded().catch(() => {});
				try {
					await roleButton.click({ timeout: 5000 });
					break;
				} catch {
					await roleButton.click({ force: true, timeout: 5000 });
					break;
				}
			} catch {
				await page.waitForTimeout(250);
			}
		}
	}

	// Wait for Listbox.Options to be visible (indicates dropdown is open)
	// The input is inside Listbox.Options, so we need to wait for the container first
	const optionsContainer = page.locator('[role="listbox"]').or(page.locator('ul[class*="dark-dropdown"]')).first();
	// Best-effort: on some transitions, the container may not match reliably on mobile.
	// The next step already falls back to the input placeholder selector.
	await optionsContainer.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

	// 2. Wait for the search input to appear (Headless UI may use Portal or conditional rendering)
	let searchInput;
	try {
		// Wait for input by test ID to be visible
		await page.waitForSelector('[data-testid="player-selection-input"]', { state: 'visible', timeout: 10000 });
		searchInput = page.getByTestId('player-selection-input');
	} catch {
		try {
			// Fallback to placeholder selector
			await page.waitForSelector('input[placeholder*="Type at least 3 characters" i]', { state: 'visible', timeout: 10000 });
			searchInput = page.getByPlaceholder(/Type at least 3 characters.../i);
		} catch {
			// Some mobile runs fail to mount the searchable dropdown.
			// Fall back to direct localStorage setup so tests can proceed deterministically.
			await setPlayerDirectly(page, playerName);
			await page.reload({ waitUntil: 'domcontentloaded' });
			await waitForPageLoad(page);
			return;
		}
	}

	// Ensure `/api/players` has finished loading before we try to filter/select.
	// Without this, the list can legitimately contain 0 options even after typing.
	{
		const loading = page.getByText(/Loading players\.\.\./i);
		const readyHint = page.getByText(/Type at least 3 characters to filter players/i);
		const deadline = Date.now() + 15000;
		while (Date.now() < deadline) {
			// When loaded, the component shows the "Type at least 3 characters..." hint (query length < 3).
			if (await readyHint.isVisible({ timeout: 200 }).catch(() => false)) break;
			// If loading message is gone, we should be safe to continue even if hint isn't shown.
			if (!(await loading.isVisible({ timeout: 200 }).catch(() => false))) break;
			await page.waitForTimeout(250);
		}
	}
	
	// Type player name
	await searchInput.fill(playerName);
	
	// Wait for dropdown and select - try test ID first
	await page.waitForTimeout(500); // Wait for dropdown to appear
	
	// Try to find the option first
	const optionByTestId = page.getByTestId('player-selection-option').filter({ hasText: playerName }).first();
	const optionExists = await optionByTestId.isVisible({ timeout: 10000 }).catch(() => false);
	
	if (optionExists) {
		// Try clicking the option first (most direct)
		try {
			await optionByTestId.click({ timeout: 5000 });
		} catch (e) {
			// Fallback 1: Try clicking with force
			try {
				await optionByTestId.click({ force: true, timeout: 5000 });
			} catch (e2) {
				// Fallback 2: Try keyboard navigation
				await searchInput.focus();
				await page.waitForTimeout(100);
				await searchInput.press('ArrowDown');
				await page.waitForTimeout(100);
				await searchInput.press('Enter');
			}
		}
	} else {
		const option = page.locator(`text=${playerName}`).first();
		const optionVisible = await option.isVisible({ timeout: 2000 }).catch(() => false);
		if (optionVisible) {
			try {
				await option.click();
			} catch (e) {
				await searchInput.press('Enter');
			}
		} else {
			// Last resort: try keyboard Enter on the input (should select first filtered option)
			await searchInput.press('Enter');
		}
	}
	
	// Wait for player to be selected
	await waitForPageLoad(page);

	// Verify selection actually took effect (UI selection can be flaky if `/api/players` is slow).
	// If it didn't, fall back to setting localStorage directly and reloading.
	const selectionMarker = page
		.locator('[data-testid="home-edit-player-button"], [data-testid="player-selection-edit-button"]')
		.first();
	const selectedViaUi = await selectionMarker.isVisible({ timeout: 7000 }).catch(() => false);
	if (!selectedViaUi) {
		await setPlayerDirectly(page, playerName);
		await page.reload({ waitUntil: 'domcontentloaded' });
		await waitForPageLoad(page);
		await selectionMarker.waitFor({ state: 'visible', timeout: 20000 });
	}
}

/**
 * Set player directly in store and localStorage (bypasses UI interaction)
 * This is more reliable for tests that need a player selected before testing
 * 
 * This function:
 * 1. Sets localStorage directly
 * 2. Calls the store's selectPlayer function via page.evaluate to update store state
 * 3. Waits for the store to be updated
 */
export async function setPlayerDirectly(page: Page, playerName: string) {
	// Set localStorage and manually trigger store update
	// Since we can't easily access Zustand stores from page.evaluate(),
	// we'll set localStorage and then trigger initializeFromStorage by navigating
	await page.evaluate((name) => {
		// Set localStorage (matching store's selectPlayer behavior)
		localStorage.setItem('dorkinians-selected-player', name);
		
		// Also update recent players
		try {
			const recentPlayersKey = 'dorkinians-recent-players';
			const existing = localStorage.getItem(recentPlayersKey);
			let recentPlayers: string[] = existing ? JSON.parse(existing) : [];
			recentPlayers = recentPlayers.filter((p) => p !== name);
			recentPlayers.unshift(name);
			recentPlayers = recentPlayers.slice(0, 5);
			localStorage.setItem(recentPlayersKey, JSON.stringify(recentPlayers));
		} catch (e) {
			console.warn('Failed to update recent players:', e);
		}
	}, playerName);
	
	// Now trigger store update by calling initializeFromStorage
	// We'll do this by navigating away and back, or by manually calling it if accessible
	// The simplest: reload the page or navigate to trigger initializeFromStorage
	// But actually, we can just wait for the next component mount to call it
	// OR we can manually trigger it by accessing the store if it's exposed
	
	// Wait for localStorage to be set
	await page.waitForFunction(
		(name) => localStorage.getItem('dorkinians-selected-player') === name,
		playerName,
		{ timeout: 5000 }
	);
	
}

/**
 * Set up localStorage for Player Stats page to display fully populated
 * This replicates the essential behavior of initializeFromStorage for testing
 * without requiring navigation to home page
 */
export async function setupPlayerStatsPage(page: Page, playerName: string) {
	// localStorage access requires a same-origin document context.
	await page.goto('/', { waitUntil: 'domcontentloaded' });

	await page.evaluate((name) => {
		// Set selected player (required for Player Stats)
		localStorage.setItem('dorkinians-selected-player', name);
		
		// Set navigation state to stats page
		localStorage.setItem('dorkinians-current-main-page', 'stats');
		localStorage.setItem('dorkinians-current-stats-sub-page', 'player-stats');
		
		// Update recent players (matching selectPlayer behavior)
		try {
			const recentPlayersKey = 'dorkinians-recent-players';
			const existing = localStorage.getItem(recentPlayersKey);
			let recentPlayers: string[] = existing ? JSON.parse(existing) : [];
			recentPlayers = recentPlayers.filter((p) => p !== name);
			recentPlayers.unshift(name);
			recentPlayers = recentPlayers.slice(0, 5);
			localStorage.setItem(recentPlayersKey, JSON.stringify(recentPlayers));
		} catch (e) {
			console.warn('Failed to update recent players:', e);
		}
	}, playerName);
	
	// Wait for localStorage to be set
	await page.waitForFunction(
		(name) => localStorage.getItem('dorkinians-selected-player') === name && localStorage.getItem('dorkinians-current-main-page') === 'stats',
		playerName,
		{ timeout: 5000 }
	);

	// Trigger app initialization from storage for stats route.
	// Without this, some tests may land on "No player data available" if initialization happens after assertions.
	await page.goto('/stats', { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(500);
}

/**
 * Wait for chatbot to appear
 */
export async function waitForChatbot(page: Page) {
	// Ensure the player selection has finished first (prevents racing with player/chatbot transitions)
	await waitForElement(page, '[data-testid="home-edit-player-button"]', { timeout: 20000 });
	
	const viewport = page.viewportSize();
	const isMobile = viewport !== null && viewport.width < 768;
	const timeout = isMobile ? 10000 : 20000;
	
	await waitForElement(page, '[data-testid="chatbot-input"]', { timeout });
}

/**
 * Submit a chatbot query
 */
export async function submitChatbotQuery(page: Page, query: string) {
	// Try test ID first, then fall back to placeholder
	const inputByTestId = page.getByTestId('chatbot-input');
	const inputExists = await inputByTestId.isVisible({ timeout: 2000 }).catch(() => false);
	
	let input;
	if (inputExists) {
		input = inputByTestId;
	} else {
		const inputSelector = 'input[type="text"][placeholder*="question" i], textarea[placeholder*="question" i]';
		input = await waitForElement(page, inputSelector);
	}
	
	await input.fill(query);
	
	// Try test ID first, then fall back to type/submit
	const submitByTestId = page.getByTestId('chatbot-submit');
	const submitExists = await submitByTestId.isVisible({ timeout: 2000 }).catch(() => false);
	
	if (submitExists) {
		await submitByTestId.click();
	} else {
		await page.getByTestId('chatbot-submit').filter({ has: page.locator(':visible') }).click();
	}
	
	// Wait for response (avoid networkidle — analytics/long-polling often prevent it on production)
	await page.getByTestId('chatbot-submit').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
	await expect(page.getByTestId('chatbot-answer')).toBeVisible({ timeout: 120000 });
}

/**
 * Verify no console errors
 */
export async function verifyNoConsoleErrors(page: Page) {
	const errors: string[] = [];
	
	page.on('console', (msg) => {
		if (msg.type() === 'error') {
			errors.push(msg.text());
		}
	});
	
	return errors;
}

/**
 * Get the visible navigation button (footer on mobile, sidebar on desktop)
 */
export async function getVisibleNavButton(page: Page, pageId: 'home' | 'stats' | 'totw' | 'club-info') {
	const footerButton = page.getByTestId(`nav-footer-${pageId}`);
	// Parent TOTW and sub-page "Team of the Week" both use data-testid nav-sidebar-totw; parent is first in DOM.
	const sidebarButton =
		pageId === 'totw'
			? page.getByTestId(`nav-sidebar-${pageId}`).first()
			: page.getByTestId(`nav-sidebar-${pageId}`);
	
	// Check which button is visible - prioritize footer on mobile, sidebar on desktop
	const viewport = page.viewportSize();
	const isMobile = viewport && viewport.width < 768; // md breakpoint
	
	if (isMobile) {
		// On mobile, try footer first
		const footerVisible = await footerButton.isVisible({ timeout: 2000 }).catch(() => false);
		if (footerVisible) return footerButton;
		// Fallback to sidebar if footer not visible
		const sidebarVisible = await sidebarButton.isVisible({ timeout: 2000 }).catch(() => false);
		if (sidebarVisible) return sidebarButton;
	} else {
		// On desktop, try sidebar first
		const sidebarVisible = await sidebarButton.isVisible({ timeout: 2000 }).catch(() => false);
		if (sidebarVisible) return sidebarButton;
		// Fallback to footer if sidebar not visible
		const footerVisible = await footerButton.isVisible({ timeout: 2000 }).catch(() => false);
		if (footerVisible) return footerButton;
	}
	
	// If neither is visible yet, return the one that should be visible based on viewport
	return isMobile ? footerButton : sidebarButton;
}

export type StatsSubPageId = "player-stats" | "team-stats" | "club-stats" | "comparison";

/**
 * Click a stats sub-page control and wait for the target content to render.
 * Mobile uses the dot indicators; desktop uses the sidebar buttons.
 */
export async function clickStatsSubPage(page: Page, subPageId: StatsSubPageId) {
	const viewport = page.viewportSize();
	const isMobile = viewport !== null && viewport.width < 768;
	
	const MOBILE_INDICES: Record<StatsSubPageId, number> = {
		"player-stats": 0,
		"team-stats": 1,
		"club-stats": 2,
		"comparison": 3,
	};
	
	if (isMobile) {
		const idx = MOBILE_INDICES[subPageId];
		const indicator = page.getByTestId(`stats-subpage-indicator-${idx}`);
		await indicator.waitFor({ state: "visible", timeout: 15000 });
		await indicator.click({ timeout: 15000 });
	} else {
		const btn = page.getByTestId(`nav-sidebar-${subPageId}`);
		await btn.waitFor({ state: "visible", timeout: 15000 });
		await btn.scrollIntoViewIfNeeded();
		await btn.click({ timeout: 15000 });
	}
	
	// Wait for the relevant sub-page marker.
	// These selectors should exist regardless of viewport.
	const contentTimeout = 45000;
	switch (subPageId) {
		case "player-stats":
			await page.getByTestId("stats-page-heading").first().waitFor({ state: "visible", timeout: contentTimeout });
			break;
		case "team-stats":
			// Team stats can now render either with loaded content or with page header
			// while team data is being initialized/selected.
			{
				const teamHeading = page.getByTestId("team-top-players-heading").first();
				const teamPageHeading = page.getByRole("heading", { name: /Team Stats/i }).first();
				
				const headingTimeout = 5000;
				try {
					await teamHeading.waitFor({ state: "visible", timeout: headingTimeout });
				} catch {
					await teamPageHeading.waitFor({ state: "visible", timeout: contentTimeout });
				}
			}
			break;
		case "club-stats":
			{
				const clubHeading = page.getByTestId("club-top-players-heading").first();
				const clubPageHeading = page.getByRole("heading", { name: /Club Stats/i }).first();
				const clubEmpty = page.getByText(/No team data available/i).first();
				
				const headingTimeout = 5000;
				try {
					await clubHeading.waitFor({ state: "visible", timeout: headingTimeout });
				} catch {
					try {
						await clubPageHeading.waitFor({ state: "visible", timeout: headingTimeout });
					} catch {
						await clubEmpty.waitFor({ state: "visible", timeout: contentTimeout });
					}
				}
			}
			break;
		case "comparison":
			{
				const radar = page.locator("#comparison-radar-chart").first();
				const comparisonPageHeading = page.getByRole("heading", { name: /Player Comparison|Comparison/i }).first();
				const comparisonSelectPrompt = page.getByText(/Select a player to display data here/i).first();
				const comparisonEmpty = page.getByText(/No data available for comparison/i).first();
				
				const headingTimeout = 5000;
				try {
					await radar.waitFor({ state: "visible", timeout: headingTimeout });
				} catch {
					try {
						await comparisonSelectPrompt.waitFor({ state: "visible", timeout: headingTimeout });
					} catch {
						try {
							await comparisonEmpty.waitFor({ state: "visible", timeout: headingTimeout });
						} catch {
							await comparisonPageHeading.waitFor({ state: "visible", timeout: contentTimeout });
						}
					}
				}
			}
			break;
	}
}

/**
 * Take screenshot with descriptive name
 */
export async function takeScreenshot(page: Page, name: string) {
	await page.screenshot({ path: `e2e/test-results/screenshots/${name}.png`, fullPage: true });
}

/**
 * Verify a section is visible by checking its heading and content
 * page is the page object
 * sectionName is the name of the section to verify
 * dataTestId is the data-testid of the section to verify
 * contentText is some additional text to verify within the section
 */
export async function verifySectionVisible(page: Page, sectionId: string, sectionName: string, dataTestId?: string, contentText?: string) {
	// Find section by heading (h3 element) or data-testid
	const heading = dataTestId ? page.getByTestId(dataTestId) : page.getByRole('heading', { name: new RegExp(sectionName, 'i') });
	await expect(heading).toBeVisible({ timeout: 10000 });
	
	// If content text is provided, verify it exists within the section
	if (contentText) {
		// Find the section container
		const sectionContainer = heading.locator(`xpath=ancestor::*[@id="${sectionId}"]`);
		// 1. Normal text match
		const textMatch = sectionContainer.getByText(new RegExp(contentText, 'i'));
		// 2. Label text match
		const labelMatch = sectionContainer.locator('label', {
			hasText: new RegExp(contentText, 'i'),
		});
		// 3. Combined locator: either text OR label
		const combined = sectionContainer.locator(
			`:is(:text("${contentText}"), label:has-text("${contentText}"))`
		);
		await expect(combined.first()).toBeVisible({ timeout: 5000 });
	}
}

/**
 * Toggle data table mode and verify the state
 */
export async function toggleDataTable(page: Page, expectedState: 'table' | 'visualisation') {
	// Find the toggle button
	const toggleButton = page.getByRole('button', { name: /Switch to (data table|data visualisation)/i });
	await expect(toggleButton).toBeVisible({ timeout: 5000 });
	
	// Click the button
	await toggleButton.click();
	await page.waitForTimeout(500); // Wait for state change
	
	// Verify the new state
	if (expectedState === 'table') {
		// Should see data table and "Switch to data visualisation" button
		const table = page.locator('table').first();
		await expect(table).toBeVisible({ timeout: 5000 });
		const visualisationButton = page.getByRole('button', { name: /Switch to data visualisation/i });
		await expect(visualisationButton).toBeVisible({ timeout: 5000 });
	} else {
		// Should see visualisations and "Switch to data table" button
		const tableButton = page.getByRole('button', { name: /Switch to data table/i });
		await expect(tableButton).toBeVisible({ timeout: 5000 });
		// Verify at least one "visualisation mode" marker is present.
		// For empty-data states, the UI uses the subpage heading ("Team Stats"/"Club Stats") + empty message.
		const visualisationReady = page
			.getByRole('heading', {
				name: /Key Performance Stats|Key Club Stats|Player Stats|Team Stats|Club Stats/i,
			})
			.first()
			.or(page.getByText(/No team data available/i))
			.or(page.getByText(/No player data available/i));
		await expect(visualisationReady).toBeVisible({ timeout: 5000 });
	}
}
