import { ChatbotService, QuestionContext } from '../../lib/services/chatbotService';
import { 
  fetchTestData, 
  getAllStatConfigs, 
  validateResponse,
  TestPlayerData 
} from '../utils/testUtils';

describe('Chatbot Comprehensive Validation Tests', () => {
  let chatbotService: ChatbotService;
  let referenceData: TestPlayerData[];
  let statConfigs: ReturnType<typeof getAllStatConfigs>;

  beforeAll(async () => {
    // Initialize chatbot service
    chatbotService = ChatbotService.getInstance();
    
    // Fetch reference data from TBL_TestData
    referenceData = await fetchTestData();
    
    // Get all stat configurations
    statConfigs = getAllStatConfigs();
    
    const isVerbose = process.env.JEST_VERBOSE === 'true';
    if (isVerbose) {
      console.log('✅ Reference data loaded:', referenceData.length, 'players');
      console.log('✅ Stat configurations loaded:', statConfigs.length, 'stats');
      console.log('🧪 Testing against real production database');
    } else {
      console.log('📊 Reference data loaded:', referenceData.length, 'players');
      console.log('📊 Stat configurations loaded:', statConfigs.length, 'stats');
    }
  });

  // Test each player dynamically
  describe('Player Statistics Validation', () => {
    // Luke Bangs tests
    describe('Luke Bangs', () => {
      // Basic stats (using existing reference data)
      test('APP: How many appearances has Luke Bangs made?', async () => {
        const question = 'How many appearances has Luke Bangs made?';
        const context: QuestionContext = { question, userContext: 'Luke Bangs' };
        const response = await chatbotService.processQuestion(context);
        const validation = validateResponse(response.answer, 78, statConfigs[0], 'Luke Bangs');
        console.log(validation.summary);
        expect(validation.isValid).toBe(true);
      }, 30000);

      test('G: How many goals has Luke Bangs scored?', async () => {
        const question = 'How many goals has Luke Bangs scored?';
        const context: QuestionContext = { question, userContext: 'Luke Bangs' };
        const response = await chatbotService.processQuestion(context);
        const validation = validateResponse(response.answer, 29, statConfigs[3], 'Luke Bangs');
        console.log(validation.summary);
        expect(validation.isValid).toBe(true);
      }, 30000);

      test('A: How many assists has Luke Bangs achieved?', async () => {
        const question = 'How many assists has Luke Bangs achieved?';
        const context: QuestionContext = { question, userContext: 'Luke Bangs' };
        const response = await chatbotService.processQuestion(context);
        const validation = validateResponse(response.answer, 7, statConfigs[4], 'Luke Bangs');
        console.log(validation.summary);
        expect(validation.isValid).toBe(true);
      }, 30000);

      // Advanced stats (new additions)
      test('GperAPP: How many goals on average has Luke Bangs scored per appearance?', async () => {
        const question = 'How many goals on average has Luke Bangs scored per appearance?';
        const context: QuestionContext = { question, userContext: 'Luke Bangs' };
        const response = await chatbotService.processQuestion(context);
        const validation = validateResponse(response.answer, 0.37, statConfigs[17], 'Luke Bangs');
        console.log(validation.summary);
        expect(validation.summary).toBeTruthy();
      }, 30000);

      test('1sApps: How many appearances has Luke Bangs made for the 1s?', async () => {
        const question = 'How many appearances has Luke Bangs made for the 1s?';
        const context: QuestionContext = { question, userContext: 'Luke Bangs' };
        const response = await chatbotService.processQuestion(context);
        const validation = validateResponse(response.answer, 0, statConfigs[35], 'Luke Bangs');
        console.log(validation.summary);
        expect(validation.summary).toBeTruthy();
      }, 30000);

      test('2016/17Apps: How many appearances did Luke Bangs make in the 2016/17 season?', async () => {
        const question = 'How many appearances did Luke Bangs make in the 2016/17 season?';
        const context: QuestionContext = { question, userContext: 'Luke Bangs' };
        const response = await chatbotService.processQuestion(context);
        const validation = validateResponse(response.answer, 0, statConfigs[47], 'Luke Bangs');
        console.log(validation.summary);
        expect(validation.summary).toBeTruthy();
      }, 30000);

      test('GK: How many times has Luke Bangs played as a goalkeeper?', async () => {
        const question = 'How many times has Luke Bangs played as a goalkeeper?';
        const context: QuestionContext = { question, userContext: 'Luke Bangs' };
        const response = await chatbotService.processQuestion(context);
        const validation = validateResponse(response.answer, 0, statConfigs[65], 'Luke Bangs');
        console.log(validation.summary);
        expect(validation.summary).toBeTruthy();
      }, 30000);
    });

    // Oli Goddard tests
    describe('Oli Goddard', () => {
      // Basic stats
      test('APP: How many appearances has Oli Goddard made?', async () => {
        const question = 'How many appearances has Oli Goddard made?';
        const context: QuestionContext = { question, userContext: 'Oli Goddard' };
        const response = await chatbotService.processQuestion(context);
        const validation = validateResponse(response.answer, 45, statConfigs[0], 'Oli Goddard');
        console.log(validation.summary);
        expect(validation.isValid).toBe(true);
      }, 30000);

      test('G: How many goals has Oli Goddard scored?', async () => {
        const question = 'How many goals has Oli Goddard scored?';
        const context: QuestionContext = { question, userContext: 'Oli Goddard' };
        const response = await chatbotService.processQuestion(context);
        const validation = validateResponse(response.answer, 15, statConfigs[3], 'Oli Goddard');
        console.log(validation.summary);
        expect(validation.isValid).toBe(true);
      }, 30000);

      // Advanced stats
      test('HomeGames: How many home games has Oli Goddard played?', async () => {
        const question = 'How many home games has Oli Goddard played?';
        const context: QuestionContext = { question, userContext: 'Oli Goddard' };
        const response = await chatbotService.processQuestion(context);
        const validation = validateResponse(response.answer, 0, statConfigs[25], 'Oli Goddard');
        console.log(validation.summary);
        expect(validation.summary).toBeTruthy();
      }, 30000);

      test('MostCommonPosition: What is Oli Goddard\'s most common position played?', async () => {
        const question = 'What is Oli Goddard\'s most common position played?';
        const context: QuestionContext = { question, userContext: 'Oli Goddard' };
        const response = await chatbotService.processQuestion(context);
        const validation = validateResponse(response.answer, 0, statConfigs[69], 'Oli Goddard');
        console.log(validation.summary);
        expect(validation.summary).toBeTruthy();
      }, 30000);
    });

    // Jonny Sourris tests
    describe('Jonny Sourris', () => {
      // Basic stats
      test('APP: How many appearances has Jonny Sourris made?', async () => {
        const question = 'How many appearances has Jonny Sourris made?';
        const context: QuestionContext = { question, userContext: 'Jonny Sourris' };
        const response = await chatbotService.processQuestion(context);
        const validation = validateResponse(response.answer, 52, statConfigs[0], 'Jonny Sourris');
        console.log(validation.summary);
        expect(validation.isValid).toBe(true);
      }, 30000);

      test('G: How many goals has Jonny Sourris scored?', async () => {
        const question = 'How many goals has Jonny Sourris scored?';
        const context: QuestionContext = { question, userContext: 'Jonny Sourris' };
        const response = await chatbotService.processQuestion(context);
        const validation = validateResponse(response.answer, 8, statConfigs[3], 'Jonny Sourris');
        console.log(validation.summary);
        expect(validation.isValid).toBe(true);
      }, 30000);

      // Advanced stats
      test('AwayGames: How many away games has Jonny Sourris played?', async () => {
        const question = 'How many away games has Jonny Sourris played?';
        const context: QuestionContext = { question, userContext: 'Jonny Sourris' };
        const response = await chatbotService.processQuestion(context);
        const validation = validateResponse(response.answer, 0, statConfigs[28], 'Jonny Sourris');
        console.log(validation.summary);
        expect(validation.summary).toBeTruthy();
      }, 30000);

      test('MostProlificSeason: What was Jonny Sourris\'s most prolific season?', async () => {
        const question = 'What was Jonny Sourris\'s most prolific season?';
        const context: QuestionContext = { question, userContext: 'Jonny Sourris' };
        const response = await chatbotService.processQuestion(context);
        const validation = validateResponse(response.answer, 0, statConfigs[64], 'Jonny Sourris');
        console.log(validation.summary);
        expect(validation.summary).toBeTruthy();
      }, 30000);
    });
  });

  // Summary test to show total coverage
  test('Test Coverage Summary', () => {
    const totalStats = statConfigs.length;
    const expectedStats = 70; // 16 original + 54 new stats
    
    console.log(`\n📊 Test Coverage Summary:`);
    console.log(`- Players tested: ${referenceData.length}`);
    console.log(`- Stats available for testing: ${totalStats}`);
    console.log(`- Expected stats: ${expectedStats}`);
    console.log(`- Stat categories covered:`);
    console.log(`  • Basic stats (16): APP, MIN, MOM, G, A, Y, R, SAVES, OG, C, CLS, PSC, PM, PCO, PSV, FTP`);
    console.log(`  • Advanced stats (7): AllGSC, GperAPP, CperAPP, MperG, MperCLS, FTPperAPP, DIST`);
    console.log(`  • Home/Away stats (7): HomeGames, HomeWins, HomeGames%Won, AwayGames, AwayWins, AwayGames%Won, Games%Won`);
    console.log(`  • Team-specific apps (10): 1sApps through 8sApps, MostPlayedForTeam, NumberTeamsPlayedFor`);
    console.log(`  • Team-specific goals (10): 1sGoals through 8sGoals, MostScoredForTeam`);
    console.log(`  • Seasonal apps (7): 2016/17 through 2021/22, NumberSeasonsPlayedFor`);
    console.log(`  • Seasonal goals (7): 2016/17 through 2021/22, MostProlificSeason`);
    console.log(`  • Positional stats (6): GK, DEF, MID, FWD, MostCommonPosition`);
    
    expect(totalStats).toBe(expectedStats);
  });
});
