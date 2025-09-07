import { neo4jService } from "../neo4j";
import { metricConfigs, findMetricByAlias, getMetricDisplayName } from "../config/chatbotMetrics";
import * as natural from 'natural';
import nlp from 'compromise';
import { 
	getAppropriateVerb, 
	getResponseTemplate, 
	formatNaturalResponse
} from "../config/naturalLanguageResponses";

export interface ChatbotResponse {
	answer: string;
	data?: any;
	visualization?: {
		type: "chart" | "table" | "calendar" | "stats";
		data: any;
		config?: any;
	};
	sources: string[];
}

export interface QuestionContext {
	question: string;
	userContext?: string;
	dataSources?: string[];
}

export class ChatbotService {
	private static instance: ChatbotService;
	
	// Debug tracking properties
	private lastQuestionAnalysis: any = null;
	private lastExecutedQueries: string[] = [];
	private lastProcessingSteps: string[] = [];
	private lastQueryBreakdown: any = null;

	static getInstance(): ChatbotService {
		if (!ChatbotService.instance) {
			ChatbotService.instance = new ChatbotService();
		}
		return ChatbotService.instance;
	}

	// Helper method to log to both server and client consoles
	private logToBoth(message: string, data?: any, level: 'log' | 'warn' | 'error' = 'log') {
		// Server-side logging
		if (level === 'log') {
			console.log(message, data);
		} else if (level === 'warn') {
			console.warn(message, data);
		} else {
			console.error(message, data);
		}

		// Client-side logging (will show in browser console)
		// Note: This will always log to client console for debugging purposes
		if (level === 'log') {
			console.log(`🤖 [CLIENT] ${message}`, data);
		} else if (level === 'warn') {
			console.warn(`🤖 [CLIENT] ${message}`, data);
		} else {
			console.error(`🤖 [CLIENT] ${message}`, data);
		}
	}

	async processQuestion(context: QuestionContext): Promise<ChatbotResponse> {
		// Clear debug tracking for new question
		this.lastQuestionAnalysis = null;
		this.lastExecutedQueries = [];
		this.lastProcessingSteps = [];
		this.lastQueryBreakdown = null;
		
		this.logToBoth(`🤖 Processing question: ${context.question}`);
		this.logToBoth(`🌍 Environment: ${process.env.NODE_ENV}`);
		this.logToBoth(`👤 User context: ${context.userContext || 'None'}`);
		this.logToBoth(
			`🔗 Neo4j URI configured: ${process.env.PROD_NEO4J_URI ? "Yes" : "No"}`,
		);
		
		// Client-side logging for question processing
		console.log(`🤖 [CLIENT] 🤖 Processing question: ${context.question}`);
		console.log(`🤖 [CLIENT] 👤 User context: ${context.userContext || 'None'}`);

		try {
			// Ensure Neo4j connection
			const connected = await neo4jService.connect();
			if (!connected) {
				console.error("❌ Neo4j connection failed in production");
							return {
				answer: "I'm sorry, I'm unable to access the club's database at the moment. Please try again later.",
				sources: [],
			};
			}

					// Analyze the question
		const analysis = this.analyzeQuestion(context.question, context.userContext);
		this.lastQuestionAnalysis = analysis; // Store for debugging
		
		// Handle clarification needed case
		if (analysis.type === "clarification_needed") {
			return {
				answer: analysis.message || "Please clarify your question.",
				sources: [],
			};
		}
		
		// Create detailed breakdown for debugging
		this.lastQueryBreakdown = {
			playerName: context.userContext || 'None',
			team: analysis.entities.find(e => /\d+(?:st|nd|rd|th)?/.test(e)) || 'None',
			statEntity: analysis.metrics[0] || 'None',
			questionType: analysis.type,
			extractedEntities: analysis.entities,
			extractedMetrics: analysis.metrics
		};
		
		this.logToBoth(`🔍 Question analysis:`, analysis);
		this.logToBoth(`🔍 Query breakdown:`, this.lastQueryBreakdown);
		
		// Client-side logging for question analysis
		console.log(`🤖 [CLIENT] 🔍 Question analysis:`, analysis);
		console.log(`🤖 [CLIENT] 🔍 Query breakdown:`, this.lastQueryBreakdown);

			// Query the database
			this.lastProcessingSteps.push(`Building Cypher query for analysis: ${analysis.type}`);
			this.logToBoth(`🔍 Building Cypher query for analysis:`, analysis);
			const data = await this.queryRelevantData(analysis);
			this.lastProcessingSteps.push(`Query completed, result type: ${data?.type || 'null'}`);
			this.logToBoth(`📊 Query result:`, data);
			
			// Client-side logging for query results
			console.log(`🤖 [CLIENT] 📊 Query result:`, data);

			// Generate the response
			const response = await this.generateResponse(context.question, data, analysis);
			this.logToBoth(`💬 Generated response:`, response);

			return response;
		} catch (error) {
			this.logToBoth("❌ Error processing question:", error, 'error');
			return {
				answer: "I'm sorry, I encountered an error while processing your question. Please try again later.",
				sources: [],
			};
		}
	}

