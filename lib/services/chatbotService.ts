import { neo4jService } from "@/lib/neo4j";

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

			return response;

			console.log(` 🤖 Answer to question: ${response.answer}`);
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
			lowerQuestion.includes("appearances") || lowerQuestion.includes("minutes") || lowerQuestion.includes("man of the match")) {
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

		// Extract player names from questions like "What is Luke Bangs's total goals?"
		const entities: string[] = [];
		const playerNameMatch = question.match(/What is (.*?)'s total/);
		if (playerNameMatch) {
			entities.push(playerNameMatch[1].trim());
		}

		// Extract metrics
		const metrics: string[] = [];
		if (lowerQuestion.includes("goals")) metrics.push("goals");
		if (lowerQuestion.includes("assists")) metrics.push("assists");
		if (lowerQuestion.includes("clean sheets")) metrics.push("cleanSheets");
		if (lowerQuestion.includes("games") || lowerQuestion.includes("appearances")) metrics.push("appearances");
		if (lowerQuestion.includes("minutes")) metrics.push("minutes");
		if (lowerQuestion.includes("man of the match")) metrics.push("mom");

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
				case 'appearances':
					returnClause = 'RETURN p.name as playerName, count(md) as value';
					break;
				case 'minutes':
					returnClause = 'RETURN p.name as playerName, coalesce(sum(CASE WHEN md.minutes IS NULL OR md.minutes = "" THEN 0 ELSE md.minutes END), 0) as value';
					break;
				case 'goals':
					returnClause = 'RETURN p.name as playerName, coalesce(sum(CASE WHEN md.goals IS NULL OR md.goals = "" THEN 0 ELSE md.goals END), 0) as value';
					break;
				case 'mom':
					returnClause = 'RETURN p.name as playerName, coalesce(sum(CASE WHEN md.manOfMatch IS NULL OR md.manOfMatch = "" THEN 0 ELSE md.manOfMatch END), 0) as value';
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
				
				// Format the metric name for display
				let metricName = '';
				switch (metric) {
					case 'appearances':
						metricName = 'appearances';
						break;
					case 'minutes':
						metricName = 'minutes played';
						break;
					case 'goals':
						metricName = 'goals';
						break;
					case 'mom':
						metricName = 'man of the match awards';
						break;
					default:
						metricName = metric;
				}
				
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
