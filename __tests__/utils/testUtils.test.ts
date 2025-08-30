import { 
  fetchTestData, 
  getAllStatConfigs, 
  validateResponse,
  TestPlayerData,
  STAT_TEST_CONFIGS
} from './testUtils';

describe('TestUtils Debug Tests', () => {
  test('STAT_TEST_CONFIGS should have 70 entries', () => {
    console.log('🔍 STAT_TEST_CONFIGS length:', STAT_TEST_CONFIGS.length);
    console.log('🔍 STAT_TEST_CONFIGS keys:', STAT_TEST_CONFIGS.map(config => config.key));
    expect(STAT_TEST_CONFIGS.length).toBe(70);
  });

  test('getAllStatConfigs should return 70 entries', () => {
    const configs = getAllStatConfigs();
    console.log('🔍 getAllStatConfigs length:', configs.length);
    console.log('🔍 getAllStatConfigs keys:', configs.map(config => config.key));
    expect(configs.length).toBe(70);
  });

  test('fetchTestData should return test data', async () => {
    const testData = await fetchTestData();
    console.log('🔍 fetchTestData length:', testData.length);
    console.log('🔍 fetchTestData players:', testData.map(p => p.playerName));
    console.log('🔍 First player sample:', testData[0]);
    expect(testData.length).toBeGreaterThan(0);
  });

  test('validateResponse should work with valid statConfig', () => {
    const statConfig = STAT_TEST_CONFIGS[0]; // APP
    const response = 'Luke Bangs has made 78 appearances';
    const validation = validateResponse(response, 78, statConfig, 'Luke Bangs');
    console.log('🔍 Validation result:', validation);
    expect(validation.isValid).toBe(true);
  });
});
