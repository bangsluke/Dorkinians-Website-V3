import { neo4jService } from "../neo4j";
import { metricConfigs, findMetricByAlias, getMetricDisplayName } from "../config/chatbotMetrics";

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
		console.log(`🤖 Processing question: ${context.question}`);
		console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
		console.log(`👤 User context: ${context.userContext || 'None'}`);
		console.log(
			`🔗 Neo4j URI configured: ${process.env.NODE_ENV === "production" ? (process.env.PROD_NEO4J_URI ? "Yes" : "No") : process.env.DEV_NEO4J_URI ? "Yes" : "No"}`,
		);

		try {
			// Ensure Neo4j connection
			const connected = await neo4jService.connect();
			if (!connected) {
				console.error("❌ Neo4j connection failed in production");
				return {
					answer: "I'm sorry, I'm unable to access the club's database at the moment. Please try again later.",
					confidence: 0,
					sources: [],
				};
			}

			// Analyze the question
			const analysis = this.analyzeQuestion(context.question, context.userContext);
			console.log(`🔍 Question analysis:`, analysis);

			// Query the database
			console.log(`🔍 Building Cypher query for analysis:`, analysis);
			const data = await this.queryRelevantData(analysis);
			console.log(`📊 Query result:`, data);

			// Generate the response
			const response = await this.generateResponse(context.question, data, analysis);
			console.log(`💬 Generated response:`, response);

			return response;
		} catch (error) {
			console.error("❌ Error processing question:", error);
			return {
				answer: "I'm sorry, I encountered an error while processing your question. Please try again later.",
				confidence: 0,
				sources: [],
			};
		}
	}

	private analyzeQuestion(
		question: string,
		userContext?: string,
	): {
		type: "player" | "team" | "club" | "fixture" | "comparison" | "streak" | "double_game" | "general";
		entities: string[];
		metrics: string[];
		timeRange?: string;
	} {
		const lowerQuestion = question.toLowerCase();

		// Determine question type
		let type: "player" | "team" | "club" | "fixture" | "comparison" | "streak" | "double_game" | "general" = "general";

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
			lowerQuestion.includes("fantasy")
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

		// Pattern 2b: "How many penalties has Jonny Sourris missed?" (more natural format)
		if (entities.length === 0) {
			playerNameMatch = question.match(
				/How many (?:goals|assists|appearances|minutes|man of the match awards?|yellow cards?|red cards?|saves?|own goals?|conceded goals?|clean sheets?|penalties|fantasy points?) has (.*?) (?:scored|got|made|played|won|received|conceded|kept|missed|saved|earned|received|given|booked|cautioned|dismissed|sent off|let in|allowed|kept|converted|failed|gave away|stopped|earned|collected|accumulated)/,
			);
			if (playerNameMatch) {
				entities.push(playerNameMatch[1].trim());
			}
		}

		// Pattern 3: "Luke Bangs goals" or "Luke Bangs appearances"
		if (entities.length === 0) {
			playerNameMatch = question.match(
				/^([A-Za-z\s]+) (?:goals|assists|appearances|minutes|man of the match|mom|yellow cards?|red cards?|saves?|own goals?|conceded|clean sheets?|penalties|fantasy points)/,
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

		// Pattern 5: Team-specific questions like "3rd team" or "2s"
		if (entities.length === 0) {
			const teamMatch = question.match(/(\d+(?:st|nd|rd|th)?)\s*team/);
			if (teamMatch) {
				entities.push(teamMatch[1]);
			}
		}

		// Extract metrics using the configuration with context awareness
		const metrics: string[] = [];

		// Check for metric matches using aliases
		for (const config of metricConfigs) {
			const found =
				config.aliases.some((alias) => lowerQuestion.includes(alias.toLowerCase())) || lowerQuestion.includes(config.displayName.toLowerCase());

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

		// Debug logging
		console.log(`Question analysis - Type: ${type}, Entities: ${entities}, Metrics: ${metrics}, Lower question: ${lowerQuestion}`);

		return { type, entities, metrics };
	}

	private async queryRelevantData(analysis: any): Promise<any> {
		console.log(`🔍 queryRelevantData called with analysis:`, analysis);
		const { type, entities, metrics } = analysis;

		try {
			console.log(`🔍 Querying for type: ${type}, entities: ${entities}, metrics: ${metrics}`);

					switch (type) {
			case "player":
				console.log(`🔍 Calling queryPlayerData for entities: ${entities}, metrics: ${metrics}`);
				const playerResult = await this.queryPlayerData(entities, metrics);
				console.log(`🔍 queryPlayerData returned:`, playerResult);
				return playerResult;
			case "team":
				console.log(`🔍 Calling queryTeamData...`);
				return await this.queryTeamData(entities, metrics);
			case "club":
				console.log(`🔍 Calling queryClubData...`);
				return await this.queryClubData(entities, metrics);
			case "fixture":
				console.log(`🔍 Calling queryFixtureData...`);
				return await this.queryFixtureData(entities, metrics);
			case "comparison":
				console.log(`🔍 Calling queryComparisonData...`);
				return await this.queryComparisonData(entities, metrics);
			case "streak":
				console.log(`🔍 Calling queryStreakData...`);
				return await this.queryStreakData(entities, metrics);
			case "double_game":
				console.log(`🔍 Calling queryDoubleGameData...`);
				return await this.queryDoubleGameData(entities, metrics);
			default:
				console.log(`🔍 Calling queryGeneralData...`);
				return await this.queryGeneralData();
		}
		} catch (error) {
			console.error("❌ Data query failed:", error);
			return null;
		}
	}

	private async queryPlayerData(entities: string[], metrics: string[]): Promise<any> {
		console.log(`🔍 queryPlayerData called with entities: ${entities}, metrics: ${metrics}`);

		// Check if we have entities (player names) to query
		if (entities.length === 0) {
			return { type: "no_context", data: [], message: "No player context provided" };
		}

		// If we have a specific player name and metrics, query their stats
		if (entities.length > 0 && metrics.length > 0) {
			const playerName = entities[0];
			const metric = metrics[0];

			console.log(`🎯 Querying for player: ${playerName}, metric: ${metric}`);

			// Check if this is a team-specific question (e.g., "3rd team")
			if (playerName.match(/^\d+(?:st|nd|rd|th)?$/)) {
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
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.yellowCard IS NULL OR md.yellowCard = "" THEN 0 ELSE md.yellowCard END), 0) as value';
					break;
				case "R":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.redCard IS NULL OR md.redCard = "" THEN 0 ELSE md.redCard END), 0) as value';
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
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.conceded IS NULL OR md.conceded = "" THEN 0 ELSE md.conceded END), 0) as value';
					break;
				case "CLS":
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.cleanSheet IS NULL OR md.cleanSheet = "" THEN 0 ELSE md.cleanSheet END), 0) as value';
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
					returnClause =
						'RETURN p.playerName as playerName, coalesce(sum(CASE WHEN md.fantasyPoints IS NULL OR md.fantasyPoints = "" THEN 0 ELSE md.fantasyPoints END), 0) as value';
					break;
				default:
					returnClause = "RETURN p.playerName as playerName, count(md) as value";
			}

			query += " " + returnClause;
			console.log(`🔍 Final Cypher query: ${query}`);

			try {
				// Create case-insensitive name variations for matching
				const playerNameLower = String(playerName).toLowerCase();
				const playerNameHyphen = String(playerName).toLowerCase().replace(/\s+/g, "-");

				console.log(`🔍 Query parameters: playerName=${playerName}, playerNameLower=${playerNameLower}, playerNameHyphen=${playerNameHyphen}`);

				const result = await neo4jService.executeQuery(query, {
					playerName,
					playerNameLower,
					playerNameHyphen,
				});

				console.log(`🔍 Player query result for ${playerName}:`, result);
				console.log(`🔍 Result type: ${typeof result}, length: ${Array.isArray(result) ? result.length : "not array"}`);

				if (result && Array.isArray(result) && result.length > 0) {
					console.log(`🔍 First result item:`, result[0]);
				} else {
					// Diagnostic: Let's see what players actually exist in the database
					console.log(`🔍 No results found for ${playerName}. Running diagnostic query...`);
					const diagnosticQuery = `
						MATCH (p:Player)
						RETURN p.playerName as playerName
						ORDER BY p.playerName
						LIMIT 20
					`;
					const diagnosticResult = await neo4jService.executeQuery(diagnosticQuery);
					console.log(
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
					console.log(
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
					console.log(`🔍 Relationships for ${playerName}:`, relationshipResult);

					// Check if there are any MatchDetail nodes at all
					const matchDetailQuery = `
						MATCH (md:MatchDetail)
						RETURN count(md) as totalMatchDetails
						LIMIT 1
					`;
					const matchDetailResult = await neo4jService.executeQuery(matchDetailQuery);
					console.log(`🔍 Total MatchDetail nodes:`, matchDetailResult);

					// Check if there are any MatchDetail nodes without graphLabel
					const noLabelQuery = `
						MATCH (md:MatchDetail)
						WHERE NOT EXISTS(md.graphLabel)
						RETURN count(md) as noLabelMatchDetails
						LIMIT 1
					`;
					const noLabelResult = await neo4jService.executeQuery(noLabelQuery);
					console.log(`🔍 MatchDetail nodes without graphLabel:`, noLabelResult);
				}

				return { type: "specific_player", data: result, playerName, metric };
			} catch (error) {
				console.error("❌ Error querying specific player data:", error);
				return null;
			}
		}

		console.log(`🔍 No specific player query, falling back to general player query`);

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
		console.log(`🔍 queryTeamSpecificPlayerData called with teamNumber: ${teamNumber}, metric: ${metric}`);

		// Convert team number to team name (e.g., "3rd" -> "3rd Team")
		const teamName = `${teamNumber} Team`;
		console.log(`🔍 Looking for team: ${teamName}`);

		// First, let's check what teams actually exist in the Fixture data
		console.log(`🔍 Running diagnostic query to see available teams...`);
		const diagnosticQuery = `
			MATCH (f:Fixture)
			WHERE f.team IS NOT NULL
			RETURN DISTINCT f.team as teamName
			ORDER BY f.team
		`;
		
		try {
			const diagnosticResult = await neo4jService.executeQuery(diagnosticQuery);
			console.log(`🔍 Available teams in Fixture data:`, diagnosticResult.map(r => r.teamName));
			
			// Check if our target team exists
			const teamExists = diagnosticResult.some(r => r.teamName === teamName);
			console.log(`🔍 Team "${teamName}" exists: ${teamExists}`);
			
			if (!teamExists) {
				console.log(`🔍 Team "${teamName}" not found. Available teams:`, diagnosticResult.map(r => r.teamName));
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
			console.error(`❌ Diagnostic query failed:`, error);
		}

		// Now build the actual query using the correct data structure
		// We'll query MatchDetail nodes directly, filtering by team property
		const query = `
			MATCH (p:Player)-[:PLAYED_IN]->(md:MatchDetail)
			WHERE md.team = $teamName
			WITH p, md
			RETURN p.playerName as playerName, 
				   sum(CASE WHEN md.${this.getMetricField(metric)} IS NOT NULL AND md.${this.getMetricField(metric)} != "" THEN toInteger(md.${this.getMetricField(metric)}) ELSE 0 END) as value,
				   count(md) as appearances
			ORDER BY value DESC
			LIMIT 10
		`;

		console.log(`🔍 Final team-specific query:`, query);
		console.log(`🔍 Query parameters: teamName=${teamName}, metric=${metric}, metricField=${this.getMetricField(metric)}`);

		try {
			const result = await neo4jService.executeQuery(query, { teamName });
			console.log(`🔍 Team-specific query result:`, result);
			
			if (result && result.length > 0) {
				console.log(`🔍 Found ${result.length} players for team ${teamName}`);
				return { type: "team_specific", data: result, teamName, metric };
			} else {
				console.log(`🔍 No players found for team ${teamName}`);
				return { type: "team_specific", data: [], teamName, metric, message: `No players found for team ${teamName}` };
			}
		} catch (error: any) {
			console.error(`❌ Error querying team-specific player data:`, error);
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
				confidence: 0.15, // Never show 0% confidence
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

				// Use the metric configuration for proper display names
				const metricName = getMetricDisplayName(metric, value);
				answer = `${playerName} has ${value} ${metricName}.`;
			} else if (data && data.type === "team_specific" && data.data && data.data.length > 0) {
				// Team-specific query (e.g., "3rd team goals")
				const teamName = data.teamName;
				const metric = data.metric;
				const topPlayer = data.data[0];
				const metricName = getMetricDisplayName(metric, topPlayer.value);

				answer = `For the ${teamName}, ${topPlayer.playerName} has scored the most ${metricName} with ${topPlayer.value}.`;

				visualization = {
					type: "table",
					data: data.data,
					config: { columns: ["playerName", "value", "appearances"] },
				};
			} else if (data && data.type === "team_not_found") {
				// Team not found - provide helpful information
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
			confidence: data.length > 0 ? 0.85 : 0.15, // High confidence when data found, never 0%
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
}

export const chatbotService = ChatbotService.getInstance();
