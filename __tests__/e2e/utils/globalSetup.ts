import { FullConfig } from '@playwright/test';
import { clearSectionLocks } from './testHelpers';

async function globalSetup(config: FullConfig) {
	// Clear section locks at the start of each test run
	clearSectionLocks();
}

export default globalSetup;
