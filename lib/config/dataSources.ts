import { DataSource } from '@/lib/services/dataService'

export const dataSources: DataSource[] = [
  // Stats Data (Google Sheets CSVs)
  {
    name: 'PlayerStats',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=0&single=true&output=csv',
    type: 'StatsData'
  },
  {
    name: 'TeamStats',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1&single=true&output=csv',
    type: 'StatsData'
  },
  {
    name: 'FixtureData',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=2&single=true&output=csv',
    type: 'StatsData'
  },
  {
    name: 'SeasonTOTW',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=3&single=true&output=csv',
    type: 'StatsData'
  },
  
  // FA Site Data (for scraping)
  {
    name: 'FALeagueTable',
    url: 'https://fulltime.thefa.com/displayTeam.html?divisionseason=123456789&teamID=123456789',
    type: 'FASiteData'
  },
  {
    name: 'FAResults',
    url: 'https://fulltime.thefa.com/displayResults.html?divisionseason=123456789&teamID=123456789',
    type: 'FASiteData'
  }
]

export const getDataSourcesByType = (type: 'StatsData' | 'FASiteData'): DataSource[] => {
  return dataSources.filter(source => source.type === type)
}

export const getDataSourcesByName = (names: string[]): DataSource[] => {
  return dataSources.filter(source => names.includes(source.name))
}
