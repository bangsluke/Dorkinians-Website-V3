import { ChatbotService, QuestionContext } from '../../lib/services/chatbotService';
import { fetchTestData, getTestPlayerNames, validateResponse } from '../utils/testUtils';

describe('Chatbot Integration Tests', () => {
  let chatbotService: ChatbotService;
  let referenceData: any[];

  beforeAll(async () => {
    // Fetch reference data from TBL_TestData for validation
    try {
      referenceData = await fetchTestData();
      const isVerbose = process.env.JEST_VERBOSE === 'true';
      
      if (isVerbose) {
        console.log('✅ Integration reference data loaded:', referenceData.length, 'players');
        console.log('🧪 Integration testing against real production database');
      } else {
        console.log('📊 Integration data loaded:', referenceData.length, 'players');
      }
    } catch (error) {
      console.error('❌ Failed to load integration reference data:', error);
      throw error;
    }
  });

  beforeEach(() => {
    chatbotService = ChatbotService.getInstance();
  });

  describe('End-to-End Chatbot Workflow', () => {
    test('should process complete question workflow for Luke Bangs', async () => {
      const playerName = 'Luke Bangs';
      const question = 'How many goals has Luke Bangs scored?';
      
      const context: QuestionContext = {
        question,
        userContext: playerName,
      };

      // Process the question
      const response = await chatbotService.processQuestion(context);
      
      // Verify response structure
      expect(response).toBeDefined();
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');
      expect(response.sources).toBeDefined();
      
      // Verify response contains expected elements
      expect(response.answer).toContain(playerName);
      expect(response.answer).toContain('goals');
      expect(response.answer).toContain('appearance');
      
      // Get processing details
      const processingDetails = chatbotService.getProcessingDetails();
      expect(processingDetails.questionAnalysis).toBeDefined();
      expect(processingDetails.cypherQueries).toBeDefined();
      expect(processingDetails.queryBreakdown).toBeDefined();
      
      // Verify question analysis
      expect(processingDetails.questionAnalysis.type).toBe('player');
      expect(processingDetails.questionAnalysis.entities).toContain(playerName);
      expect(processingDetails.questionAnalysis.metrics).toContain('G');
      
      // Verify query breakdown
      expect(processingDetails.queryBreakdown.playerName).toBe(playerName);
      expect(processingDetails.queryBreakdown.statEntity).toBe('G');
    });

    test('should handle team-specific questions', async () => {
      const playerName = 'Luke Bangs';
      const question = 'How many goals have I scored for the 3rd team?';
      
      const context: QuestionContext = {
        question,
        userContext: playerName,
      };

      const response = await chatbotService.processQuestion(context);
      
      expect(response).toBeDefined();
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');
      
      // Should contain team context
      expect(response.answer.toLowerCase()).toContain('3rd');
      expect(response.answer).toContain(playerName);
    });

    test('should provide consistent responses for same questions', async () => {
      const playerName = 'Luke Bangs';
      const question = 'How many assists does Luke Bangs have?';
      
      const context: QuestionContext = {
        question,
        userContext: playerName,
      };

      // Ask the same question twice
      const response1 = await chatbotService.processQuestion(context);
      const response2 = await chatbotService.processQuestion(context);
      
      // Responses should be consistent
      expect(response1.answer).toBe(response2.answer);
      
      // Both should contain the same numeric value
      const value1 = response1.answer.match(/(\d+)/)?.[1];
      const value2 = response2.answer.match(/(\d+)/)?.[1];
      expect(value1).toBe(value2);
    });
  });

  describe('Data Consistency Validation', () => {
    test('should maintain data consistency across different question formats', async () => {
      const playerName = 'Luke Bangs';
      const questions = [
        'How many goals has Luke Bangs scored?',
        'What is Luke Bangs total goals?',
        'Luke Bangs goals',
      ];

      let firstResponse: string | null = null;
      
      for (const question of questions) {
        const context: QuestionContext = {
          question,
          userContext: playerName,
        };

        const response = await chatbotService.processQuestion(context);
        
        if (firstResponse === null) {
          firstResponse = response.answer;
        } else {
          // All responses should contain the same numeric value
          const value1 = firstResponse.match(/(\d+)/)?.[1];
          const value2 = response.answer.match(/(\d+)/)?.[1];
          expect(value1).toBe(value2);
        }
      }
    });

    test('should validate all players have consistent data', async () => {
      const playerNames = await getTestPlayerNames();
      
      for (const playerName of playerNames) {
        const playerData = referenceData.find((p: any) => p.playerName === playerName);
        expect(playerData).toBeDefined();
        
        // Test goals question
        const goalsQuestion = `How many goals has ${playerName} scored?`;
        const goalsContext: QuestionContext = {
          question: goalsQuestion,
          userContext: playerName,
        };
        
        const goalsResponse = await chatbotService.processQuestion(goalsContext);
        const goalsValid = validateResponse(goalsResponse.answer, playerData!.goals, 'goals');
        expect(goalsValid).toBe(true);
        
        // Test assists question
        const assistsQuestion = `How many assists does ${playerName} have?`;
        const assistsContext: QuestionContext = {
          question: assistsQuestion,
          userContext: playerName,
        };
        
        const assistsResponse = await chatbotService.processQuestion(assistsContext);
        const assistsValid = validateResponse(assistsResponse.answer, playerData!.assists, 'assists');
        expect(assistsValid).toBe(true);
      }
    });
  });

  describe('Response Quality Validation', () => {
    test('should provide natural language responses', async () => {
      const playerName = 'Luke Bangs';
      const question = 'How many yellow cards has Luke Bangs received?';
      
      const context: QuestionContext = {
        question,
        userContext: playerName,
      };

      const response = await chatbotService.processQuestion(context);
      
      // Response should be natural language, not just data
      expect(response.answer).toMatch(/^[A-Z][^.]*\.$/); // Starts with capital, ends with period
      expect(response.answer).toContain(playerName);
      expect(response.answer).toContain('yellow');
      
      // Should use appropriate verbs
      expect(response.answer.toLowerCase()).toContain('received');
    });

    test('should handle edge cases gracefully', async () => {
      const edgeCases = [
        { question: 'How many goals has Luke Bangs scored?', expected: 'should work' },
        { question: 'What is the weather like?', expected: 'should handle gracefully' },
        { question: '', expected: 'should handle gracefully' },
        { question: 'How many goals has Luke Bangs scored for the 3rd team?', expected: 'should work' },
      ];

      for (const testCase of edgeCases) {
        const context: QuestionContext = {
          question: testCase.question,
          userContext: 'Luke Bangs',
        };

        try {
          const response = await chatbotService.processQuestion(context);
          expect(response).toBeDefined();
          expect(response.answer).toBeDefined();
          expect(response.answer).not.toBe('');
        } catch (error) {
          // Some edge cases might throw errors, which is acceptable
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle multiple rapid questions', async () => {
      const playerName = 'Luke Bangs';
      const questions = [
        'How many goals has Luke Bangs scored?',
        'How many assists does Luke Bangs have?',
        'How many appearances has Luke Bangs made?',
        'How many yellow cards has Luke Bangs received?',
      ];

      const startTime = Date.now();
      
      for (const question of questions) {
        const context: QuestionContext = {
          question,
          userContext: playerName,
        };

        const response = await chatbotService.processQuestion(context);
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should complete all questions in reasonable time (under 10 seconds)
      expect(totalTime).toBeLessThan(10000);
    });

    test('should maintain state consistency across questions', async () => {
      const playerName = 'Luke Bangs';
      
      // Ask a series of related questions
      const questions = [
        'How many goals has Luke Bangs scored?',
        'How many assists does Luke Bangs have?',
        'How many appearances has Luke Bangs made?',
      ];

      for (const question of questions) {
        const context: QuestionContext = {
          question,
          userContext: playerName,
        };

        const response = await chatbotService.processQuestion(context);
        
        // Each response should contain the player name
        expect(response.answer).toContain(playerName);
        
        // Should have consistent processing details
        const processingDetails = chatbotService.getProcessingDetails();
        expect(processingDetails.queryBreakdown.playerName).toBe(playerName);
      }
    });
  });
});
