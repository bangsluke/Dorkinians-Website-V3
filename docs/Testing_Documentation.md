# E2E Testing Documentation

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Overview](#overview)
- [Test Framework](#test-framework)
- [Test Structure](#test-structure)
- [Test Categories](#test-categories)
  - [Navigation Tests](#navigation-tests)
  - [Home Page Tests](#home-page-tests)
  - [Stats Page Tests](#stats-page-tests)
  - [TOTW Page Tests](#totw-page-tests)
  - [Club Info Page Tests](#club-info-page-tests)
  - [Settings Page Tests](#settings-page-tests)
  - [API Endpoint Tests](#api-endpoint-tests)
  - [Cross-Cutting Tests](#cross-cutting-tests)
- [What Is Tested](#what-is-tested)
- [What Is Not Tested](#what-is-not-tested)
- [Running Tests](#running-tests)
  - [Local Development](#local-development)
  - [Cron Job Execution](#cron-job-execution)
  - [Environment Variables](#environment-variables)
- [Test Maintenance](#test-maintenance)
  - [When to Update Tests](#when-to-update-tests)
  - [Test Data](#test-data)
  - [Selector Updates](#selector-updates)
  - [Adding New Tests](#adding-new-tests)
- [Cron Job Setup for E2E Tests](#cron-job-setup-for-e2e-tests)
  - [Overview](#overview-1)
  - [Prerequisites](#prerequisites)
  - [Setting Up cron-job.org](#setting-up-cron-joborg)
    - [Option 1: Direct Command Execution (Recommended)](#option-1-direct-command-execution-recommended)
    - [Option 2: HTTP Endpoint (Alternative)](#option-2-http-endpoint-alternative)
    - [Option 3: Custom Server Script](#option-3-custom-server-script)
  - [Test Execution](#test-execution)
    - [Command for cron-job.org](#command-for-cron-joborg)
    - [What Happens During Execution](#what-happens-during-execution)
    - [Expected Duration](#expected-duration)
  - [Failure Notifications](#failure-notifications)
    - [cron-job.org Built-in Notifications](#cron-joborg-built-in-notifications)
    - [Custom Notification Script](#custom-notification-script)
    - [Notification Content](#notification-content)
  - [Monitoring and Maintenance](#monitoring-and-maintenance)
    - [Weekly Review Checklist](#weekly-review-checklist)
    - [Common Issues and Solutions](#common-issues-and-solutions)
    - [Test Report Access](#test-report-access)
    - [Updating Test Schedule](#updating-test-schedule)
  - [Example cron-job.org Configuration](#example-cron-joborg-configuration)

## Overview

This document serves as the main source of information about the E2E (End-to-End) test suite for the Dorkinians FC website. The test suite is designed to verify that all major functionality is working correctly and can be run weekly via cron-job.org to ensure the app is up and running at all times.

The test suite uses Playwright for browser automation and is configured to run headlessly for cron job execution. Tests are organized by feature/page and cover navigation, user interactions, data loading, and API endpoints.

> [Back to Table of Contents](#table-of-contents)

## Test Framework

**Framework**: Playwright  
**Language**: TypeScript  
**Test Location**: `e2e/` directory  
**Configuration**: `playwright.config.ts`

**Key Features**:
- Headless browser automation
- Screenshot capture on failure (no video recording)
- Multi-browser support (Chromium, Mobile Chrome)
- Automatic waiting and retry logic
- HTML test reports

> [Back to Table of Contents](#table-of-contents)

## Test Structure

```
e2e/
├── fixtures/        # Test data and constants
├── utils/           # Helper functions and utilities
├── navigation/      # Navigation tests
├── home/            # Home page tests
├── stats/           # Stats page tests
├── totw/            # TOTW page tests
├── club-info/       # Club Info page tests
├── settings/        # Settings page tests
├── api/             # API endpoint tests
└── cross-cutting/   # Cross-cutting tests
```

> [Back to Table of Contents](#table-of-contents)

## Test Categories

### Navigation Tests

**File**: `e2e/navigation/navigation.spec.ts`

**What is tested**:
- Navigation to all main pages (Home, Stats, TOTW, Club Info, Settings)
- Sub-page navigation within Stats section
- Sub-page navigation within TOTW section
- Navigation state persistence

**What is not tested**:
- Deep navigation paths (e.g., navigating to a specific stats section then to another)
- Browser back/forward button behavior
- URL changes on navigation

> [Back to Table of Contents](#table-of-contents)

### Home Page Tests

**File**: `e2e/home/home.spec.ts`

**What is tested**:
- Player selection functionality
- Chatbot interface display after player selection
- Chatbot query submission and response validation
- Example questions display
- Example question clicking
- Recently selected players list (if present)

**What is not tested**:
- Chatbot conversation history
- Multiple consecutive queries
- Chatbot error handling for invalid queries (covered in API tests)
- Player selection dropdown filtering

> [Back to Table of Contents](#table-of-contents)

### Stats Page Tests

**File**: `e2e/stats/stats.spec.ts`

**What is tested**:
- Player Stats page default display
- Navigation between Stats sub-pages (Player Stats, Team Stats, Club Stats, Comparison)
- Filter sidebar opening and closing
- Filter application (basic)
- Data table display (if present)
- Chart rendering (if present)

**What is not tested**:
- All individual stats sections within each sub-page
- Complex filter combinations
- Filter persistence across page navigation
- Data table sorting/filtering
- Chart interactions (zooming, tooltips)
- Player selection within Comparison page
- Detailed data validation for each stat type

> [Back to Table of Contents](#table-of-contents)

### TOTW Page Tests

**File**: `e2e/totw/totw.spec.ts`

**What is tested**:
- Team of the Week page display
- Season and week selection (HeadlessUI Listbox)
- TOTW data loading
- Player display on pitch with scores
- **Player click interaction and modal display** (Primary example test)
  - Modal opens when clicking a player
  - Player name is displayed in modal
  - Player points/score is displayed in modal
  - Match details are shown
  - TOTW appearances count (if available)
  - Modal closes correctly
- Week selection and data updates
- Players of the Month sub-page navigation
- Player rankings display on Players of the Month page

**What is not tested**:
- All player positions on pitch
- Formation changes
- Star Man interaction
- Detailed match breakdown in modal
- Month selection on Players of the Month page
- Player stats expansion on Players of the Month page

> [Back to Table of Contents](#table-of-contents)

### Club Info Page Tests

**File**: `e2e/club-info/club-info.spec.ts`

**What is tested**:
- Club Information page default display
- Navigation to all Club Info sub-pages:
  - League Information
  - Club Captains
  - Club Awards
  - Useful Links
- League tables display on League Information page
- Data loading for each sub-page

**What is not tested**:
- Detailed content validation for each sub-page
- Season filtering on League Information
- Captain details expansion
- Award category filtering
- Useful link click validation (external links)
- Map interactions (if present)

> [Back to Table of Contents](#table-of-contents)

### Settings Page Tests

**File**: `e2e/settings/settings.spec.ts`

**What is tested**:
- Settings page display
- Navigation shortcuts display
- Quick navigation using shortcuts
- Database status display (if present)
- PWA install button (if present)

**What is not tested**:
- PWA installation flow
- Database status refresh
- Settings persistence
- Feedback modal
- Data privacy modal

> [Back to Table of Contents](#table-of-contents)

### API Endpoint Tests

**File**: `e2e/api/api.spec.ts`

**What is tested**:
- Chatbot API response structure and timing
- Player Data API response structure and timing
- TOTW API response structure and timing
- Error handling for invalid queries
- Error handling for invalid player names
- Response time validation (< 5 seconds)

**What is not tested**:
- All API endpoints (only critical ones)
- API authentication/authorization
- Rate limiting
- API response data accuracy (covered in functional tests)
- WebSocket connections (if any)

> [Back to Table of Contents](#table-of-contents)

### Cross-Cutting Tests

**File**: `e2e/cross-cutting/cross-cutting.spec.ts`

**What is tested**:
- Loading states (skeletons appear and disappear)
- Error handling (app doesn't crash on invalid input)
- Mobile responsiveness (viewport and touch interactions)
- Console error detection (filtered for critical errors)
- Navigation state persistence across refreshes
- Basic data validation (data is present and formatted)

**What is not tested**:
- All error scenarios
- All viewport sizes
- Performance metrics (load times, render times)
- Accessibility (WCAG compliance)
- SEO meta tags
- Analytics tracking

> [Back to Table of Contents](#table-of-contents)

## What Is Tested

The test suite covers:

1. **Core Navigation**: All main pages and sub-pages
2. **Critical User Flows**: Player selection, chatbot queries, TOTW player interactions
3. **Data Loading**: Verification that data loads and displays correctly
4. **User Interactions**: Clicks, form inputs, dropdown selections
5. **API Endpoints**: Critical API responses and error handling
6. **Responsive Design**: Mobile viewport testing
7. **Error Resilience**: App doesn't crash on invalid input

> [Back to Table of Contents](#table-of-contents)

## What Is Not Tested

The test suite does not cover:

1. **Detailed Content Validation**: Specific data values, calculations, or business logic accuracy
2. **All Edge Cases**: Only common user flows are tested
3. **Performance Metrics**: Load times, render performance, bundle sizes
4. **Accessibility**: WCAG compliance, screen reader compatibility
5. **Browser Compatibility**: Only Chromium and Mobile Chrome are tested
6. **Offline Functionality**: PWA offline mode, service worker behavior
7. **Analytics**: Tracking pixel firing, event logging
8. **Third-Party Integrations**: External service integrations beyond API calls
9. **Complex User Workflows**: Multi-step processes spanning multiple pages
10. **Data Accuracy**: The tests verify data is present, not that it's correct

> [Back to Table of Contents](#table-of-contents)

## Running Tests

### Local Development

```bash
# Run all tests
npm run test:e2e

# Run with UI (interactive mode)
npm run test:e2e:ui

# Run in headless mode
npm run test:e2e:headless

# Run specific test file
npx playwright test e2e/totw/totw.spec.ts

# Run tests in debug mode
npm run test:e2e:debug

# Run tests with email notification
npm run test:e2e:email

# View test report
npm run test:e2e:report
```

### Cron Job Execution

For cron-job.org, use:

```bash
npm run test:e2e:headless
```

Or with email notifications:

```bash
npm run test:e2e:email
```

This will:
- Run all tests in headless mode
- Generate HTML report in `e2e/playwright-report/`
- Capture screenshots on failure in `e2e/test-results/screenshots/`
- Send email notification with test results (if email configured)
- Exit with non-zero code on failure (for cron job notification)

### Environment Variables

Set `BASE_URL` environment variable for testing against production:

```bash
BASE_URL=https://dorkinians-website-v3.netlify.app npm run test:e2e:headless
```

For email notifications, ensure these environment variables are set:
- `SMTP_SERVER` - SMTP server hostname
- `SMTP_PORT` - SMTP server port
- `SMTP_USERNAME` - SMTP username
- `SMTP_PASSWORD` - SMTP password
- `SMTP_FROM_EMAIL` - Sender email address
- `SMTP_TO_EMAIL` - Recipient email address
- `SMTP_EMAIL_SECURE` - Use TLS/SSL (true/false)

> [Back to Table of Contents](#table-of-contents)

## Test Maintenance

### When to Update Tests

1. **New Features**: Add tests for new pages or major features
2. **Breaking Changes**: Update selectors when UI components change
3. **Bug Fixes**: Add regression tests for fixed bugs
4. **API Changes**: Update API tests when endpoints change

### Test Data

Test data is defined in `e2e/fixtures/testData.ts`. Update this file when:
- Test players are no longer in the database
- Test seasons are outdated
- Expected response times need adjustment

### Selector Updates

If UI components change and tests fail:
1. Update selectors in test files to match new structure
2. Prefer data attributes or ARIA labels over class names
3. Use semantic selectors (text content, roles) when possible

### Adding New Tests

When adding new tests:
1. Follow existing test structure and naming conventions
2. Use helper functions from `e2e/utils/testHelpers.ts`
3. Update this documentation to reflect new test coverage
4. Ensure tests are independent and can run in any order

> [Back to Table of Contents](#table-of-contents)

## Cron Job Setup for E2E Tests

### Overview

This guide explains how to set up weekly E2E test execution via cron-job.org. The tests will run automatically once per week to verify that the Dorkinians FC website is functioning correctly.

> [Back to Table of Contents](#table-of-contents)

### Prerequisites

1. **cron-job.org Account**: Sign up at https://cron-job.org
2. **Production URL**: The tests will run against the production site
3. **Node.js Environment**: cron-job.org should support Node.js execution (or use a custom server)

> [Back to Table of Contents](#table-of-contents)

### Setting Up cron-job.org

#### Option 1: Direct Command Execution (Recommended)

If cron-job.org supports Node.js execution:

1. **Create a new cron job**:
   - Title: "Dorkinians E2E Tests - Weekly"
   - URL/Command: See command below
   - Schedule: Weekly (e.g., Every Monday at 2:00 AM)

2. **Command to execute**:
   ```bash
   cd /path/to/V3-Dorkinians-Website && npm run test:e2e:cron
   ```

3. **Environment Variables**:
   - `BASE_URL=https://dorkinians-website-v3.netlify.app`
   - `HEADLESS=true`

#### Option 2: HTTP Endpoint (Alternative)

If you prefer to trigger tests via HTTP endpoint:

1. Create a Netlify Function or API route that executes the tests
2. Set up cron-job.org to call this endpoint weekly
3. The endpoint should:
   - Run the test suite
   - Return test results
   - Send notifications on failure

#### Option 3: Custom Server Script

If you have a server with Node.js:

1. Set up a script that:
   - Clones/pulls the latest code
   - Installs dependencies
   - Runs the test suite
   - Sends email notifications on failure

2. Configure cron-job.org to call this script via HTTP or SSH

> [Back to Table of Contents](#table-of-contents)

### Test Execution

#### Command for cron-job.org

```bash
BASE_URL=https://dorkinians-website-v3.netlify.app HEADLESS=true npm run test:e2e:cron
```

#### What Happens During Execution

1. **Test Suite Runs**: All E2E tests execute in headless mode
2. **Screenshots Captured**: On failure, screenshots are saved to `e2e/test-results/screenshots/`
3. **Report Generated**: HTML report created in `e2e/playwright-report/`
4. **Email Sent**: If using `test:e2e:email`, email notification is sent with results and screenshots
5. **Exit Code**: 
   - `0` if all tests pass
   - `1` if any test fails (triggers cron job notification)

#### Expected Duration

- Full test suite: ~5-10 minutes
- Individual test: ~10-30 seconds
- Timeout per test: 60 seconds (configured in `playwright.config.ts`)

> [Back to Table of Contents](#table-of-contents)

### Failure Notifications

#### cron-job.org Built-in Notifications

1. **Email Notifications**:
   - Enable in cron-job.org settings
   - Configure email address
   - Set to notify on failure only

2. **Webhook Notifications**:
   - Configure webhook URL
   - Receive JSON payload with test results

#### Custom Notification Script

You can extend `scripts/run-e2e-tests.js` to send custom notifications:

```javascript
// Add after error handling
const nodemailer = require('nodemailer');

async function sendFailureNotification(errorDetails) {
	// Configure email transporter
	// Send email with test results
}
```

#### Notification Content

On failure, notifications should include:
- Test failure summary
- Link to test report (if hosted)
- Screenshot attachments (if email supports)
- Timestamp of execution

> [Back to Table of Contents](#table-of-contents)

### Monitoring and Maintenance

#### Weekly Review Checklist

- [ ] Review test results from cron job
- [ ] Check for any failing tests
- [ ] Investigate failures (check screenshots)
- [ ] Update tests if UI/components changed
- [ ] Verify test data is still valid
- [ ] Update documentation if needed

#### Common Issues and Solutions

1. **Tests Fail Due to UI Changes**:
   - Update selectors in test files
   - Prefer stable selectors (data attributes, ARIA labels)

2. **Tests Fail Due to Data Changes**:
   - Update test data in `e2e/fixtures/testData.ts`
   - Use stable test data that won't change

3. **Tests Timeout**:
   - Check if site is slow or down
   - Increase timeout in `playwright.config.ts` if needed
   - Verify network connectivity

4. **Screenshots Not Captured**:
   - Verify `test-results/screenshots/` directory exists
   - Check file permissions
   - Review Playwright configuration

#### Test Report Access

After test execution:
- HTML report: `e2e/playwright-report/index.html`
- Screenshots: `e2e/test-results/screenshots/*.png`
- View report: `npm run test:e2e:report`

#### Updating Test Schedule

To change the test schedule:
1. Log into cron-job.org
2. Edit the cron job
3. Update the schedule
4. Save changes

> [Back to Table of Contents](#table-of-contents)

### Example cron-job.org Configuration

**Job Title**: Dorkinians E2E Tests - Weekly

**Schedule**: Every Monday at 2:00 AM

**Command**:
```bash
cd /path/to/V3-Dorkinians-Website && BASE_URL=https://dorkinians-website-v3.netlify.app HEADLESS=true npm run test:e2e:email
```

**Alternative (without email)**:
```bash
cd /path/to/V3-Dorkinians-Website && BASE_URL=https://dorkinians-website-v3.netlify.app HEADLESS=true npm run test:e2e:cron
```

**Notifications**:
- Email: your-email@example.com
- Notify on: Failure only
- Include output: Yes

**Timeout**: 15 minutes

> [Back to Table of Contents](#table-of-contents)
