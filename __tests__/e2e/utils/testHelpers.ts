import { Page, expect } from '@playwright/test';

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page) {
	await page.waitForLoadState('networkidle');
	await page.waitForLoadState('domcontentloaded');
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

	await page.goto(pageMap[pageName]);
	await waitForPageLoad(page);

	// If not settings, use client-side navigation
	if (pageName !== 'settings') {
		// Click the navigation button in footer or sidebar
		const navSelector = pageName === 'home' 
			? 'button:has-text("Home"), [aria-label*="Home"]'
			: pageName === 'stats'
			? 'button:has-text("Stats"), [aria-label*="Stats"]'
			: pageName === 'totw'
			? 'button:has-text("TOTW"), [aria-label*="TOTW"]'
			: 'button:has-text("Club Info"), [aria-label*="Club Info"]';

		await page.click(navSelector);
		await waitForPageLoad(page);
	}
}

/**
 * Select a player from the player selection component
 */
export async function selectPlayer(page: Page, playerName: string) {
	// Wait for player selection input
	const playerInput = await waitForElement(page, 'input[type="text"], input[placeholder*="player" i]');
	
	// Type player name
	await playerInput.fill(playerName);
	
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
