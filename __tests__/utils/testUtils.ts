import Papa from 'papaparse';

export interface TestPlayerData {
  playerName: string;
  goals: number;
  assists: number;
  appearances: number;
  yellowCards: number;
  redCards: number;
  cleanSheets: number;
  penaltiesScored: number;
  penaltiesMissed: number;
  fantasyPoints: number;
}

export interface TestDataRow {
  [key: string]: string | number;
}

/**
 * Fallback test data for when CSV loading fails
 */
export const FALLBACK_TEST_DATA: TestPlayerData[] = [
  {
    playerName: 'Luke Bangs',
    goals: 29,
    assists: 7,
    appearances: 78,
    yellowCards: 5,
    redCards: 0,
    cleanSheets: 3,
    penaltiesScored: 2,
    penaltiesMissed: 1,
    fantasyPoints: 156
  },
  {
    playerName: 'Oli Goddard',
    goals: 15,
    assists: 12,
    appearances: 45,
    yellowCards: 3,
    redCards: 0,
    cleanSheets: 0,
    penaltiesScored: 1,
    penaltiesMissed: 0,
    fantasyPoints: 98
  },
  {
    playerName: 'Jonny Sourris',
    goals: 8,
    assists: 15,
    appearances: 52,
    yellowCards: 2,
    redCards: 0,
    cleanSheets: 0,
    penaltiesScored: 0,
    penaltiesMissed: 0,
    fantasyPoints: 87
  }
];

/**
 * Fetch and parse TBL_TestData CSV to get reference player data
 * Note: In production database testing, this serves as reference data
 * for validating chatbot responses against actual database values
 */
export async function fetchTestData(): Promise<TestPlayerData[]> {
  const testDataUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=14183891&single=true&output=csv';
  
  const isVerbose = process.env.JEST_VERBOSE === 'true';
  
  try {
    if (isVerbose) {
      console.log('🔍 Attempting to fetch reference data from:', testDataUrl);
    }
    
    const response = await fetch(testDataUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch test data: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    
    if (isVerbose) {
      console.log('📊 CSV content length:', csvText.length);
      console.log('📊 CSV preview:', csvText.substring(0, 200));
    }
    
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    
    if (parsed.errors.length > 0 && isVerbose) {
      console.warn('⚠️ CSV parsing warnings:', parsed.errors);
    }
    
    if (isVerbose) {
      console.log('📊 Parsed reference data rows:', parsed.data.length);
      console.log('📊 First row:', parsed.data[0]);
    }
    
    const processedData = parsed.data.map((row: any) => ({
      playerName: String(row.playerName || row.PlayerName || row.name || ''),
      goals: Number(row.goals || row.Goals || row.G || 0),
      assists: Number(row.assists || row.Assists || row.A || 0),
      appearances: Number(row.appearances || row.Appearances || row.APP || 0),
      yellowCards: Number(row.yellowCards || row.YellowCards || row.Y || 0),
      redCards: Number(row.redCards || row.RedCards || row.R || 0),
      cleanSheets: Number(row.cleanSheets || row.CleanSheets || row.CLS || 0),
      penaltiesScored: Number(row.penaltiesScored || row.PenaltiesScored || row.PSC || 0),
      penaltiesMissed: Number(row.penaltiesMissed || row.PenaltiesMissed || row.PM || 0),
      fantasyPoints: Number(row.fantasyPoints || row.FantasyPoints || row.FTP || 0),
    })).filter(player => player.playerName && player.playerName.trim() !== '');
    
    if (isVerbose) {
      console.log('✅ Processed reference data:', processedData.length, 'players');
    } else {
      console.log('📊 Reference data loaded:', processedData.length, 'players');
    }
    
    if (processedData.length === 0) {
      if (isVerbose) {
        console.warn('⚠️ No valid reference data found, using fallback data');
      }
      return FALLBACK_TEST_DATA;
    }
    
    return processedData;
  } catch (error) {
    if (isVerbose) {
      console.error('❌ Error fetching reference data:', error);
      console.warn('⚠️ Using fallback reference data');
    } else {
      console.log('📊 Using fallback reference data');
    }
    return FALLBACK_TEST_DATA;
  }
}

/**
 * Get player names from test data
 */
export async function getTestPlayerNames(): Promise<string[]> {
  const testData = await fetchTestData();
  return testData.map(player => player.playerName);
}

/**
 * Get specific player data by name
 */
export async function getPlayerTestData(playerName: string): Promise<TestPlayerData | null> {
  const testData = await fetchTestData();
  return testData.find(player => player.playerName === playerName) || null;
}

/**
 * Generate test questions for a player
 */
export function generateTestQuestions(playerName: string): string[] {
  return [
    `How many goals has ${playerName} scored?`,
    `How many assists does ${playerName} have?`,
    `How many appearances has ${playerName} made?`,
    `How many yellow cards has ${playerName} received?`,
    `How many red cards has ${playerName} received?`,
    `How many clean sheets has ${playerName} kept?`,
    `How many penalties has ${playerName} scored?`,
    `How many penalties has ${playerName} missed?`,
    `How many fantasy points has ${playerName} earned?`,
  ];
}

/**
 * Extract numeric value from chatbot response
 */
export function extractNumericValue(response: string): number | null {
  const match = response.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Validate chatbot response against expected value
 */
export function validateResponse(response: string, expectedValue: number, metric: string): boolean {
  const extractedValue = extractNumericValue(response);
  if (extractedValue === null) {
    console.error(`Could not extract numeric value from response: "${response}"`);
    return false;
  }
  
  if (extractedValue !== expectedValue) {
    console.error(`Value mismatch for ${metric}: expected ${expectedValue}, got ${extractedValue}`);
    return false;
  }
  
  return true;
}
