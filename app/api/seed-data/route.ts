import { NextRequest, NextResponse } from 'next/server'
import { dataSeederService } from '@/lib/services/dataSeederService'
import { dataService } from '@/lib/services/dataService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { dataSources } = body

    if (!dataSources || !Array.isArray(dataSources)) {
      return NextResponse.json(
        { error: 'dataSources array is required' },
        { status: 400 }
      )
    }

    console.log('🌱 Starting data seeding process...')

    // Seed the data
    const result = await dataSeederService.seedAllData(dataSources)

    if (result.success) {
      console.log(`✅ Data seeding completed: ${result.nodesCreated} nodes, ${result.relationshipsCreated} relationships`)
    } else {
      console.log(`⚠️ Data seeding completed with errors: ${result.errors.join(', ')}`)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ Data seeding API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Get database stats
    const stats = await dataSeederService.getDatabaseStats()
    const cacheStats = dataService.getCacheStats()

    return NextResponse.json({
      database: stats,
      cache: cacheStats
    })
  } catch (error) {
    console.error('❌ Stats API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
