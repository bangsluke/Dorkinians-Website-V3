import { neo4jService } from '@/lib/neo4j'

export interface ChatbotResponse {
  answer: string
  data?: any
  visualization?: {
    type: 'chart' | 'table' | 'calendar' | 'stats'
    data: any
    config?: any
  }
  confidence: number
  sources: string[]
}

export interface QuestionContext {
  question: string
  userContext?: string
  dataSources?: string[]
}

export class ChatbotService {
  private static instance: ChatbotService

  static getInstance(): ChatbotService {
    if (!ChatbotService.instance) {
      ChatbotService.instance = new ChatbotService()
    }
    return ChatbotService.instance
  }

  async processQuestion(context: QuestionContext): Promise<ChatbotResponse> {
    console.log(`🤖 Processing question: ${context.question}`)
    
    try {
      // Ensure Neo4j connection
      const connected = await neo4jService.connect()
      if (!connected) {
        return {
          answer: "I'm sorry, I'm unable to access the club's database at the moment. Please try again later.",
          confidence: 0,
          sources: []
        }
      }

      // Analyze the question to determine what data we need
      const analysis = this.analyzeQuestion(context.question)
      
      // Query Neo4j for relevant data
      const data = await this.queryRelevantData(analysis)
      
      // Generate response based on data and question type
      const response = await this.generateResponse(context.question, data, analysis)
      
      return response
    } catch (error) {
      console.error('❌ Chatbot processing failed:', error)
      return {
        answer: "I'm sorry, I encountered an error while processing your question. Please try again.",
        confidence: 0,
        sources: []
      }
    }
  }

  private analyzeQuestion(question: string): {
    type: 'player' | 'team' | 'club' | 'fixture' | 'comparison' | 'general'
    entities: string[]
    metrics: string[]
    timeRange?: string
  } {
    const lowerQuestion = question.toLowerCase()
    
    // Determine question type
    let type: 'player' | 'team' | 'club' | 'fixture' | 'comparison' | 'general' = 'general'
    
    if (lowerQuestion.includes('player') || lowerQuestion.includes('scored') || lowerQuestion.includes('goals')) {
      type = 'player'
    } else if (lowerQuestion.includes('team') || lowerQuestion.includes('finish')) {
      type = 'team'
    } else if (lowerQuestion.includes('club') || lowerQuestion.includes('captain')) {
      type = 'club'
    } else if (lowerQuestion.includes('fixture') || lowerQuestion.includes('match')) {
      type = 'fixture'
    } else if (lowerQuestion.includes('compare') || lowerQuestion.includes('vs')) {
      type = 'comparison'
    }

    // Extract entities (player names, team names, etc.)
    const entities: string[] = []
    // This is a simplified extraction - in production, you'd use NLP
    
    // Extract metrics
    const metrics: string[] = []
    if (lowerQuestion.includes('goals')) metrics.push('goals')
    if (lowerQuestion.includes('assists')) metrics.push('assists')
    if (lowerQuestion.includes('clean sheets')) metrics.push('cleanSheets')
    if (lowerQuestion.includes('games')) metrics.push('games')
    if (lowerQuestion.includes('points')) metrics.push('points')

    return { type, entities, metrics }
  }

  private async queryRelevantData(analysis: any): Promise<any> {
    const { type, entities, metrics } = analysis
    
    try {
      switch (type) {
        case 'player':
          return await this.queryPlayerData(entities, metrics)
        case 'team':
          return await this.queryTeamData(entities, metrics)
        case 'club':
          return await this.queryClubData(entities, metrics)
        case 'fixture':
          return await this.queryFixtureData(entities, metrics)
        case 'comparison':
          return await this.queryComparisonData(entities, metrics)
        default:
          return await this.queryGeneralData()
      }
    } catch (error) {
      console.error('❌ Data query failed:', error)
      return null
    }
  }

  private async queryPlayerData(entities: string[], metrics: string[]): Promise<any> {
    const query = `
      MATCH (p:Player {graphLabel: 'dorkiniansWebsite'})
      WHERE p.NAME IS NOT NULL
      RETURN p.NAME as name, p.source as source
      LIMIT 50
    `
    
    const result = await neo4jService.executeQuery(query)
    return result
  }

