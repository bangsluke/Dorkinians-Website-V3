# Dorkinians Website Test Suite

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Overview](#overview)
- [Test Structure](#test-structure)
- [Test Categories](#test-categories)
  - [1. Basic Tests (`basic/`)](#1-basic-tests-basic)
  - [2. Service Tests (`services/`)](#2-service-tests-services)
  - [3. Integration Tests (`integration/`)](#3-integration-tests-integration)
  - [4. Comprehensive Stat Testing (`comprehensive/`)](#4-comprehensive-stat-testing-comprehensive)
    - [Test Files](#test-files)
    - [What it tests:](#what-it-tests)
    - [Test Coverage Summary](#test-coverage-summary)
    - [Benefits](#benefits)
  - [5. Advanced Question Types (`advanced/`)](#5-advanced-question-types-advanced)
  - [6. Performance and Load Testing (`performance/`)](#6-performance-and-load-testing-performance)
  - [7. Data Accuracy Validation (`validation/`)](#7-data-accuracy-validation-validation)
  - [8. User Experience Testing (`ux/`)](#8-user-experience-testing-ux)
  - [9. Security and Edge Cases (`security/`)](#9-security-and-edge-cases-security)
  - [10. Monitoring and Observability (`monitoring/`)](#10-monitoring-and-observability-monitoring)
- [Test Data](#test-data)
  - [TBL_TestData Integration](#tbl_testdata-integration)
  - [Fallback Data](#fallback-data)
  - [Production Database Testing](#production-database-testing)
- [Running Tests](#running-tests)
  - [All Tests](#all-tests)
  - [Specific Test Categories](#specific-test-categories)
  - [With Coverage](#with-coverage)
  - [Debug Mode](#debug-mode)
- [Test Output Modes](#test-output-modes)
  - [Clean Output (Default)](#clean-output-default)
  - [Detailed Debug Output](#detailed-debug-output)
- [Test Coverage Goals](#test-coverage-goals)
- [Environment Variables Required](#environment-variables-required)
- [Test Utilities](#test-utilities)
  - [Data Fetching](#data-fetching)
  - [Response Validation](#response-validation)
  - [Mock Services](#mock-services)
- [Expected Test Results](#expected-test-results)
  - [✅ Passing Tests](#-passing-tests)
  - [⚠️ Known Considerations](#️-known-considerations)
- [Continuous Integration](#continuous-integration)
- [Troubleshooting](#troubleshooting)
  - [Common Issues](#common-issues)
  - [Debug Mode](#debug-mode-1)
- [Test Statistics](#test-statistics)
- [Future Enhancements](#future-enhancements)

## Overview

This comprehensive test suite validates the chatbot service performance and accuracy by testing against the **production database** using reference data from `TBL_TestData`. The test suite includes 200+ individual test cases across 9 major categories, providing complete coverage of both database seeding operations and chatbot functionality.

## Test Structure

```
__tests__/
├── basic/                           # Basic functionality tests
│   └── chatbotBasic.test.ts        # Core service validation
├── services/                        # Service-specific tests
│   └── chatbotService.test.ts      # Chatbot service unit tests
├── integration/                     # End-to-end tests
│   ├── chatbotIntegration.test.ts  # Full workflow validation
│   └── enhancedIntegration.test.ts # Extended integration scenarios
├── comprehensive/                   # Comprehensive stat testing
│   └── statTesting.test.ts         # All 50+ metrics coverage
├── advanced/                        # Advanced question types
│   └── advancedQuestionTypes.test.ts # Comparative, ranking, complex queries
├── performance/                     # Performance and load testing
│   └── performanceLoadTesting.test.ts # Response times, concurrent users, memory
├── validation/                      # Data accuracy validation
│   └── dataAccuracyValidation.test.ts # Reference vs production data
├── ux/                             # User experience testing
│   └── userExperienceTesting.test.ts # Naturalness, context awareness
├── security/                       # Security and edge cases
│   └── securityEdgeCases.test.ts  # Input sanitization, injection prevention
├── monitoring/                     # Monitoring and observability
│   └── monitoringObservability.test.ts # Logging, metrics, health checks
├── mocks/                          # Mock services
│   └── neo4jMock.ts               # Neo4j service mock
├── reporters/                      # Custom test reporters
│   └── summaryReporter.js         # Clean output reporter
└── utils/                          # Test utilities
    └── testUtils.ts               # Test data and validation helpers
```

> [Back to Table of Contents](#table-of-contents)

## Test Categories

### 1. Basic Tests (`basic/`)

**Purpose**: Core service validation and fundamental functionality

- **Service Initialization**: Singleton pattern, method availability
- **Reference Data Validation**: CSV parsing, fallback handling, data structure
- **Question Analysis**: Player extraction, metric identification
- **Response Validation**: Numeric extraction, format verification
- **Production Database**: Real Neo4j connection testing

> [Back to Table of Contents](#table-of-contents)

### 2. Service Tests (`services/`)

**Purpose**: Unit testing of chatbot service components

- **Reference Data Loading**: Dynamic CSV fetching, fallback mechanisms
- **Player Statistics Queries**: Goals, assists, appearances validation
- **Response Format Validation**: Natural language, appropriate terminology
- **Error Handling**: Unknown players, malformed questions
- **Question Analysis**: Player identification, metric extraction

> [Back to Table of Contents](#table-of-contents)

### 3. Integration Tests (`integration/`)

**Purpose**: End-to-end workflow validation

- **Complete User Journey**: Full session from start to finish
- **Multi-Player Workflow**: Seamless switching between players
- **Complex Query Integration**: Nested comparative queries, temporal queries
- **Error Recovery Integration**: Graceful error handling and recovery
- **Data Consistency Integration**: Cross-format consistency validation
- **Performance Integration**: Complex scenarios within time limits
- **Real-World Usage Patterns**: Typical user interaction patterns

> [Back to Table of Contents](#table-of-contents)

### 4. Comprehensive Stat Testing (`comprehensive/`)

**Purpose**: Complete coverage of all 50+ statistical metrics with comprehensive validation

This directory contains comprehensive tests that validate the chatbot's ability to answer questions about all player statistics by comparing responses against the reference data in `TBL_TestData`.

#### Test Files

- **`statTesting.test.ts`**: Comprehensive validation of all 50+ statistical metrics

#### What it tests:

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

#### Test Coverage Summary

```
📊 Test Coverage Summary:
- Players tested: 3
- Stats tested per player: 50+
- Total tests executed: 150+
- Expected tests: 150+
```

#### Benefits

1. **Comprehensive Coverage**: Tests all 50+ stats for all players
2. **Dynamic Discovery**: No hardcoded player names or values
3. **Real Database Testing**: Validates against production database responses
4. **Standardized Output**: Consistent format for easy analysis
5. **Automated Validation**: Catches data inconsistencies automatically

> [Back to Table of Contents](#table-of-contents)

### 5. Advanced Question Types (`advanced/`)

**Purpose**: Testing complex query scenarios and natural language processing

- **Comparative Questions**: "Who has more goals?", "Who has fewer assists?"
- **Ranking Questions**: "Top 3 goal scorers", "Best assist providers"
- **Complex Multi-Condition Queries**: Team-specific comparisons, seasonal comparisons
- **Natural Language Variations**: Informal questions, different phrasings
- **Edge Case Handling**: Invalid comparisons, ambiguous questions, malformed inputs
- **Performance Testing**: Multiple complex queries within time limits
- **Response Quality Validation**: Detailed responses, structured rankings

> [Back to Table of Contents](#table-of-contents)

### 6. Performance and Load Testing (`performance/`)

**Purpose**: Response time benchmarking and system performance validation

- **Response Time Benchmarking**: Basic questions <2s, complex questions <5s
- **Concurrent User Simulation**: 5 concurrent users, burst traffic (10 rapid requests)
- **Memory Usage Monitoring**: Memory leak detection, large dataset handling
- **Database Connection Performance**: Connection and query time analysis
- **Stress Testing**: Sustained load over 30 seconds
- **Performance Regression Testing**: Baseline performance maintenance
- **Detailed Performance Metrics**: Average, min, max response times, standard deviation

> [Back to Table of Contents](#table-of-contents)

### 7. Data Accuracy Validation (`validation/`)

**Purpose**: Validating chatbot responses against reference data and production database

- **Reference Data vs Production Database**: Basic and advanced stats validation
- **Cross-Reference Data Validation**: Different question formats, team-specific data
- **Statistical Validation**: Calculated ratios, mathematical correctness
- **Data Range Validation**: Reasonable ranges, percentage values (0-100)
- **Data Completeness Validation**: All players have basic stats data
- **Real-Time Data Validation**: Consistency across multiple requests
- **Accuracy Rate Tracking**: 80%+ accuracy for basic stats, 70%+ for advanced stats

> [Back to Table of Contents](#table-of-contents)

### 8. User Experience Testing (`ux/`)

**Purpose**: Testing response naturalness, context awareness, and user interaction quality

- **Response Naturalness**: Conversational responses, appropriate verbs
- **Context Awareness**: Player context maintenance, pronoun references
- **Error Message Quality**: Helpful error messages, suggestions
- **Response Completeness**: Complete answers with relevant information
- **Conversation Flow**: Natural conversation handling, topic transitions
- **Accessibility and Clarity**: Clear language, easy to understand
- **Personalization**: User context adaptation, formality levels

> [Back to Table of Contents](#table-of-contents)

### 9. Security and Edge Cases (`security/`)

**Purpose**: Input sanitization, SQL injection prevention, and malicious query handling

- **Input Sanitization**: SQL injection, XSS, command injection prevention
- **Input Validation**: Long inputs, special characters, empty inputs
- **Rate Limiting and Abuse Prevention**: Rapid requests, concurrent requests
- **Data Privacy and Security**: No sensitive information exposure
- **Edge Case Handling**: Malformed JSON, large numbers, unicode characters
- **Resource Exhaustion Prevention**: Memory-intensive queries, infinite loops
- **Error Handling Security**: No stack trace exposure, graceful failures

> [Back to Table of Contents](#table-of-contents)

### 10. Monitoring and Observability (`monitoring/`)

**Purpose**: Logging completeness, metrics collection, error tracking, and performance monitoring

- **Logging Completeness**: All events logged, performance metrics
- **Metrics Collection**: Response times, success rates, question type distribution
- **Error Tracking**: Error categorization, frequency patterns
- **Performance Monitoring**: Response time trends, memory usage patterns
- **Health Check Monitoring**: System health indicators, overall health rate
- **Comprehensive Observability**: Full system monitoring capabilities

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

### All Tests

```bash
npm test
```

### Specific Test Categories

```bash
# Basic functionality
npm test -- --testPathPattern=basic

# Service unit tests
npm test -- --testPathPattern=services

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

### With Coverage

```bash
npm run test:coverage
```

### Debug Mode

```bash
npm run test:debug
```

> [Back to Table of Contents](#table-of-contents)

## Test Output Modes

### Clean Output (Default)

```bash
npm test
```

- **Simple one-line status** for each test
- **Minimal logging** - only essential information
- **Clean summary** with pass/fail counts
- **Perfect for CI/CD** and regular development

### Detailed Debug Output

```bash
npm run test:debug
```

- **Verbose logging** for all operations
- **Detailed database connection info**
- **Full error stack traces**
- **Reference data loading details**
- **Perfect for troubleshooting** and development

> [Back to Table of Contents](#table-of-contents)

## Test Coverage Goals

- **Unit Tests**: 90%+ coverage of chatbot service methods
- **Integration Tests**: End-to-end workflow validation with real database
- **Data Validation**: 100% coverage of reference data scenarios
- **Error Handling**: Graceful degradation and fallback mechanisms
- **Performance Testing**: Real database query performance metrics
- **Accuracy Validation**: Production data vs. reference data comparison
- **Security Testing**: Input sanitization and abuse prevention
- **UX Testing**: Natural language and context awareness validation
- **Monitoring**: Complete observability and health check coverage

> [Back to Table of Contents](#table-of-contents)

## Environment Variables Required

```bash
PROD_NEO4J_URI=bolt://your-production-db:7687
PROD_NEO4J_USER=your-username
PROD_NEO4J_PASSWORD=your-password
```

**⚠️ Note**: If production credentials are not provided, tests will fall back to local development database.

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

> [Back to Table of Contents](#table-of-contents)

## Expected Test Results

### ✅ Passing Tests

- Service initialization and configuration
- Reference data validation and loading
- Question analysis and processing
- Response validation and formatting
- Data consistency and accuracy checks
- Production database connectivity
- Real chatbot performance metrics
- Security and input validation
- User experience and naturalness
- Monitoring and observability

### ⚠️ Known Considerations

- **Production database availability required**
- **Network latency may affect test timing**
- **Database load may impact performance**
- **Some tests may have variable accuracy rates due to real data**

> [Back to Table of Contents](#table-of-contents)

## Continuous Integration

The test suite is designed to run in CI/CD environments:

1. **Build Verification**: Ensures TypeScript compilation
2. **Unit Testing**: Validates core functionality
3. **Integration Testing**: Verifies end-to-end workflows
4. **Performance Testing**: Validates response times and load handling
5. **Security Testing**: Ensures input sanitization and abuse prevention
6. **Coverage Reporting**: Tracks test coverage metrics

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

### Debug Mode

Run tests with verbose output:

```bash
npm run test:debug
```

> [Back to Table of Contents](#table-of-contents)

## Test Statistics

- **Total Test Files**: 9 comprehensive test suites
- **Total Test Cases**: 200+ individual test cases
- **Test Categories**: 10 major categories
- **Stat Configurations**: 50+ metrics tested
- **Performance Benchmarks**: Response times, memory usage, concurrent handling
- **Security Coverage**: Input sanitization, injection prevention, abuse protection
- **UX Coverage**: Natural language, context awareness, error handling
- **Monitoring Coverage**: Logging, metrics, health checks, observability

> [Back to Table of Contents](#table-of-contents)

## Future Enhancements

1. **API Testing**: HTTP endpoint validation with real database
2. **Load Testing**: Extended concurrent user simulation
3. **Visual Regression Testing**: UI component testing
4. **Accessibility Testing**: WCAG compliance validation
5. **Internationalization Testing**: Multi-language support
6. **Mobile Testing**: Responsive design validation
7. **Analytics Integration**: User behavior tracking
8. **A/B Testing**: Feature flag validation
