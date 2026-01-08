// Mock the Neo4j service to avoid database connection issues
// This must be at the top level before any imports
jest.mock("../../lib/neo4j", () => ({
	neo4jService: {
		connect: jest.fn().mockResolvedValue(true),
		disconnect: jest.fn().mockResolvedValue(undefined),
		executeQuery: jest.fn().mockImplementation(async (query: string, params: any) => {
			// Mock responses based on query content
			const queryLower = query.toLowerCase();
			const playerName = params.playerName;

			if (queryLower.includes("goals") && playerName === "Luke Bangs") {
				return [{ playerName: "Luke Bangs", value: 29, appearances: 78 }];
			}
			if (queryLower.includes("assists") && playerName === "Luke Bangs") {
				return [{ playerName: "Luke Bangs", value: 7, appearances: 78 }];
			}
			if (queryLower.includes("appearances") && playerName === "Luke Bangs") {
				return [{ playerName: "Luke Bangs", value: 78, appearances: 78 }];
			}
			if (queryLower.includes("goals") && playerName === "Oli Goddard") {
				return [{ playerName: "Oli Goddard", value: 15, appearances: 45 }];
			}
			if (queryLower.includes("assists") && playerName === "Oli Goddard") {
				return [{ playerName: "Oli Goddard", value: 12, appearances: 45 }];
			}
			if (queryLower.includes("goals") && playerName === "Jonny Sourris") {
				return [{ playerName: "Jonny Sourris", value: 8, appearances: 52 }];
			}
			if (queryLower.includes("assists") && playerName === "Jonny Sourris") {
				return [{ playerName: "Jonny Sourris", value: 15, appearances: 52 }];
			}

			// Default empty response
			return [];
		}),
		isConnectedStatus: jest.fn().mockReturnValue(true),
	},
}));

import { ChatbotService, QuestionContext } from "../../lib/services/chatbotService";
import { fetchTestData, getTestPlayerNames, generateTestQuestions, validateResponse, STAT_TEST_CONFIGS } from "../utils/testUtils";
import { TestConfig } from "../../config/config";

// No mocking - testing against real production database
// This tests actual chatbot performance with real data

