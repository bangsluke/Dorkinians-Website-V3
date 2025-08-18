import { NextResponse } from 'next/server'
import { neo4jService } from '@/lib/neo4j'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('🧪 Testing Neo4j connection via API...')
    console.log('📋 Environment check:')
    console.log('  NODE_ENV:', process.env.NODE_ENV)
    console.log('  DEV_NEO4J_URI:', process.env.DEV_NEO4J_URI)
    console.log('  DEV_NEO4J_USER:', process.env.DEV_NEO4J_USER)
    console.log('  DEV_NEO4J_PASSWORD:', process.env.DEV_NEO4J_PASSWORD ? '***set***' : 'not set')
    
    // Check if we have the required environment variables
    if (!process.env.DEV_NEO4J_URI || !process.env.DEV_NEO4J_USER || !process.env.DEV_NEO4J_PASSWORD) {
      console.error('❌ Missing required Neo4j environment variables')
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required Neo4j environment variables',
        missing: {
          uri: !process.env.DEV_NEO4J_URI,
          user: !process.env.DEV_NEO4J_USER,
          password: !process.env.DEV_NEO4J_PASSWORD
        }
      }, { status: 500 })
    }
    
    console.log('✅ Environment variables are properly configured')
    
    // Test connection
    console.log('🔗 Attempting to connect to Neo4j...')
    console.log('🔍 Neo4j service object:', typeof neo4jService)
    console.log('🔍 Neo4j service methods:', Object.getOwnPropertyNames(neo4jService))
    
    const connected = await neo4jService.connect()
    if (!connected) {
      console.error('❌ Failed to connect to Neo4j')
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to connect to Neo4j - check if database is running' 
      }, { status: 500 })
    }

    console.log('✅ Neo4j connection successful via API')
    
    // Test creating a test node
    console.log('🧪 Creating test node via API...')
    const testNode = await neo4jService.createNode('TestNode', {
      name: 'API Test Player',
      testProperty: 'api test value',
      timestamp: new Date().toISOString()
    } as any)
    
    if (testNode) {
      console.log('✅ Test node created successfully via API')
      
      // Verify graphLabel property - safely check structure
      if (testNode && typeof testNode === 'object' && 'properties' in testNode && testNode.properties && testNode.properties.graphLabel === 'dorkiniansWebsite') {
        console.log('✅ graphLabel property correctly set via API')
      } else {
        console.error('❌ graphLabel property missing or incorrect via API')
        console.log('🔍 Test node structure:', JSON.stringify(testNode, null, 2))
      }
    }

    // Test querying nodes by graphLabel
    console.log('🧪 Testing graphLabel query via API...')
    const nodes = await neo4jService.getNodesByGraphLabel()
    console.log(`✅ Found ${nodes.length} nodes with graphLabel via API`)

    // Test database statistics
    console.log('🧪 Testing database statistics via API...')
    const stats = await neo4jService.getDatabaseStats()
    console.log('📊 Database stats via API:', stats)

    // Clean up test data
    console.log('🧹 Cleaning up test data via API...')
    const deleteResult = await neo4jService.clearGraphData()
    console.log('🗑️ Deletion result via API:', deleteResult)

    // Verify no dorkiniansWebsite nodes remain
    const remainingNodes = await neo4jService.getNodesByGraphLabel()
    console.log(`✅ Remaining nodes with graphLabel via API: ${remainingNodes.length}`)

    // Disconnect
    await neo4jService.disconnect()
    console.log('🔌 Disconnected from Neo4j via API')

    return NextResponse.json({ 
      success: true, 
      message: 'Neo4j connection test completed successfully',
      stats,
      testNodeCreated: !!testNode,
      nodesFound: nodes.length,
      deletionResult: deleteResult,
      remainingNodes: remainingNodes.length
    })

  } catch (error) {
    console.error('❌ Neo4j API test failed:', error)
    
    // Log detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    // Try to disconnect if there was an error
    try {
      await neo4jService.disconnect()
    } catch (disconnectError) {
      console.error('❌ Failed to disconnect:', disconnectError)
    }
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.name : 'Unknown',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