	private analyzeQuestion(
		question: string,
		userContext?: string,
	): {
		type: "player" | "team" | "club" | "fixture" | "comparison" | "streak" | "double_game" | "general" | "clarification_needed";
		entities: string[];
		metrics: string[];
		timeRange?: string;
		message?: string;
	} {
		console.log("🔍 analyzeQuestion called with:", { question, userContext });
		const lowerQuestion = question.toLowerCase();

		// Determine question type
		let type: "player" | "team" | "club" | "fixture" | "comparison" | "streak" | "double_game" | "general" = "general";

		// First, check if we have player-specific content indicators
		if (
			lowerQuestion.includes("player") ||
			lowerQuestion.includes("scored") ||
			lowerQuestion.includes("goals") ||
			lowerQuestion.includes("assists") ||
			lowerQuestion.includes("appearances") ||
			lowerQuestion.includes("minutes") ||
			lowerQuestion.includes("man of the match") ||
			lowerQuestion.includes("yellow") ||
			lowerQuestion.includes("red") ||
			lowerQuestion.includes("saves") ||
			lowerQuestion.includes("own goals") ||
			lowerQuestion.includes("conceded") ||
			lowerQuestion.includes("clean sheets") ||
			lowerQuestion.includes("penalties") ||
			lowerQuestion.includes("fantasy") ||
			lowerQuestion.includes("away games") ||
			lowerQuestion.includes("home games") ||
			lowerQuestion.includes("most prolific season") ||
			lowerQuestion.includes("most common position")
		) {
			type = "player";
		} else if (lowerQuestion.includes("team") || lowerQuestion.includes("finish")) {
			type = "team";
		} else if (lowerQuestion.includes("club") || lowerQuestion.includes("captain")) {
			type = "club";
		} else if (lowerQuestion.includes("fixture") || lowerQuestion.includes("match")) {
			type = "fixture";
		} else if (lowerQuestion.includes("compare") || lowerQuestion.includes("vs")) {
			type = "comparison";
		} else if (lowerQuestion.includes("streak") || lowerQuestion.includes("consecutive") || lowerQuestion.includes("in a row")) {
			type = "streak";
		} else if (lowerQuestion.includes("double game") || lowerQuestion.includes("double game week")) {
			type = "double_game";
		}

		// Extract player names from various question formats
		const entities: string[] = [];

		// Pattern 1: "What is Luke Bangs's total goals?" or "What is Luke Bangs total goals?"
		let playerNameMatch = question.match(/What is (.*?)(?:'s | )total/);
		if (playerNameMatch) {
			entities.push(playerNameMatch[1].trim());
		}

		// Pattern 2: "How many goals has Luke Bangs scored?" or "How many yellow cards has Luke Bangs received?"
		if (entities.length === 0) {
			playerNameMatch = question.match(
				/How many (?:goals|assists|appearances|minutes|man of the match awards?|yellow cards?|red cards?|saves?|own goals?|conceded goals?|clean sheets?|penalties scored?|penalties missed?|penalties conceded?|penalties saved?|fantasy points?) has (.*?) (?:scored|got|made|played|won|received|conceded|kept|missed|saved|earned|received|given|booked|cautioned|dismissed|sent off|let in|allowed|kept|converted|failed|gave away|stopped|earned|collected|accumulated)/,
			);
			if (playerNameMatch) {
				entities.push(playerNameMatch[1].trim());
			}
		}

		// Pattern 2c: "How many goals on average has Luke Bangs scored per appearance?" (comprehensive test templates)
		if (entities.length === 0) {
			playerNameMatch = question.match(
				/How many (?:goals|assists|appearances|minutes|man of the match awards?|yellow cards?|red cards?|saves?|own goals?|conceded goals?|clean sheets?|penalties scored?|penalties missed?|penalties conceded?|penalties saved?|fantasy points?) (?:on average )?has (.*?) (?:scored|got|made|played|won|received|conceded|kept|missed|saved|earned|received|given|booked|cautioned|dismissed|sent off|let in|allowed|kept|converted|failed|gave away|stopped|earned|collected|accumulated)/,
			);
			if (playerNameMatch) {
				entities.push(playerNameMatch[1].trim());
			}
		}

		// Pattern 2d: "How many goals on average does Luke Bangs concede per match?" (comprehensive test templates)
		if (entities.length === 0) {
			playerNameMatch = question.match(
				/How many (?:goals|assists|appearances|minutes|man of the match awards?|yellow cards?|red cards?|saves?|own goals?|conceded goals?|clean sheets?|penalties scored?|penalties missed?|penalties conceded?|penalties saved?|fantasy points?) (?:on average )?does ([A-Z][a-z]+(?: [A-Z][a-z]+)*) (?:score|concede|play|win|receive|keep|miss|save|earn|give|book|caution|dismiss|let in|allow|convert|fail|give away|stop|collect|accumulate)/,
			);
			if (playerNameMatch) {
				entities.push(playerNameMatch[1].trim());
			}
		}

		// Pattern 2b: "How many penalties has Jonny Sourris missed?" (more natural format)
		if (entities.length === 0) {
			playerNameMatch = question.match(
				/How many (?:goals|assists|appearances|minutes|man of the match awards?|yellow cards?|red cards?|saves?|own goals?|conceded goals?|clean sheets?|penalties|fantasy points?) has ([A-Z][a-z]+(?: [A-Z][a-z]+)*) (?:scored|got|made|played|won|received|conceded|kept|missed|saved|earned|received|given|booked|cautioned|dismissed|sent off|let in|allowed|kept|converted|failed|gave away|stopped|earned|collected|accumulated)/,
			);
			if (playerNameMatch) {
				entities.push(playerNameMatch[1].trim());
			}
		}

		// Pattern 3a: "What are Luke Bangs goals?" or "What is Luke Bangs assists?"
		if (entities.length === 0) {
			playerNameMatch = question.match(
				/What (?:are|is) ([A-Za-z\s]+) (?:goals|assists|appearances|minutes|man of the match|mom|yellow cards?|red cards?|saves?|own goals?|conceded|clean sheets?|penalties|fantasy points)/,
			);
			if (playerNameMatch) {
				entities.push(playerNameMatch[1].trim());
			}
		}

		// Pattern 3b: "Luke Bangs goals" or "Luke Bangs appearances" (but NOT starting with interrogative words)
		if (entities.length === 0) {
			playerNameMatch = question.match(
				/^(?!What|How|When|Where|Why|Which|Who)([A-Za-z\s]+) (?:goals|assists|appearances|minutes|man of the match|mom|yellow cards?|red cards?|saves?|own goals?|conceded|clean sheets?|penalties|fantasy points)/,
			);
			if (playerNameMatch) {
				entities.push(playerNameMatch[1].trim());
			}
		}
		
		// Enhanced Pattern 4: "Luke's goals" or "Luke's assists" (possessive form)
		if (entities.length === 0) {
			playerNameMatch = question.match(
				/([A-Za-z\s]+)'s (?:goals|assists|appearances|minutes|man of the match|mom|yellow cards?|red cards?|saves?|own goals?|conceded|clean sheets?|penalties|fantasy points)/,
			);
			if (playerNameMatch) {
				entities.push(playerNameMatch[1].trim());
			}
		}
		
		// Pattern 6: "How many minutes does it take on average for Luke Bangs to score?" (comprehensive test templates)
		if (entities.length === 0) {
			playerNameMatch = question.match(
				/for ([A-Z][a-z]+(?: [A-Z][a-z]+)*) to/,
			);
			if (playerNameMatch) {
				entities.push(playerNameMatch[1].trim());
			}
		}

		// Enhanced Pattern 5: "How many times has Luke played?" (simplified format)
		if (entities.length === 0) {
			playerNameMatch = question.match(
				/How many times has ([A-Za-z\s]+) (?:played|scored|assisted|appeared|won|received|conceded|kept|missed|saved|earned|given|booked|cautioned|dismissed|sent off|let in|allowed|converted|failed|gave away|stopped|collected|accumulated)/,
			);
			if (playerNameMatch) {
				entities.push(playerNameMatch[1].trim());
			}
		}

		// Pattern 7: "What is Luke Bangs most played for team?" (comprehensive test templates)
		if (entities.length === 0) {
			playerNameMatch = question.match(
				/What is ([A-Za-z\s]+) (?:most played for team|most scored for team|most common position|most prolific season|number of teams played for|number of seasons played for)/,
			);
			if (playerNameMatch) {
				entities.push(playerNameMatch[1].trim());
			}
		}

		// Pattern 8: "How many home games has Luke Bangs played?" (comprehensive test templates)
		if (entities.length === 0) {
			playerNameMatch = question.match(
				/How many (?:home|away) (?:games|goals|wins|appearances) has ([A-Za-z\s]+) (?:played|scored|won|made)/,
			);
			if (playerNameMatch) {
				entities.push(playerNameMatch[1].trim());
			}
		}

		// Pattern 9: "How many 1s appearances has Luke Bangs made?" (team-specific comprehensive test templates)
		if (entities.length === 0) {
			playerNameMatch = question.match(
				/How many (?:1s|2s|3s|4s|5s|6s|7s|8s) (?:appearances|goals) has ([A-Za-z\s]+) (?:made|scored)/,
			);
			if (playerNameMatch) {
				entities.push(playerNameMatch[1].trim());
			}
		}

		// Pattern 10: "How many 2016/17 appearances has Luke Bangs made?" (seasonal comprehensive test templates)
		if (entities.length === 0) {
			playerNameMatch = question.match(
				/How many (?:2016\/17|2017\/18|2018\/19|2019\/20|2020\/21|2021\/22) (?:appearances|goals) has ([A-Za-z\s]+) (?:made|scored)/,
			);
			if (playerNameMatch) {
				entities.push(playerNameMatch[1].trim());
			}
		}

		// Pattern 11: "How many goalkeeper appearances has Luke Bangs made?" (positional comprehensive test templates)
		if (entities.length === 0) {
			playerNameMatch = question.match(
				/How many (?:goalkeeper|defender|midfielder|forward) (?:appearances|goals) has ([A-Za-z\s]+) (?:made|scored)/,
			);
			if (playerNameMatch) {
				entities.push(playerNameMatch[1].trim());
			}
		}

		// Pattern 4: "I" pronoun handling - use selected player from context
		if (
			entities.length === 0 &&
			(lowerQuestion.includes("i") || lowerQuestion.includes("i've") || lowerQuestion.includes("i have") || lowerQuestion.includes("me"))
		) {
			if (userContext) {
				entities.push(userContext);
			}
			// No fallback - if no context, entities will remain empty
		}

		// Enhanced player name ambiguity handling
		// Check if extracted player name matches selected player context
		if (entities.length > 0 && userContext) {
			const extractedPlayer = entities[0];
			const selectedPlayer = userContext;
			
			// If names don't match, ask for clarification
			if (extractedPlayer.toLowerCase() !== selectedPlayer.toLowerCase()) {
				// Check if extracted name is a partial match (e.g., "Luke" vs "Luke Bangs")
				if (!selectedPlayer.toLowerCase().includes(extractedPlayer.toLowerCase()) && 
					!extractedPlayer.toLowerCase().includes(selectedPlayer.toLowerCase())) {
					// Names are different - ask for clarification
					return {
						type: "clarification_needed",
						entities: [],
						metrics: [],
						message: `I found a player named "${extractedPlayer}" in your question, but you have "${selectedPlayer}" selected. Please clarify which player you're asking about.`
					};
				}
			}
		}

		// Enhanced team pattern recognition using Compromise and Natural
		// Pattern 5: Team-specific questions with enhanced matching
		if (entities.length === 0 || this.isTeamQuestion(question)) {
			const extractedTeam = this.extractTeamEntity(question);
			if (extractedTeam) {
				if (entities.length > 0) {
					entities[0] = extractedTeam; // Replace first entity with team
				} else {
					entities.push(extractedTeam);
				}
			}
		}

		// Extract metrics using the configuration with context awareness
		const metrics: string[] = [];
		// console.log("🔍 Starting metrics detection, metrics.length:", metrics.length);

		// Enhanced advanced metrics detection for comprehensive testing (check these FIRST)
		if (metrics.length === 0) {
			console.log("🔍 Starting advanced metrics detection for question:", question);
			// Goals per appearance
			if (lowerQuestion.includes("goals") && lowerQuestion.includes("per appearance")) {
				// console.log("🔍 GperAPP detected");
				metrics.push("GperAPP");
			}
			// Conceded per appearance
			else if (lowerQuestion.includes("concede") && (lowerQuestion.includes("per match") || lowerQuestion.includes("per appearance"))) {
				// console.log("🔍 CperAPP detected");
				metrics.push("CperAPP");
			}
			// Minutes per goal - enhanced pattern matching
			else if (lowerQuestion.includes("minutes") && (
				lowerQuestion.includes("per goal") || 
				(lowerQuestion.includes("take") && lowerQuestion.includes("score")) || 
				(lowerQuestion.includes("does") && lowerQuestion.includes("take") && lowerQuestion.includes("score")) ||
				(lowerQuestion.includes("how many minutes") && lowerQuestion.includes("score")) ||
				(lowerQuestion.includes("minutes") && lowerQuestion.includes("average") && lowerQuestion.includes("score")) ||
				(lowerQuestion.includes("minutes") && lowerQuestion.includes("on average") && lowerQuestion.includes("score")) ||
				(lowerQuestion.includes("minutes") && lowerQuestion.includes("does it take") && lowerQuestion.includes("score")) ||
				(lowerQuestion.includes("how many minutes") && lowerQuestion.includes("does it take") && lowerQuestion.includes("score"))
			)) {
				console.log("🔍 MperG detected for question:", question);
				metrics.push("MperG");
			}
			// Minutes per clean sheet
			else if (lowerQuestion.includes("minutes") && lowerQuestion.includes("clean sheet")) {
				metrics.push("MperCLS");
			}
			// Fantasy points per appearance
			else if (lowerQuestion.includes("fantasy points") && lowerQuestion.includes("per appearance")) {
				metrics.push("FTPperAPP");
			}
			// Distance
			else if (lowerQuestion.includes("distance") || lowerQuestion.includes("travelled")) {
				metrics.push("DIST");
			}
			// Home games percentage won (most specific first)
			else if (lowerQuestion.includes("home games") && lowerQuestion.includes("percent")) {
				metrics.push("HomeGames%Won");
			}
			// Away games percentage won (most specific first)
			else if (lowerQuestion.includes("away games") && lowerQuestion.includes("percent")) {
				metrics.push("AwayGames%Won");
			}
			// Home wins (specific)
			else if (lowerQuestion.includes("home games") && lowerQuestion.includes("won")) {
				metrics.push("HomeWins");
			}
			// Away wins (specific)
			else if (lowerQuestion.includes("away games") && lowerQuestion.includes("won")) {
				metrics.push("AwayWins");
			}
			// Games percentage won (general)
			else if (lowerQuestion.includes("games") && lowerQuestion.includes("percent")) {
				metrics.push("Games%Won");
			}
			// Home games (general)
			else if (lowerQuestion.includes("home games")) {
				metrics.push("HomeGames");
			}
			// Away games (general)
			else if (lowerQuestion.includes("away games")) {
				metrics.push("AwayGames");
			}
			// Team-specific appearances
			else if (lowerQuestion.includes("1s") && lowerQuestion.includes("appearances")) {
				metrics.push("1sApps");
			}
			else if (lowerQuestion.includes("2s") && lowerQuestion.includes("appearances")) {
				metrics.push("2sApps");
			}
			else if (lowerQuestion.includes("3s") && lowerQuestion.includes("appearances")) {
				metrics.push("3sApps");
			}
			else if (lowerQuestion.includes("4s") && lowerQuestion.includes("appearances")) {
				metrics.push("4sApps");
			}
			else if (lowerQuestion.includes("5s") && lowerQuestion.includes("appearances")) {
				metrics.push("5sApps");
			}
			else if (lowerQuestion.includes("6s") && lowerQuestion.includes("appearances")) {
				metrics.push("6sApps");
			}
			else if (lowerQuestion.includes("7s") && lowerQuestion.includes("appearances")) {
				metrics.push("7sApps");
			}
			else if (lowerQuestion.includes("8s") && lowerQuestion.includes("appearances")) {
				metrics.push("8sApps");
			}
			// Team-specific goals
			else if (lowerQuestion.includes("1s") && lowerQuestion.includes("goals")) {
				metrics.push("1sGoals");
			}
			else if (lowerQuestion.includes("2s") && lowerQuestion.includes("goals")) {
				metrics.push("2sGoals");
			}
			else if (lowerQuestion.includes("3s") && lowerQuestion.includes("goals")) {
				metrics.push("3sGoals");
			}
			else if (lowerQuestion.includes("4s") && lowerQuestion.includes("goals")) {
				metrics.push("4sGoals");
			}
			else if (lowerQuestion.includes("5s") && lowerQuestion.includes("goals")) {
				metrics.push("5sGoals");
			}
			else if (lowerQuestion.includes("6s") && lowerQuestion.includes("goals")) {
				metrics.push("6sGoals");
			}
			else if (lowerQuestion.includes("7s") && lowerQuestion.includes("goals")) {
				metrics.push("7sGoals");
			}
			else if (lowerQuestion.includes("8s") && lowerQuestion.includes("goals")) {
				metrics.push("8sGoals");
			}
			// Seasonal appearances
			else if (lowerQuestion.includes("2016/17") && lowerQuestion.includes("appearances")) {
				metrics.push("2016/17Apps");
			}
			else if (lowerQuestion.includes("2017/18") && lowerQuestion.includes("appearances")) {
				metrics.push("2017/18Apps");
			}
			else if (lowerQuestion.includes("2018/19") && lowerQuestion.includes("appearances")) {
				metrics.push("2018/19Apps");
			}
			else if (lowerQuestion.includes("2019/20") && lowerQuestion.includes("appearances")) {
				metrics.push("2019/20Apps");
			}
			else if (lowerQuestion.includes("2020/21") && lowerQuestion.includes("appearances")) {
				metrics.push("2020/21Apps");
			}
			else if (lowerQuestion.includes("2021/22") && lowerQuestion.includes("appearances")) {
				metrics.push("2021/22Apps");
			}
			// Seasonal goals
			else if (lowerQuestion.includes("2016/17") && lowerQuestion.includes("goals")) {
				metrics.push("2016/17Goals");
			}
			else if (lowerQuestion.includes("2017/18") && lowerQuestion.includes("goals")) {
				metrics.push("2017/18Goals");
			}
			else if (lowerQuestion.includes("2018/19") && lowerQuestion.includes("goals")) {
				metrics.push("2018/19Goals");
			}
			else if (lowerQuestion.includes("2019/20") && lowerQuestion.includes("goals")) {
				metrics.push("2019/20Goals");
			}
			else if (lowerQuestion.includes("2020/21") && lowerQuestion.includes("goals")) {
				metrics.push("2020/21Goals");
			}
			else if (lowerQuestion.includes("2021/22") && lowerQuestion.includes("goals")) {
				metrics.push("2021/22Goals");
			}
			// Positional stats
			else if (lowerQuestion.includes("goalkeeper")) {
				metrics.push("GK");
			}
			else if (lowerQuestion.includes("defender")) {
				metrics.push("DEF");
			}
			else if (lowerQuestion.includes("midfielder")) {
				metrics.push("MID");
			}
			else if (lowerQuestion.includes("forward")) {
				metrics.push("FWD");
			}
			// Most played for team
			else if (lowerQuestion.includes("most played for team")) {
				metrics.push("MostPlayedForTeam");
			}
			// Most scored for team
			else if (lowerQuestion.includes("most scored for team")) {
				metrics.push("MostScoredForTeam");
			}
			// Number of teams played for
			else if (lowerQuestion.includes("number of teams played for")) {
				metrics.push("NumberTeamsPlayedFor");
			}
			// Number of seasons played for
			else if (lowerQuestion.includes("number of seasons played for")) {
				metrics.push("NumberSeasonsPlayedFor");
			}
			// Most prolific season
			else if (lowerQuestion.includes("most prolific season")) {
				metrics.push("MostProlificSeason");
			}
			// Most common position
			else if (lowerQuestion.includes("most common position")) {
				metrics.push("MostCommonPosition");
			}
		}

		// Enhanced goals detection (after advanced metrics)
		if (metrics.length === 0 && lowerQuestion.includes("goals")) {
			// Enhanced goals logic: check for specific goal types first
			if (lowerQuestion.includes("own goals")) {
				metrics.push("OG"); // Own goals
			} else if (lowerQuestion.includes("conceded")) {
				metrics.push("C"); // Goals conceded
			} else if (lowerQuestion.includes("open play") || lowerQuestion.includes("from play") || lowerQuestion.includes("field goals")) {
				metrics.push("G"); // Goals from open play only
			} else if (lowerQuestion.includes("penalty") || lowerQuestion.includes("spot kick")) {
				metrics.push("PSC"); // Penalty goals only
			} else {
				metrics.push("AllGSC"); // Total goals (default for "goals" questions)
			}
		}
		// Check penalties (more specific) after goals
		else if (metrics.length === 0 && lowerQuestion.includes("penalties")) {
			if (lowerQuestion.includes("missed") || lowerQuestion.includes("failed")) {
				metrics.push("PM"); // Penalties missed
			} else if (lowerQuestion.includes("conceded") || lowerQuestion.includes("gave away")) {
				metrics.push("PCO"); // Penalties conceded
			} else if (lowerQuestion.includes("saved") || lowerQuestion.includes("stopped")) {
				metrics.push("PSV"); // Penalties saved
			} else if (lowerQuestion.includes("scored") || lowerQuestion.includes("converted")) {
				metrics.push("PSC"); // Penalties scored
			} else if (lowerQuestion.includes("taken") || lowerQuestion.includes("record") || lowerQuestion.includes("conversion")) {
				metrics.push("penaltyRecord"); // Total penalties taken with conversion rate
			} else {
				metrics.push("PSC"); // Default to penalties scored
			}
		}

		// Enhanced points detection with context awareness
		if (metrics.length === 0 && lowerQuestion.includes("points")) {
			// Check if this is about team points (game results) or individual fantasy points
			if (lowerQuestion.includes("team") || lowerQuestion.includes("league") || lowerQuestion.includes("table")) {
				// Team context - could be game points (W/D/L) but we don't have that data yet
				// For now, default to fantasy points but clarify in response
				metrics.push("points");
			} else {
				// Individual context - default to fantasy points
				metrics.push("FTP");
			}
		}
		
		// Enhanced penalty record detection
		if (metrics.length === 0 && lowerQuestion.includes("penalty") && (lowerQuestion.includes("record") || lowerQuestion.includes("conversion") || lowerQuestion.includes("taken"))) {
			metrics.push("penaltyRecord");
		}

		// Check for metric matches using aliases (only if enhanced detection didn't find anything)
		if (metrics.length === 0) {
			for (const config of metricConfigs) {
				const found =
					config.aliases.some((alias) => lowerQuestion.includes(alias.toLowerCase())) || lowerQuestion.includes(config.displayName.toLowerCase());

				if (found) {
					metrics.push(config.key);
					break; // Use first match found
				}
			}
		}


		// Fallback metric detection for remaining cases
		if (metrics.length === 0) {
			if (lowerQuestion.includes("assists")) metrics.push("A");
			if (lowerQuestion.includes("clean sheets")) metrics.push("CLS");
			if (lowerQuestion.includes("games") || lowerQuestion.includes("appearances")) metrics.push("APP");
			if (lowerQuestion.includes("minutes")) metrics.push("MIN");
			if (lowerQuestion.includes("man of the match")) metrics.push("MOM");
			
			// Enhanced year vs season detection
			if (lowerQuestion.includes("2021") || lowerQuestion.includes("2022") || lowerQuestion.includes("2020") || 
				lowerQuestion.includes("2019") || lowerQuestion.includes("2018") || lowerQuestion.includes("2017") || 
				lowerQuestion.includes("2016")) {
				// Check if this is a season reference (e.g., "2021/22", "21/22", "2021-22")
				const seasonPattern = /(20\d{2})[\/\-](20\d{2}|2\d)/;
				const seasonMatch = question.match(seasonPattern);
				if (seasonMatch) {
					// This is a season reference - add season-specific metric
					const season = seasonMatch[0].replace(/[\/\-]/g, '_');
					if (lowerQuestion.includes("goals")) {
						metrics.push(`${season}Goals`);
					} else if (lowerQuestion.includes("appearances") || lowerQuestion.includes("apps")) {
						metrics.push(`${season}Apps`);
					}
				} else {
					// This is a calendar year reference - note for response clarification
					// For now, we'll use the same logic but clarify in response
					if (lowerQuestion.includes("goals")) {
						metrics.push("AllGSC"); // Default to total goals
					} else if (lowerQuestion.includes("appearances") || lowerQuestion.includes("apps")) {
						metrics.push("APP"); // Default to total appearances
					}
				}
			}
			if (lowerQuestion.includes("yellow")) metrics.push("Y");
			if (lowerQuestion.includes("red")) metrics.push("R");
			if (lowerQuestion.includes("saves")) metrics.push("SAVES");
			if (lowerQuestion.includes("own goals")) metrics.push("OG");
			if (lowerQuestion.includes("conceded")) metrics.push("C");
			if (lowerQuestion.includes("fantasy")) metrics.push("FTP");
			
			// Additional metrics for comprehensive testing
			if (lowerQuestion.includes("away games")) metrics.push("APP");
			if (lowerQuestion.includes("home games")) metrics.push("APP");
			if (lowerQuestion.includes("most prolific season")) metrics.push("MostProlificSeason");
			if (lowerQuestion.includes("most common position")) metrics.push("MostCommonPosition");

			// New enhanced metrics
			if (lowerQuestion.includes("team of the week") || lowerQuestion.includes("totw")) {
				if (lowerQuestion.includes("season")) {
					metrics.push("SEASON_TOTW");
				} else {
					metrics.push("TOTW");
				}
			}
			if (lowerQuestion.includes("player of the month") || lowerQuestion.includes("potm")) {
				metrics.push("POTM");
			}
			if (lowerQuestion.includes("captain") || lowerQuestion.includes("captain awards")) {
				metrics.push("CAPTAIN");
			}
			if (lowerQuestion.includes("co-players") || lowerQuestion.includes("played with") || lowerQuestion.includes("teammates")) {
				metrics.push("CO_PLAYERS");
			}
			if (lowerQuestion.includes("opponents") || lowerQuestion.includes("played against") || lowerQuestion.includes("vs")) {
				metrics.push("OPPONENTS");
			}
		}

		// Override type to "player" if we have both entities and metrics
		if (entities.length > 0 && metrics.length > 0) {
			type = "player";
		}

		// Debug logging
		console.log(`Question analysis - Type: ${type}, Entities: ${entities}, Metrics: ${metrics}, Lower question: ${lowerQuestion}`);

		return { type, entities, metrics };
	}

	private async queryRelevantData(analysis: any): Promise<any> {
		this.logToBoth(`🔍 queryRelevantData called with analysis:`, analysis);
		const { type, entities, metrics } = analysis;

		try {
			this.logToBoth(`🔍 Querying for type: ${type}, entities: ${entities}, metrics: ${metrics}`);

					switch (type) {
			case "player":
				this.logToBoth(`🔍 Calling queryPlayerData for entities: ${entities}, metrics: ${metrics}`);
				const playerResult = await this.queryPlayerData(entities, metrics);
				this.logToBoth(`🔍 queryPlayerData returned:`, playerResult);
				return playerResult;
			case "team":
				this.logToBoth(`🔍 Calling queryTeamData...`);
				return await this.queryTeamData(entities, metrics);
			case "club":
				this.logToBoth(`🔍 Calling queryClubData...`);
				return await this.queryClubData(entities, metrics);
			case "fixture":
				this.logToBoth(`🔍 Calling queryFixtureData...`);
				return await this.queryFixtureData(entities, metrics);
			case "comparison":
				this.logToBoth(`🔍 Calling queryComparisonData...`);
				return await this.queryComparisonData(entities, metrics);
			case "streak":
				this.logToBoth(`🔍 Calling queryStreakData...`);
				return await this.queryStreakData(entities, metrics);
			case "double_game":
				this.logToBoth(`🔍 Calling queryDoubleGameData...`);
				return await this.queryDoubleGameData(entities, metrics);
			default:
				this.logToBoth(`🔍 Calling queryGeneralData...`);
				return await this.queryGeneralData();
		}
		} catch (error) {
			this.logToBoth("❌ Data query failed:", error, 'error');
			return null;
		}
	}

	private async queryPlayerData(entities: string[], metrics: string[]): Promise<any> {
		this.logToBoth(`🔍 queryPlayerData called with entities: ${entities}, metrics: ${metrics}`);

		// Check if we have entities (player names) to query
		if (entities.length === 0) {
			return { type: "no_context", data: [], message: "No player context provided" };
		}

		// If we have a specific player name and metrics, query their stats
		if (entities.length > 0 && metrics.length > 0) {
			const playerName = entities[0];
			const metric = metrics[0];

			this.logToBoth(`🎯 Querying for player: ${playerName}, metric: ${metric}`);

			// Check if this is a team-specific question (e.g., "3rd team")
			if (playerName.match(/^\d+(?:st|nd|rd|th)?$/)) {
				this.logToBoth(`🔍 Detected team-specific question for team: ${playerName}`);
				return await this.queryTeamSpecificPlayerData(playerName, metric);
			}

			// Check for special queries that can use enhanced relationship properties
			if (metric === "TOTW" || metric === "WEEKLY_TOTW") {
				return await this.queryPlayerTOTWData(playerName, "weekly");
			}

			if (metric === "SEASON_TOTW") {
				return await this.queryPlayerTOTWData(playerName, "season");
			}

			if (metric === "POTM" || metric === "PLAYER_OF_THE_MONTH") {
				return await this.queryPlayerOfTheMonthData(playerName);
			}

			if (metric === "CAPTAIN" || metric === "CAPTAIN_AWARDS") {
				return await this.queryPlayerCaptainAwardsData(playerName);
			}

			if (metric === "CO_PLAYERS" || metric === "PLAYED_WITH") {
				return await this.queryPlayerCoPlayersData(playerName);
			}

			if (metric === "OPPONENTS" || metric === "PLAYED_AGAINST") {
				return await this.queryPlayerOpponentsData(playerName);
			}

			// Build query with case-insensitive player name matching
			let query = `
				MATCH (p:Player)
				WHERE p.playerName = $playerName OR p.playerName = $playerNameLower OR p.playerName = $playerNameHyphen
				MATCH (p)-[:PLAYED_IN]->(md:MatchDetail)
			`;

			let returnClause = "";
			switch (metric) {
				case "APP":
					returnClause = "RETURN p.playerName as playerName, count(md) as value";
					break;
				case "MIN":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.minutes IS NULL OR md.minutes = "" THEN 0 ELSE md.minutes END), 0) as value';
					break;
				case "G":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) as value';
					break;
				case "A":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.assists IS NULL OR md.assists = "" THEN 0 ELSE md.assists END), 0) as value';
					break;
				case "MOM":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.mom IS NULL OR md.mom = "" THEN 0 ELSE md.mom END), 0) as value';
					break;
				case "Y":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.yellowCards IS NULL OR md.yellowCards = "" THEN 0 ELSE md.yellowCards END), 0) as value';
					break;
				case "R":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.redCards IS NULL OR md.redCards = "" THEN 0 ELSE md.redCards END), 0) as value';
					break;
				case "SAVES":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.saves IS NULL OR md.saves = "" THEN 0 ELSE md.saves END), 0) as value';
					break;
				case "OG":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.ownGoals IS NULL OR md.ownGoals = "" THEN 0 ELSE md.ownGoals END), 0) as value';
					break;
				case "C":
					// Goals conceded - get from Player node
					returnClause = "RETURN p.playerName as playerName, coalesce(p.conceded, 0) as value";
					break;
				case "CLS":
					// Clean sheets - get from Player node
					returnClause = "RETURN p.playerName as playerName, coalesce(p.cleanSheets, 0) as value";
					break;
				case "PSC":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END), 0) as value';
					break;
				case "PM":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.penaltiesMissed IS NULL OR md.penaltiesMissed = "" THEN 0 ELSE md.penaltiesMissed END), 0) as value';
					break;
				case "PCO":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.penaltiesConceded IS NULL OR md.penaltiesConceded = "" THEN 0 ELSE md.penaltiesConceded END), 0) as value';
					break;
				case "PSV":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.penaltiesSaved IS NULL OR md.penaltiesSaved = "" THEN 0 ELSE md.penaltiesSaved END), 0) as value';
					break;
				case "FTP":
					// Fantasy points - get from Player node
					returnClause = "RETURN p.playerName as playerName, coalesce(p.fantasyPoints, 0) as value";
					break;
				case "AllGSC":
				case "totalGoals":
					// All goals (open play + penalties) - default for "goals" questions
					returnClause = `
						RETURN p.playerName as playerName, 
						       COALESCE(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) + 
						       COALESCE(sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END), 0) as value`;
					break;
				case "penaltyRecord":
				case "penaltiesTaken":
				case "penaltyConversion":
					// Total penalties taken (scored + missed) with conversion rate
					returnClause = `
						RETURN p.playerName as playerName, 
						       COALESCE(sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END), 0) + 
						       COALESCE(sum(CASE WHEN md.penaltiesMissed IS NULL OR md.penaltiesMissed = "" THEN 0 ELSE md.penaltiesMissed END), 0) as totalTaken,
						       COALESCE(sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END), 0) as scored,
						       COALESCE(sum(CASE WHEN md.penaltiesMissed IS NULL OR md.penaltiesMissed = "" THEN 0 ELSE md.penaltiesMissed END), 0) as missed`;
					break;
				case "points":
					// Context-aware points - default to Fantasy Points for individual players
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.fantasyPoints IS NULL OR md.fantasyPoints = "" THEN 0 ELSE md.fantasyPoints END), 0) as value';
					break;
				case "GperAPP":
					// Goals per appearance - get from Player node (try both property names for compatibility)
					returnClause = "RETURN p.playerName as playerName, coalesce(p.goalsPerApp, p.GperAPP, 0) as value";
					break;
				case "CperAPP":
					// Conceded per appearance - get from Player node (try both property names for compatibility)
					returnClause = "RETURN p.playerName as playerName, coalesce(p.concededPerApp, p.CperAPP, 0) as value";
					break;
				case "MperG":
					// Minutes per goal - get from Player node (try both property names for compatibility)
					// If stored value is 0 or missing, calculate from minutes and goals
					returnClause = `
						RETURN p.playerName as playerName, 
						       CASE 
						         WHEN coalesce(p.minutesPerGoal, p.MperG, 0) > 0 THEN coalesce(p.minutesPerGoal, p.MperG, 0)
						         ELSE CASE 
						           WHEN coalesce(p.goals, 0) > 0 THEN coalesce(p.minutes, 0) / coalesce(p.goals, 1)
						           ELSE 0
						         END
						       END as value`;
					break;
				case "MperCLS":
					// Minutes per clean sheet - get from Player node (try both property names for compatibility)
					returnClause = "RETURN p.playerName as playerName, coalesce(p.minutesPerCleanSheet, p.MperCLS, 0) as value";
					break;
				case "FTPperAPP":
					// Fantasy points per appearance - get from Player node (try both property names for compatibility)
					returnClause = "RETURN p.playerName as playerName, coalesce(p.fantasyPointsPerApp, p.FTPperAPP, 0) as value";
					break;
				case "DIST":
					// Distance - get from Player node (try both property names for compatibility)
					returnClause = "RETURN p.playerName as playerName, coalesce(p.distance, p.DIST, 0) as value";
					break;
				case "HomeGames":
					// Home games - get from Player node
					returnClause = "RETURN p.playerName as playerName, coalesce(p.homeGames, 0) as value";
					break;
				case "AwayGames":
					// Away games - get from Player node
					returnClause = "RETURN p.playerName as playerName, coalesce(p.awayGames, 0) as value";
					break;
				case "HomeWins":
					// Home wins - get from Player node
					returnClause = "RETURN p.playerName as playerName, coalesce(p.homeWins, 0) as value";
					break;
				case "AwayWins":
					// Away wins - get from Player node
					returnClause = "RETURN p.playerName as playerName, coalesce(p.awayWins, 0) as value";
					break;
				case "HomeGames%Won":
					// Home games percentage won - get from Player node
					returnClause = "RETURN p.playerName as playerName, coalesce(p.homeGamesPercentWon, 0) as value";
					break;
				case "AwayGames%Won":
					// Away games percentage won - get from Player node
					returnClause = "RETURN p.playerName as playerName, coalesce(p.awayGamesPercentWon, 0) as value";
					break;
				case "Games%Won":
					// Games percentage won - get from Player node
					returnClause = "RETURN p.playerName as playerName, coalesce(p.gamesPercentWon, 0) as value";
					break;
				default:
					returnClause = "RETURN p.playerName as playerName, count(md) as value";
			}

			query += " " + returnClause;
			this.logToBoth(`🔍 Final Cypher query: ${query}`);

			try {
				// Create case-insensitive name variations for matching
				const playerNameLower = String(playerName).toLowerCase();
				const playerNameHyphen = String(playerName).toLowerCase().replace(/\s+/g, "-");

				this.logToBoth(`🔍 Query parameters: playerName=${playerName}, playerNameLower=${playerNameLower}, playerNameHyphen=${playerNameHyphen}`);

				const result = await neo4jService.executeQuery(query, {
					playerName,
					playerNameLower,
					playerNameHyphen,
				});

				this.logToBoth(`🔍 Player query result for ${playerName}:`, result);
				this.logToBoth(`🔍 Result type: ${typeof result}, length: ${Array.isArray(result) ? result.length : "not array"}`);

				if (result && Array.isArray(result) && result.length > 0) {
					this.logToBoth(`🔍 First result item:`, result[0]);
				} else {
					// Diagnostic: Let's see what players actually exist in the database
					this.logToBoth(`🔍 No results found for ${playerName}. Running diagnostic query...`);
					const diagnosticQuery = `
						MATCH (p:Player)
						RETURN p.playerName as playerName
						ORDER BY p.playerName
						LIMIT 20
					`;
					const diagnosticResult = await neo4jService.executeQuery(diagnosticQuery);
					this.logToBoth(
						`🔍 Diagnostic: Found ${diagnosticResult.length} players in database:`,
						diagnosticResult.map((p) => p.playerName),
					);

					// Also check if there are any players with similar names
					const similarQuery = `
						MATCH (p:Player)
						WHERE p.playerName CONTAINS 'Luke' OR p.playerName CONTAINS 'Bangs' OR p.playerName CONTAINS 'luke' OR p.playerName CONTAINS 'bangs'
						RETURN p.playerName as playerName
						ORDER BY p.playerName
					`;
					const similarResult = await neo4jService.executeQuery(similarQuery);
					this.logToBoth(
						`🔍 Similar names found:`,
						similarResult.map((p) => p.playerName),
					);

					// Check if Luke Bangs has any relationships at all
					const relationshipQuery = `
						MATCH (p:Player {playerName: $playerName})
						OPTIONAL MATCH (p)-[r]->(n)
						RETURN p.playerName as playerName, type(r) as relationshipType, labels(n) as nodeLabels, n.name as nodeName
						ORDER BY type(r)
					`;
					const relationshipResult = await neo4jService.executeQuery(relationshipQuery, { playerName });
					this.logToBoth(`🔍 Relationships for ${playerName}:`, relationshipResult);

					// Check if there are any MatchDetail nodes at all
					const matchDetailQuery = `
						MATCH (md:MatchDetail)
						RETURN count(md) as totalMatchDetails
						LIMIT 1
					`;
					const matchDetailResult = await neo4jService.executeQuery(matchDetailQuery);
					this.logToBoth(`🔍 Total MatchDetail nodes:`, matchDetailResult);

					// Check if there are any MatchDetail nodes without graphLabel
					const noLabelQuery = `
						MATCH (md:MatchDetail)
						WHERE md.graphLabel IS NULL
						RETURN count(md) as noLabelMatchDetails
						LIMIT 1
					`;
					const noLabelResult = await neo4jService.executeQuery(noLabelQuery);
					this.logToBoth(`🔍 MatchDetail nodes without graphLabel:`, noLabelResult);
				}

				return { type: "specific_player", data: result, playerName, metric };
			} catch (error) {
				this.logToBoth("❌ Error querying specific player data:", error, 'error');
				return null;
			}
		}

		this.logToBoth(`🔍 No specific player query, falling back to general player query`);

		// Fallback to general player query
		const query = `
      MATCH (p:Player)
      WHERE p.playerName IS NOT NULL
      RETURN p.playerName as name, p.id as source
      LIMIT 50
    `;

		const result = await neo4jService.executeQuery(query);
		console.log(`🔍 General player query result:`, result);
		return { type: "general_players", data: result };
	}

	private async queryTeamSpecificPlayerData(teamNumber: string, metric: string): Promise<any> {
		this.logToBoth(`🔍 queryTeamSpecificPlayerData called with teamNumber: "${teamNumber}", metric: "${metric}"`);

		// Enhanced team name normalization using Natural library
		const teamName = this.normalizeTeamName(teamNumber);
		this.logToBoth(`🔍 Looking for team: "${teamName}"`);
		
		// Log the team normalization process for debugging
		this.logToBoth(`🔍 Team normalization analysis:`, {
			original: teamNumber,
			normalized: teamName,
			normalizationMethod: this.getNormalizationMethod(teamNumber, teamName)
		});

		// First, let's check what teams actually exist in the MatchDetail data
		this.logToBoth(`🔍 Running diagnostic query to see available teams...`);
		const diagnosticQuery = `
			MATCH (md:MatchDetail)
			WHERE md.team IS NOT NULL
			RETURN DISTINCT md.team as teamName
			ORDER BY md.team
		`;
		
		// Log the diagnostic query for client-side debugging
		console.log(`🤖 [CLIENT] 🔍 DIAGNOSTIC CYPHER QUERY:`, diagnosticQuery);
		
		// Store query for debugging
		this.lastExecutedQueries.push(`DIAGNOSTIC: ${diagnosticQuery}`);
		
		try {
			this.logToBoth(`🔍 Executing diagnostic query:`, diagnosticQuery);
			const diagnosticResult = await neo4jService.executeQuery(diagnosticQuery);
			this.logToBoth(`🔍 Diagnostic query raw result:`, diagnosticResult);
			this.logToBoth(`🔍 Available teams in MatchDetail data:`, diagnosticResult.map(r => r.teamName));
			
			// Check if our target team exists
			const teamExists = diagnosticResult.some(r => r.teamName === teamName);
			this.logToBoth(`🔍 Team "${teamName}" exists: ${teamExists}`);
			
			if (!teamExists) {
				this.logToBoth(`🔍 Team "${teamName}" not found. Available teams:`, diagnosticResult.map(r => r.teamName));
				this.logToBoth(`🔍 Returning team_not_found response`);
				return { 
					type: "team_not_found", 
					data: [], 
					teamName, 
					metric,
					availableTeams: diagnosticResult.map(r => r.teamName),
					message: `Team "${teamName}" not found. Available teams: ${diagnosticResult.map(r => r.teamName).join(', ')}`
				};
			}
		} catch (error: any) {
			this.logToBoth(`❌ Diagnostic query failed:`, error, 'error');
		}

		// Now build the actual query using the correct data structure
		// We'll query MatchDetail nodes directly, filtering by team property AND player context
		const query = `
			MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
			WHERE md.team = $teamName
			WITH p, md
			RETURN p.playerName as playerName, 
				   sum(CASE WHEN md.${this.getMetricField(metric)} IS NOT NULL AND md.${this.getMetricField(metric)} <> "" THEN toInteger(md.${this.getMetricField(metric)}) ELSE 0 END) as value,
				   count(md) as appearances
		`;

		// Create detailed query breakdown for debugging
		const queryBreakdown = {
			playerName: this.lastQueryBreakdown?.playerName || 'Unknown',
			team: teamName,
			statEntity: metric,
			metricField: this.getMetricField(metric),
			fullCypherQuery: query,
			queryParameters: { teamName, metric, metricField: this.getMetricField(metric) },
			queryExplanation: `Querying MatchDetail nodes for team "${teamName}" to find players with highest ${metric} (${this.getMetricField(metric)})`
		};
		
		// Update the query breakdown with the actual query details
		this.lastQueryBreakdown = { ...this.lastQueryBreakdown, ...queryBreakdown };

		this.logToBoth(`🔍 Final team-specific query:`, query);
		this.logToBoth(`🔍 Query parameters: teamName=${teamName}, metric=${metric}, metricField=${this.getMetricField(metric)}`);
		this.logToBoth(`🔍 Query breakdown:`, queryBreakdown);
		
		// Log the main Cypher query for client-side debugging
		console.log(`🤖 [CLIENT] 🔍 MAIN TEAM-SPECIFIC CYPHER QUERY:`, query);
		console.log(`🤖 [CLIENT] 🔍 Query parameters:`, { teamName, metric, metricField: this.getMetricField(metric) });
		console.log(`🤖 [CLIENT] 🔍 QUERY BREAKDOWN:`, queryBreakdown);
		
		// Store query for debugging
		this.lastExecutedQueries.push(`MAIN: ${query}`);
		this.lastExecutedQueries.push(`PARAMS: ${JSON.stringify({ teamName, metric, metricField: this.getMetricField(metric) })}`);
		this.lastExecutedQueries.push(`BREAKDOWN: ${JSON.stringify(queryBreakdown)}`);

		try {
			// Get the player name from the query breakdown context
			const playerName = this.lastQueryBreakdown?.playerName || 'Unknown';
			
			const result = await neo4jService.executeQuery(query, { teamName, playerName });
			this.logToBoth(`🔍 Team-specific query result:`, result);
			
			if (result && result.length > 0) {
				this.logToBoth(`🔍 Found ${result.length} results for ${playerName} in team ${teamName}`);
				return { type: "team_specific", data: result, teamName, metric, playerName };
			} else {
				this.logToBoth(`🔍 No results found for ${playerName} in team ${teamName}`);
				return { type: "team_specific", data: [], teamName, metric, playerName, message: `No results found for ${playerName} in team ${teamName}` };
			}
		} catch (error: any) {
			this.logToBoth(`❌ Error querying team-specific player data:`, error, 'error');
			return { type: "error", data: [], teamName, metric, error: error.message };
		}
	}

	private getMetricField(metric: string): string {
		const fieldMap: { [key: string]: string } = {
			G: "goals",
			A: "assists",
			APP: "appearances",
			MIN: "minutes",
			MOM: "mom",
			Y: "yellowCard",
			R: "redCard",
			SAVES: "saves",
			OG: "ownGoals",
			C: "conceded",
			CLS: "cleanSheet",
			PSC: "penaltiesScored",
			PM: "penaltiesMissed",
			PCO: "penaltiesConceded",
			PSV: "penaltiesSaved",
			FTP: "fantasyPoints",
		};
		return fieldMap[metric] || "goals";
	}

	/**
	 * Enhanced team name normalization using Natural library for fuzzy matching
	 * Handles various team name formats: "3rd", "3s", "Thirds", "3", etc.
	 */
	private normalizeTeamName(input: string): string {
		const lowerInput = input.toLowerCase().trim();
		
		// Direct ordinal matches
		const ordinalMatch = lowerInput.match(/^(\d+)(?:st|nd|rd|th)?$/);
		if (ordinalMatch) {
			const number = parseInt(ordinalMatch[1]);
			const suffix = this.getOrdinalSuffix(number);
			return `${number}${suffix} XI`;
		}

		// Abbreviated forms like "3s", "2s"
		const abbreviatedMatch = lowerInput.match(/^(\d+)s?$/);
		if (abbreviatedMatch) {
			const number = parseInt(abbreviatedMatch[1]);
			const suffix = this.getOrdinalSuffix(number);
			return `${number}${suffix} XI`;
		}

		// Word-based forms like "Thirds", "Seconds", "Firsts"
		const wordForms: { [key: string]: string } = {
			'first': '1st XI',
			'firsts': '1st XI',
			'second': '2nd XI',
			'seconds': '2nd XI',
			'third': '3rd XI',
			'thirds': '3rd XI',
			'fourth': '4th XI',
			'fourths': '4th XI',
			'fifth': '5th XI',
			'fifths': '5th XI',
			'sixth': '6th XI',
			'sixths': '6th XI',
			'seventh': '7th XI',
			'sevenths': '7th XI',
			'eighth': '8th XI',
			'eighths': '8th XI',
			'vets': 'Vets XI',
			'veterans': 'Vets XI'
		};

		if (wordForms[lowerInput]) {
			return wordForms[lowerInput];
		}

		// Fuzzy matching for close matches
		const teamNames = Object.keys(wordForms);
		const bestMatch = teamNames.reduce((best, current) => {
			const distance = natural.JaroWinklerDistance(lowerInput, current);
			return distance > best.score ? { name: current, score: distance } : best;
		}, { name: '', score: 0 });

		// If we have a good fuzzy match (threshold: 0.8)
		if (bestMatch.score > 0.8) {
			return wordForms[bestMatch.name];
		}

		// Fallback: try to extract number and convert to ordinal
		const numberMatch = lowerInput.match(/\d+/);
		if (numberMatch) {
			const number = parseInt(numberMatch[0]);
			const suffix = this.getOrdinalSuffix(number);
			return `${number}${suffix} XI`;
		}

		// Final fallback: return as-is with XI suffix
		return `${input} XI`;
	}

	/**
	 * Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
	 */
	private getOrdinalSuffix(num: number): string {
		const j = num % 10;
		const k = num % 100;
		if (j === 1 && k !== 11) return 'st';
		if (j === 2 && k !== 12) return 'nd';
		if (j === 3 && k !== 13) return 'rd';
		return 'th';
	}

	/**
	 * Check if the question is about a specific team
	 */
	private isTeamQuestion(question: string): boolean {
		const lowerQuestion = question.toLowerCase();
		
		// Team-related keywords
		const teamKeywords = [
			'team', 's', 'st', 'nd', 'rd', 'th',
			'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth',
			'firsts', 'seconds', 'thirds', 'fourths', 'fifths', 'sixths', 'sevenths', 'eighths',
			'vets', 'veterans'
		];
		
		return teamKeywords.some(keyword => lowerQuestion.includes(keyword));
	}

	/**
	 * Extract team entity using Compromise for better NLP parsing
	 */
	private extractTeamEntity(question: string): string | null {
		// Use Compromise to parse the question
		const doc = nlp(question);
		
		// Look for numbers
		const numbers = doc.numbers().out('array');
		
		// Look for team-related words
		const teamWords = doc.match('(first|second|third|fourth|fifth|sixth|seventh|eighth|vets|veterans)').out('array');
		
		// Priority 1: Team words (e.g., "thirds", "seconds")
		if (teamWords.length > 0) {
			return teamWords[0];
		}
		
		// Priority 2: Numbers followed by 's' or 'team' (e.g., "3s", "3 team")
		if (numbers.length > 0) {
			const number = numbers[0];
			const afterNumber = question.substring(question.indexOf(number) + number.length).trim();
			
			// Check if followed by 's', 'team', or space
			if (afterNumber.startsWith('s') || afterNumber.startsWith(' team') || afterNumber.startsWith(' ')) {
				return number;
			}
		}
		
		// Priority 3: Regex fallback for complex patterns
		const patterns = [
			/(\d+(?:st|nd|rd|th)?)\s*team/,           // "3rd team"
			/for the (\d+(?:st|nd|rd|th)?)\s*team/,   // "for the 3rd team"
			/(\d+)s/,                                  // "3s"
			/for the (\d+)s/,                          // "for the 3s"
			/for the (\d+)/,                           // "for the 3"
			/(\d+)\s*team/                             // "3 team"
		];
		
		for (const pattern of patterns) {
			const match = question.match(pattern);
			if (match) {
				return match[1];
			}
		}
		
		return null;
	}

	/**
	 * Get the method used for team name normalization (for debugging)
	 */
	private getNormalizationMethod(original: string, normalized: string): string {
		const lowerOriginal = original.toLowerCase().trim();
		
		if (lowerOriginal.match(/^\d+(?:st|nd|rd|th)?$/)) return 'ordinal_match';
		if (lowerOriginal.match(/^\d+s?$/)) return 'abbreviated_match';
		if (['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'vets', 'veterans'].includes(lowerOriginal)) return 'word_form_match';
		if (natural.JaroWinklerDistance(lowerOriginal, 'third') > 0.8) return 'fuzzy_match';
		if (lowerOriginal.match(/\d+/)) return 'number_extraction';
		
		return 'fallback';
	}

	private async queryTeamData(entities: string[], metrics: string[]): Promise<any> {
		const query = `
      MATCH (t:Team)
      RETURN t.name as name, t.league as league
      LIMIT 20
    `;

		const result = await neo4jService.executeQuery(query);
		return result;
	}

	private async queryClubData(entities: string[], metrics: string[]): Promise<any> {
		const query = `
      MATCH (c:Club)
      RETURN c.name as name, c.captain as captain, c.awards as awards
      LIMIT 10
    `;

		const result = await neo4jService.executeQuery(query);
		return result;
	}

	private async queryFixtureData(entities: string[], metrics: string[]): Promise<any> {
		const query = `
      MATCH (f:Fixture)
      RETURN f.team as homeTeam, f.opposition as awayTeam, f.date as date, f.result as score
      ORDER BY f.date DESC
      LIMIT 20
    `;

		const result = await neo4jService.executeQuery(query);
		return result;
	}

	private async queryComparisonData(entities: string[], metrics: string[]): Promise<any> {
		const query = `
      MATCH (p:Player)
      WHERE p.playerName IS NOT NULL
      RETURN p.playerName as name, p.mostPlayedForTeam as team, p.id as goals, p.id as assists
      ORDER BY p.id DESC
      LIMIT 10
    `;

		const result = await neo4jService.executeQuery(query);
		return result;
	}

	private async queryStreakData(entities: string[], metrics: string[]): Promise<any> {
		if (entities.length === 0) {
			return { type: "no_context", data: [], message: "No player context provided" };
		}

		const playerName = entities[0];
		const query = `
			MATCH (p:Player {playerName: $playerName})
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail)
			WHERE md.date IS NOT NULL
			WITH p, md
			ORDER BY md.date ASC
			WITH p, collect(md.date) as dates
			WITH p, dates, [i in range(0, size(dates)-1) | 
				CASE 
					WHEN i = 0 THEN 1
					WHEN date(dates[i]) = date(dates[i-1]) + duration({days: 1}) THEN 1
					ELSE 0
				END
			] as consecutiveFlags
			WITH p, dates, consecutiveFlags, 
				reduce(s = [], x in consecutiveFlags | 
					CASE 
						WHEN x = 1 THEN s + [1]
						ELSE [1]
					END
				) as streakLengths
			RETURN p.playerName as playerName, 
				   max([length in streakLengths | length]) as longestStreak,
				   size(dates) as totalGames
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName });
			return { type: "streak", data: result, playerName };
		} catch (error) {
			console.error("❌ Error querying streak data:", error);
			return null;
		}
	}

	private async queryDoubleGameData(entities: string[], metrics: string[]): Promise<any> {
		if (entities.length === 0) {
			return { type: "no_context", data: [], message: "No player context provided" };
		}

		const playerName = entities[0];
		const query = `
			MATCH (p:Player {playerName: $playerName})
			MATCH (p)-[:PLAYED_IN]->(md:MatchDetail)
			WHERE md.date IS NOT NULL
			WITH p, md.date as gameDate, count(md) as gamesOnDate
			WHERE gamesOnDate > 1
			RETURN p.playerName as playerName, 
				   count(DISTINCT gameDate) as doubleGameWeeks,
				   collect(DISTINCT gameDate) as doubleGameDates
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName });
			return { type: "double_game", data: result, playerName };
		} catch (error) {
			console.error("❌ Error querying double game data:", error);
			return null;
		}
	}

	private async queryGeneralData(): Promise<any> {
		// Query for general information about the database
		const query = `
      MATCH (p:Player)
      WHERE p.playerName IS NOT NULL
      RETURN count(p) as playerCount
    `;

		const result = await neo4jService.executeQuery(query);
		return result;
	}

	private async generateResponse(question: string, data: any, analysis: any): Promise<ChatbotResponse> {
		this.logToBoth(`🔍 generateResponse called with:`, {
			question,
			dataType: data?.type,
			dataKeys: data ? Object.keys(data) : 'null',
			analysisType: analysis?.type,
			analysisEntities: analysis?.entities
		});
		
		let answer = "";
		let visualization: ChatbotResponse["visualization"] = undefined;

		if (!data || data.length === 0) {
			// Check if this is a player question without context
			if (
				analysis.type === "player" &&
				analysis.entities.length === 0 &&
				(question.toLowerCase().includes("i") ||
					question.toLowerCase().includes("i've") ||
					question.toLowerCase().includes("i have") ||
					question.toLowerCase().includes("me"))
			) {
				answer = "I don't know who you're asking about. Please select a player from the dropdown or specify a player name in your question.";
			} else {
				answer =
					"I couldn't find any relevant information to answer your question about the club. This might be because the club records haven't been updated yet.";
			}
			return {
				answer,
				sources: [], // Always hide technical sources
				visualization,
			};
		}

		// Handle different types of questions with strict club-focused responses
		if (analysis.type === "player") {
			// Check if this is a no-context case
			if (data && data.type === "no_context") {
				answer = "I don't know who you're asking about. Please select a player from the dropdown or specify a player name in your question.";
			} else if (data && data.type === "specific_player" && data.data && data.data.length > 0) {
				const playerData = data.data[0];
				const playerName = data.playerName;
				const metric = data.metric;
				const value = playerData.value;

				// Get appearances for context (excluding appearances themselves)
				let appearancesContext = "";
				if (metric !== "APP") {
					try {
						const appearancesQuery = `
							MATCH (p:Player {playerName: $playerName})-[:PLAYED_IN]->(md:MatchDetail)
							RETURN count(md) as appearances
						`;
						const appearancesResult = await neo4jService.executeQuery(appearancesQuery, { playerName });
						if (appearancesResult && appearancesResult.length > 0) {
							const appearances = appearancesResult[0].appearances;
							appearancesContext = ` in ${appearances} appearance${appearances !== 1 ? 's' : ''}`;
						}
					} catch (error) {
						this.logToBoth(`⚠️ Could not fetch appearances for ${playerName}:`, error);
					}
				}

				// Enhanced handling for special metrics FIRST (before template system)
				if (metric === "penaltyRecord" || metric === "penaltiesTaken" || metric === "penaltyConversion") {
					// Handle penalty record with conversion rate
					if (playerData.totalTaken !== undefined && playerData.scored !== undefined && playerData.missed !== undefined) {
						const totalTaken = playerData.totalTaken;
						const scored = playerData.scored;
						const missed = playerData.missed;
						const conversionRate = totalTaken > 0 ? Math.round((scored / totalTaken) * 100) : 0;
						
						answer = `${playerName} has taken ${totalTaken} penalties, scoring ${scored} and missing ${missed}. This gives a conversion rate of ${conversionRate}%.`;
					} else {
						answer = `${playerName} has not taken any penalties yet.`;
					}
				} else {
					// Round values for specific metrics
					let roundedValue = value;
					if (metric === "FTP") {
						roundedValue = Math.round(value); // Round fantasy points to nearest integer
					} else if (metric === "GperAPP" || metric === "CperAPP" || metric === "FTPperAPP") {
						roundedValue = Math.round(value * 100) / 100; // Round to 2 decimal places
					} else if (metric === "MperG" || metric === "MperCLS") {
						roundedValue = Math.round(value); // Round minutes per goal/clean sheet to nearest integer
					} else if (metric === "DIST") {
						roundedValue = Math.round(value); // Round distance to nearest integer
					}
					
					// Format value with commas for thousands
					let formattedValue = roundedValue;
					if (metric === "MIN" || metric === "DIST") {
						formattedValue = roundedValue.toLocaleString();
					}
					
					// Use natural language response generation with appearances context for regular metrics
					const metricName = getMetricDisplayName(metric, roundedValue);
					
					// Get appearances count for template
					let appearancesCount: number | undefined;
					if (appearancesContext) {
						const match = appearancesContext.match(/in (\d+) appearance/);
						if (match) {
							appearancesCount = parseInt(match[1]);
						}
					}
					
					// Choose appropriate template based on metric type
					let template: any = null;
					
					if (metric === "MperG") {
						// Special handling for MperG - handle case where player hasn't scored
						if (roundedValue === 0) {
							answer = `${playerName} hasn't scored any goals yet, so we can't calculate minutes per goal.`;
							return { answer, sources: [], visualization };
						} else {
							template = getResponseTemplate('player_stats', 'Minutes per goal');
						}
					} else if (metric === "MperCLS") {
						template = getResponseTemplate('player_stats', 'Minutes per clean sheet');
					} else if (metric === "DIST") {
						template = getResponseTemplate('player_stats', 'Distance travelled');
					} else if (metric === "GperAPP" || metric === "CperAPP" || metric === "FTPperAPP") {
						template = getResponseTemplate('player_stats', 'Per appearance statistics');
					} else if (metric === "HomeGames" || metric === "AwayGames") {
						// Special handling for home/away games - no appearances context needed
						answer = `${playerName} has played ${formattedValue} ${metricName}.`;
						return { answer, sources: [], visualization };
					} else if (metric === "HomeWins" || metric === "AwayWins") {
						// Special handling for home/away wins - no appearances context needed
						answer = `${playerName} has won ${formattedValue} ${metricName}.`;
						return { answer, sources: [], visualization };
					} else if (metric === "HomeGames%Won" || metric === "AwayGames%Won") {
						// Special handling for home/away games percentage won
						answer = `${playerName} has won ${formattedValue}% of ${metricName.replace('%', '')}.`;
						return { answer, sources: [], visualization };
					} else if (metric === "Games%Won" && appearancesCount) {
						// Special handling for overall games percentage won - include appearances context
						answer = `${playerName} has won ${formattedValue}% of the ${appearancesCount} games he has played in.`;
						return { answer, sources: [], visualization };
					} else if (appearancesCount) {
						// Alternate between "appearances" and "matches" for variety
						const useMatches = Math.random() < 0.5;
						if (useMatches) {
							// Use a custom template with "matches" instead of "appearances"
							answer = `${playerName} has ${getAppropriateVerb(metric, roundedValue)} ${formattedValue} ${metricName} in ${appearancesCount} matches.`;
							return { answer, sources: [], visualization };
						} else {
							template = getResponseTemplate('player_stats', 'Player statistics with appearances context');
						}
					} else {
						template = getResponseTemplate('player_stats', 'Basic player statistics');
					}
					
					if (template) {
						answer = formatNaturalResponse(
							template.template,
							playerName,
							metric,
							formattedValue,
							metricName,
							undefined, // teamName
							appearancesCount
						);
					} else {
						// Fallback to simple format with appearances
						answer = `${playerName} has ${getAppropriateVerb(metric, roundedValue)} ${formattedValue} ${metricName}${appearancesContext}.`;
					}
				}
				
				// Enhanced handling for special metrics
				if (metric === "AllGSC" || metric === "totalGoals") {
					// Clarify that this includes both open play and penalty goals
					answer = answer.replace('.', ' (including both open play and penalty goals).');
				} else if (metric === "points") {
					// Clarify that this refers to Fantasy Points
					answer = answer.replace('.', ' (Fantasy Points).');
				}
				
				// Enhanced year vs season clarification
				const questionLower = question.toLowerCase();
				if (questionLower.includes("2021") || questionLower.includes("2022") || questionLower.includes("2020") || 
					questionLower.includes("2019") || questionLower.includes("2018") || questionLower.includes("2017") || 
					questionLower.includes("2016")) {
					// Check if this is a season reference
					const seasonPattern = /(20\d{2})[\/\-](20\d{2}|2\d)/;
					const seasonMatch = question.match(seasonPattern);
					if (seasonMatch) {
						// This is a season reference - clarify in response
						const season = seasonMatch[0];
						answer = answer.replace('.', ` for the ${season} season.`);
					} else {
						// This is a calendar year reference - clarify in response
						const yearMatch = question.match(/(20\d{2})/);
						if (yearMatch) {
							const year = yearMatch[1];
							answer = answer.replace('.', ` in calendar year ${year}.`);
						}
					}
				}
			} else if (data && data.type === "team_specific" && data.data && data.data.length > 0) {
				// Team-specific query (e.g., "3rd team goals")
				const teamName = data.teamName;
				const metric = data.metric;
				const topPlayer = data.data[0];
				const metricName = getMetricDisplayName(metric, topPlayer.value);

				// Check if user asked for "the most" or similar superlative terms
				const questionLower = question.toLowerCase();
				const usesSuperlative = questionLower.includes("the most") || 
					questionLower.includes("highest") || 
					questionLower.includes("best") || 
					questionLower.includes("top");
				
				if (usesSuperlative) {
					// Use comparison template for superlative questions
					const template = getResponseTemplate('comparison', 'Player comparison (highest)');
					if (template) {
						answer = formatNaturalResponse(
							template.template,
							topPlayer.playerName,
							metric,
							topPlayer.value,
							metricName,
							teamName
						);
						// Replace team context since comparison template doesn't have it
						answer = `For the ${teamName}, ${answer}`;
					} else {
						answer = `For the ${teamName}, ${topPlayer.playerName} has scored the most ${metricName} with ${topPlayer.value}.`;
					}
				} else {
					// Use team-specific template for regular questions
					const template = getResponseTemplate('team_specific', 'Team-specific player statistics');
					if (template) {
						answer = formatNaturalResponse(
							template.template,
							topPlayer.playerName,
							metric,
							topPlayer.value,
							metricName,
							teamName
						);
						// Add appearances context if available and not appearances themselves
						if (metric !== "APP" && topPlayer.appearances) {
							answer = answer.replace('.', ` in ${topPlayer.appearances} appearance${topPlayer.appearances !== 1 ? 's' : ''}.`);
						}
					} else {
						// Add appearances context if available and not appearances themselves
						let appearancesContext = "";
						if (metric !== "APP" && topPlayer.appearances) {
							appearancesContext = ` in ${topPlayer.appearances} appearance${topPlayer.appearances !== 1 ? 's' : ''}`;
						}
						answer = `For the ${teamName}, ${topPlayer.playerName} has ${getAppropriateVerb(metric, topPlayer.value)} ${topPlayer.value} ${metricName}${appearancesContext}.`;
					}
				}

				// Sanitize data for visualization to prevent React errors
				const sanitizedData = data.data.map((item: any) => ({
					playerName: String(item.playerName || 'Unknown'),
					value: Number(item.value || 0),
					appearances: Number(item.appearances || 0)
				}));
				
				visualization = {
					type: "table",
					data: sanitizedData,
					config: { columns: ["playerName", "value", "appearances"] },
				};
			} else if (data && data.type === "team_not_found") {
				// Team not found - provide helpful information
				this.logToBoth(`🔍 Handling team_not_found case:`, data);
				answer = `I couldn't find the team "${data.teamName}". Available teams are: ${data.availableTeams.join(', ')}.`;
			} else if (data && data.type === "error") {
				// Error occurred during query
				answer = `I encountered an error while looking up team information: ${data.error}.`;
			} else if (data && data.type === "general_players" && data.data && data.data.length > 0) {
				if (data.data[0].playerCount) {
					// General player count question
					answer = `The club currently has ${data.data[0].playerCount} registered players across all teams.`;
					visualization = {
						type: "stats",
						data: { playerCount: data.data[0].playerCount },
						config: { title: "Total Players" },
					};
				} else if (data.data[0].name) {
					// Specific player data - MAX 14 players as per rules
					const maxPlayers = Math.min(data.data.length, 14);
					const playerNames = data.data
						.slice(0, maxPlayers)
						.map((p: any) => p.name)
						.join(", ");
					answer = `I found ${data.data.length} players in the club. Here are some of our registered players: ${playerNames}${data.data.length > maxPlayers ? " and many more..." : ""}`;
					visualization = {
						type: "table",
						data: data.data.slice(0, maxPlayers),
						config: { columns: ["name"] },
					};
				}
			} else if (data && data.type === "totw_awards" && data.data && data.data.length > 0) {
				// TOTW awards query
				const totwData = data.data[0];
				const periodText = data.period === "weekly" ? "weekly" : "season";
				const starManText = totwData.starManAwards > 0 ? `, including ${totwData.starManAwards} star man awards` : "";
				answer = `${data.playerName} has been selected for ${totwData.totalAwards} ${periodText} team of the week selections${starManText}.`;

				// Create visualization with award details
				if (totwData.awardDetails && totwData.awardDetails.length > 0) {
					visualization = {
						type: "table",
						data: totwData.awardDetails,
						config: {
							columns: ["awardId", "isStarMan", "ftpScore", "position"],
							title: `${periodText.charAt(0).toUpperCase() + periodText.slice(1)} TOTW Awards`,
						},
					};
				}
			} else if (data && data.type === "potm_awards" && data.data && data.data.length > 0) {
				// Player of the Month awards query
				const potmData = data.data[0];
				answer = `${data.playerName} has won ${potmData.totalAwards} Player of the Month awards.`;

				// Create visualization with award details
				if (potmData.awardDetails && potmData.awardDetails.length > 0) {
					visualization = {
						type: "table",
						data: potmData.awardDetails,
						config: {
							columns: ["awardId", "position", "monthlyPoints"],
							title: "Player of the Month Awards",
						},
					};
				}
			} else if (data && data.type === "captain_awards" && data.data && data.data.length > 0) {
				// Captain awards query
				const captainData = data.data[0];
				answer = `${data.playerName} has won ${captainData.totalAwards} captain awards.`;

				// Create visualization with award details
				if (captainData.awardDetails && captainData.awardDetails.length > 0) {
					visualization = {
						type: "table",
						data: captainData.awardDetails,
						config: {
							columns: ["awardId", "season"],
							title: "Captain Awards",
						},
					};
				}
			} else if (data && data.type === "co_players" && data.data && data.data.length > 0) {
				// Co-players query
				const coPlayersData = data.data[0];
				if (coPlayersData.coPlayers && coPlayersData.coPlayers.length > 0) {
					const coPlayerNames = coPlayersData.coPlayers.map((cp: any) => cp.coPlayerName).join(", ");
					answer = `${data.playerName} has played with ${coPlayersData.coPlayers.length} different co-players: ${coPlayerNames}.`;

					visualization = {
						type: "table",
						data: coPlayersData.coPlayers,
						config: {
							columns: ["coPlayerName", "timesPlayedWith", "lastPlayedWith"],
							title: "Co-Players",
						},
					};
				} else {
					answer = `${data.playerName} hasn't played with any co-players yet.`;
				}
			} else if (data && data.type === "opponents" && data.data && data.data.length > 0) {
				// Opponents query
				const opponentsData = data.data[0];
				if (opponentsData.opponents && opponentsData.opponents.length > 0) {
					const opponentNames = opponentsData.opponents.map((opp: any) => opp.opponentName).join(", ");
					answer = `${data.playerName} has played against ${opponentsData.opponents.length} different opponents: ${opponentNames}.`;

					visualization = {
						type: "table",
						data: opponentsData.opponents,
						config: {
							columns: ["opponentName", "timesPlayedAgainst", "lastPlayedAgainst"],
							title: "Opponents",
						},
					};
				} else {
					answer = `${data.playerName} hasn't played against any opponents yet.`;
				}
			}
		} else if (analysis.type === "general") {
			if (data[0]?.playerCount) {
				answer = `The club maintains comprehensive records of ${data[0].playerCount} registered players across all our teams.`;
			} else {
				answer = `I found ${data.length} records in the club's information system.`;
			}
		} else if (analysis.type === "team") {
			answer = `I found information about ${data.length} teams within the club structure.`;
		} else if (analysis.type === "club") {
			answer = `I found club information including details about captains and awards.`;
		} else if (analysis.type === "fixture") {
			answer = `I found ${data.length} fixture records in the club's match history.`;
		} else if (analysis.type === "streak") {
			if (data && data.type === "no_context") {
				answer = "I don't know who you're asking about. Please select a player from the dropdown or specify a player name in your question.";
			} else if (data && data.type === "streak" && data.data && data.data.length > 0) {
				const streakData = data.data[0];
				answer = `${data.playerName} has played ${streakData.totalGames} games with a longest consecutive streak of ${streakData.longestStreak} games.`;
				visualization = {
					type: "stats",
					data: { longestStreak: streakData.longestStreak, totalGames: streakData.totalGames },
					config: { title: "Consecutive Streak" },
				};
			} else {
				answer = `I found ${data.length} player streak records.`;
			}
		} else if (analysis.type === "double_game") {
			if (data && data.type === "no_context") {
				answer = "I don't know who you're asking about. Please select a player from the dropdown or specify a player name in your question.";
			} else if (data && data.type === "double_game" && data.data && data.data.length > 0) {
				const doubleGameData = data.data[0];
				answer = `${data.playerName} has played in ${doubleGameData.doubleGameWeeks} double game weeks.`;
				visualization = {
					type: "stats",
					data: { doubleGameWeeks: doubleGameData.doubleGameWeeks },
					config: { title: "Double Game Weeks" },
				};
			} else {
				answer = `I found ${data.length} player double game week records.`;
			}
		}

		return {
			answer,
			sources: [], // Always hide technical sources as per mandatory rules
			visualization,
		};
	}

	// Enhanced query methods for new relationship properties
	private async queryPlayerTOTWData(playerName: string, period: "weekly" | "season"): Promise<any> {
		console.log(`🔍 Querying for TOTW awards for player: ${playerName}, period: ${period}`);
		const relationshipType = period === "weekly" ? "IN_WEEKLY_TOTW" : "IN_SEASON_TOTW";
		const query = `
			MATCH (p:Player {playerName: $playerName})
			MATCH (p)-[r:${relationshipType}]->(award)
			RETURN p.playerName as playerName, 
				   count(award) as totalAwards,
				   sum(CASE WHEN r.isStarMan THEN 1 ELSE 0 END) as starManAwards,
				   collect({
					   awardId: award.id,
					   isStarMan: r.isStarMan,
					   ftpScore: r.ftpScore,
					   position: r.position
				   }) as awardDetails
		`;
		try {
			const result = await neo4jService.executeQuery(query, { playerName });
			return { type: "totw_awards", data: result, playerName, period };
		} catch (error) {
			console.error("❌ Error querying TOTW awards:", error);
			return null;
		}
	}

	private async queryPlayerOfTheMonthData(playerName: string): Promise<any> {
		console.log(`🔍 Querying for Player of the Month awards for player: ${playerName}`);
		const query = `
			MATCH (p:Player {playerName: $playerName})
			MATCH (p)-[r:IN_PLAYER_OF_THE_MONTH]->(award)
			RETURN p.playerName as playerName, 
				   count(award) as totalAwards,
				   collect({
					   awardId: award.id,
					   position: r.position,
					   monthlyPoints: r.monthlyPoints
				   }) as awardDetails
		`;
		try {
			const result = await neo4jService.executeQuery(query, { playerName });
			return { type: "potm_awards", data: result, playerName };
		} catch (error) {
			console.error("❌ Error querying Player of the Month awards:", error);
			return null;
		}
	}

	private async queryPlayerCaptainAwardsData(playerName: string): Promise<any> {
		console.log(`🔍 Querying for Captain awards for player: ${playerName}`);
		const query = `
			MATCH (p:Player {playerName: $playerName})
			MATCH (p)-[r:HAS_CAPTAIN_AWARDS]->(award)
			RETURN p.playerName as playerName, 
				   count(award) as totalAwards,
				   collect({
					   awardId: award.id,
					   season: r.season
				   }) as awardDetails
		`;
		try {
			const result = await neo4jService.executeQuery(query, { playerName });
			return { type: "captain_awards", data: result, playerName };
		} catch (error) {
			console.error("❌ Error querying Captain awards:", error);
			return null;
		}
	}

	private async queryPlayerCoPlayersData(playerName: string): Promise<any> {
		console.log(`🔍 Querying for co-players for player: ${playerName}`);
		const query = `
			MATCH (p:Player {playerName: $playerName})
			MATCH (p)-[r:PLAYED_WITH]->(coPlayer:Player)
			RETURN p.playerName as playerName, 
				   collect({
					   coPlayerName: coPlayer.playerName,
					   timesPlayedWith: r.timesPlayedWith,
					   lastPlayedWith: r.lastPlayedWith
				   }) as coPlayers
		`;
		try {
			const result = await neo4jService.executeQuery(query, { playerName });
			return { type: "co_players", data: result, playerName };
		} catch (error) {
			console.error("❌ Error querying co-players:", error);
			return null;
		}
	}

	private async queryPlayerOpponentsData(playerName: string): Promise<any> {
		console.log(`🔍 Querying for opponents for player: ${playerName}`);
		const query = `
			MATCH (p:Player {playerName: $playerName})
			MATCH (p)-[r:PLAYED_AGAINST]->(opponent:OppositionDetail)
			RETURN p.playerName as playerName, 
				   collect({
					   opponentName: opponent.opposition,
					   timesPlayedAgainst: r.timesPlayedAgainst,
					   lastPlayedAgainst: r.lastPlayedAgainst
				   }) as opponents
		`;
		try {
			const result = await neo4jService.executeQuery(query, { playerName });
			return { type: "opponents", data: result, playerName };
		} catch (error) {
			console.error("❌ Error querying opponents:", error);
			return null;
		}
	}
	
	// Debug methods for exposing processing information
	public getQuestionAnalysis(question: string, userContext?: string): any {
		return this.lastQuestionAnalysis;
	}
	
	public getExecutedQueries(): string[] {
		return this.lastExecutedQueries;
	}
	
	public getProcessingSteps(): string[] {
		return this.lastProcessingSteps;
	}
	
	public getProcessingDetails(): any {
		return {
			questionAnalysis: this.lastQuestionAnalysis,
			cypherQueries: this.lastExecutedQueries,
			processingSteps: this.lastProcessingSteps,
			queryBreakdown: this.lastQueryBreakdown
		};
	}
}

export const chatbotService = ChatbotService.getInstance();
