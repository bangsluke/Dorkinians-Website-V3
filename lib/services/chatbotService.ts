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
          answer: "I'm sorry, I'm unable to connect to the database at the moment. Please try again later.",
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
      WHERE p.name IS NOT NULL
      RETURN p.name as name, p.team as team, p.position as position
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
      WHERE p.name IS NOT NULL
      RETURN p.name as name, p.team as team, p.goals as goals, p.assists as assists
      ORDER BY p.goals DESC
      LIMIT 10
    `
    
    const result = await neo4jService.executeQuery(query)
    return result
  }

  private async queryGeneralData(): Promise<any> {
    const query = `
      MATCH (n {graphLabel: 'dorkiniansWebsite'})
      RETURN labels(n) as labels, count(n) as count
      ORDER BY count DESC
      LIMIT 10
    `
    
    const result = await neo4jService.executeQuery(query)
    return result
  }

  private async generateResponse(question: string, data: any, analysis: any): Promise<ChatbotResponse> {
    // For now, generate a simple response
    // In production, this would integrate with OpenAI API for natural language generation
    
    let answer = "Based on the available data, "
    let visualization: ChatbotResponse['visualization'] = undefined
    
    if (!data || data.length === 0) {
      answer += "I couldn't find any relevant information to answer your question. This might be because the database is empty or the data hasn't been seeded yet."
      return {
        answer,
        confidence: 0.1,
        sources: []
      }
    }

    const { type } = analysis
    
    switch (type) {
      case 'player':
        answer += `I found ${data.length} players in the database. `
        if (data.length > 0) {
          answer += `For example, ${data[0].name} plays for ${data[0].team}.`
        }
        visualization = {
          type: 'table',
          data: data.slice(0, 10),
          config: { columns: ['name', 'team', 'position'] }
        }
        break
        
      case 'team':
        answer += `I found ${data.length} teams. `
        if (data.length > 0) {
          answer += `Teams include ${data.map((t: any) => t.name).join(', ')}.`
        }
        break
        
      case 'club':
        answer += `I found club information including captains and awards.`
        break
        
      default:
        answer += `I found ${data.length} records in the database.`
    }

    return {
      answer,
      data,
      visualization,
      confidence: 0.8,
      sources: ['Neo4j Database']
    }
  }
}

export const chatbotService = ChatbotService.getInstance()
