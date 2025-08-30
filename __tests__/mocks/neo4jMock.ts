import { TestPlayerData } from '../utils/testUtils';

export class MockNeo4jService {
  private testData: TestPlayerData[] = [];
  private connected: boolean = false;

  constructor(testData: TestPlayerData[]) {
    this.testData = testData;
  }

  async connect(): Promise<boolean> {
    this.connected = true;
    return true;
  }

  async executeQuery(query: string, params?: any): Promise<any[]> {
    if (!this.connected) {
      throw new Error('Not connected to Neo4j');
    }

    // Parse the query to understand what data to return
    const queryLower = query.toLowerCase();
    
    // Extract player name from params or query
    let playerName = params?.playerName;
    if (!playerName && params?.playerNameLower) {
      playerName = params.playerNameLower;
    }

    // Find player data
    const playerData = this.testData.find(p => 
      p.playerName.toLowerCase() === playerName?.toLowerCase()
    );

    if (!playerData) {
      return [];
    }

    // Handle different query types based on content
    if (queryLower.includes('count(md)')) {
      // Appearances query
      return [{ playerName: playerData.playerName, value: playerData.appearances }];
    } else if (queryLower.includes('sum') && queryLower.includes('goals')) {
      // Goals query
      return [{ playerName: playerData.playerName, value: playerData.goals }];
    } else if (queryLower.includes('sum') && queryLower.includes('assists')) {
      // Assists query
      return [{ playerName: playerData.playerName, value: playerData.assists }];
    } else if (queryLower.includes('sum') && queryLower.includes('yellowcard')) {
      // Yellow cards query
      return [{ playerName: playerData.playerName, value: playerData.yellowCards }];
    } else if (queryLower.includes('sum') && queryLower.includes('redcard')) {
      // Red cards query
      return [{ playerName: playerData.playerName, value: playerData.redCards }];
    } else if (queryLower.includes('sum') && queryLower.includes('cleansheet')) {
      // Clean sheets query
      return [{ playerName: playerData.playerName, value: playerData.cleanSheets }];
    } else if (queryLower.includes('sum') && queryLower.includes('penaltiesscored')) {
      // Penalties scored query
      return [{ playerName: playerData.playerName, value: playerData.penaltiesScored }];
    } else if (queryLower.includes('sum') && queryLower.includes('penaltiesmissed')) {
      // Penalties missed query
      return [{ playerName: playerData.playerName, value: playerData.penaltiesMissed }];
    } else if (queryLower.includes('sum') && queryLower.includes('fantasypoints')) {
      // Fantasy points query
      return [{ playerName: playerData.playerName, value: playerData.fantasyPoints }];
    } else if (queryLower.includes('sum') && queryLower.includes('minutes')) {
      // Minutes query (mock data)
      return [{ playerName: playerData.playerName, value: playerData.appearances * 90 }];
    } else if (queryLower.includes('sum') && queryLower.includes('mom')) {
      // Man of the match query (mock data)
      return [{ playerName: playerData.playerName, value: Math.floor(playerData.appearances / 10) }];
    } else if (queryLower.includes('sum') && queryLower.includes('saves')) {
      // Saves query (mock data for goalkeepers)
      return [{ playerName: playerData.playerName, value: Math.floor(playerData.appearances * 3) }];
    } else if (queryLower.includes('sum') && queryLower.includes('owngoals')) {
      // Own goals query (mock data)
      return [{ playerName: playerData.playerName, value: Math.floor(playerData.appearances / 20) }];
    } else if (queryLower.includes('sum') && queryLower.includes('conceded')) {
      // Conceded goals query (mock data)
      return [{ playerName: playerData.playerName, value: Math.floor(playerData.appearances * 1.5) }];
    }

    // Default fallback
    return [{ playerName: playerData.playerName, value: 0 }];
  }

  async close(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Mock factory function
export function createMockNeo4jService(testData: TestPlayerData[]): MockNeo4jService {
  return new MockNeo4jService(testData);
}
