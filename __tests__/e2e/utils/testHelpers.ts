import { Page, expect } from '@playwright/test';
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

	// If not settings and not home, use client-side navigation to switch pages
	if (pageName !== 'settings' && pageName !== 'home') {
		// Try test IDs first, then fall back to text-based selectors
		const testIdSelector = `[data-testid="nav-footer-${pageName}"], [data-testid="nav-sidebar-${pageName}"]`;
		const textSelector = pageName === 'stats'
			? 'button:has-text("Stats"), [aria-label*="Stats"]'
			: pageName === 'totw'
			? 'button:has-text("TOTW"), [aria-label*="TOTW"]'
			: 'button:has-text("Club Info"), [aria-label*="Club Info"]';

		// Try test ID first
		let buttonExists = await page.locator(testIdSelector).first().isVisible({ timeout: 2000 }).catch(() => false);
		let selectorToUse = testIdSelector;
		
		// Fall back to text selector if test ID not found
		if (!buttonExists) {
			buttonExists = await page.locator(textSelector).first().isVisible({ timeout: 5000 }).catch(() => false);
			selectorToUse = textSelector;
		}
		
		if (buttonExists) {
			await page.locator(selectorToUse).first().click({ timeout: 10000 });
			// Wait for navigation to complete
			await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
		}
	}
	
	// Final wait for page to be ready
	await waitForPageLoad(page);
}

/**
 * Select a player from the player selection component
 */
export async function selectPlayer(page: Page, playerName: string) {
	// Wait for component to be ready (players might be loading)
	await page.waitForTimeout(500);
	
	// 1. Open the dropdown - try test ID first, then fall back to role
	const button = page.getByTestId('player-selection-button').first();
	const buttonExists = await button.isVisible({ timeout: 2000 }).catch(() => false);
	
	if (buttonExists) {
		// Ensure button is in view and clickable
		await button.scrollIntoViewIfNeeded();
		// Try normal click first, then fallback to force click if needed
		try {
			await button.click({ timeout: 5000 });
		} catch {
			// If normal click fails, use force click (Headless UI Listbox may require this)
			await button.click({ force: true, timeout: 5000 });
		}
	} else {
		const roleButton = page.getByRole('button', { name: /Choose a player/i });
		await roleButton.scrollIntoViewIfNeeded();
		try {
			await roleButton.click({ timeout: 5000 });
		} catch {
			await roleButton.click({ force: true, timeout: 5000 });
		}
	}

	// Wait for Listbox.Options to be visible (indicates dropdown is open)
	// The input is inside Listbox.Options, so we need to wait for the container first
	const optionsContainer = page.locator('[role="listbox"]').or(page.locator('ul[class*="dark-dropdown"]')).first();
	await optionsContainer.waitFor({ state: 'visible', timeout: 10000 }).catch(async () => {
		// If role-based selector doesn't work, wait for any container with the input
		await page.waitForSelector('[data-testid="player-selection-input"]', { state: 'visible', timeout: 10000 });
	});

	// 2. Wait for the search input to appear (Headless UI may use Portal or conditional rendering)
	let searchInput;
	try {
		// Wait for input by test ID to be visible
		await page.waitForSelector('[data-testid="player-selection-input"]', { state: 'visible', timeout: 10000 });
		searchInput = page.getByTestId('player-selection-input');
	} catch {
		// Fallback to placeholder selector
		await page.waitForSelector('input[placeholder*="Type at least 3 characters" i]', { state: 'visible', timeout: 10000 });
		searchInput = page.getByPlaceholder(/Type at least 3 characters.../i);
	}
	
	// Type player name
	await searchInput.fill(playerName);
	
	// Wait for dropdown and select - try test ID first
	await page.waitForTimeout(500); // Wait for dropdown to appear
	const optionByTestId = page.getByTestId('player-selection-option').filter({ hasText: playerName }).first();
	const optionExists = await optionByTestId.isVisible({ timeout: 2000 }).catch(() => false);
	
	if (optionExists) {
		await optionByTestId.click();
	} else {
		const option = page.locator(`text=${playerName}`).first();
		await option.click();
	}
	
	// Wait for player to be selected
	await waitForPageLoad(page);
}

/**
 * Wait for chatbot to appear
 */
export async function waitForChatbot(page: Page) {
	await waitForElement(page, '[data-testid="chatbot-input"]', { timeout: 10000 });
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
	
	// Wait for response
	await page.waitForTimeout(2000); // Initial wait
	await waitForDataLoad(page);
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
	const sidebarButton = page.getByTestId(`nav-sidebar-${pageId}`);
	
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

/**
 * Take screenshot with descriptive name
 */
export async function takeScreenshot(page: Page, name: string) {
	await page.screenshot({ path: `e2e/test-results/screenshots/${name}.png`, fullPage: true });
}
