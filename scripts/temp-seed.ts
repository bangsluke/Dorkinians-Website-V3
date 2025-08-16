
      import { dataSeederService } from './lib/services/dataSeederService'
      
      const seedData = {
        dataSources: [
          {
            name: "TBL_Players",
            url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=528214413&single=true&output=csv",
            type: "StatsData"
          }
        ]
      }
      
      console.log('🌱 Starting data seeding...')
      const result = await dataSeederService.seedAllData(seedData.dataSources)
      console.log('✅ Seeding completed:', JSON.stringify(result, null, 2))
    