  private async queryTeamData(entities: string[], metrics: string[]): Promise<any> {
    const query = `
      MATCH (t:Team {graphLabel: 'dorkiniansWebsite'})
      RETURN t.name as name, t.league as league
      LIMIT 20
    `
    
    const result = await neo4jService.executeQuery(query)
    return result
  }

  private async queryClubData(entities: string[], metrics: string[]): Promise<any> {
    const query = `
      MATCH (c:Club {graphLabel: 'dorkiniansWebsite'})
      RETURN c.name as name, c.captain as captain, c.awards as awards
      LIMIT 10
    `
    
    const result = await neo4jService.executeQuery(query)
    return result
  }

  private async queryFixtureData(entities: string[], metrics: string[]): Promise<any> {
    const query = `
      MATCH (f:Fixture {graphLabel: 'dorkiniansWebsite'})
      RETURN f.homeTeam as homeTeam, f.awayTeam as awayTeam, f.date as date, f.score as score
      ORDER BY f.date DESC
      LIMIT 20
    `
    
    const result = await neo4jService.executeQuery(query)
    return result
  }

  private async queryComparisonData(entities: string[], metrics: string[]): Promise<any> {
    const query = `
      MATCH (p:Player {graphLabel: 'dorkiniansWebsite'})
      WHERE p.NAME IS NOT NULL
      RETURN p.NAME as name, p.team as team, p.goals as goals, p.assists as assists
      ORDER BY p.goals DESC
      LIMIT 10
    `
    
    const result = await neo4jService.executeQuery(query)
    return result
  }

  private async queryGeneralData(): Promise<any> {
    // Query for general information about the database
    const query = `
      MATCH (p:Player {graphLabel: 'dorkiniansWebsite'})
      WHERE p.NAME IS NOT NULL
      RETURN count(p) as playerCount
    `
    
    const result = await neo4jService.executeQuery(query)
    return result
  }

  private async generateResponse(question: string, data: any, analysis: any): Promise<ChatbotResponse> {
    let answer = ""
    let visualization: ChatbotResponse['visualization'] = undefined
    
    if (!data || data.length === 0) {
      answer = "I couldn't find any relevant information to answer your question about the club. This might be because the club records haven't been updated yet."
      return {
        answer,
        confidence: 0.15, // Never show 0% confidence
        sources: [], // Always hide technical sources
        visualization
      }
    }

    // Handle different types of questions with strict club-focused responses
    if (analysis.type === 'player') {
      if (data.length > 0) {
        if (data[0].playerCount) {
          // General player count question
          answer = `The club currently has ${data[0].playerCount} registered players across all teams.`
          visualization = {
            type: 'stats',
            data: { playerCount: data[0].playerCount },
            config: { title: 'Total Players' }
          }
        } else if (data[0].name) {
          // Specific player data - MAX 14 players as per rules
          const maxPlayers = Math.min(data.length, 14)
          const playerNames = data.slice(0, maxPlayers).map((p: any) => p.name).join(', ')
          answer = `I found ${data.length} players in the club. Here are some of our registered players: ${playerNames}${data.length > maxPlayers ? ' and many more...' : ''}`
          visualization = {
            type: 'table',
            data: data.slice(0, maxPlayers),
            config: { columns: ['name'] }
          }
        }
      }
    } else if (analysis.type === 'general') {
      if (data[0]?.playerCount) {
        answer = `The club maintains comprehensive records of ${data[0].playerCount} registered players across all our teams.`
      } else {
        answer = `I found ${data.length} records in the club's information system.`
      }
    } else if (analysis.type === 'team') {
      answer = `I found information about ${data.length} teams within the club structure.`
    } else if (analysis.type === 'club') {
      answer = `I found club information including details about captains and awards.`
    } else if (analysis.type === 'fixture') {
      answer = `I found ${data.length} fixture records in the club's match history.`
    }

    return {
      answer,
      confidence: data.length > 0 ? 0.85 : 0.15, // High confidence when data found, never 0%
      sources: [], // Always hide technical sources as per mandatory rules
      visualization
    }
  }
}

export const chatbotService = ChatbotService.getInstance()
