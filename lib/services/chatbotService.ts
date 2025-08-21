import { neo4jService } from "@/lib/neo4j";
import { metricConfigs, findMetricByAlias, getMetricDisplayName } from "@/lib/config/chatbotMetrics";

export interface ChatbotResponse {
	answer: string;
	data?: any;
	visualization?: {
		type: "chart" | "table" | "calendar" | "stats";
		data: any;
		config?: any;
	};
	confidence: number;
	sources: string[];
}

export interface QuestionContext {
	question: string;
	userContext?: string;
	dataSources?: string[];
}

export class ChatbotService {
	private static instance: ChatbotService;

	static getInstance(): ChatbotService {
		if (!ChatbotService.instance) {
			ChatbotService.instance = new ChatbotService();
		}
		return ChatbotService.instance;
	}

	async processQuestion(context: QuestionContext): Promise<ChatbotResponse> {
		

		try {
			// Ensure Neo4j connection
			const connected = await neo4jService.connect();
			if (!connected) {
				return {
					answer: "I'm sorry, I'm unable to access the club's database at the moment. Please try again later.",
					confidence: 0,
					sources: [],
				};
			}

			// Analyze the question to determine what data we need
			const analysis = this.analyzeQuestion(context.question);

			// Query Neo4j for relevant data
			const data = await this.queryRelevantData(analysis);

			// Generate response based on data and question type
			const response = await this.generateResponse(context.question, data, analysis);

			console.log(` 🤖 Answer to question: ${response.answer}`);
			
			return response;
		} catch (error) {
			console.error("❌ Chatbot processing failed:", error);
			return {
				answer: "I'm sorry, I encountered an error while processing your question. Please try again.",
				confidence: 0,
				sources: [],
			};
		}
	}

