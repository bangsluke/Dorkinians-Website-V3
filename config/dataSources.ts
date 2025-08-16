import { DataSource } from '@/lib/services/dataService'

export const dataSources: DataSource[] = [
  // Stats Data (Google Sheets CSVs)
  {
    name: 'TBL_Players',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=528214413&single=true&output=csv',
    type: 'StatsData'
  },
  {
    name: 'TBL_FixturesAndResults',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=0&single=true&output=csv',
    type: 'StatsData'
  },
  {
    name: 'TBL_MatchDetails',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=564691931&single=true&output=csv',
    type: 'StatsData'
  },
  {
    name: 'TBL_StatDetails',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=488085380&single=true&output=csv',
    type: 'StatsData'
  },
  {
    name: 'TBL_WeeklyTOTW',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1985336995&single=true&output=csv',
    type: 'StatsData'
  },
  {
    name: 'TBL_SeasonTOTW',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=91372781&single=true&output=csv',
    type: 'StatsData'
  },
  {
    name: 'TBL_PlayersOfTheMonth',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=2007852556&single=true&output=csv',
    type: 'StatsData'
  },
  {
    name: 'TBL_CaptainsAndAwards',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1753413613&single=true&output=csv',
    type: 'StatsData'
  },
  {
    name: 'TBL_OppositionDetails',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1977394709&single=true&output=csv',
    type: 'StatsData'
  },
  {
    name: 'TBL_SiteDetails',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=77050817&single=true&output=csv',
    type: 'StatsData'
  }
]

export const getDataSourcesByType = (type: 'StatsData' | 'FASiteData'): DataSource[] => {
  return dataSources.filter(source => source.type === type)
}

export const getDataSourcesByName = (names: string[]): DataSource[] => {
  return dataSources.filter(source => names.includes(source.name))
}
