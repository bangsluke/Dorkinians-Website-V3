# Testing Documentation

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Overview](#overview)
- [Test Framework Overview](#test-framework-overview)
- [Test Structure](#test-structure)
- [Unit Tests](#unit-tests)
  - [Basic Tests](#basic-tests)
  - [Service Tests](#service-tests)
  - [Utility Tests](#utility-tests)
- [Integration Tests](#integration-tests)
- [End-to-End Tests](#end-to-end-tests)
  - [Navigation Tests](#navigation-tests)
  - [Home Page Tests](#home-page-tests)
  - [Stats Page Tests](#stats-page-tests)
  - [TOTW Page Tests](#totw-page-tests)
  - [Club Info Page Tests](#club-info-page-tests)
  - [Settings Page Tests](#settings-page-tests)
  - [API Endpoint Tests](#api-endpoint-tests)
  - [Cross-Cutting Tests](#cross-cutting-tests)
- [Comprehensive Tests](#comprehensive-tests)
- [Advanced Tests](#advanced-tests)
- [Performance Tests](#performance-tests)
- [Validation Tests](#validation-tests)
- [User Experience Tests](#user-experience-tests)
- [Security Tests](#security-tests)
- [Monitoring Tests](#monitoring-tests)
- [Test Data](#test-data)
- [Running Tests](#running-tests)
  - [Unit and Integration Tests](#unit-and-integration-tests)
  - [E2E Tests](#e2e-tests)
  - [Chatbot Test Reports](#chatbot-test-reports)
- [Test Coverage Analysis](#test-coverage-analysis)
- [Testing Recommendations](#testing-recommendations)
- [Environment Variables](#environment-variables)
- [Test Utilities](#test-utilities)
- [Troubleshooting](#troubleshooting)
- [Continuous Integration](#continuous-integration)
- [Cron Job Setup for E2E Tests](#cron-job-setup-for-e2e-tests)

## Overview

This comprehensive test suite validates the Dorkinians FC website functionality across multiple testing layers. The suite includes:

- **200+ unit and integration test cases** across 10 major categories
- **End-to-end browser tests** covering all major user flows
- **Production database testing** for real-world validation
- **Performance and load testing** for system reliability
- **Security and edge case testing** for robustness

The test suite uses Jest for unit/integration testing and Playwright for end-to-end browser automation, providing complete coverage of both backend services and frontend user interactions.

> [Back to Table of Contents](#table-of-contents)

## Test Framework Overview

### Jest (Unit and Integration Tests)

**Framework**: Jest with ts-jest  
**Language**: TypeScript  
**Test Location**: `__tests__/` directory  
**Configuration**: `jest.config.js`

**Key Features**:
- TypeScript support via ts-jest
- Production database testing
- Custom reporters for clean output
- Coverage reporting
- Test timeout: 60 seconds for database operations

### Playwright (End-to-End Tests)

**Framework**: Playwright  
**Language**: TypeScript  
**Test Location**: `__tests__/e2e/` directory  
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
__tests__/
├── unit/                           # Unit tests (isolated component/service tests)
│   ├── basic/                     # Basic functionality tests
│   │   └── chatbotBasic.test.ts   # Core service validation
│   ├── services/                  # Service-specific tests
│   │   └── chatbotService.test.ts # Chatbot service unit tests
│   └── utils/                     # Utility function tests
│       └── testUtils.test.ts      # Test utility validation
├── integration/                    # Integration tests (component interactions)
│   ├── chatbotIntegration.test.ts # Full workflow validation
│   └── enhancedIntegration.test.ts # Extended integration scenarios
├── e2e/                           # End-to-end tests (Playwright)
│   ├── fixtures/                  # Test data and constants
│   ├── utils/                     # Helper functions and utilities
│   ├── scripts/                   # E2E test runner scripts
│   │   ├── run-e2e-tests.js      # Cron job runner
│   │   └── test-e2e-email-report.js # Email report generator
│   ├── navigation/                # Navigation tests
│   ├── home/                      # Home page tests
│   ├── stats/                     # Stats page tests
│   ├── totw/                      # TOTW page tests
│   ├── club-info/                 # Club Info page tests
│   ├── settings/                  # Settings page tests
│   ├── api/                       # API endpoint tests
│   ├── cross-cutting/             # Cross-cutting tests
│   ├── playwright-report/         # Test reports
│   └── test-results/              # Test artifacts
├── comprehensive/                  # Comprehensive validation tests
│   ├── statTesting.test.ts        # All 50+ metrics coverage
│   ├── chatbotComprehensiveValidation.test.ts
│   ├── chatbotNLPVariations.test.ts
│   └── test-individual-questions.test.ts
├── advanced/                       # Advanced test scenarios
│   └── advancedQuestionTypes.test.ts # Comparative, ranking, complex queries
├── performance/                    # Performance and load testing
│   └── performanceLoadTesting.test.ts # Response times, concurrent users, memory
├── validation/                     # Data accuracy validation
│   └── dataAccuracyValidation.test.ts # Reference vs production data
├── ux/                            # User experience testing
│   └── userExperienceTesting.test.ts # Naturalness, context awareness
├── security/                      # Security and edge cases
│   └── securityEdgeCases.test.ts  # Input sanitization, injection prevention
├── monitoring/                    # Monitoring and observability
│   └── monitoringObservability.test.ts # Logging, metrics, health checks
├── mocks/                         # Mock services
│   └── neo4jMock.ts              # Neo4j service mock
├── reporters/                     # Custom test reporters
│   └── summaryReporter.js        # Clean output reporter
├── scripts/                       # Test utility scripts
│   ├── test-chatbot-email-report.js
│   ├── test-chatbot-with-enhanced-logging.js
│   ├── test-questions-email-report.js
│   └── analyze-chatbot-logs.js
└── utils/                         # Test utilities (shared)
    └── testUtils.ts              # Test data and validation helpers
```

> [Back to Table of Contents](#table-of-contents)

## Unit Tests

### Basic Tests

**Location**: `__tests__/unit/basic/`  
**File**: `chatbotBasic.test.ts`

**Purpose**: Core service validation and fundamental functionality

**What is tested**:
- Service Initialization: Singleton pattern, method availability
- Reference Data Validation: CSV parsing, fallback handling, data structure
- Question Analysis: Player extraction, metric identification
- Response Validation: Numeric extraction, format verification
- Production Database: Real Neo4j connection testing

> [Back to Table of Contents](#table-of-contents)

### Service Tests

**Location**: `__tests__/unit/services/`  
**File**: `chatbotService.test.ts`

**Purpose**: Unit testing of chatbot service components

**What is tested**:
- Reference Data Loading: Dynamic CSV fetching, fallback mechanisms
- Player Statistics Queries: Goals, assists, appearances validation
- Response Format Validation: Natural language, appropriate terminology
- Error Handling: Unknown players, malformed questions
- Question Analysis: Player identification, metric extraction

> [Back to Table of Contents](#table-of-contents)

### Utility Tests

**Location**: `__tests__/unit/utils/`  
**File**: `testUtils.test.ts`

**Purpose**: Validation of test utility functions

**What is tested**:
- Data fetching utilities
- Response validation helpers
- Test data generation

> [Back to Table of Contents](#table-of-contents)

## Integration Tests

**Location**: `__tests__/integration/`  
**Files**: `chatbotIntegration.test.ts`, `enhancedIntegration.test.ts`

**Purpose**: End-to-end workflow validation

**What is tested**:
- Complete User Journey: Full session from start to finish
- Multi-Player Workflow: Seamless switching between players
- Complex Query Integration: Nested comparative queries, temporal queries
- Error Recovery Integration: Graceful error handling and recovery
- Data Consistency Integration: Cross-format consistency validation
- Performance Integration: Complex scenarios within time limits
- Real-World Usage Patterns: Typical user interaction patterns

> [Back to Table of Contents](#table-of-contents)

## End-to-End Tests

### Navigation Tests

**File**: `__tests__/e2e/navigation/navigation.spec.ts`

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

**File**: `__tests__/e2e/home/home.spec.ts`

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

**File**: `__tests__/e2e/stats/stats.spec.ts`

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

**File**: `__tests__/e2e/totw/totw.spec.ts`

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

**File**: `__tests__/e2e/club-info/club-info.spec.ts`

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

**File**: `__tests__/e2e/settings/settings.spec.ts`

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

**File**: `__tests__/e2e/api/api.spec.ts`

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

**File**: `__tests__/e2e/cross-cutting/cross-cutting.spec.ts`

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

## Comprehensive Tests

**Location**: `__tests__/comprehensive/`  
**Files**: `statTesting.test.ts`, `chatbotComprehensiveValidation.test.ts`, `chatbotNLPVariations.test.ts`, `test-individual-questions.test.ts`

**Purpose**: Complete coverage of all 50+ statistical metrics with comprehensive validation

**What is tested**:
- **Dynamic Player Discovery**: Automatically reads player names from `TBL_TestData` (no hardcoding)
- **All 50+ Stats**: Tests every statistic for each player including:
  - **Basic Statistics**: APP, MIN, MOM, G, A, Y, R, SAVES, OG, C, CLS, PSC, PM, PCO, PSV, FTP
  - **Advanced Statistics**: AllGSC, GperAPP, CperAPP, MperG, MperCLS, FTPperAPP, DIST
  - **Home/Away Statistics**: HomeGames, HomeWins, AwayGames, AwayWins, Games%Won
  - **Team-Specific Appearances**: 1sApps through 8sApps, MostPlayedForTeam, NumberTeamsPlayedFor
  - **Team-Specific Goals**: 1sGoals through 8sGoals, MostScoredForTeam
  - **Seasonal Appearances**: 2016/17 through 2021/22 seasons
  - **Seasonal Goals**: All seasonal goal statistics
  - **Positional Statistics**: GK, DEF, MID, FWD, MostCommonPosition
- **Data Validation**: Compares chatbot responses against actual `TBL_TestData` values
- **Standardized Output**: Provides output in the exact format: "Database value: {X}, ChatBot answer: {Y}, Equals Check: {true/false}"
- **Response Quality**: Natural language, appropriate terminology
- **Edge Case Handling**: Zero values, decimal values, performance testing

**Test Coverage Summary**:
- Players tested: 3
- Stats tested per player: 50+
- Total tests executed: 150+

> [Back to Table of Contents](#table-of-contents)

## Advanced Tests

**Location**: `__tests__/advanced/`  
**File**: `advancedQuestionTypes.test.ts`

**Purpose**: Testing complex query scenarios and natural language processing

**What is tested**:
- Comparative Questions: "Who has more goals?", "Who has fewer assists?"
- Ranking Questions: "Top 3 goal scorers", "Best assist providers"
- Complex Multi-Condition Queries: Team-specific comparisons, seasonal comparisons
- Natural Language Variations: Informal questions, different phrasings
- Edge Case Handling: Invalid comparisons, ambiguous questions, malformed inputs
- Performance Testing: Multiple complex queries within time limits
- Response Quality Validation: Detailed responses, structured rankings

> [Back to Table of Contents](#table-of-contents)

## Performance Tests

**Location**: `__tests__/performance/`  
**File**: `performanceLoadTesting.test.ts`

**Purpose**: Response time benchmarking and system performance validation

**What is tested**:
- Response Time Benchmarking: Basic questions <2s, complex questions <5s
- Concurrent User Simulation: 5 concurrent users, burst traffic (10 rapid requests)
- Memory Usage Monitoring: Memory leak detection, large dataset handling
- Database Connection Performance: Connection and query time analysis
- Stress Testing: Sustained load over 30 seconds
- Performance Regression Testing: Baseline performance maintenance
- Detailed Performance Metrics: Average, min, max response times, standard deviation

> [Back to Table of Contents](#table-of-contents)

## Validation Tests

**Location**: `__tests__/validation/`  
**File**: `dataAccuracyValidation.test.ts`

**Purpose**: Validating chatbot responses against reference data and production database

**What is tested**:
- Reference Data vs Production Database: Basic and advanced stats validation
- Cross-Reference Data Validation: Different question formats, team-specific data
- Statistical Validation: Calculated ratios, mathematical correctness
- Data Range Validation: Reasonable ranges, percentage values (0-100)
- Data Completeness Validation: All players have basic stats data
- Real-Time Data Validation: Consistency across multiple requests
- Accuracy Rate Tracking: 80%+ accuracy for basic stats, 70%+ for advanced stats

> [Back to Table of Contents](#table-of-contents)

## User Experience Tests

**Location**: `__tests__/ux/`  
**File**: `userExperienceTesting.test.ts`

**Purpose**: Testing response naturalness, context awareness, and user interaction quality

**What is tested**:
- Response Naturalness: Conversational responses, appropriate verbs
- Context Awareness: Player context maintenance, pronoun references
- Error Message Quality: Helpful error messages, suggestions
- Response Completeness: Complete answers with relevant information
- Conversation Flow: Natural conversation handling, topic transitions
- Accessibility and Clarity: Clear language, easy to understand
- Personalization: User context adaptation, formality levels

> [Back to Table of Contents](#table-of-contents)

## Security Tests

**Location**: `__tests__/security/`  
**File**: `securityEdgeCases.test.ts`

**Purpose**: Input sanitization, SQL injection prevention, and malicious query handling

**What is tested**:
- Input Sanitization: SQL injection, XSS, command injection prevention
- Input Validation: Long inputs, special characters, empty inputs
- Rate Limiting and Abuse Prevention: Rapid requests, concurrent requests
- Data Privacy and Security: No sensitive information exposure
- Edge Case Handling: Malformed JSON, large numbers, unicode characters
- Resource Exhaustion Prevention: Memory-intensive queries, infinite loops
- Error Handling Security: No stack trace exposure, graceful failures

> [Back to Table of Contents](#table-of-contents)

## Monitoring Tests

**Location**: `__tests__/monitoring/`  
**File**: `monitoringObservability.test.ts`

**Purpose**: Logging completeness, metrics collection, error tracking, and performance monitoring

**What is tested**:
- Logging Completeness: All events logged, performance metrics
- Metrics Collection: Response times, success rates, question type distribution
- Error Tracking: Error categorization, frequency patterns
- Performance Monitoring: Response time trends, memory usage patterns
- Health Check Monitoring: System health indicators, overall health rate
- Comprehensive Observability: Full system monitoring capabilities

> [Back to Table of Contents](#table-of-contents)

## Test Data

### TBL_TestData Integration

The test suite dynamically reads **reference data** from the `TBL_TestData` Google Sheet to validate chatbot responses against the production database:

- **Luke Bangs**: 29 goals, 7 assists, 78 appearances
- **Oli Goddard**: 15 goals, 12 assists, 45 appearances
- **Jonny Sourris**: 8 goals, 15 assists, 52 appearances

### Fallback Data

If CSV loading fails, the suite uses embedded fallback reference data to ensure tests can run independently.

### Production Database Testing

**⚠️ Important**: This test suite connects to the **production database** to test real chatbot performance:

- Tests actual Neo4j queries and response times
- Validates real data accuracy and consistency
- Measures chatbot performance under real conditions
- Requires production database credentials

> [Back to Table of Contents](#table-of-contents)

## Running Tests

### Unit and Integration Tests

#### All Tests

```bash
npm test
```

#### Specific Test Categories

```bash
# Basic functionality
npm test -- --testPathPattern=unit/basic

# Service unit tests
npm test -- --testPathPattern=unit/services

# Integration tests
npm test -- --testPathPattern=integration

# Comprehensive stat testing
npm test -- --testPathPattern=comprehensive

# Advanced question types
npm test -- --testPathPattern=advanced

# Performance and load testing
npm test -- --testPathPattern=performance

# Data accuracy validation
npm test -- --testPathPattern=validation

# User experience testing
npm test -- --testPathPattern=ux

# Security and edge cases
npm test -- --testPathPattern=security

# Monitoring and observability
npm test -- --testPathPattern=monitoring
```

#### With Coverage

```bash
npm run test:coverage
```

#### Debug Mode

```bash
npm run test:debug
```

#### Test Output Modes

**Clean Output (Default)**:
- Simple one-line status for each test
- Minimal logging - only essential information
- Clean summary with pass/fail counts
- Perfect for CI/CD and regular development

**Detailed Debug Output**:
- Verbose logging for all operations
- Detailed database connection info
- Full error stack traces
- Reference data loading details
- Perfect for troubleshooting and development

> [Back to Table of Contents](#table-of-contents)

### E2E Tests

#### Local Development

```bash
# Run all tests
npm run test:e2e

# Run with UI (interactive mode)
npm run test:e2e:ui

# Run in headless mode
npm run test:e2e:headless

# Run specific test file
npx playwright test __tests__/e2e/totw/totw.spec.ts

# Run tests in debug mode
npm run test:e2e:debug

# Run tests with email notification
npm run test:e2e:email

# View test report
npm run test:e2e:report
```

#### Cron Job Execution

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
- Generate HTML report in `__tests__/e2e/playwright-report/`
- Capture screenshots on failure in `__tests__/e2e/test-results/screenshots/`
- Send email notification with test results (if email configured)
- Exit with non-zero code on failure (for cron job notification)

> [Back to Table of Contents](#table-of-contents)

### Chatbot Test Reports

#### Chatbot Email Report

```bash
# Run chatbot tests and send email report
npm run test:chatbot-report

# Hide passed tests in report
npm run test:chatbot-report:hide

# Run with debug mode
npm run test:chatbot-report:debug

# Enhanced logging version
npm run test:chatbot-report:enhanced-logging

# Analyze chatbot logs
npm run test:chatbot-report:analyze-logs
```

#### Questions Email Report

```bash
# Run questions tests and send email report
npm run test:questions-report

# Hide passed tests in report
npm run test:questions-report:hide
```

> [Back to Table of Contents](#table-of-contents)

## Test Coverage Analysis

### Current Coverage

#### Unit and Integration Tests
- **Total Test Files**: 10+ comprehensive test suites
- **Total Test Cases**: 200+ individual test cases
- **Test Categories**: 10 major categories
- **Stat Configurations**: 50+ metrics tested
- **Coverage Areas**:
  - Chatbot service methods: ~90% coverage
  - Database operations: Full coverage of critical paths
  - Error handling: Comprehensive edge case coverage
  - Performance: Response time and load testing
  - Security: Input validation and sanitization

#### E2E Tests
- **Total Test Suites**: 8 major test suites
- **Test Coverage**:
  - Core Navigation: All main pages and sub-pages
  - Critical User Flows: Player selection, chatbot queries, TOTW interactions
  - Data Loading: Verification that data loads and displays
  - User Interactions: Clicks, form inputs, dropdown selections
  - API Endpoints: Critical API responses and error handling
  - Responsive Design: Mobile viewport testing
  - Error Resilience: App doesn't crash on invalid input

### Coverage Gaps Identified

1. **Component-Level Unit Tests**: 
   - Missing: React component tests with @testing-library/react
   - Impact: UI changes may break without detection
   - Priority: Medium

2. **API Route Unit Tests**:
   - Missing: Direct API route testing without browser
   - Impact: API changes may not be caught early
   - Priority: High

3. **Utility Function Tests**:
   - Partial: Some utilities tested, but not comprehensive
   - Impact: Utility bugs may affect multiple features
   - Priority: Medium

4. **Accessibility Tests**:
   - Missing: WCAG compliance validation
   - Impact: Accessibility issues may go undetected
   - Priority: Medium

5. **Visual Regression Tests**:
   - Missing: Screenshot comparison testing
   - Impact: Visual bugs may not be caught
   - Priority: Low

6. **Performance Benchmarks**:
   - Partial: Load testing exists, but no baseline benchmarks
   - Impact: Performance regressions may go unnoticed
   - Priority: Medium

> [Back to Table of Contents](#table-of-contents)

## Testing Recommendations

### Short-Term Improvements (1-3 months)

1. **Add React Component Tests**:
   - Use @testing-library/react for component testing
   - Focus on critical UI components (PlayerStats, TOTW, Chatbot)
   - Target: 60% component coverage

2. **Expand API Route Testing**:
   - Add unit tests for all API routes
   - Test error handling and edge cases
   - Target: 80% API route coverage

3. **Improve Utility Test Coverage**:
   - Add tests for all utility functions
   - Focus on data transformation and validation utilities
   - Target: 90% utility coverage

### Medium-Term Improvements (3-6 months)

1. **Add Accessibility Testing**:
   - Integrate @axe-core/playwright for E2E accessibility tests
   - Run accessibility audits on all pages
   - Target: WCAG 2.1 AA compliance

2. **Implement Visual Regression Testing**:
   - Use Playwright's screenshot comparison
   - Test critical UI components and pages
   - Integrate into CI/CD pipeline

3. **Performance Benchmarking**:
   - Establish performance baselines
   - Add performance regression tests
   - Monitor Core Web Vitals

### Long-Term Improvements (6-12 months)

1. **Test Coverage Goals**:
   - Unit Tests: 90%+ coverage of chatbot service methods
   - Integration Tests: End-to-end workflow validation with real database
   - E2E Tests: 80%+ coverage of critical user flows
   - Overall: 70%+ code coverage

2. **CI/CD Integration**:
   - Automated test runs on all pull requests
   - Test result reporting in PR comments
   - Block merges on test failures

3. **Test Maintenance**:
   - Regular test review and cleanup
   - Update tests when features change
   - Document test patterns and best practices

> [Back to Table of Contents](#table-of-contents)

## Environment Variables

### Unit and Integration Tests

```bash
PROD_NEO4J_URI=bolt://your-production-db:7687
PROD_NEO4J_USER=your-username
PROD_NEO4J_PASSWORD=your-password
```

**⚠️ Note**: If production credentials are not provided, tests will fall back to local development database.

### E2E Tests

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

## Test Utilities

### Data Fetching

- `fetchTestData()`: Retrieves reference CSV data from Google Sheets
- `getTestPlayerNames()`: Extracts player names dynamically
- `getPlayerTestData()`: Gets specific player reference statistics
- `getAllStatConfigs()`: Gets all 50+ stat configurations

### Response Validation

- `extractNumericValue()`: Parses numbers from chatbot responses
- `validateResponse()`: Compares reference data vs. production database values
- `generateTestQuestions()`: Creates test scenarios for each player

### Mock Services

- `neo4jMock.ts`: Mock Neo4j service for testing without database connection

### E2E Test Helpers

- `testHelpers.ts`: Common E2E test utilities
- `apiHelpers.ts`: API testing helpers
- `testData.ts`: E2E test data and constants

> [Back to Table of Contents](#table-of-contents)

## Troubleshooting

### Common Issues

1. **CSV Loading Failures**: Tests fall back to embedded reference data
2. **Production Database Connection**: Ensure database credentials are correct
3. **Network Issues**: Check database connectivity and firewall settings
4. **TypeScript Errors**: Ensure proper type definitions
5. **Database Performance**: Tests may be slower during peak database load
6. **Memory Issues**: Large test suites may require increased memory limits
7. **Timeout Issues**: Complex queries may need extended timeout periods
8. **E2E Test Failures**: Check for UI changes that require selector updates

### Debug Mode

Run tests with verbose output:

```bash
# Unit/Integration tests
npm run test:debug

# E2E tests
npm run test:e2e:debug
```

### E2E Test Maintenance

#### When to Update Tests

1. **New Features**: Add tests for new pages or major features
2. **Breaking Changes**: Update selectors when UI components change
3. **Bug Fixes**: Add regression tests for fixed bugs
4. **API Changes**: Update API tests when endpoints change

#### Test Data

Test data is defined in `__tests__/e2e/fixtures/testData.ts`. Update this file when:
- Test players are no longer in the database
- Test seasons are outdated
- Expected response times need adjustment

#### Selector Updates

If UI components change and tests fail:
1. Update selectors in test files to match new structure
2. Prefer data attributes or ARIA labels over class names
3. Use semantic selectors (text content, roles) when possible

#### Adding New Tests

When adding new tests:
1. Follow existing test structure and naming conventions
2. Use helper functions from `__tests__/e2e/utils/testHelpers.ts`
3. Update this documentation to reflect new test coverage
4. Ensure tests are independent and can run in any order

> [Back to Table of Contents](#table-of-contents)

## Continuous Integration

The test suite is designed to run in CI/CD environments:

1. **Build Verification**: Ensures TypeScript compilation
2. **Unit Testing**: Validates core functionality
3. **Integration Testing**: Verifies end-to-end workflows
4. **E2E Testing**: Validates user-facing functionality
5. **Performance Testing**: Validates response times and load handling
6. **Security Testing**: Ensures input sanitization and abuse prevention
7. **Coverage Reporting**: Tracks test coverage metrics

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
2. **Screenshots Captured**: On failure, screenshots are saved to `__tests__/e2e/test-results/screenshots/`
3. **Report Generated**: HTML report created in `__tests__/e2e/playwright-report/`
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

You can extend `__tests__/e2e/scripts/run-e2e-tests.js` to send custom notifications:

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
   - Update test data in `__tests__/e2e/fixtures/testData.ts`
   - Use stable test data that won't change

3. **Tests Timeout**:
   - Check if site is slow or down
   - Increase timeout in `playwright.config.ts` if needed
   - Verify network connectivity

4. **Screenshots Not Captured**:
   - Verify `__tests__/e2e/test-results/screenshots/` directory exists
   - Check file permissions
   - Review Playwright configuration

#### Test Report Access

After test execution:
- HTML report: `__tests__/e2e/playwright-report/index.html`
- Screenshots: `__tests__/e2e/test-results/screenshots/*.png`
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