	private analyzeQuestion(question: string): {
		type: "player" | "team" | "club" | "fixture" | "comparison" | "general";
		entities: string[];
		metrics: string[];
		timeRange?: string;
	} {
		const lowerQuestion = question.toLowerCase();

		// Determine question type
		let type: "player" | "team" | "club" | "fixture" | "comparison" | "general" = "general";

		if (lowerQuestion.includes("player") || lowerQuestion.includes("scored") || lowerQuestion.includes("goals") || 
			lowerQuestion.includes("assists") || lowerQuestion.includes("appearances") || lowerQuestion.includes("minutes") || 
			lowerQuestion.includes("man of the match") || lowerQuestion.includes("yellow") || lowerQuestion.includes("red") ||
			lowerQuestion.includes("saves") || lowerQuestion.includes("own goals") || lowerQuestion.includes("conceded") ||
			lowerQuestion.includes("clean sheets") || lowerQuestion.includes("penalties") || lowerQuestion.includes("fantasy")) {
			type = "player";
		} else if (lowerQuestion.includes("team") || lowerQuestion.includes("finish")) {
			type = "team";
		} else if (lowerQuestion.includes("club") || lowerQuestion.includes("captain")) {
			type = "club";
		} else if (lowerQuestion.includes("fixture") || lowerQuestion.includes("match")) {
			type = "fixture";
		} else if (lowerQuestion.includes("compare") || lowerQuestion.includes("vs")) {
			type = "comparison";
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
			playerNameMatch = question.match(/How many (?:goals|assists|appearances|minutes|man of the match awards?|yellow cards?|red cards?|saves?|own goals?|conceded goals?|clean sheets?|penalties scored?|penalties missed?|penalties conceded?|penalties saved?|fantasy points?) has (.*?) (?:scored|got|made|played|won|received|conceded|kept|missed|saved|earned|received|given|booked|cautioned|dismissed|sent off|let in|allowed|kept|converted|failed|gave away|stopped|earned|collected|accumulated)/);
			if (playerNameMatch) {
				entities.push(playerNameMatch[1].trim());
			}
		}
		
		// Pattern 2b: "How many penalties has Jonny Sourris missed?" (more natural format)
		if (entities.length === 0) {
			playerNameMatch = question.match(/How many (?:goals|assists|appearances|minutes|man of the match awards?|yellow cards?|red cards?|saves?|own goals?|conceded goals?|clean sheets?|penalties|fantasy points?) has (.*?) (?:scored|got|made|played|won|received|conceded|kept|missed|saved|earned|received|given|booked|cautioned|dismissed|sent off|let in|allowed|kept|converted|failed|gave away|stopped|earned|collected|accumulated)/);
			if (playerNameMatch) {
				entities.push(playerNameMatch[1].trim());
			}
		}
		
		// Pattern 3: "Luke Bangs goals" or "Luke Bangs appearances"
		if (entities.length === 0) {
			playerNameMatch = question.match(/^([A-Za-z\s]+) (?:goals|assists|appearances|minutes|man of the match|mom|yellow cards?|red cards?|saves?|own goals?|conceded|clean sheets?|penalties|fantasy points)/);
			if (playerNameMatch) {
				entities.push(playerNameMatch[1].trim());
			}
		}

		// Extract metrics using the configuration with context awareness
		const metrics: string[] = [];
		
		// Check for metric matches using aliases
		for (const config of metricConfigs) {
			const found = config.aliases.some(alias => 
				lowerQuestion.includes(alias.toLowerCase())
			) || lowerQuestion.includes(config.displayName.toLowerCase());
			
			if (found) {
				metrics.push(config.key);
				break; // Use first match found
			}
		}
		
		// Enhanced metric detection with context awareness
		if (metrics.length === 0) {
			// Check penalties first (more specific) before general goals
			if (lowerQuestion.includes("penalties")) {
				if (lowerQuestion.includes("missed") || lowerQuestion.includes("failed")) {
					metrics.push("PM"); // Penalties missed
				} else if (lowerQuestion.includes("conceded") || lowerQuestion.includes("gave away")) {
					metrics.push("PCO"); // Penalties conceded
				} else if (lowerQuestion.includes("saved") || lowerQuestion.includes("stopped")) {
					metrics.push("PSV"); // Penalties saved
				} else if (lowerQuestion.includes("scored") || lowerQuestion.includes("converted")) {
					metrics.push("PSC"); // Penalties scored
				} else {
					metrics.push("PSC"); // Default to penalties scored
				}
			} else if (lowerQuestion.includes("goals") && !lowerQuestion.includes("penalties")) {
				metrics.push("G");
			}
			
			if (lowerQuestion.includes("assists")) metrics.push("A");
			if (lowerQuestion.includes("clean sheets")) metrics.push("CLS");
			if (lowerQuestion.includes("games") || lowerQuestion.includes("appearances")) metrics.push("APP");
			if (lowerQuestion.includes("minutes")) metrics.push("MIN");
			if (lowerQuestion.includes("man of the match")) metrics.push("MOM");
			if (lowerQuestion.includes("yellow")) metrics.push("Y");
			if (lowerQuestion.includes("red")) metrics.push("R");
			if (lowerQuestion.includes("saves")) metrics.push("SAVES");
			if (lowerQuestion.includes("own goals")) metrics.push("OG");
			if (lowerQuestion.includes("conceded")) metrics.push("C");
			if (lowerQuestion.includes("fantasy")) metrics.push("FTP");
		}
		
		// Debug logging
		console.log(`Question analysis - Type: ${type}, Entities: ${entities}, Metrics: ${metrics}, Lower question: ${lowerQuestion}`);

		return { type, entities, metrics };
	}

	private async queryRelevantData(analysis: any): Promise<any> {
		const { type, entities, metrics } = analysis;

		try {
			switch (type) {
				case "player":
					return await this.queryPlayerData(entities, metrics);
				case "team":
					return await this.queryTeamData(entities, metrics);
				case "club":
					return await this.queryClubData(entities, metrics);
				case "fixture":
					return await this.queryFixtureData(entities, metrics);
				case "comparison":
					return await this.queryComparisonData(entities, metrics);
				default:
					return await this.queryGeneralData();
			}
		} catch (error) {
			console.error("❌ Data query failed:", error);
			return null;
		}
	}

