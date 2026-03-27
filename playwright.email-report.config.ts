import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

/**
 * Used only by `npm run test:e2e:email` to write machine-readable results for skipped-test reasons.
 * Keeps all other settings identical to playwright.config.ts.
 */
export default defineConfig({
	...baseConfig,
	reporter: [
		['html', { outputFolder: '__tests__/e2e/playwright-report' }],
		['list'],
		['json', { outputFile: '__tests__/e2e/test-results/e2e-email-report.json' }],
	],
});