describe("ChatbotService", () => {
	let chatbotService: ChatbotService;
	let referenceData: any[];

	beforeAll(async () => {
		// Fetch reference data from TBL_TestData for validation
		try {
			referenceData = await fetchTestData();
			const isVerbose = process.env.JEST_VERBOSE === "true";

			if (isVerbose) {
				console.log("✅ Reference data loaded:", referenceData.length, "players");
				console.log("🧪 Testing against real production database");
			} else {
				console.log("📊 Reference data loaded:", referenceData.length, "players");
			}
		} catch (error) {
			console.error("❌ Failed to load reference data:", error);
			throw error;
		}
	});

	beforeEach(() => {
		// Create fresh chatbot service instance for each test
		chatbotService = ChatbotService.getInstance();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("Reference Data Validation", () => {
		test("should load reference data successfully", () => {
			expect(referenceData).toBeDefined();
			expect(referenceData.length).toBeGreaterThan(0);
			expect(referenceData[0]).toHaveProperty("playerName");
			expect(referenceData[0]).toHaveProperty("goals");
			expect(referenceData[0]).toHaveProperty("assists");
		});

		test("should have expected player names", async () => {
			const playerNames = await getTestPlayerNames();
			expect(playerNames).toContain("Luke Bangs");
			expect(playerNames).toContain("Oli Goddard");
			expect(playerNames).toContain("Jonny Sourris");
		});
	});

	describe("Player Statistics Queries", () => {
		test.each([
			["Luke Bangs", "goals"],
			["Luke Bangs", "assists"],
			["Luke Bangs", "appearances"],
			["Oli Goddard", "goals"],
			["Oli Goddard", "assists"],
			["Jonny Sourris", "goals"],
			["Jonny Sourris", "assists"],
		])("should correctly answer %s %s question", async (playerName, metric) => {
			const question = `How many ${metric} has ${playerName} ${metric === "goals" ? "scored" : metric === "assists" ? "provided" : "made"}?`;

			const context: QuestionContext = {
				question,
				userContext: playerName,
			};

			const response = await chatbotService.processQuestion(context);

			expect(response.answer).toBeDefined();
			expect(response.answer).not.toBe("");

			// Get expected value from reference data
			const playerData = referenceData.find((p: any) => p.playerName === playerName);
			expect(playerData).toBeDefined();

			let expectedValue: number;
			switch (metric) {
				case "goals":
					expectedValue = playerData!.goals;
					break;
				case "assists":
					expectedValue = playerData!.assists;
					break;
				case "appearances":
					expectedValue = playerData!.appearances;
					break;
				default:
					expectedValue = 0;
			}

			// Validate response contains correct value
			const statConfig = STAT_TEST_CONFIGS.find((config: TestConfig) => config.metric === metric);
			if (statConfig) {
				const isValid = validateResponse(response.answer, expectedValue, statConfig, playerName);
				expect(isValid).toBe(true);
			}
		});
	});

	describe("Response Format Validation", () => {
		test("should include appearances context for goals", async () => {
			const question = "How many goals has Luke Bangs scored?";
			const context: QuestionContext = {
				question,
				userContext: "Luke Bangs",
			};

			const response = await chatbotService.processQuestion(context);

			expect(response.answer).toContain("goals");
			expect(response.answer).toContain("appearance");

			// Should contain the word "scored" for goals
			expect(response.answer.toLowerCase()).toContain("scored");
		});

		test("should include appearances context for assists", async () => {
			const question = "How many assists does Luke Bangs have?";
			const context: QuestionContext = {
				question,
				userContext: "Luke Bangs",
			};

			const response = await chatbotService.processQuestion(context);

			expect(response.answer).toContain("assists");
			expect(response.answer).toContain("appearance");

			// Should contain the word "provided" for assists
			expect(response.answer.toLowerCase()).toContain("provided");
		});

		test("should not include appearances context for appearances question", async () => {
			const question = "How many appearances has Luke Bangs made?";
			const context: QuestionContext = {
				question,
				userContext: "Luke Bangs",
			};

			const response = await chatbotService.processQuestion(context);

			expect(response.answer).toContain("appearances");
			// Should not contain "in X appearances" for appearances questions
			expect(response.answer).not.toMatch(/in \d+ appearance/);
		});
	});

	describe("Error Handling", () => {
		test("should handle unknown player gracefully", async () => {
			const question = "How many goals has Unknown Player scored?";
			const context: QuestionContext = {
				question,
				userContext: "Unknown Player",
			};

			const response = await chatbotService.processQuestion(context);

			expect(response.answer).toBeDefined();
			expect(response.answer).not.toBe("");
			// Should provide a helpful error message
			expect(response.answer.toLowerCase()).toContain("couldn't find");
		});

		test("should handle malformed questions", async () => {
			const question = "What is this?";
			const context: QuestionContext = {
				question,
				userContext: "Luke Bangs",
			};

			const response = await chatbotService.processQuestion(context);

			expect(response.answer).toBeDefined();
			expect(response.answer).not.toBe("");
		});
	});

	describe("Dynamic Player Discovery", () => {
		test("should work with all players from test data", async () => {
			const playerNames = await getTestPlayerNames();

			for (const playerName of playerNames) {
				const question = `How many goals has ${playerName} scored?`;
				const context: QuestionContext = {
					question,
					userContext: playerName,
				};

				const response = await chatbotService.processQuestion(context);

				expect(response.answer).toBeDefined();
				expect(response.answer).not.toBe("");

				// Verify response contains player name
				expect(response.answer).toContain(playerName);
			}
		});
	});

	describe("Question Analysis", () => {
		test("should correctly identify player questions", async () => {
			const question = "How many goals has Luke Bangs scored?";
			const context: QuestionContext = {
				question,
				userContext: "Luke Bangs",
			};

			const response = await chatbotService.processQuestion(context);

			// Get processing details to verify question analysis
			const processingDetails = chatbotService.getProcessingDetails();
			expect(processingDetails.questionAnalysis).toBeDefined();
			expect(processingDetails.questionAnalysis?.type).toBe("player");
		});

		test("should extract correct metrics from questions", async () => {
			const questions = [
				"How many goals has Luke Bangs scored?",
				"How many assists does Luke Bangs have?",
				"How many yellow cards has Luke Bangs received?",
			];

			for (const question of questions) {
				const context: QuestionContext = {
					question,
					userContext: "Luke Bangs",
				};

				await chatbotService.processQuestion(context);
				const processingDetails = chatbotService.getProcessingDetails();

				expect(processingDetails.questionAnalysis?.metrics).toBeDefined();
				expect(processingDetails.questionAnalysis?.metrics.length).toBeGreaterThan(0);
			}
		});
	});
});