	private async queryPlayerData(entities: string[], metrics: string[]): Promise<any> {
		// If we have a specific player name and metrics, query their stats
		if (entities.length > 0 && metrics.length > 0) {
			const playerName = entities[0];
			const metric = metrics[0];
			
			// Build query based on the metric requested
			let query = `
				MATCH (p:Player {name: $playerName, graphLabel: 'dorkiniansWebsite'})
				MATCH (p)-[:PERFORMED_IN]->(md:MatchDetail {graphLabel: 'dorkiniansWebsite'})
			`;
			
			let returnClause = '';
			switch (metric) {
				case 'APP':
					returnClause = 'RETURN p.name as playerName, count(md) as value';
					break;
				case 'MIN':
					returnClause = 'RETURN p.name as playerName, coalesce(sum(CASE WHEN md.minutes IS NULL OR md.minutes = "" THEN 0 ELSE md.minutes END), 0) as value';
					break;
				case 'G':
					returnClause = 'RETURN p.name as playerName, coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) as value';
					break;
				case 'A':
					returnClause = 'RETURN p.name as playerName, coalesce(sum(CASE WHEN md.assists IS NULL OR md.assists = "" THEN 0 ELSE md.assists END), 0) as value';
					break;
				case 'MOM':
					returnClause = 'RETURN p.name as playerName, coalesce(sum(CASE WHEN md.manOfMatch IS NULL OR md.manOfMatch = "" THEN 0 ELSE md.manOfMatch END), 0) as value';
					break;
				case 'Y':
					returnClause = 'RETURN p.name as playerName, coalesce(sum(CASE WHEN md.yellowCards IS NULL OR md.yellowCards = "" THEN 0 ELSE md.yellowCards END), 0) as value';
					break;
				case 'R':
					returnClause = 'RETURN p.name as playerName, coalesce(sum(CASE WHEN md.redCards IS NULL OR md.redCards = "" THEN 0 ELSE md.redCards END), 0) as value';
					break;
				case 'SAVES':
					returnClause = 'RETURN p.name as playerName, coalesce(sum(CASE WHEN md.saves IS NULL OR md.saves = "" THEN 0 ELSE md.saves END), 0) as value';
					break;
				case 'OG':
					returnClause = 'RETURN p.name as playerName, coalesce(sum(CASE WHEN md.ownGoals IS NULL OR md.ownGoals = "" THEN 0 ELSE md.ownGoals END), 0) as value';
					break;
				case 'C':
					returnClause = 'RETURN p.name as playerName, coalesce(sum(CASE WHEN md.conceded IS NULL OR md.conceded = "" THEN 0 ELSE md.conceded END), 0) as value';
					break;
				case 'CLS':
					returnClause = 'RETURN p.name as playerName, coalesce(sum(CASE WHEN md.cleanSheet IS NULL OR md.cleanSheet = "" THEN 0 ELSE md.cleanSheet END), 0) as value';
					break;
				case 'PSC':
					returnClause = 'RETURN p.name as playerName, coalesce(sum(CASE WHEN md.penaltiesScored IS NULL OR md.penaltiesScored = "" THEN 0 ELSE md.penaltiesScored END), 0) as value';
					break;
				case 'PM':
					returnClause = 'RETURN p.name as playerName, coalesce(sum(CASE WHEN md.penaltiesMissed IS NULL OR md.penaltiesMissed = "" THEN 0 ELSE md.penaltiesMissed END), 0) as value';
					break;
				case 'PCO':
					returnClause = 'RETURN p.name as playerName, coalesce(sum(CASE WHEN md.penaltiesConceded IS NULL OR md.penaltiesConceded = "" THEN 0 ELSE md.penaltiesConceded END), 0) as value';
					break;
				case 'PSV':
					returnClause = 'RETURN p.name as playerName, coalesce(sum(CASE WHEN md.penaltiesSaved IS NULL OR md.penaltiesSaved = "" THEN 0 ELSE md.penaltiesSaved END), 0) as value';
					break;
				case 'FTP':
					returnClause = 'RETURN p.name as playerName, coalesce(sum(CASE WHEN md.fantasyPoints IS NULL OR md.fantasyPoints = "" THEN 0 ELSE md.fantasyPoints END), 0) as value';
					break;
				default:
					returnClause = 'RETURN p.name as playerName, count(md) as value';
			}
			
			query += ' ' + returnClause;
			
			try {
				const result = await neo4jService.executeQuery(query, { playerName });
				return { type: 'specific_player', data: result, playerName, metric };
			} catch (error) {
				console.error('Error querying specific player data:', error);
				return null;
			}
		}
		
		// Fallback to general player query
		const query = `
      MATCH (p:Player {graphLabel: 'dorkiniansWebsite'})
      WHERE p.NAME IS NOT NULL
      RETURN p.NAME as name, p.source as source
      LIMIT 50
    `;

		const result = await neo4jService.executeQuery(query);
		return { type: 'general_players', data: result };
	}

