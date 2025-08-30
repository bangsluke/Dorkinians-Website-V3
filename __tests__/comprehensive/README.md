# Chatbot Comprehensive Validation Tests

This directory contains comprehensive tests that validate the chatbot's ability to answer questions about all 16 player statistics by comparing responses against the reference data in `TBL_TestData`.

## Test Files

### 1. `chatbotComprehensiveValidation.test.ts`
**Purpose**: Validates that the chatbot returns accurate data for all 16 stats for each player.

**What it tests**:
- **Dynamic Player Discovery**: Automatically reads player names from `TBL_TestData` (no hardcoding)
- **All 16 Stats**: Tests every statistic for each player
- **Data Validation**: Compares chatbot responses against actual `TBL_TestData` values
- **Standardized Output**: Provides output in the exact format: "Database value: {X}, ChatBot answer: {Y}, Equals Check: {true/false}"

**Stats Covered**:
- **APP**: Appearances
- **MIN**: Minutes played
- **MOM**: Man of the Match awards
- **G**: Goals scored
- **A**: Assists
- **Y**: Yellow cards
- **R**: Red cards
- **SAVES**: Saves made
- **OG**: Own goals
- **C**: Goals conceded
- **CLS**: Clean sheets
- **PSC**: Penalties scored
- **PM**: Penalties missed
- **PCO**: Penalties conceded
- **PSV**: Penalties saved
- **FTP**: Fantasy points

### 2. `chatbotNLPVariations.test.ts`
**Purpose**: Tests the chatbot's ability to understand different ways of asking for the same statistic.

**What it tests**:
- **Question Variations**: Multiple ways to ask for each stat (e.g., "scored", "netted", "put away" for goals)
- **NLP Robustness**: Handles different verbs, synonyms, and question structures
- **Case Sensitivity**: Tests mixed case and punctuation variations
- **Whitespace Handling**: Tests extra spaces and formatting variations

## Running the Tests

### Basic Test Run (Clean Output)
```bash
npm test -- --testPathPattern="__tests__/comprehensive"
```

### Detailed Debug Output
```bash
npm run test:debug -- --testPathPattern="__tests__/comprehensive"
```

### Test Specific Files
```bash
# Run only comprehensive validation tests
npm test -- --testPathPattern="__tests__/comprehensive/chatbotComprehensiveValidation.test.ts"

# Run only NLP variation tests
npm test -- --testPathPattern="__tests__/comprehensive/chatbotNLPVariations.test.ts"
```

## Expected Output

### Comprehensive Validation Tests
Each test will output:
```
Database value: 29, ChatBot answer: 29, Equals Check: true
```

### Test Coverage Summary
```
📊 Test Coverage Summary:
- Players tested: 3
- Stats tested per player: 16
- Total tests executed: 48
- Expected tests: 48
```

## Data Source

The tests dynamically fetch reference data from:
- **Primary**: Google Sheets CSV export of `TBL_TestData`
- **Fallback**: Hardcoded reference data in `testUtils.ts`

## Benefits

1. **Comprehensive Coverage**: Tests all 16 stats for all players
2. **Dynamic Discovery**: No hardcoded player names or values
3. **Real Database Testing**: Validates against production database responses
4. **NLP Validation**: Ensures chatbot understands various question formats
5. **Standardized Output**: Consistent format for easy analysis
6. **Automated Validation**: Catches data inconsistencies automatically

## Troubleshooting

### Database Connection Issues
- Ensure production database is accessible
- Check environment variables in `.env` file
- Verify network connectivity

### CSV Fetching Issues
- Check Google Sheets URL accessibility
- Verify CSV format matches expected structure
- Fallback data will be used if CSV fetch fails

### Test Timeouts
- Tests have 30-second timeout per individual test
- Increase timeout in Jest config if needed
- Check database response times
