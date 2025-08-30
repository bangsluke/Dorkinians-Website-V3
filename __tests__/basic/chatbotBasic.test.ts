import { ChatbotService, QuestionContext } from '../../lib/services/chatbotService';
import { FALLBACK_TEST_DATA } from '../utils/testUtils';

// Mock the neo4j service completely
jest.mock('../../lib/neo4j', () => ({
  neo4jService: {
    connect: jest.fn().mockResolvedValue(true),
    executeQuery: jest.fn().mockResolvedValue([
      { playerName: 'Luke Bangs', value: 29, appearances: 78 }
    ]),
  },
}));

describe('ChatbotService Basic Tests', () => {
  let chatbotService: ChatbotService;

  beforeEach(() => {
    chatbotService = ChatbotService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    test('should create singleton instance', () => {
      const instance1 = ChatbotService.getInstance();
      const instance2 = ChatbotService.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should have required methods', () => {
      expect(chatbotService.processQuestion).toBeDefined();
      expect(typeof chatbotService.processQuestion).toBe('function');
    });
  });

  describe('Test Data Validation', () => {
    test('should have fallback test data', () => {
      expect(FALLBACK_TEST_DATA).toBeDefined();
      expect(FALLBACK_TEST_DATA.length).toBeGreaterThan(0);
      expect(FALLBACK_TEST_DATA[0]).toHaveProperty('playerName');
      expect(FALLBACK_TEST_DATA[0]).toHaveProperty('goals');
      expect(FALLBACK_TEST_DATA[0]).toHaveProperty('assists');
    });

    test('should contain expected players', () => {
      const playerNames = FALLBACK_TEST_DATA.map(p => p.playerName);
      expect(playerNames).toContain('Luke Bangs');
      expect(playerNames).toContain('Oli Goddard');
      expect(playerNames).toContain('Jonny Sourris');
    });

    test('should have valid numeric data', () => {
      FALLBACK_TEST_DATA.forEach(player => {
        expect(typeof player.goals).toBe('number');
        expect(typeof player.assists).toBe('number');
        expect(typeof player.appearances).toBe('number');
        expect(player.goals).toBeGreaterThanOrEqual(0);
        expect(player.assists).toBeGreaterThanOrEqual(0);
        expect(player.appearances).toBeGreaterThan(0);
      });
    });
  });

  describe('Question Analysis', () => {
    test('should analyze player questions correctly', async () => {
      const question = 'How many goals has Luke Bangs scored?';
      const context: QuestionContext = {
        question,
        userContext: 'Luke Bangs',
      };

      // This will fail due to Neo4j connection issues, but we can test the analysis
      try {
        await chatbotService.processQuestion(context);
      } catch (error) {
        // Expected to fail in test environment
      }

      // Get processing details to verify question analysis
      const processingDetails = chatbotService.getProcessingDetails();
      expect(processingDetails.questionAnalysis).toBeDefined();
      expect(processingDetails.questionAnalysis.type).toBe('player');
      expect(processingDetails.questionAnalysis.entities).toContain('Luke Bangs');
      expect(processingDetails.questionAnalysis.metrics).toContain('G');
    });

    test('should handle different question formats', async () => {
      const questions = [
        'How many goals has Luke Bangs scored?',
        'What is Luke Bangs total goals?',
        'Luke Bangs goals',
      ];

      for (const question of questions) {
        const context: QuestionContext = {
          question,
          userContext: 'Luke Bangs',
        };

        try {
          await chatbotService.processQuestion(context);
        } catch (error) {
          // Expected to fail in test environment
        }

        const processingDetails = chatbotService.getProcessingDetails();
        expect(processingDetails.questionAnalysis).toBeDefined();
        expect(processingDetails.questionAnalysis.type).toBe('player');
      }
    });
  });

  describe('Response Validation', () => {
    test('should validate numeric responses correctly', () => {
      const validResponse = 'Luke Bangs has scored 29 goals in 78 appearances.';
      const invalidResponse = 'Luke Bangs has scored goals in appearances.';
      const noResponse = 'No data available.';

      // Import the validation function
      const { validateResponse } = require('../utils/testUtils');
      
      expect(validateResponse(validResponse, 29, 'goals')).toBe(true);
      expect(validateResponse(validResponse, 30, 'goals')).toBe(false);
      expect(validateResponse(invalidResponse, 29, 'goals')).toBe(false);
      expect(validateResponse(noResponse, 29, 'goals')).toBe(false);
    });
  });

  describe('Data Consistency', () => {
    test('should maintain consistent player data structure', () => {
      FALLBACK_TEST_DATA.forEach(player => {
        // Check required properties exist
        expect(player).toHaveProperty('playerName');
        expect(player).toHaveProperty('goals');
        expect(player).toHaveProperty('assists');
        expect(player).toHaveProperty('appearances');
        expect(player).toHaveProperty('yellowCards');
        expect(player).toHaveProperty('redCards');
        expect(player).toHaveProperty('cleanSheets');
        expect(player).toHaveProperty('penaltiesScored');
        expect(player).toHaveProperty('penaltiesMissed');
        expect(player).toHaveProperty('fantasyPoints');

        // Check data types
        expect(typeof player.playerName).toBe('string');
        expect(typeof player.goals).toBe('number');
        expect(typeof player.assists).toBe('number');
        expect(typeof player.appearances).toBe('number');

        // Check data validity
        expect(player.playerName.length).toBeGreaterThan(0);
        expect(player.goals).toBeGreaterThanOrEqual(0);
        expect(player.assists).toBeGreaterThanOrEqual(0);
        expect(player.appearances).toBeGreaterThan(0);
      });
    });

    test('should have realistic data values', () => {
      FALLBACK_TEST_DATA.forEach(player => {
        // Goals should not exceed appearances (unrealistic)
        expect(player.goals).toBeLessThanOrEqual(player.appearances);
        
        // Assists should not exceed appearances
        expect(player.assists).toBeLessThanOrEqual(player.appearances);
        
        // Yellow cards should be reasonable
        expect(player.yellowCards).toBeLessThanOrEqual(player.appearances);
        
        // Red cards should be very low
        expect(player.redCards).toBeLessThanOrEqual(5);
        
        // Clean sheets should not exceed appearances
        expect(player.cleanSheets).toBeLessThanOrEqual(player.appearances);
      });
    });
  });
});