	private async queryTeamData(entities: string[], metrics: string[]): Promise<any> {
		const query = `
      MATCH (t:Team {graphLabel: 'dorkiniansWebsite'})
      RETURN t.name as name, t.league as league
      LIMIT 20
    `;

		const result = await neo4jService.executeQuery(query);
		return result;
	}

	private async queryClubData(entities: string[], metrics: string[]): Promise<any> {
		const query = `
      MATCH (c:Club {graphLabel: 'dorkiniansWebsite'})
      RETURN c.name as name, c.captain as captain, c.awards as awards
      LIMIT 10
    `;

		const result = await neo4jService.executeQuery(query);
		return result;
	}

	private async queryFixtureData(entities: string[], metrics: string[]): Promise<any> {
		const query = `
      MATCH (f:Fixture {graphLabel: 'dorkiniansWebsite'})
      RETURN f.homeTeam as homeTeam, f.awayTeam as awayTeam, f.date as date, f.score as score
      ORDER BY f.date DESC
      LIMIT 20
    `;

		const result = await neo4jService.executeQuery(query);
		return result;
	}

	private async queryComparisonData(entities: string[], metrics: string[]): Promise<any> {
		const query = `
      MATCH (p:Player {graphLabel: 'dorkiniansWebsite'})
      WHERE p.NAME IS NOT NULL
      RETURN p.NAME as name, p.team as team, p.goals as goals, p.assists as assists
      ORDER BY p.goals DESC
      LIMIT 10
    `;

		const result = await neo4jService.executeQuery(query);
		return result;
	}

	private async queryGeneralData(): Promise<any> {
		// Query for general information about the database
		const query = `
      MATCH (p:Player {graphLabel: 'dorkiniansWebsite'})
      WHERE p.NAME IS NOT NULL
      RETURN count(p) as playerCount
    `;

		const result = await neo4jService.executeQuery(query);
		return result;
	}

	private async generateResponse(question: string, data: any, analysis: any): Promise<ChatbotResponse> {
		let answer = "";
		let visualization: ChatbotResponse["visualization"] = undefined;

		if (!data || data.length === 0) {
			answer =
				"I couldn't find any relevant information to answer your question about the club. This might be because the club records haven't been updated yet.";
			return {
				answer,
				confidence: 0.15, // Never show 0% confidence
				sources: [], // Always hide technical sources
				visualization,
			};
		}

		// Handle different types of questions with strict club-focused responses
		if (analysis.type === "player") {
			// Check if this is a specific player query
			if (data && data.type === 'specific_player' && data.data && data.data.length > 0) {
				const playerData = data.data[0];
				const playerName = data.playerName;
				const metric = data.metric;
				const value = playerData.value;
				
				// Use the metric configuration for proper display names
				const metricName = getMetricDisplayName(metric, value);
				answer = `${playerName} has ${value} ${metricName}.`;
			} else if (data && data.type === 'general_players' && data.data && data.data.length > 0) {
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
		}

		return {
			answer,
			confidence: data.length > 0 ? 0.85 : 0.15, // High confidence when data found, never 0%
			sources: [], // Always hide technical sources as per mandatory rules
			visualization,
		};
	}
}

export const chatbotService = ChatbotService.getInstance();
