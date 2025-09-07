/**
 * User Experience Testing
 * Tests response naturalness, context awareness, and user interaction quality
 */

import { ChatbotService, QuestionContext } from '../../lib/services/chatbotService';
import { fetchTestData, getTestPlayerNames } from '../utils/testUtils';

describe('User Experience Testing', () => {
  let chatbotService: ChatbotService;
  let referenceData: any[];

  beforeAll(async () => {
    try {
      referenceData = await fetchTestData();
      const isVerbose = process.env.JEST_VERBOSE === 'true';
      if (isVerbose) {
        console.log(`✅ Loaded ${referenceData.length} players for UX testing`);
      }
    } catch (error) {
      console.error('❌ Failed to load test data:', error);
      throw error;
    }
  });

  beforeEach(() => {
    chatbotService = ChatbotService.getInstance();
  });

  describe('Response Naturalness', () => {
    test('should provide natural, conversational responses', async () => {
      const questions = [
        'How many goals has Luke Bangs scored?',
        'What about his assists?',
        'Who has more goals, Luke Bangs or Oli Goddard?',
        'What are the top 3 players by appearances?'
      ];

      for (const question of questions) {
        const context: QuestionContext = {
          question,
          userContext: 'Luke Bangs',
        };

        const response = await chatbotService.processQuestion(context);
        
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');

        // Should start with capital letter
        expect(response.answer).toMatch(/^[A-Z]/);
        
        // Should end with appropriate punctuation
        expect(response.answer).toMatch(/[.!?]$/);
        
        // Should be substantial (not just a number)
        expect(response.answer.length).toBeGreaterThan(20);
        
        // Should contain natural language elements
        expect(response.answer).toMatch(/\b(has|have|scored|made|achieved|received|got|earned)\b/);
      }
    });

    test('should use appropriate verbs and terminology', async () => {
      const verbTests = [
        { question: 'How many goals has Luke Bangs scored?', expectedVerb: 'scored' },
        { question: 'How many assists does Luke Bangs have?', expectedVerb: 'provided' },
        { question: 'How many appearances has Luke Bangs made?', expectedVerb: 'made' },
        { question: 'How many yellow cards has Luke Bangs received?', expectedVerb: 'received' },
        { question: 'How many clean sheets has Luke Bangs achieved?', expectedVerb: 'achieved' }
      ];

      for (const test of verbTests) {
        const context: QuestionContext = {
          question: test.question,
          userContext: 'Luke Bangs',
        };

        const response = await chatbotService.processQuestion(context);
        
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');
        expect(response.answer.toLowerCase()).toContain(test.expectedVerb);
      }
    });

    test('should provide contextually appropriate responses', async () => {
      const contextTests = [
        {
          question: 'How many goals has Luke Bangs scored?',
          shouldContain: ['goals', 'appearance', 'scored'],
          shouldNotContain: ['assists', 'cards']
        },
        {
          question: 'How many assists does Luke Bangs have?',
          shouldContain: ['assists', 'appearance', 'provided'],
          shouldNotContain: ['goals', 'cards']
        },
        {
          question: 'How many yellow cards has Luke Bangs received?',
          shouldContain: ['yellow', 'cards', 'received'],
          shouldNotContain: ['goals', 'assists']
        }
      ];

      for (const test of contextTests) {
        const context: QuestionContext = {
          question: test.question,
          userContext: 'Luke Bangs',
        };

        const response = await chatbotService.processQuestion(context);
        
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');

        // Should contain expected terms
        test.shouldContain.forEach(term => {
          expect(response.answer.toLowerCase()).toContain(term);
        });

        // Should not contain irrelevant terms
        test.shouldNotContain.forEach(term => {
          expect(response.answer.toLowerCase()).not.toContain(term);
        });
      }
    });
  });

  describe('Context Awareness', () => {
    test('should maintain player context across follow-up questions', async () => {
      const followUpSequence = [
        'How many goals has Luke Bangs scored?',
        'What about assists?',
        'And appearances?',
        'How many yellow cards?',
        'What\'s his goal-to-game ratio?'
      ];

      const contextResults: any[] = [];

      for (const question of followUpSequence) {
        const context: QuestionContext = {
          question,
          userContext: 'Luke Bangs',
        };

        const response = await chatbotService.processQuestion(context);
        
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');
        expect(response.answer).toContain('Luke Bangs');

        contextResults.push({
          question,
          response: response.answer,
          maintainsContext: response.answer.includes('Luke Bangs')
        });
      }

      // All responses should maintain Luke Bangs context
      const allMaintainContext = contextResults.every(result => result.maintainsContext);
      expect(allMaintainContext).toBe(true);
    });

    test('should handle pronoun references correctly', async () => {
      const pronounTests = [
        'How many goals has Luke Bangs scored?',
        'What about his assists?',
        'How many appearances has he made?',
        'What\'s his disciplinary record?'
      ];

      for (const question of pronounTests) {
        const context: QuestionContext = {
          question,
          userContext: 'Luke Bangs',
        };

        const response = await chatbotService.processQuestion(context);
        
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');
        
        // Should contain the player name, not just pronouns
        expect(response.answer).toContain('Luke Bangs');
      }
    });

    test('should provide appropriate context for different question types', async () => {
      const contextTests = [
        {
          question: 'How many goals has Luke Bangs scored?',
          expectedContext: 'goals and appearances'
        },
        {
          question: 'Who has more goals, Luke Bangs or Oli Goddard?',
          expectedContext: 'comparison between players'
        },
        {
          question: 'What are the top 3 players by assists?',
          expectedContext: 'ranking of players'
        }
      ];

      for (const test of contextTests) {
        const context: QuestionContext = {
          question: test.question,
          userContext: 'Luke Bangs',
        };

        const response = await chatbotService.processQuestion(context);
        
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');
        expect(response.answer.length).toBeGreaterThan(30); // Should be substantial
      }
    });
  });

  describe('Error Message Quality', () => {
    test('should provide helpful error messages for unknown players', async () => {
      const unknownPlayerQuestions = [
        'How many goals has Unknown Player scored?',
        'What about NonExistent Player?',
        'How many assists does Fake Player have?'
      ];

      for (const question of unknownPlayerQuestions) {
        const context: QuestionContext = {
          question,
          userContext: 'Unknown Player',
        };

        const response = await chatbotService.processQuestion(context);
        
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');
        
        // Should provide helpful error message
        expect(response.answer.toLowerCase()).toMatch(/couldn't find|not found|unknown|don't have|unable to find/);
        
        // Should be polite and helpful
        expect(response.answer).toMatch(/[.!?]$/);
        expect(response.answer.length).toBeGreaterThan(20);
      }
    });

    test('should provide helpful error messages for unclear questions', async () => {
      const unclearQuestions = [
        'What is this?',
        'Tell me something',
        'Help me',
        '???'
      ];

      for (const question of unclearQuestions) {
        const context: QuestionContext = {
          question,
          userContext: 'Luke Bangs',
        };

        const response = await chatbotService.processQuestion(context);
        
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');
        
        // Should provide helpful guidance
        expect(response.answer.toLowerCase()).toMatch(/help|clarify|understand|ask|question/);
        expect(response.answer).toMatch(/[.!?]$/);
      }
    });

    test('should provide suggestions for similar questions', async () => {
      const context: QuestionContext = {
        question: 'What is this?',
        userContext: 'Luke Bangs',
      };

      const response = await chatbotService.processQuestion(context);
      
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');
      
      // Should provide examples or suggestions
      expect(response.answer.toLowerCase()).toMatch(/example|try|ask|question|goals|assists|appearances/);
    });
  });

  describe('Response Completeness', () => {
    test('should provide complete answers with all relevant information', async () => {
      const completenessTests = [
        {
          question: 'How many goals has Luke Bangs scored?',
          shouldInclude: ['Luke Bangs', 'goals', 'appearances', 'number']
        },
        {
          question: 'Who has more goals, Luke Bangs or Oli Goddard?',
          shouldInclude: ['Luke Bangs', 'Oli Goddard', 'goals', 'more', 'number']
        },
        {
          question: 'What are the top 3 players by assists?',
          shouldInclude: ['top', 'assists', 'players', 'number']
        }
      ];

      for (const test of completenessTests) {
        const context: QuestionContext = {
          question: test.question,
          userContext: 'Luke Bangs',
        };

        const response = await chatbotService.processQuestion(context);
        
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');
        expect(response.answer.length).toBeGreaterThan(30);

        // Should include all expected elements
        test.shouldInclude.forEach(element => {
          expect(response.answer.toLowerCase()).toContain(element.toLowerCase());
        });
      }
    });

    test('should provide appropriate level of detail', async () => {
      const detailTests = [
        {
          question: 'How many goals has Luke Bangs scored?',
          expectedLength: { min: 30, max: 200 }
        },
        {
          question: 'Compare Luke Bangs and Oli Goddard',
          expectedLength: { min: 50, max: 300 }
        },
        {
          question: 'Who are the top 3 players by goals?',
          expectedLength: { min: 40, max: 250 }
        }
      ];

      for (const test of detailTests) {
        const context: QuestionContext = {
          question: test.question,
          userContext: 'Luke Bangs',
        };

        const response = await chatbotService.processQuestion(context);
        
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');
        expect(response.answer.length).toBeGreaterThanOrEqual(test.expectedLength.min);
        expect(response.answer.length).toBeLessThanOrEqual(test.expectedLength.max);
      }
    });
  });

  describe('Conversation Flow', () => {
    test('should handle conversation flow naturally', async () => {
      const conversationFlow = [
        'Hi, I want to know about Luke Bangs',
        'How many goals has he scored?',
        'What about assists?',
        'How does that compare to Oli Goddard?',
        'Who has more appearances?',
        'Thanks!'
      ];

      const flowResults: any[] = [];

      for (const message of conversationFlow) {
        const context: QuestionContext = {
          question: message,
          userContext: 'Luke Bangs',
        };

        const response = await chatbotService.processQuestion(context);
        
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');

        flowResults.push({
          message,
          response: response.answer,
          isAppropriate: response.answer.length > 10
        });
      }

      // All responses should be appropriate
      const allAppropriate = flowResults.every(result => result.isAppropriate);
      expect(allAppropriate).toBe(true);

      const isVerbose = process.env.JEST_VERBOSE === 'true';
      if (isVerbose) {
        console.log(`💬 Conversation Flow Results:`);
        flowResults.forEach((result, index) => {
          console.log(`   ${index + 1}. "${result.message}"`);
          console.log(`      → "${result.response.substring(0, 80)}..."`);
        });
      }
    });

    test('should handle topic transitions smoothly', async () => {
      const topicTransitions = [
        'How many goals has Luke Bangs scored?',
        'What about Oli Goddard\'s goals?',
        'Who has more assists between them?',
        'What about Jonny Sourris?',
        'Rank all three by appearances'
      ];

      for (const question of topicTransitions) {
        const context: QuestionContext = {
          question,
          userContext: 'Luke Bangs',
        };

        const response = await chatbotService.processQuestion(context);
        
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');
        expect(response.answer).toMatch(/[.!?]$/);
        expect(response.answer.length).toBeGreaterThan(20);
      }
    });
  });

  describe('Accessibility and Clarity', () => {
    test('should use clear, simple language', async () => {
      const clarityTests = [
        'How many goals has Luke Bangs scored?',
        'What is Luke Bangs goal-to-game ratio?',
        'Who has the most appearances?'
      ];

      for (const question of clarityTests) {
        const context: QuestionContext = {
          question,
          userContext: 'Luke Bangs',
        };

        const response = await chatbotService.processQuestion(context);
        
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');

        // Should use simple, clear language
        expect(response.answer).not.toMatch(/\b(utilize|facilitate|implement|leverage)\b/);
        expect(response.answer).toMatch(/\b(has|have|is|are|was|were)\b/);
      }
    });

    test('should provide responses that are easy to understand', async () => {
      const question = 'How many goals has Luke Bangs scored?';
      const context: QuestionContext = {
        question,
        userContext: 'Luke Bangs',
      };

      const response = await chatbotService.processQuestion(context);
      
      expect(response.answer).toBeDefined();
      expect(response.answer).not.toBe('');

      // Should be easy to read
      expect(response.answer).toMatch(/^[A-Z]/); // Start with capital
      expect(response.answer).toMatch(/[.!?]$/); // End with punctuation
      expect(response.answer).not.toMatch(/[A-Z]{3,}/); // No excessive caps
      expect(response.answer).not.toMatch(/\d{4,}/); // No excessive numbers
    });
  });

  describe('Personalization', () => {
    test('should personalize responses based on user context', async () => {
      const personalizationTests = [
        {
          question: 'How many goals have I scored?',
          userContext: 'Luke Bangs',
          shouldContain: 'Luke Bangs'
        },
        {
          question: 'What about my assists?',
          userContext: 'Oli Goddard',
          shouldContain: 'Oli Goddard'
        }
      ];

      for (const test of personalizationTests) {
        const context: QuestionContext = {
          question: test.question,
          userContext: test.userContext,
        };

        const response = await chatbotService.processQuestion(context);
        
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');
        expect(response.answer).toContain(test.shouldContain);
      }
    });

    test('should adapt language based on question formality', async () => {
      const formalityTests = [
        {
          question: 'How many goals has Luke Bangs scored?',
          expectedTone: 'formal'
        },
        {
          question: 'How many goals has Luke Bangs got?',
          expectedTone: 'informal'
        },
        {
          question: 'Luke Bangs goals?',
          expectedTone: 'casual'
        }
      ];

      for (const test of formalityTests) {
        const context: QuestionContext = {
          question: test.question,
          userContext: 'Luke Bangs',
        };

        const response = await chatbotService.processQuestion(context);
        
        expect(response.answer).toBeDefined();
        expect(response.answer).not.toBe('');
        expect(response.answer.length).toBeGreaterThan(20);
      }
    });
  });
});
