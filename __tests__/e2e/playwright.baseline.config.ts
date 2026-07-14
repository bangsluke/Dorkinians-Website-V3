import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const root = path.resolve(__dirname, '../..');

/**
 * Baseline run config: same projects/timeouts as root playwright.config.ts,
 * plus JSON output for fail/skip inventory. Paths are absolute so this file
 * can live under __tests__/e2e without shifting testDir.
 */
export default defineConfig({
	testDir: path.join(root, '__tests__', 'e2e'),
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : Number(process.env.PLAYWRIGHT_WORKERS || 2),
	reporter: [
		['list'],
		['json', { outputFile: path.join(root, '__tests__', 'e2e', '.baseline.json') }],
		['html', { outputFolder: path.join(root, '__tests__', 'e2e', 'playwright-report'), open: 'never' }],
	],
	outputDir: path.join(root, '__tests__', 'e2e', 'test-results'),
	timeout: 60000,
	use: {
		baseURL: process.env.WEBSITE_URL || process.env.BASE_URL || 'http://localhost:3000',
		ignoreHTTPSErrors: true,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
		actionTimeout: 60000,
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
		{
			name: 'Mobile Chrome',
			use: { ...devices['Pixel 7'] },
		},
	],
	globalSetup: path.join(root, '__tests__', 'e2e', 'utils', 'globalSetup.ts'),
});
