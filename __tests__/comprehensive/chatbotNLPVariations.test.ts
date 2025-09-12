import { ChatbotService, QuestionContext } from "../../lib/services/chatbotService";
import { getAllStatConfigs } from "../utils/testUtils";

describe("Chatbot NLP Variations Tests", () => {
	let chatbotService: ChatbotService;
	let statConfigs: ReturnType<typeof getAllStatConfigs>;

	beforeAll(async () => {
		chatbotService = ChatbotService.getInstance();
		statConfigs = getAllStatConfigs();

		const isVerbose = process.env.JEST_VERBOSE === "true";
		if (isVerbose) {
			console.log("✅ NLP Variations Test: Testing", statConfigs.length, "stat configurations");
		}
	});

	// Test basic stats with variations
	describe("Basic Stats NLP Variations", () => {
		const basicStats = [
			{ key: "APP", variations: ["appearances", "games played", "times played", "matches"] },
			{ key: "G", variations: ["goals", "goals scored", "times scored", "scored"] },
			{ key: "A", variations: ["assists", "assists provided", "assists given", "helped score"] },
			{ key: "MIN", variations: ["minutes", "time played", "football time", "playing time"] },
			{ key: "MOM", variations: ["man of the match", "MoM", "player of the match", "best player"] },
		];

		basicStats.forEach(({ key, variations }) => {
			variations.forEach((variation) => {
				test(`${key}: "How many ${variation} has Luke Bangs got?"`, async () => {
					const question = `How many ${variation} has Luke Bangs got?`;
					const context: QuestionContext = { question, userContext: "Luke Bangs" };
					const response = await chatbotService.processQuestion(context);

					expect(response.answer).toBeTruthy();
					expect(response.answer).not.toBe("");
					expect(response.answer).toMatch(/\d+/); // Should contain a number
				}, 30000);
			});
		});
	});

	// Test advanced stats with variations
	describe("Advanced Stats NLP Variations", () => {
		const advancedStats = [
			{ key: "GperAPP", variations: ["goals per appearance", "goals per game", "goals per match", "scoring rate"] },
			{ key: "CperAPP", variations: ["goals conceded per appearance", "conceded per game", "conceded per match"] },
			{ key: "MperG", variations: ["minutes per goal", "time per goal", "minutes to score"] },
			{ key: "FTPperAPP", variations: ["fantasy points per appearance", "fantasy points per game", "points per match"] },
		];

		advancedStats.forEach(({ key, variations }) => {
			variations.forEach((variation) => {
				test(`${key}: "How many ${variation} does Luke Bangs have?"`, async () => {
					const question = `How many ${variation} does Luke Bangs have?`;
					const context: QuestionContext = { question, userContext: "Luke Bangs" };
					const response = await chatbotService.processQuestion(context);

					expect(response.answer).toBeTruthy();
					expect(response.answer).not.toBe("");
					expect(response.answer).toMatch(/\d+/); // Should contain a number
				}, 30000);
			});
		});
	});

	// Test team-specific stats with variations
	describe("Team-Specific Stats NLP Variations", () => {
		const teamStats = [
			{ key: "1sApps", variations: ["1s", "first team", "firsts", "1st team", "1st XI"] },
			{ key: "2sApps", variations: ["2s", "second team", "seconds", "2nd team", "2nd XI"] },
			{ key: "3sApps", variations: ["3s", "third team", "thirds", "3rd team", "3rd XI"] },
			{ key: "MostPlayedForTeam", variations: ["most played for", "plays most for", "favorite team", "main team"] },
		];

		teamStats.forEach(({ key, variations }) => {
			variations.forEach((variation) => {
				test(`${key}: "How many appearances has Luke Bangs made for the ${variation}?"`, async () => {
					const question = `How many appearances has Luke Bangs made for the ${variation}?`;
					const context: QuestionContext = { question, userContext: "Luke Bangs" };
					const response = await chatbotService.processQuestion(context);

					expect(response.answer).toBeTruthy();
					expect(response.answer).not.toBe("");
					expect(response.answer).toMatch(/\d+/); // Should contain a number
				}, 30000);
			});
		});
	});

	// Test seasonal stats with variations
	describe("Seasonal Stats NLP Variations", () => {
		const seasonalStats = [
			{ key: "2016/17Apps", variations: ["2016/17", "2016-17", "16/17", "2016 to 2017"] },
			{ key: "2017/18Apps", variations: ["2017/18", "2017-18", "17/18", "2017 to 2018"] },
			{ key: "MostProlificSeason", variations: ["most prolific season", "best season", "top season", "highest scoring season"] },
		];

		seasonalStats.forEach(({ key, variations }) => {
			variations.forEach((variation) => {
				test(`${key}: "How many appearances did Luke Bangs make in ${variation}?"`, async () => {
					const question = `How many appearances did Luke Bangs make in ${variation}?`;
					const context: QuestionContext = { question, userContext: "Luke Bangs" };
					const response = await chatbotService.processQuestion(context);

					expect(response.answer).toBeTruthy();
					expect(response.answer).not.toBe("");
					expect(response.answer).toMatch(/\d+/); // Should contain a number
				}, 30000);
			});
		});
	});

	// Test positional stats with variations
	describe("Positional Stats NLP Variations", () => {
		const positionalStats = [
			{ key: "GK", variations: ["goalkeeper", "keeper", "goal keeper", "GK"] },
			{ key: "DEF", variations: ["defender", "defence", "defensive", "DEF"] },
			{ key: "MID", variations: ["midfielder", "midfield", "MID"] },
			{ key: "FWD", variations: ["forward", "striker", "attacker", "FWD"] },
			{ key: "MostCommonPosition", variations: ["most common position", "usual position", "main position", "favorite position"] },
		];

		positionalStats.forEach(({ key, variations }) => {
			variations.forEach((variation) => {
				test(`${key}: "How many times has Luke Bangs played as a ${variation}?"`, async () => {
					const question = `How many times has Luke Bangs played as a ${variation}?`;
					const context: QuestionContext = { question, userContext: "Luke Bangs" };
					const response = await chatbotService.processQuestion(context);

					expect(response.answer).toBeTruthy();
					expect(response.answer).not.toBe("");
					expect(response.answer).toMatch(/\d+/); // Should contain a number
				}, 30000);
			});
		});
	});

	// Test parsing robustness
	describe("Parsing Robustness", () => {
		test("Mixed case handling", async () => {
			const question = "HoW mAnY gOaLs HaS lUkE bAnGs ScOrEd?";
			const context: QuestionContext = { question, userContext: "Luke Bangs" };
			const response = await chatbotService.processQuestion(context);

			expect(response.answer).toBeTruthy();
			expect(response.answer).not.toBe("");
		}, 30000);

		test("Extra punctuation handling", async () => {
			const question = "How many goals has Luke Bangs scored?!?!?!";
			const context: QuestionContext = { question, userContext: "Luke Bangs" };
			const response = await chatbotService.processQuestion(context);

			expect(response.answer).toBeTruthy();
			expect(response.answer).not.toBe("");
		}, 30000);

		test("Extra whitespace handling", async () => {
			const question = "  How   many   goals   has   Luke   Bangs   scored?  ";
			const context: QuestionContext = { question, userContext: "Luke Bangs" };
			const response = await chatbotService.processQuestion(context);

			expect(response.answer).toBeTruthy();
			expect(response.answer).not.toBe("");
		}, 30000);
	});

	// Test summary
	test("NLP Variations Test Summary", () => {
		const totalStats = statConfigs.length;
		const expectedStats = 70; // 16 original + 54 new stats

		console.log(`\n🧠 NLP Variations Test Summary:`);
		console.log(`- Total stat configurations: ${totalStats}`);
		console.log(`- Expected stats: ${expectedStats}`);
		console.log(`- Categories tested:`);
		console.log(`  • Basic stats: APP, G, A, MIN, MOM`);
		console.log(`  • Advanced stats: GperAPP, CperAPP, MperG, FTPperAPP`);
		console.log(`  • Team-specific: 1s, 2s, 3s, MostPlayedForTeam`);
		console.log(`  • Seasonal: 2016/17, 2017/18, MostProlificSeason`);
		console.log(`  • Positional: GK, DEF, MID, FWD, MostCommonPosition`);
		console.log(`  • Parsing robustness: Mixed case, punctuation, whitespace`);

		expect(totalStats).toBe(expectedStats);
	});
});
