import Papa from 'papaparse'

export interface CSVData {
  [key: string]: string | number
}

export interface DataSource {
  name: string
  url: string
  type: 'StatsData' | 'FASiteData'
}

export class DataService {
  private static instance: DataService
  private dataCache: Map<string, { data: CSVData[], timestamp: number }> = new Map()
  private readonly CACHE_DURATION = 1000 * 60 * 60 * 24 // 24 hours

  static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService()
    }
    return DataService.instance
  }

  async fetchCSVData(url: string, sourceName: string): Promise<CSVData[]> {
    // Check cache first
    const cached = this.dataCache.get(sourceName)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log(`📦 Using cached data for ${sourceName}`)
      return cached.data
    }

    try {
      console.log(`🌐 Fetching data from ${sourceName}...`)
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const csvText = await response.text()
      const result = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transform: (value) => {
          // Convert numeric strings to numbers
          const num = Number(value)
          return isNaN(num) ? value : num
        }
      })

      if (result.errors.length > 0) {
        console.warn(`⚠️ CSV parsing warnings for ${sourceName}:`, result.errors)
      }

      const data = result.data as CSVData[]
      console.log(`✅ Fetched ${data.length} rows from ${sourceName}`)

      // Cache the data
      this.dataCache.set(sourceName, {
        data,
        timestamp: Date.now()
      })

      return data
    } catch (error) {
      console.error(`❌ Failed to fetch data from ${sourceName}:`, error)
      throw error
    }
  }

  async fetchAllDataSources(dataSources: DataSource[]): Promise<Map<string, CSVData[]>> {
    const results = new Map<string, CSVData[]>()
    
    const promises = dataSources.map(async (source) => {
      try {
        const data = await this.fetchCSVData(source.url, source.name)
        results.set(source.name, data)
      } catch (error) {
        console.error(`Failed to fetch ${source.name}:`, error)
        results.set(source.name, [])
      }
    })

    await Promise.all(promises)
    return results
  }

  clearCache(): void {
    this.dataCache.clear()
    console.log('🗑️ Data cache cleared')
  }

  getCacheStats(): { size: number, sources: string[] } {
    return {
      size: this.dataCache.size,
      sources: Array.from(this.dataCache.keys())
    }
  }
}

export const dataService = DataService.getInstance()
