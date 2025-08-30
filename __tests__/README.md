# Dorkinians Website Test Suite

## Overview

This test suite validates the chatbot service performance and accuracy by testing against the **production database** using reference data from `TBL_TestData`. This approach tests real chatbot performance rather than mocked responses.

## Test Structure

```
__tests__/
├── basic/                    # Basic functionality tests
│   └── chatbotBasic.test.ts # Core service validation
├── services/                 # Service-specific tests
│   └── chatbotService.test.ts # Chatbot service unit tests
├── integration/              # End-to-end tests
│   └── chatbotIntegration.test.ts # Full workflow validation
├── mocks/                    # Mock services
│   └── neo4jMock.ts         # Neo4j service mock
└── utils/                    # Test utilities
    └── testUtils.ts         # Test data and validation helpers
```

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

## Running Tests

### Basic Tests
```bash
npm test -- --testPathPattern=basic
```

### Service Tests
```bash
npm test -- --testPathPattern=services
```

### Integration Tests
```bash
npm test -- --testPathPattern=integration
```

### All Tests
```bash
npm test
```

### With Coverage
```bash
npm run test:coverage
```

## Test Categories

### 1. Service Initialization
- Singleton pattern validation
- Method availability checks
- Service state management

### 2. Reference Data Validation
- CSV parsing and fallback handling
- Reference data structure validation
- Data type and range verification

### 3. Question Analysis
- Player name extraction
- Metric identification
- Question type classification

### 4. Response Validation
- Numeric value extraction
- Expected vs. actual value comparison
- Response format verification
- **Production database accuracy validation**

### 5. Data Consistency
- Cross-player data validation
- Realistic value ranges
- Structural integrity checks
- **Real database data consistency**

## Production Database Testing

### Real Neo4j Connection
- **Connects to production database** for real testing
- Tests actual query performance and response times
- Validates real data accuracy and consistency
- Measures chatbot performance under production conditions

### Environment Variables Required
```bash
PROD_NEO4J_URI=bolt://your-production-db:7687
PROD_NEO4J_USER=your-username
PROD_NEO4J_PASSWORD=your-password
```

**⚠️ Note**: If production credentials are not provided, tests will fall back to local development database.

## Test Utilities

### Data Fetching
- `fetchTestData()`: Retrieves reference CSV data from Google Sheets
- `getTestPlayerNames()`: Extracts player names dynamically
- `getPlayerTestData()`: Gets specific player reference statistics

### Response Validation
- `extractNumericValue()`: Parses numbers from chatbot responses
- `validateResponse()`: Compares reference data vs. production database values

### Question Generation
- `generateTestQuestions()`: Creates test scenarios for each player

## Expected Test Results

### ✅ Passing Tests
- Service initialization
- Reference data validation
- Question analysis
- Response validation logic
- Data consistency checks
- **Production database connectivity**
- **Real chatbot performance metrics**

### ⚠️ Known Issues
- **Production database availability required**
- **Network latency may affect test timing**
- **Database load may impact performance**

## Test Coverage Goals

- **Unit Tests**: 90%+ coverage of chatbot service methods
- **Integration Tests**: End-to-end workflow validation with real database
- **Data Validation**: 100% coverage of reference data scenarios
- **Error Handling**: Graceful degradation and fallback mechanisms
- **Performance Testing**: Real database query performance metrics
- **Accuracy Validation**: Production data vs. reference data comparison

## Continuous Integration

The test suite is designed to run in CI/CD environments:

1. **Build Verification**: Ensures TypeScript compilation
2. **Unit Testing**: Validates core functionality
3. **Integration Testing**: Verifies end-to-end workflows
4. **Coverage Reporting**: Tracks test coverage metrics

## Troubleshooting

### Common Issues

1. **CSV Loading Failures**: Tests fall back to embedded reference data
2. **Production Database Connection**: Ensure database credentials are correct
3. **Network Issues**: Check database connectivity and firewall settings
4. **TypeScript Errors**: Ensure proper type definitions
5. **Database Performance**: Tests may be slower during peak database load

### Debug Mode

Run tests with verbose output:
```bash
npm run test:debug
```

## Future Enhancements

1. **Performance Benchmarking**: Response time baselines and regression testing
2. **Load Testing**: Concurrent question handling under database load
3. **API Testing**: HTTP endpoint validation with real database
4. **Monitoring Integration**: Real-time chatbot performance metrics
5. **Automated Alerts**: Performance degradation notifications
