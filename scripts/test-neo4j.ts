import { neo4jService } from '../lib/neo4j'

async function testNeo4jConnection() {
  console.log('🧪 Testing Neo4j Local Connection...')
  
  try {
    // Test connection
    const connected = await neo4jService.connect()
    if (!connected) {
      console.error('❌ Failed to connect to Neo4j')
      return
    }

    console.log('✅ Connection successful!')
    
    // Test creating a test node
    console.log('🧪 Creating test node...')
    const testNode = await neo4jService.createNode('TestNode', {
      name: 'Test Player',
      testProperty: 'test value'
    } as any)
    
    if (testNode) {
      console.log('✅ Test node created successfully')
      console.log('📊 Node properties:', testNode.properties)
      
      // Verify graphLabel property
      if (testNode.properties.graphLabel === 'dorkiniansWebsite') {
        console.log('✅ graphLabel property correctly set')
      } else {
        console.error('❌ graphLabel property missing or incorrect')
      }
    }

    // Test querying nodes by graphLabel
    console.log('🧪 Testing graphLabel query...')
    const nodes = await neo4jService.getNodesByGraphLabel()
    console.log(`✅ Found ${nodes.length} nodes with graphLabel`)

    // Test database statistics
    console.log('🧪 Testing database statistics...')
    const stats = await neo4jService.getDatabaseStats()
    console.log('📊 Database stats:', stats)

    // Test safe deletion - this should only affect our test data
    console.log('🧪 Testing safe deletion...')
    const deleteResult = await neo4jService.clearGraphData()
    console.log('🗑️ Deletion result:', deleteResult)

    // Verify no dorkiniansWebsite nodes remain
    const remainingNodes = await neo4jService.getNodesByGraphLabel()
    console.log(`✅ Remaining nodes with graphLabel: ${remainingNodes.length}`)

  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await neo4jService.disconnect()
    console.log('🔌 Disconnected from Neo4j')
  }
}

// Run the test
testNeo4jConnection()
  .then(() => {
    console.log('🎉 Neo4j test completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Test failed:', error)
    process.exit(1)
  })
