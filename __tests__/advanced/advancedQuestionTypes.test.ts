/**
 * Advanced Question Types Testing
 * Tests comparative questions, ranking queries, and complex multi-condition scenarios
 */

import { ChatbotService, QuestionContext } from '../../lib/services/chatbotService';
import { fetchTestData, getTestPlayerNames } from '../utils/testUtils';

describe('Advanced Question Types', () => {
  let chatbotService: ChatbotService;
  let referenceData: any[];

  beforeAll(async () => {
    try {
      referenceData = await fetchTestData();
      const isVerbose = process.env.JEST_VERBOSE === 'true';
      if (isVerbose) {
        console.log(`✅ Loaded ${referenceData.length} players for advanced question testing`);
      }
    } catch (error) {
      console.error('❌ Failed to load test data:', error);
      throw error;
    }
  });

  beforeEach(() => {
    chatbotService = ChatbotService.getInstance();
  });

  describe('Comparative Questions', () => {
    test('should handle "Who has more goals?" questions', async () => {
      const question = 'Who has more goals, Luke Bangs or Oli Goddard?';
      const context: QuestionContext = {
        question,
        userContext: 'Luke Bangs',
      };

      const response = await chatbotService.processQuestion(context);
      
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');
      expect(response.answer).toContain('Luke Bangs');
      expect(response.answer).toContain('Oli Goddard');
      expect(response.answer.toLowerCase()).toMatch(/more|higher|greater/);
    });

    test('should handle "Who has fewer assists?" questions', async () => {
      const question = 'Who has fewer assists, Luke Bangs or Jonny Sourris?';
      const context: QuestionContext = {
        question,
        userContext: 'Luke Bangs',
      };

      const response = await chatbotService.processQuestion(context);
      
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');
      expect(response.answer).toContain('Luke Bangs');
      expect(response.answer).toContain('Jonny Sourris');
      expect(response.answer.toLowerCase()).toMatch(/fewer|less|lower/);
    });

    test('should handle "Compare goals" questions', async () => {
      const question = 'Compare the goals scored by Luke Bangs and Oli Goddard';
      const context: QuestionContext = {
        question,
        userContext: 'Luke Bangs',
      };

      const response = await chatbotService.processQuestion(context);
      
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');
      expect(response.answer).toContain('Luke Bangs');
      expect(response.answer).toContain('Oli Goddard');
      expect(response.answer.toLowerCase()).toContain('goal');
    });

    test('should handle "Which player" comparison questions', async () => {
      const question = 'Which player has more appearances, Luke Bangs or Jonny Sourris?';
      const context: QuestionContext = {
        question,
        userContext: 'Luke Bangs',
      };

      const response = await chatbotService.processQuestion(context);
      
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');
      expect(response.answer).toContain('Luke Bangs');
      expect(response.answer).toContain('Jonny Sourris');
      expect(response.answer.toLowerCase()).toContain('appearance');
    });
  });

  describe('Ranking Questions', () => {
    test('should handle "Top 3 goal scorers" questions', async () => {
      const question = 'Who are the top 3 goal scorers?';
      const context: QuestionContext = {
        question,
        userContext: 'Luke Bangs',
      };

      const response = await chatbotService.processQuestion(context);
      
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');
      expect(response.answer.toLowerCase()).toMatch(/top|best|highest/);
      expect(response.answer.toLowerCase()).toContain('goal');
    });

    test('should handle "Best assist providers" questions', async () => {
      const question = 'Who are the best assist providers?';
      const context: QuestionContext = {
        question,
        userContext: 'Luke Bangs',
      };

      const response = await chatbotService.processQuestion(context);
      
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');
      expect(response.answer.toLowerCase()).toMatch(/best|top|highest/);
      expect(response.answer.toLowerCase()).toContain('assist');
    });

    test('should handle "Most appearances" questions', async () => {
      const question = 'Who has the most appearances?';
      const context: QuestionContext = {
        question,
        userContext: 'Luke Bangs',
      };

      const response = await chatbotService.processQuestion(context);
      
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');
      expect(response.answer.toLowerCase()).toMatch(/most|highest|top/);
      expect(response.answer.toLowerCase()).toContain('appearance');
    });

    test('should handle "Worst disciplinary record" questions', async () => {
      const question = 'Who has the worst disciplinary record?';
      const context: QuestionContext = {
        question,
        userContext: 'Luke Bangs',
      };

      const response = await chatbotService.processQuestion(context);
      
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');
      expect(response.answer.toLowerCase()).toMatch(/worst|most|highest/);
      expect(response.answer.toLowerCase()).toMatch(/card|disciplinary/);
    });
  });

  describe('Complex Multi-Condition Queries', () => {
    test('should handle team-specific comparisons', async () => {
      const question = 'Who scored more goals for the 3rd team, Luke Bangs or Jonny Sourris?';
      const context: QuestionContext = {
        question,
        userContext: 'Luke Bangs',
      };

      const response = await chatbotService.processQuestion(context);
      
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');
      expect(response.answer).toContain('Luke Bangs');
      expect(response.answer).toContain('Jonny Sourris');
      expect(response.answer.toLowerCase()).toContain('3rd');
      expect(response.answer.toLowerCase()).toContain('goal');
    });

    test('should handle seasonal comparisons', async () => {
      const question = 'Who scored more goals in the 2019/20 season, Luke Bangs or Oli Goddard?';
      const context: QuestionContext = {
        question,
        userContext: 'Luke Bangs',
      };

      const response = await chatbotService.processQuestion(context);
      
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');
      expect(response.answer).toContain('Luke Bangs');
      expect(response.answer).toContain('Oli Goddard');
      expect(response.answer.toLowerCase()).toContain('2019');
      expect(response.answer.toLowerCase()).toContain('goal');
    });

    test('should handle position-specific queries', async () => {
      const question = 'Which midfielder has the most goals, Luke Bangs or Jonny Sourris?';
      const context: QuestionContext = {
        question,
        userContext: 'Luke Bangs',
      };

      const response = await chatbotService.processQuestion(context);
      
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');
      expect(response.answer).toContain('Luke Bangs');
      expect(response.answer).toContain('Jonny Sourris');
      expect(response.answer.toLowerCase()).toContain('midfielder');
      expect(response.answer.toLowerCase()).toContain('goal');
    });

    test('should handle multiple metric comparisons', async () => {
      const question = 'Who has better stats overall, Luke Bangs or Oli Goddard?';
      const context: QuestionContext = {
        question,
        userContext: 'Luke Bangs',
      };

      const response = await chatbotService.processQuestion(context);
      
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');
      expect(response.answer).toContain('Luke Bangs');
      expect(response.answer).toContain('Oli Goddard');
      expect(response.answer.toLowerCase()).toMatch(/better|overall|stats/);
    });
  });

  describe('Natural Language Variations', () => {
    test('should handle informal comparison questions', async () => {
      const questions = [
        'Luke Bangs vs Oli Goddard - who\'s better?',
        'Is Luke Bangs better than Jonny Sourris?',
        'Luke Bangs or Oli Goddard - who scores more?',
        'Between Luke Bangs and Jonny Sourris, who has more assists?'
      ];

      for (const question of questions) {
        const context: QuestionContext = {
          question,
          userContext: 'Luke Bangs',
        };

        const response = await chatbotService.processQuestion(context);
        
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');
        expect(response.answer).toContain('Luke Bangs');
      }
    });

    test('should handle question variations for rankings', async () => {
      const questions = [
        'List the best goal scorers',
        'Show me the top players by assists',
        'Who are the leading appearance makers?',
        'Rank players by fantasy points'
      ];

      for (const question of questions) {
        const context: QuestionContext = {
          question,
          userContext: 'Luke Bangs',
        };

        const response = await chatbotService.processQuestion(context);
        
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');
        expect(response.answer.toLowerCase()).toMatch(/best|top|leading|rank/);
      }
    });

    test('should handle complex question structures', async () => {
      const questions = [
        'If I had to choose between Luke Bangs and Oli Goddard for goals, who should I pick?',
        'Between all the players, who would you say is the most consistent performer?',
        'Looking at the stats, which player has the best goal-to-game ratio?',
        'Who would you recommend as the best all-round player?'
      ];

      for (const question of questions) {
        const context: QuestionContext = {
          question,
          userContext: 'Luke Bangs',
        };

        const response = await chatbotService.processQuestion(context);
        
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');
        expect(response.answer.length).toBeGreaterThan(20); // Should be substantial response
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle invalid comparisons gracefully', async () => {
      const question = 'Who has more goals, Luke Bangs or a fictional player?';
      const context: QuestionContext = {
        question,
        userContext: 'Luke Bangs',
      };

      const response = await chatbotService.processQuestion(context);
      
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');
      expect(response.answer.toLowerCase()).toMatch(/couldn't find|unknown|not found/);
    });

    test('should handle ambiguous questions', async () => {
      const question = 'Who is better?';
      const context: QuestionContext = {
        question,
        userContext: 'Luke Bangs',
      };

      const response = await chatbotService.processQuestion(context);
      
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');
      // Should ask for clarification or provide general guidance
      expect(response.answer.length).toBeGreaterThan(10);
    });

    test('should handle empty or malformed questions', async () => {
      const questions = ['', '???', 'asdfghjkl', '123456789'];
      
      for (const question of questions) {
        const context: QuestionContext = {
          question,
          userContext: 'Luke Bangs',
        };

        const response = await chatbotService.processQuestion(context);
        
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');
        // Should provide helpful error message
        expect(response.answer.toLowerCase()).toMatch(/help|clarify|understand/);
      }
    });
  });

  describe('Performance with Complex Queries', () => {
    test('should handle multiple complex queries efficiently', async () => {
      const complexQuestions = [
        'Who has more goals, Luke Bangs or Oli Goddard?',
        'Who are the top 3 assist providers?',
        'Which player has the best goal-to-game ratio?',
        'Compare Luke Bangs and Jonny Sourris across all stats',
        'Who would you recommend as the best midfielder?'
      ];

      const startTime = Date.now();
      
      for (const question of complexQuestions) {
        const context: QuestionContext = {
          question,
          userContext: 'Luke Bangs',
        };

        const response = await chatbotService.processQuestion(context);
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should complete 5 complex queries in under 15 seconds
      expect(totalTime).toBeLessThan(15000);
      
      const isVerbose = process.env.JEST_VERBOSE === 'true';
      if (isVerbose) {
        console.log(`⚡ Completed ${complexQuestions.length} complex queries in ${totalTime}ms`);
        console.log(`📊 Average time per complex query: ${(totalTime / complexQuestions.length).toFixed(2)}ms`);
      }
    });
  });

  describe('Response Quality for Advanced Questions', () => {
    test('should provide detailed responses for comparisons', async () => {
      const question = 'Compare Luke Bangs and Oli Goddard';
      const context: QuestionContext = {
        question,
        userContext: 'Luke Bangs',
      };

      const response = await chatbotService.processQuestion(context);
      
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');
      expect(response.answer.length).toBeGreaterThan(50); // Should be detailed
      expect(response.answer).toContain('Luke Bangs');
      expect(response.answer).toContain('Oli Goddard');
      
      // Should contain multiple metrics
      const metricCount = (response.answer.match(/\d+/g) || []).length;
      expect(metricCount).toBeGreaterThan(2);
    });

    test('should provide structured responses for rankings', async () => {
      const question = 'Who are the top 3 players by goals?';
      const context: QuestionContext = {
        question,
        userContext: 'Luke Bangs',
      };

      const response = await chatbotService.processQuestion(context);
      
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');
      expect(response.answer.length).toBeGreaterThan(30);
      expect(response.answer.toLowerCase()).toMatch(/top|best|highest/);
      
      // Should contain player names and numbers
      expect(response.answer).toMatch(/\d+/); // Should contain numbers
    });
  });
});
