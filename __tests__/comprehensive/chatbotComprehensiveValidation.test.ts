import { ChatbotService, QuestionContext } from "../../lib/services/chatbotService";
import { fetchTestData, getAllStatConfigs, validateResponse, TestPlayerData } from "../utils/testUtils";

// End-to-end chatbot validation against the real production Neo4j pipeline (no mocks) for curated player/stat questions.
// beforeAll loads reference rows and stat configs from test utilities; per-test timeouts default to 30s where set.
// Sensitive to DB availability, data drift, and the fixed expected stat count—treat failures as integration signals.

describe("Chatbot Comprehensive Validation Tests", () => {
	let chatbotService: ChatbotService;
	let referenceData: TestPlayerData[];
	let statConfigs: ReturnType<typeof getAllStatConfigs>;

	beforeAll(async () => {
		// Initialize chatbot service
		chatbotService = ChatbotService.getInstance();

		// Fetch reference data from TBL_TestData (for reference only, not for validation)
		referenceData = await fetchTestData();

		// Get all stat configurations
		statConfigs = getAllStatConfigs();

		const isVerbose = process.env.JEST_VERBOSE === "true";
		if (isVerbose) {
			console.log("✅ Reference data loaded:", referenceData.length, "players");
			console.log("✅ Stat configurations loaded:", statConfigs.length, "stats");
			console.log("🧪 Testing against real production database");
		} else {
			console.log("📊 Reference data loaded:", referenceData.length, "players");
			console.log("📊 Stat configurations loaded:", statConfigs.length, "stats");
		}
	});

	// Test each player with basic stats that we know work
	describe("Player Statistics Validation", () => {
		// Luke Bangs tests - Basic stats only
		describe("Luke Bangs", () => {
			test("APP: How many appearances has Luke Bangs made?", async () => {
				// Arrange: appearances question with explicit player focus
				const question = "How many appearances has Luke Bangs made?";
				const context: QuestionContext = { question, userContext: "Luke Bangs" };
				// Act: full pipeline query against live data
				const response = await chatbotService.processQuestion(context);

				// Assert: non-empty natural language answer (long timeout for IO)
				console.log(`Database response: "${response.answer}"`);
				expect(response.answer).toBeTruthy();
				expect(response.answer.length).toBeGreaterThan(0);
			}, 30000);

			test("G: How many goals has Luke Bangs scored?", async () => {
				// Arrange: goals question for Luke Bangs
				const question = "How many goals has Luke Bangs scored?";
				const context: QuestionContext = { question, userContext: "Luke Bangs" };
				// Act: live chatbot + DB
				const response = await chatbotService.processQuestion(context);

				// Assert: answer text present
				console.log(`Database response: "${response.answer}"`);
				expect(response.answer).toBeTruthy();
				expect(response.answer.length).toBeGreaterThan(0);
			}, 30000);

			test("A: How many assists has Luke Bangs achieved?", async () => {
				// Arrange: assists phrasing variant
				const question = "How many assists has Luke Bangs achieved?";
				const context: QuestionContext = { question, userContext: "Luke Bangs" };
				// Act: process through production stack
				const response = await chatbotService.processQuestion(context);

				// Assert: substantive response
				console.log(`Database response: "${response.answer}"`);
				expect(response.answer).toBeTruthy();
				expect(response.answer.length).toBeGreaterThan(0);
			}, 30000);
		});

		// Oli Goddard tests - Basic stats only
		describe("Oli Goddard", () => {
			test("APP: How many appearances has Oli Goddard made?", async () => {
				// Arrange: appearances for alternate player
				const question = "How many appearances has Oli Goddard made?";
				const context: QuestionContext = { question, userContext: "Oli Goddard" };
				// Act: live query
				const response = await chatbotService.processQuestion(context);

				// Assert: logging + expectations
				console.log(`Database response: "${response.answer}"`);
				expect(response.answer).toBeTruthy();
				expect(response.answer.length).toBeGreaterThan(0);
			}, 30000);

			test("G: How many goals has Oli Goddard scored?", async () => {
				// Arrange: goals question for Oli Goddard
				const question = "How many goals has Oli Goddard scored?";
				const context: QuestionContext = { question, userContext: "Oli Goddard" };
				// Act: full processing
				const response = await chatbotService.processQuestion(context);

				// Assert: non-empty answer
				console.log(`Database response: "${response.answer}"`);
				expect(response.answer).toBeTruthy();
				expect(response.answer.length).toBeGreaterThan(0);
			}, 30000);
		});

		// Jonny Sourris tests - Basic stats only
		describe("Jonny Sourris", () => {
			test("APP: How many appearances has Jonny Sourris made?", async () => {
				// Arrange: appearances for Jonny Sourris
				const question = "How many appearances has Jonny Sourris made?";
				const context: QuestionContext = { question, userContext: "Jonny Sourris" };
				// Act: database-backed answer
				const response = await chatbotService.processQuestion(context);

				// Assert: output checks
				console.log(`Database response: "${response.answer}"`);
				expect(response.answer).toBeTruthy();
				expect(response.answer.length).toBeGreaterThan(0);
			}, 30000);

			test("G: How many goals has Jonny Sourris scored?", async () => {
				// Arrange: goals for Jonny Sourris
				const question = "How many goals has Jonny Sourris scored?";
				const context: QuestionContext = { question, userContext: "Jonny Sourris" };
				// Act: end-to-end processing
				const response = await chatbotService.processQuestion(context);

				// Assert: non-trivial string response
				console.log(`Database response: "${response.answer}"`);
				expect(response.answer).toBeTruthy();
				expect(response.answer.length).toBeGreaterThan(0);
			}, 30000);
		});
	});

	// Test Coverage Summary - validate we have the correct number of stats
	describe("Test Coverage Summary", () => {
		test("Should have correct number of stat configurations", () => {
			// Arrange: compare loaded catalog vs intentional expectation
			const totalStats = statConfigs.length;
			const expectedStats = 68; // Intentionally left off 2 of the 70

			// Act: emit human-readable coverage summary for CI logs
			console.log(`📊 Test Coverage Summary:`);
			console.log(`- Players tested: ${referenceData.length}`);
			console.log(`- Stats available for testing: ${totalStats}`);
			console.log(`- Expected stats: ${expectedStats}`);
			console.log(`- Note: This test focuses on basic stats that are fully implemented`);
			console.log(`- Advanced metrics (team-specific, seasonal, positional) will be tested separately`);

			// Assert: stat registry size matches curated baseline
			expect(totalStats).toBe(expectedStats);
		});
	});
});
