
      const { fetchTestData, STAT_TEST_CONFIGS } = require('./__tests__/utils/testUtils.ts');
      const { ChatbotService } = require('./lib/services/chatbotService.ts');
      
      async function runTests() {
        try {
          const testData = await fetchTestData();
          console.log('TEST_DATA_START');
          console.log(JSON.stringify({
            players: testData,
            configs: STAT_TEST_CONFIGS
          }, null, 2));
          console.log('TEST_DATA_END');
        } catch (error) {
          console.error('ERROR:', error.message);
        }
      }
      
      runTests();
    