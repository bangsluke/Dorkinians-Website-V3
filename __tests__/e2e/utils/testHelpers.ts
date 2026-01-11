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
	const defaultSkeletonSelector = '[class*="skeleton"], [class*="Skeleton"], [class*="loading"]';
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
		// Click the navigation button in footer or sidebar
		const navSelector = pageName === 'stats'
			? 'button:has-text("Stats"), [aria-label*="Stats"]'
			: pageName === 'totw'
			? 'button:has-text("TOTW"), [aria-label*="TOTW"]'
			: 'button:has-text("Club Info"), [aria-label*="Club Info"]';

		const buttonExists = await page.locator(navSelector).first().isVisible({ timeout: 5000 }).catch(() => false);
		if (buttonExists) {
			await page.click(navSelector, { timeout: 10000 });
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
	// 1. Open the dropdown
	await page.getByRole('button', { name: /Choose a player/i }).click();

	// 2. Wait for the search input to appear
	const searchInput = page.getByPlaceholder(/Type at least 3 characters.../i);
	await searchInput.waitFor({ state: 'visible' });
	
	// Type player name
	await searchInput.fill(playerName);
	
	// Wait for dropdown and select
	await page.waitForTimeout(500); // Wait for dropdown to appear
	const option = page.locator(`text=${playerName}`).first();
	await option.click();
	
	// Wait for player to be selected
	await waitForPageLoad(page);
}

/**
 * Wait for chatbot to appear
 */
export async function waitForChatbot(page: Page) {
	await waitForElement(page, '[class*="chatbot"], [class*="Chatbot"]', { timeout: 10000 });
}

/**
 * Submit a chatbot query
 */
export async function submitChatbotQuery(page: Page, query: string) {
	const inputSelector = 'input[type="text"][placeholder*="question" i], textarea[placeholder*="question" i]';
	const input = await waitForElement(page, inputSelector);
	
	await input.fill(query);
	
	const submitButton = page.locator('button[type="submit"], button:has-text("Send"), button:has-text("Ask")');
	await submitButton.click();
	
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
 * Take screenshot with descriptive name
 */
export async function takeScreenshot(page: Page, name: string) {
	await page.screenshot({ path: `e2e/test-results/screenshots/${name}.png`, fullPage: true });
}
